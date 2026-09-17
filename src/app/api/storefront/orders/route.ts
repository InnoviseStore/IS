import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantFeatures } from '@/lib/planLimits'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Rate Limiter en memoria para prevenir inundación de pedidos / DoS (10 pedidos cada 5 minutos por IP)
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 5 * 60 * 1000 // 5 minutos
  const maxRequests = 10

  const entry = ipRateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count += 1
  return true
}

// Sanitizador simple contra inyecciones XSS / HTML en nombres y notas
function sanitizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .replace(/[<>]/g, '') // Eliminar tags HTML
    .trim()
    .slice(0, 500) // Limitar longitud máxima para prevenir desbordamientos
}

export async function POST(req: Request) {
  try {
    // 1. Detección de IP y Control de Tasa (Rate Limiting)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown-ip'

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de pedido. Por favor espera unos minutos antes de volver a intentar.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const {
      tenantSlug: slugFromCamel,
      tenant_slug: slugFromSnake,
      customer,
      items,
      totalUsd,
      total_usd,
      totalVes,
      total_ves,
      exchangeRate,
      exchange_rate,
    } = body

    const tenantSlug = slugFromCamel || slugFromSnake

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Falta el identificador de la tienda (slug).' }, { status: 400 })
    }

    const customerFullName = customer?.fullName || customer?.full_name
    const customerPhone = customer?.phone
    const customerIdNumber = customer?.idNumber || customer?.id_number

    if (!customerFullName || !customerPhone) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos.' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito no contiene productos.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obtener tenant por slug
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, slug, phone_whatsapp, currency_rate_bcv, settings')
      .eq('slug', tenantSlug)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const tenantId = tenant.id
    const rate = Number(exchangeRate) || Number(exchange_rate) || Number(tenant.currency_rate_bcv) || 91.5
    const cleanFullName = sanitizeText(customerFullName)
    const cleanPhone = String(customerPhone).replace(/\D/g, '')
    const cleanIdNumber = customerIdNumber ? sanitizeText(customerIdNumber).toUpperCase() : null
    const cleanAddress = customer.address ? sanitizeText(customer.address) : null
    const cleanCustomerNotes = customer.notes ? sanitizeText(customer.notes) : ''
    const deliveryMethod = body.delivery_method || customer.deliveryMethod || customer.delivery_method || 'delivery_bqto'
    const shippingAgency = body.shipping_agency ? sanitizeText(body.shipping_agency) : (customer.shippingAgency ? sanitizeText(customer.shippingAgency) : null)
    const cleanAgencyAddress = body.agency_address ? sanitizeText(body.agency_address) : (customer.agencyAddress ? sanitizeText(customer.agencyAddress) : null)
    const rawCoords = body.delivery_coords || body.deliveryCoords || customer.delivery_coords || customer.deliveryCoords
    const deliveryCoords = rawCoords && typeof rawCoords.lat === 'number' && typeof rawCoords.lng === 'number'
      ? { lat: rawCoords.lat, lng: rawCoords.lng }
      : null

    const paymentMethod = body.payment_method ? sanitizeText(body.payment_method) : null
    const paymentReference = body.payment_reference ? sanitizeText(body.payment_reference) : null

    if (!cleanFullName || !cleanPhone) {
      return NextResponse.json({ error: 'Nombre y teléfono válidos son requeridos.' }, { status: 400 })
    }

    // 2. Buscar o crear cliente en la tabla customers (priorizando Cédula/RIF)
    let customerId: string | null = null
    let existingCustomer: any = null

    if (cleanIdNumber) {
      const { data: byId } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('id_number', cleanIdNumber)
        .limit(1)
        .maybeSingle()
      existingCustomer = byId
    }

    if (!existingCustomer && cleanPhone) {
      const { data: byPhone } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('phone', cleanPhone)
        .limit(1)
        .maybeSingle()
      existingCustomer = byPhone
    }

    if (existingCustomer) {
      customerId = existingCustomer.id
      // Actualizar datos si estaban vacíos (cédula o dirección)
      const updateFields: Record<string, any> = {}
      if (!existingCustomer.id_number && cleanIdNumber) updateFields.id_number = cleanIdNumber
      if (!existingCustomer.address && cleanAddress) updateFields.address = cleanAddress
      if (Object.keys(updateFields).length > 0) {
        await supabase.from('customers').update(updateFields).eq('id', customerId)
      }
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          full_name: cleanFullName,
          id_number: cleanIdNumber,
          phone: cleanPhone,
          address: cleanAddress,
          notes: cleanCustomerNotes ? `Pedido web: ${cleanCustomerNotes}` : 'Registrado desde Vitrina Web',
        })
        .select('id')
        .single()

      if (newCustomer) {
        customerId = newCustomer.id
      }
    }

    // 3. Generar número de orden seguro
    const now = new Date()
    const year = now.getFullYear()
    const randSeq = Math.floor(1000 + Math.random() * 9000)
    const orderNumber = `IS-${year}-${randSeq}`

    // Sumar subtotales de los items directamente como fallback infalible
    const computedItemsTotalUsd = items.reduce((acc: number, item: any) => {
      const price = Number(item.unit_price_usd) || 0
      const qty = parseInt(item.quantity, 10) || 1
      return acc + (price * qty)
    }, 0)

    const rawTotalUsd = totalUsd !== undefined ? totalUsd : total_usd
    const finalTotalUsd = (rawTotalUsd !== undefined && Number(rawTotalUsd) > 0)
      ? Number(rawTotalUsd)
      : computedItemsTotalUsd

    const rawTotalVes = totalVes !== undefined ? totalVes : total_ves
    const finalTotalVes = (rawTotalVes !== undefined && Number(rawTotalVes) > 0)
      ? Number(rawTotalVes)
      : (finalTotalUsd * rate)

    let deliverySummary = 'Entrega: Retiro en Sitio'
    if (deliveryMethod === 'delivery_bqto' || deliveryMethod === 'delivery_local') {
      deliverySummary = `Entrega: Delivery Local | Dirección: ${cleanAddress || 'No especificada'}${deliveryCoords ? ` | GPS: https://maps.google.com/?q=${deliveryCoords.lat},${deliveryCoords.lng}` : ''}`
    } else if (deliveryMethod === 'envio_nacional') {
      deliverySummary = `Entrega: Envío Nacional (Cobro Destino) | Agencia: ${shippingAgency || 'No especificada'} | Dirección Agencia: ${cleanAgencyAddress || 'No especificada'}`
    }

    const orderNotes = [
      `Cliente: ${cleanFullName}`,
      cleanIdNumber ? `CI/RIF: ${cleanIdNumber}` : null,
      `WhatsApp: ${cleanPhone}`,
      deliverySummary,
      paymentMethod ? `Método de Pago: ${paymentMethod.toUpperCase()}` : null,
      paymentReference ? `Ref: ${paymentReference}` : null,
      cleanCustomerNotes ? `Indicaciones: ${cleanCustomerNotes}` : null,
      paymentReference ? 'Origen: Catálogo Web (Pago Directo)' : 'Origen: Catálogo Web WhatsApp',
    ]
      .filter(Boolean)
      .join(' | ')

    // Preparar payment_breakdown si se proporcionó método de pago y referencia
    const paymentBreakdown = paymentMethod ? [
      {
        method: paymentMethod,
        amount_usd: finalTotalUsd,
        amount_ves: finalTotalVes,
        reference: paymentReference || undefined,
      }
    ] : []

    // 4. Crear orden con estado 'pending' o 'pending_review'
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        order_number: orderNumber,
        status: paymentReference ? 'pending' : 'pending',
        payment_condition: 'immediate',
        exchange_rate_at_sale: rate,
        subtotal_usd: finalTotalUsd,
        total_usd: finalTotalUsd,
        total_ves: finalTotalVes,
        payment_breakdown: paymentBreakdown,
        notes: orderNotes,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Error creating web order:', orderErr)
      throw new Error(orderErr?.message || 'No se pudo registrar la orden en la base de datos.')
    }

    // 5. Insertar order_items
    const orderItemsPayload = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id || item.id || null,
      tenant_id: tenantId,
      product_name: item.name || 'Producto',
      product_sku: item.sku || null,
      unit_price_usd: Number(item.unit_price_usd) || 0,
      quantity: parseInt(item.quantity, 10) || 1,
    }))

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsPayload)
    if (itemsErr) {
      console.warn('Warning inserting order_items for web order:', itemsErr.message)
    }

    // 6. Envío Automático de WhatsApp en Plan Enterprise
    let autoWhatsAppSent = false
    try {
      const features = getTenantFeatures(tenant)
      const tSettings = (tenant?.settings || {}) as Record<string, any>
      const waSettings = tSettings.whatsapp_automation || {}

      if (features.hasWhatsAppAutomation && waSettings.enabled && waSettings.auto_send_web_order) {
        autoWhatsAppSent = true
        const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`

        const sendPromises: Promise<any>[] = []

        // Mensaje al Cliente
        if (cleanPhone) {
          const clientMsg = [
            `🛒 *¡PEDIDO RECIBIDO CON ÉXITO!*`,
            `🏪 *${tenant.name}*`,
            `🔖 *Orden:* #${order.order_number}`,
            `👤 *Cliente:* ${cleanFullName}`,
            ``,
            `📦 *Resumen:*`,
            `• Cantidad de Productos: ${items.length}`,
            `💰 *Total:* $${finalTotalUsd.toFixed(2)} USD (Bs. ${finalTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
            `📈 *Tasa BCV:* Bs. ${rate.toFixed(2)}/USD`,
            deliverySummary ? `📍 ${deliverySummary}` : '',
            paymentReference ? `🔢 Referencia de Pago: ${paymentReference}` : '',
            ``,
            `Estamos verificando tu solicitud para preparar tu despacho. ¡Muchas gracias por tu compra!`,
          ].filter(Boolean).join('\n')

          sendPromises.push(
            sendWhatsAppTextMessage(instanceName, cleanPhone, clientMsg).catch((e) =>
              console.error('[Auto-WhatsApp Web Order Client]', e)
            )
          )
        }

        // Alerta al Dueño de la Tienda
        if (tenant.phone_whatsapp) {
          const adminAlert = [
            `🔔 *¡NUEVO PEDIDO EN CATÁLOGO WEB!*`,
            `🏪 *${tenant.name}*`,
            `🔖 *Orden:* #${order.order_number}`,
            `👤 *Cliente:* ${cleanFullName} (${cleanPhone || 'Sin teléfono'})`,
            `💰 *Monto:* $${finalTotalUsd.toFixed(2)} USD (Bs. ${finalTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
            paymentMethod ? `💳 Método: ${paymentMethod.toUpperCase()}` : '',
            paymentReference ? `🔢 Ref: ${paymentReference}` : '',
            `\nRevisa el panel de pedidos para procesarlo.`
          ].filter(Boolean).join('\n')

          sendPromises.push(
            sendWhatsAppTextMessage(instanceName, tenant.phone_whatsapp, adminAlert).catch((e) =>
              console.error('[Auto-WhatsApp Web Order Admin Alert]', e)
            )
          )
        }

        // Esperar el despacho para asegurar que la función serverless de Netlify complete la llamada antes de terminar
        if (sendPromises.length > 0) {
          await Promise.allSettled(sendPromises)
        }
      }
    } catch (waErr) {
      console.warn('[Auto-WhatsApp] Error sending web order notification:', waErr)
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      total_usd: finalTotalUsd,
      total_ves: finalTotalVes,
      auto_whatsapp_sent: autoWhatsAppSent,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar pedido web.'
    console.error('Storefront order error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

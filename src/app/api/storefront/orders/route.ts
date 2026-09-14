import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      tenantSlug,
      customer,
      items,
      totalUsd,
      totalVes,
      exchangeRate,
    } = body

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Falta el identificador de la tienda (slug).' }, { status: 400 })
    }

    if (!customer?.fullName || !customer?.phone) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos.' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito no contiene productos.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obtener tenant por slug
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, currency_rate_bcv')
      .eq('slug', tenantSlug)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const tenantId = tenant.id
    const rate = Number(exchangeRate) || Number(tenant.currency_rate_bcv) || 91.5
    const cleanFullName = sanitizeText(customer.fullName)
    const cleanPhone = customer.phone.replace(/\D/g, '')
    const cleanIdNumber = customer.idNumber ? sanitizeText(customer.idNumber).toUpperCase() : null
    const cleanAddress = customer.address ? sanitizeText(customer.address) : null
    const cleanCustomerNotes = customer.notes ? sanitizeText(customer.notes) : ''

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

    const finalTotalUsd = Number(totalUsd) || 0
    const finalTotalVes = Number(totalVes) || finalTotalUsd * rate

    const orderNotes = [
      `Cliente: ${cleanFullName}`,
      cleanIdNumber ? `CI/RIF: ${cleanIdNumber}` : null,
      `WhatsApp: ${cleanPhone}`,
      cleanAddress ? `Dirección: ${cleanAddress}` : null,
      cleanCustomerNotes ? `Indicaciones: ${cleanCustomerNotes}` : null,
      'Origen: Catálogo Web WhatsApp',
    ]
      .filter(Boolean)
      .join(' | ')

    // 4. Crear orden con estado 'pending' (sin descontar stock todavía)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        order_number: orderNumber,
        status: 'pending',
        payment_condition: 'immediate',
        exchange_rate_at_sale: rate,
        subtotal_usd: finalTotalUsd,
        total_usd: finalTotalUsd,
        total_ves: finalTotalVes,
        payment_breakdown: [],
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

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      total_usd: finalTotalUsd,
      total_ves: finalTotalVes,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar pedido web.'
    console.error('Storefront order error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

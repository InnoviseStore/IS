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

export async function POST(req: Request) {
  try {
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
    const cleanPhone = customer.phone.replace(/\D/g, '')

    // 2. Buscar o crear cliente en la tabla customers
    let customerId: string | null = null
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${cleanPhone},phone.eq.${customer.phone}`)
      .limit(1)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          full_name: customer.fullName.trim(),
          phone: customer.phone.trim(),
          notes: customer.notes ? `Pedido web: ${customer.notes.trim()}` : 'Registrado desde Vitrina Web',
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
      `Cliente: ${customer.fullName.trim()}`,
      `WhatsApp: ${customer.phone.trim()}`,
      customer.notes?.trim() ? `Indicaciones: ${customer.notes.trim()}` : null,
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

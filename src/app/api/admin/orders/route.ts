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
      tenant_id,
      customer_id,
      status,
      payment_condition,
      exchange_rate_at_sale,
      subtotal_usd,
      total_usd,
      total_ves,
      payment_breakdown,
      items,
      created_by,
      isCredit,
      customer,
    } = body

    if (!tenant_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos requeridos en la venta.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Generar order_number seguro por si el trigger en Postgres no tiene permisos de secuencia
    const now = new Date()
    const year = now.getFullYear()
    const randSeq = Math.floor(1000 + Math.random() * 9000)
    const fallbackOrderNumber = `IS-${year}-${randSeq}`

    const orderPayload = {
      tenant_id,
      customer_id: customer_id || null,
      order_number: fallbackOrderNumber,
      status: status || 'completed',
      payment_condition: payment_condition || 'immediate',
      exchange_rate_at_sale: Number(exchange_rate_at_sale) || 91.5,
      subtotal_usd: Number(subtotal_usd) || 0,
      total_usd: Number(total_usd) || 0,
      total_ves: Number(total_ves) || 0,
      payment_breakdown: payment_breakdown || [],
      created_by: created_by || null,
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderError || !order) {
      throw new Error(orderError?.message || 'Error al crear la orden de venta.')
    }

    // 2. Insertar los items (sin subtotal_usd porque es GENERATED ALWAYS AS)
    const orderItemsPayload = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      tenant_id,
      product_name: item.name || item.product_name,
      product_sku: item.sku || item.product_sku || null,
      unit_price_usd: Number(item.unit_price_usd) || 0,
      quantity: parseInt(item.quantity, 10) || 1,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload)
    if (itemsError) {
      console.warn('Error inserting order items:', itemsError.message)
    }

    // 3. Decrementar stock y registrar en inventario
    for (const item of items) {
      if (item.product_id) {
        try {
          await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: parseInt(item.quantity, 10) || 1,
          })
        } catch (e) {
          console.warn('decrement_stock error:', e)
        }

        try {
          await supabase.from('inventory_logs').insert({
            tenant_id,
            product_id: item.product_id,
            change_type: 'sale',
            quantity: -(parseInt(item.quantity, 10) || 1),
            reference_id: order.id,
            created_by: created_by || null,
          })
        } catch (e) {
          console.warn('inventory_logs error:', e)
        }
      }
    }

    // 4. Actualizar deuda de cliente si fue venta a crédito
    if (isCredit && customer_id && customer) {
      try {
        await supabase
          .from('customers')
          .update({
            current_debt_usd: (Number(customer.current_debt_usd) || 0) + Number(total_usd),
          })
          .eq('id', customer_id)
      } catch (e) {
        console.warn('customer debt update error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar la venta.'
    console.error('Error in /api/admin/orders:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

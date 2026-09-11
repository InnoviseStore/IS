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
      due_date: payment_condition === 'credit_7d' ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
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
    if (isCredit && customer_id) {
      try {
        const debtToAdd = Number(body.credit_amount_usd ?? total_usd) || 0
        const { data: custData } = await supabase
          .from('customers')
          .select('current_debt_usd')
          .eq('id', customer_id)
          .single()

        const currentDebt = Number(custData?.current_debt_usd) || 0
        await supabase
          .from('customers')
          .update({
            current_debt_usd: currentDebt + debtToAdd,
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

// DELETE: Anular y eliminar orden con clave de seguridad de administrador
export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { order_id, admin_key } = body

    if (!order_id) {
      return NextResponse.json({ error: 'ID de la orden es requerido' }, { status: 400 })
    }

    // Validación estricta de clave de seguridad admin
    if (admin_key !== '997603710921') {
      return NextResponse.json({ error: 'Clave de seguridad de administrador incorrecta.' }, { status: 403 })
    }

    const supabase = getAdminClient()

    // 1. Obtener la orden con sus items asociados
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'No se encontró la orden solicitada.' }, { status: 404 })
    }

    // 2. Restaurar stock de cada producto involucrado
    if (Array.isArray(order.order_items)) {
      for (const item of order.order_items) {
        if (item.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single()

          if (prod) {
            const restoredStock = (prod.stock || 0) + (item.quantity || 0)
            await supabase
              .from('products')
              .update({ stock: restoredStock })
              .eq('id', item.product_id)

            await supabase.from('inventory_logs').insert({
              tenant_id: order.tenant_id,
              product_id: item.product_id,
              change_type: 'adjustment',
              quantity: item.quantity,
              previous_stock: prod.stock,
              new_stock: restoredStock,
              reference_id: order.id,
              notes: `Anulación de orden ${order.order_number} por administrador`,
            })
          }
        }
      }
    }

    // 3. Revertir deuda del cliente si la orden tuvo crédito
    if (order.customer_id) {
      const creditRow = Array.isArray(order.payment_breakdown)
        ? order.payment_breakdown.find((p: any) => p.method === 'credit_7d')
        : null
      const debtToDeduct = creditRow
        ? Number(creditRow.amount_usd)
        : (order.payment_condition === 'credit_7d' ? Number(order.total_usd) : 0)

      if (debtToDeduct > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('current_debt_usd')
          .eq('id', order.customer_id)
          .single()

        if (cust) {
          const newDebt = Math.max(0, (Number(cust.current_debt_usd) || 0) - debtToDeduct)
          await supabase
            .from('customers')
            .update({ current_debt_usd: newDebt })
            .eq('id', order.customer_id)
        }
      }
    }

    // 4. Eliminar order_items y luego orders
    await supabase.from('order_items').delete().eq('order_id', order_id)
    const { error: delErr } = await supabase.from('orders').delete().eq('id', order_id)

    if (delErr) {
      throw new Error(delErr.message)
    }

    return NextResponse.json({
      success: true,
      message: `Venta ${order.order_number} eliminada correctamente. El inventario y la deuda fueron restablecidos.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar la orden.'
    console.error('Error in DELETE /api/admin/orders:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

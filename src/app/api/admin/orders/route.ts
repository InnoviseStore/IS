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

// GET: Obtener órdenes para el tenant
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '80', 10)

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    let query = supabase
      .from('orders')
      .select('*, customer:customers(*), order_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ orders: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener órdenes.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Registrar una nueva venta o completar una orden pendiente existente desde el POS
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
      existing_order_id,
    } = body

    if (!tenant_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos requeridos en la venta.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    let order: any = null

    if (existing_order_id) {
      // 1A. Si viene de una orden pendiente web, la actualizamos a 'completed'
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          customer_id: customer_id || null,
          status: status || 'completed',
          payment_condition: payment_condition || 'immediate',
          exchange_rate_at_sale: Number(exchange_rate_at_sale) || 91.5,
          subtotal_usd: Number(subtotal_usd) || 0,
          total_usd: Number(total_usd) || 0,
          total_ves: Number(total_ves) || 0,
          payment_breakdown: payment_breakdown || [],
          due_date: payment_condition === 'credit_7d' ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
          created_by: created_by || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing_order_id)
        .select()
        .single()

      if (updateError || !updatedOrder) {
        throw new Error(updateError?.message || 'Error al actualizar orden existente.')
      }
      order = updatedOrder

      // Reemplazar o asegurar items actualizados
      await supabase.from('order_items').delete().eq('order_id', order.id)
      const orderItemsPayload = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id || null,
        tenant_id,
        product_name: item.name || item.product_name,
        product_sku: item.sku || item.product_sku || null,
        unit_price_usd: Number(item.unit_price_usd) || 0,
        quantity: parseInt(item.quantity, 10) || 1,
      }))
      await supabase.from('order_items').insert(orderItemsPayload)
    } else {
      // 1B. Generar order_number seguro para nueva venta POS directa
      const now = new Date()
      const year = now.getFullYear()
      const randSeq = Math.floor(1000 + Math.random() * 9000)
      const fallbackOrderNumber = 'IS-' + year + '-' + randSeq

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

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single()

      if (orderError || !newOrder) {
        throw new Error(orderError?.message || 'Error al crear la orden de venta.')
      }
      order = newOrder

      const orderItemsPayload = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id || null,
        tenant_id,
        product_name: item.name || item.product_name,
        product_sku: item.sku || item.product_sku || null,
        unit_price_usd: Number(item.unit_price_usd) || 0,
        quantity: parseInt(item.quantity, 10) || 1,
      }))
      await supabase.from('order_items').insert(orderItemsPayload)
    }

    // 2. Decrementar stock y registrar en inventario
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

    // 3. Actualizar deuda si fue a crédito
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
          .update({ current_debt_usd: currentDebt + debtToAdd })
          .eq('id', customer_id)
      } catch (e) {
        console.warn('customer debt update error:', e)
      }
    }

    return NextResponse.json({ success: true, order })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar la venta.'
    console.error('Error in /api/admin/orders:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH: Actualizar estado de orden (ej. anular)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { order_id, status, notes } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id es requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (status) updatePayload.status = status
    if (notes !== undefined) updatePayload.notes = notes

    const { data: order, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order_id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, order })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar orden.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Eliminar o anular orden
export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { order_id, admin_key } = body

    if (!order_id) {
      return NextResponse.json({ error: 'ID de la orden es requerido' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'No se encontró la orden solicitada.' }, { status: 404 })
    }

    const isPending = order.status === 'pending' || order.status === 'cancelled'
    if (!isPending && admin_key !== '997603710921') {
      return NextResponse.json({ error: 'Clave de seguridad de administrador requerida para anular ventas completadas.' }, { status: 403 })
    }

    if (order.status === 'completed' && Array.isArray(order.order_items)) {
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
              notes: 'Anulación de orden ' + order.order_number + ' por administrador',
            })
          }
        }
      }
    }

    if (order.status === 'completed' && order.customer_id) {
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

    await supabase.from('order_items').delete().eq('order_id', order_id)
    const { error: delErr } = await supabase.from('orders').delete().eq('id', order_id)
    if (delErr) throw new Error(delErr.message)

    return NextResponse.json({
      success: true,
      message: 'Orden ' + order.order_number + ' eliminada correctamente.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar la orden.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
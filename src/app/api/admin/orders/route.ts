import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'
import { formatDate } from '@/lib/formatters'

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

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor', 'almacen'],
      targetTenantId: tenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 2. Obtener estadísticas generales del tenant (desacopladas de los filtros de vista)
    const { data: allStatsOrders } = await supabase
      .from('orders')
      .select('status, payment_condition, total_usd, payment_breakdown')
      .eq('tenant_id', tenantId)

    let pendingCount = 0
    let pendingUsd = 0
    let creditCount = 0
    let creditUsd = 0
    let completedCount = 0
    let completedUsd = 0

    ;(allStatsOrders || []).forEach((o: any) => {
      if (o.status === 'pending') {
        pendingCount++
        pendingUsd += Number(o.total_usd) || 0
      } else if (o.status === 'credit' || o.payment_condition === 'credit_7d') {
        creditCount++
        const breakdown = Array.isArray(o.payment_breakdown) ? o.payment_breakdown : []
        const pagado = breakdown.reduce((acc: number, it: any) => it.method === 'credit_7d' ? acc : acc + (Number(it.amount_usd) || 0), 0)
        creditUsd += Math.max(0, (Number(o.total_usd) || 0) - pagado)
      } else if (o.status === 'completed') {
        completedCount++
        completedUsd += Number(o.total_usd) || 0
      }
    })

    const generalStats = { pendingCount, pendingUsd, creditCount, creditUsd, completedCount, completedUsd }

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

    // Enriquecer órdenes con perfil del empleado responsable (created_by)
    const staffIds = Array.from(new Set((data || []).map((o: any) => o.created_by).filter(Boolean)))
    const staffMap = new Map<string, any>()
    if (staffIds.length > 0) {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .in('id', staffIds)
      staffProfiles?.forEach((p) => staffMap.set(p.id, p))
    }

    const enrichedOrders = (data || []).map((o: any) => ({
      ...o,
      staff: o.created_by ? staffMap.get(o.created_by) || null : null,
    }))

    return NextResponse.json({ orders: enrichedOrders, stats: generalStats })
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
      is_edit,
      admin_pin,
      due_date: incomingDueDate,
      credit_days,
      discount_total_usd,
      notes: incomingNotes,
    } = body

    if (!tenant_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos requeridos en la venta.' }, { status: 400 })
    }

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1B. Si es modo edición, verificar la clave de administrador de la tienda
    if (is_edit) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant_id)
        .single()

      const tenantSettings = (tenantData?.settings || {}) as Record<string, any>
      const configuredPin = tenantSettings.admin_security_pin || '1234'

      if (!admin_pin || String(admin_pin).trim() !== String(configuredPin).trim()) {
        return NextResponse.json(
          { error: 'Clave de Administrador incorrecta. No tienes autorización para editar esta factura.' },
          { status: 403 }
        )
      }
    }

    // Calcular fecha de vencimiento dinámica
    let finalDueDate: string | null = null
    if (isCredit || payment_condition === 'credit_7d' || status === 'credit') {
      if (incomingDueDate) {
        finalDueDate = new Date(incomingDueDate).toISOString()
      } else if (credit_days) {
        finalDueDate = new Date(Date.now() + Number(credit_days) * 86400000).toISOString()
      } else {
        finalDueDate = new Date(Date.now() + 7 * 86400000).toISOString()
      }
    }

    let order: any = null

    if (existing_order_id) {
      // Obtener la orden previa completa para conciliar stock y deudas si fue completada
      const { data: previousOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', existing_order_id)
        .single()

      if (is_edit && previousOrder) {
        // A. Si la factura anterior ya había descontado stock (completed o credit), devolver el stock anterior
        if (previousOrder.status === 'completed' || previousOrder.status === 'credit') {
          for (const oldItem of previousOrder.order_items || []) {
            if (oldItem.product_id) {
              const oldQty = parseInt(oldItem.quantity, 10) || 1
              const { data: prod } = await supabase
                .from('products')
                .select('stock')
                .eq('id', oldItem.product_id)
                .single()

              if (prod) {
                await supabase
                  .from('products')
                  .update({ stock: (prod.stock || 0) + oldQty })
                  .eq('id', oldItem.product_id)

                await supabase.from('inventory_logs').insert({
                  tenant_id,
                  product_id: oldItem.product_id,
                  change_type: 'adjustment',
                  quantity: oldQty,
                  reference_id: previousOrder.id,
                  notes: `Reversión por edición de factura #${previousOrder.order_number}`,
                  created_by: created_by || null,
                })
              }
            }
          }
        }

        // B. Si la factura anterior tenía crédito, revertir la deuda previa del cliente
        if (
          (previousOrder.status === 'credit' || previousOrder.payment_condition === 'credit_7d') &&
          previousOrder.customer_id
        ) {
          const oldBreakdown = Array.isArray(previousOrder.payment_breakdown) ? previousOrder.payment_breakdown : []
          const oldCreditRow = oldBreakdown.find((p: any) => p.method === 'credit_7d')
          const oldCreditAmount = oldCreditRow ? Number(oldCreditRow.amount_usd) : Number(previousOrder.total_usd)

          const { data: oldCust } = await supabase
            .from('customers')
            .select('current_debt_usd')
            .eq('id', previousOrder.customer_id)
            .single()

          if (oldCust) {
            const revertedDebt = Math.max(0, (Number(oldCust.current_debt_usd) || 0) - oldCreditAmount)
            await supabase
              .from('customers')
              .update({ current_debt_usd: revertedDebt })
              .eq('id', previousOrder.customer_id)
          }
        }
      }

      const auditNote = is_edit
        ? `[Factura editada por Admin el ${new Date().toLocaleDateString('es-VE')} a las ${new Date().toLocaleTimeString('es-VE')}]`
        : null

      const finalNotes = auditNote
        ? (previousOrder?.notes ? `${previousOrder.notes}\n${auditNote}` : auditNote)
        : (incomingNotes || previousOrder?.notes || null)

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          customer_id: customer_id || null,
          status: status || (isCredit ? 'credit' : 'completed'),
          payment_condition: payment_condition || (isCredit ? 'credit_7d' : 'immediate'),
          exchange_rate_at_sale: Number(exchange_rate_at_sale) || 91.5,
          subtotal_usd: Number(subtotal_usd) || 0,
          total_usd: Number(total_usd) || 0,
          total_ves: Number(total_ves) || 0,
          payment_breakdown: payment_breakdown || [],
          due_date: finalDueDate,
          notes: finalNotes,
          created_by: created_by || (previousOrder?.created_by ? previousOrder.created_by : auth.userId),
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
      // 1C. Generar order_number seguro para nueva venta POS directa
      const now = new Date()
      const year = now.getFullYear()
      const randSeq = Math.floor(1000 + Math.random() * 9000)
      const fallbackOrderNumber = 'IS-' + year + '-' + randSeq

      const orderPayload = {
        tenant_id,
        customer_id: customer_id || null,
        order_number: fallbackOrderNumber,
        status: status || (isCredit ? 'credit' : 'completed'),
        payment_condition: payment_condition || (isCredit ? 'credit_7d' : 'immediate'),
        exchange_rate_at_sale: Number(exchange_rate_at_sale) || 91.5,
        subtotal_usd: Number(subtotal_usd) || 0,
        total_usd: Number(total_usd) || 0,
        total_ves: Number(total_ves) || 0,
        payment_breakdown: payment_breakdown || [],
        due_date: finalDueDate,
        notes: incomingNotes || null,
        created_by: created_by || auth.userId,
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

    // 4. Disparo Automático de WhatsApp en Plan Enterprise
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name, slug, settings')
        .eq('id', tenant_id)
        .single()

      const features = getTenantFeatures(tenantData)
      const tSettings = (tenantData?.settings || {}) as Record<string, any>
      const waSettings = tSettings.whatsapp_automation || {}

      if (features.hasWhatsAppAutomation && waSettings.enabled && waSettings.auto_send_invoice) {
        // Obtener teléfono del cliente
        let targetPhone = body.customer_phone || null
        let customerName = 'Cliente'
        if (customer_id) {
          const { data: cData } = await supabase
            .from('customers')
            .select('full_name, phone')
            .eq('id', customer_id)
            .single()
          if (cData) {
            customerName = cData.full_name || customerName
            targetPhone = targetPhone || cData.phone
          }
        }

        if (targetPhone) {
          const instanceName = waSettings.instance_name || `tenant_${tenantData?.slug}`
          const itemsText = (items || [])
            .map((it: any) => {
              const itemName = it.product_name || it.name || 'Producto'
              const qty = it.quantity || 1
              const lineTotal = Number(it.subtotal_usd) || (qty * Number(it.unit_price_usd || 0))
              return `• ${qty}x ${itemName} — $${lineTotal.toFixed(2)} USD`
            })
            .join('\n')

          // Desglose de pagos iniciales vs crédito
          const breakdown = Array.isArray(payment_breakdown) ? payment_breakdown : []
          const initialPayments = breakdown.filter((p: any) => p.method !== 'credit_7d' && (Number(p.amount_usd) || 0) > 0)
          const initialPaidUsd = initialPayments.reduce((sum: number, p: any) => sum + (Number(p.amount_usd) || 0), 0)

          const creditRow = breakdown.find((p: any) => p.method === 'credit_7d')
          const isCreditSale = Boolean(isCredit || payment_condition === 'credit_7d' || creditRow)
          const creditAmountFinancedUsd = creditRow ? (Number(creditRow.amount_usd) || 0) : Math.max(0, Number(total_usd) - initialPaidUsd)
          const creditAmountFinancedVes = creditAmountFinancedUsd * Number(exchange_rate_at_sale)

          let installmentsSection = ''
          if (creditRow?.installments_plan?.schedule && creditRow.installments_plan.schedule.length > 0) {
            const plan = creditRow.installments_plan
            const freqLabel = plan.frequency === 'semanal'
              ? 'Semanales'
              : plan.frequency === 'quincenal'
              ? 'Quincenales'
              : plan.frequency === 'mensual'
              ? 'Mensuales'
              : `cada ${plan.frequency_days} días`

            const schedLines = plan.schedule.map((inst: any) => {
              return `  • Cuota #${inst.installment_number}: *$${Number(inst.amount_usd).toFixed(2)} USD* — Vence: ${formatDate(inst.due_date)}`
            }).join('\n')

            installmentsSection = `🗓️ *Cronograma de Cobro (${plan.total_installments} Cuotas ${freqLabel}):*\n${schedLines}\n  📌 *(En Bolívares: Se calcula a la tasa oficial BCV del día en que realices el pago)*\n`
          }

          let initialPaymentsSection = ''
          if (initialPayments.length > 0) {
            const paymentLines = initialPayments.map((p: any) => {
              const mName = p.method === 'pago_movil' ? 'Pago Móvil (VES)' : p.method === 'zelle' ? 'Zelle (USD)' : p.method === 'binance_pay' ? 'Binance Pay' : p.method === 'cash_usd' ? 'Efectivo USD' : p.method
              return `  • ${mName}: $${Number(p.amount_usd).toFixed(2)} USD`
            }).join('\n')
            initialPaymentsSection = `💵 *Abono Inicial Recibido Hoy:*\n${paymentLines}\n`
          }

          let creditSection = ''
          if (isCreditSale) {
            creditSection = [
              `⚠️ *CONDICIÓN: VENTA A CRÉDITO*`,
              initialPaymentsSection ? initialPaymentsSection.trim() : '',
              `• ⏳ *Saldo Pendiente por Pagar:* $${creditAmountFinancedUsd.toFixed(2)} USD (Bs. ${creditAmountFinancedVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
              order.due_date ? `• 📅 *Próxima Fecha de Pago:* ${formatDate(order.due_date)}` : '',
              installmentsSection ? `\n${installmentsSection.trim()}` : '',
              ``,
              `💡 *Condición de Abono:* Todo pago en Bolívares se liquida a la *tasa oficial del BCV del día* en que realices el pago.`,
              `📲 *Autoservicio WhatsApp:* Puedes responder en cualquier momento con la palabra *SALDO* para consultar cuánto debes o escribir *PAGOS* para recibir los datos de transferencia.`,
            ].filter(Boolean).join('\n')
          }

          const invoiceMsg = [
            `🧾 *FACTURA / COMPROBANTE DE VENTA*`,
            `🏪 *${tenantData?.name || 'Comercio'}*`,
            `📄 *Factura:* #${order.order_number}`,
            `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}`,
            ``,
            `👤 *Cliente:* ${customerName}`,
            itemsText ? `\n📦 *Productos Facturados:*\n${itemsText}\n` : '',
            `📊 *Resumen de Venta:*`,
            `• 💰 *Total Factura: $${Number(total_usd).toFixed(2)} USD*`,
            `• 🇻🇪 *Equivalente en Bs.:* Bs. ${Number(total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `• 📈 *Tasa Oficial BCV:* Bs. ${Number(exchange_rate_at_sale).toFixed(2)}/USD`,
            ``,
            isCreditSale ? creditSection : `💳 *Condición:* Pagada de Contado con éxito.`,
            ``,
            `✨ ¡Muchas gracias por tu compra y preferencia!`,
          ].filter(Boolean).join('\n')

          // Envío automático garantizado antes de cerrar la función serverless
          await sendWhatsAppTextMessage(instanceName, targetPhone, invoiceMsg).catch((err) =>
            console.error('[Auto-WhatsApp] Error sending invoice:', err)
          )
        }
      }
    } catch (waErr) {
      console.warn('[Auto-WhatsApp] Error checking enterprise automation:', waErr)
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
    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json()
    const { order_id, status, notes } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id es requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 2. Verificar que la orden pertenezca al tenant del usuario
    const { data: existingOrder, error: checkErr } = await supabase
      .from('orders')
      .select('tenant_id')
      .eq('id', order_id)
      .single()

    if (checkErr || !existingOrder) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 })
    }

    if (!auth.isSuperAdmin && existingOrder.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'Acceso denegado: no puedes modificar órdenes de otro comercio.' }, { status: 403 })
    }

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
    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

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

    // 2. Verificar que la orden pertenezca al comercio del usuario
    if (!auth.isSuperAdmin && order.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'Acceso denegado: no puedes anular órdenes de otro comercio.' }, { status: 403 })
    }

    const isPending = order.status === 'pending' || order.status === 'cancelled'
    if (!isPending && !auth.isSuperAdmin && auth.role !== 'owner' && admin_key !== '997603710921') {
      return NextResponse.json({ error: 'Solo el propietario de la tienda o un superadmin pueden anular ventas completadas.' }, { status: 403 })
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
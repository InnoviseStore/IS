import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'
import { checkIdempotency, recordIdempotency } from '@/lib/security/idempotency'
import { sanitizeForLogging } from '@/lib/security/dataMasking'

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
    let {
      tenant_id,
      order_id,
      customer_id,
      payment_method,
      method,
      amount_usd,
      amount_ves,
      exchange_rate,
      reference,
      notes,
      payment_date,
    } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id es requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Si tenant_id no vino en el body, resolverlo automáticamente desde la orden
    if (!tenant_id) {
      const { data: orderLookup } = await supabase
        .from('orders')
        .select('tenant_id')
        .eq('id', order_id)
        .maybeSingle()

      if (orderLookup?.tenant_id) {
        tenant_id = orderLookup.tenant_id
      }
    }

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id y order_id son requeridos.' }, { status: 400 })
    }

    const appliedMethod = payment_method || method || 'pago_movil'

    const numericAmountUsd = Number(amount_usd) || 0
    if (numericAmountUsd <= 0) {
      return NextResponse.json({ error: 'El monto del abono debe ser mayor a 0.' }, { status: 400 })
    }

    // Prevención de doble gasto y condiciones de carrera (Idempotency)
    const idempotencyKey = req.headers.get('Idempotency-Key') || req.headers.get('X-Idempotency-Key') || body.idempotency_key
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey, tenant_id)
      if (cached.exists) {
        return NextResponse.json(cached.payload, { status: cached.statusCode || 200 })
      }
    }

    // 1. Validar autenticacion
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    // 2. Obtener la orden existente
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, customer:customers(*)')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 })
    }

    const currentPayments = Array.isArray(order.payment_breakdown) ? [...order.payment_breakdown] : []
    
    // Calcular cuanto se ha pagado en abonos reales (excluyendo la etiqueta credit_7d)
    const previousPaidUsd = currentPayments.reduce((acc: number, p: any) => {
      if (p.method !== 'credit_7d') {
        return acc + (Number(p.amount_usd) || 0)
      }
      return acc
    }, 0)

    const totalOrderUsd = Number(order.total_usd) || 0
    const newTotalPaidUsd = previousPaidUsd + numericAmountUsd
    const remainingUsd = Math.max(0, totalOrderUsd - newTotalPaidUsd)
    const isFullyPaid = remainingUsd < 0.01

    // 3. Crear nuevo registro de abono
    const nowIso = new Date().toISOString()
    const entryDateIso = payment_date
      ? new Date(payment_date + 'T12:00:00').toISOString()
      : nowIso

    const newPaymentEntry = {
      id: 'abono_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      method: appliedMethod,
      amount_usd: numericAmountUsd,
      amount_ves: Number(amount_ves) || numericAmountUsd * (Number(exchange_rate) || 91.5),
      reference: reference ? String(reference).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      exchange_rate_applied: Number(exchange_rate) || 91.5,
      date: entryDateIso,
      is_abono: true,
    }

    // Actualizar breakdown: conservar pagos previos, anadir nuevo abono
    const updatedBreakdown = [...currentPayments, newPaymentEntry]

    // Si la orden tenia 'credit_7d' como fila, actualizar su monto o removerla si ya se pago completa
    const creditRowIndex = updatedBreakdown.findIndex((p: any) => p.method === 'credit_7d')
    if (creditRowIndex > -1) {
      if (isFullyPaid) {
        updatedBreakdown.splice(creditRowIndex, 1)
      } else {
        updatedBreakdown[creditRowIndex] = {
          ...updatedBreakdown[creditRowIndex],
          amount_usd: remainingUsd,
          amount_ves: remainingUsd * (Number(exchange_rate) || 91.5),
        }
      }
    }

    // 4. Actualizar orden
    const updateOrderPayload: Record<string, any> = {
      payment_breakdown: updatedBreakdown,
      updated_at: nowIso,
    }

    if (isFullyPaid) {
      updateOrderPayload.status = 'completed'
    }

    const dateStr = payment_date
      ? new Date(payment_date + 'T12:00:00').toLocaleDateString('es-VE')
      : new Date().toLocaleDateString('es-VE')
    const refText = reference ? ' Ref: ' + reference : ''
    const abonoLog = '[Abono ' + dateStr + ': $' + numericAmountUsd.toFixed(2) + ' USD via ' + (appliedMethod || 'Pago') + refText + ' | Tasa BCV aplicada: Bs. ' + (Number(exchange_rate) || 91.5) + ']'
    updateOrderPayload.notes = order.notes ? order.notes + ' | ' + abonoLog : abonoLog

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateOrderPayload)
      .eq('id', order_id)
      .select('*, customer:customers(*)')
      .single()

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    // 5. Descontar deuda del cliente si esta registrado
    const effectiveCustomerId = customer_id || order.customer_id
    let updatedCustomerDebt = 0

    if (effectiveCustomerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('full_name, phone, current_debt_usd')
        .eq('id', effectiveCustomerId)
        .single()

      if (cust) {
        const currentDebt = Number(cust.current_debt_usd) || 0
        updatedCustomerDebt = Math.max(0, currentDebt - numericAmountUsd)
        await supabase
          .from('customers')
          .update({ current_debt_usd: updatedCustomerDebt })
          .eq('id', effectiveCustomerId)

        // 6. Envío automático por WhatsApp en Plan Enterprise
        try {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('name, slug, settings')
            .eq('id', tenant_id)
            .single()

          const features = getTenantFeatures(tenantData)
          const tSettings = (tenantData?.settings || {}) as Record<string, any>
          const waSettings = tSettings.whatsapp_automation || {}

          if (features.hasWhatsAppAutomation && waSettings.enabled && waSettings.auto_send_abono && cust.phone) {
            const instanceName = waSettings.instance_name || `tenant_${tenantData?.slug}`
            const abonoMsg = [
              `🧾 *COMPROBANTE DE ABONO RECIBIDO*`,
              `🏪 *${tenantData?.name || 'Comercio'}*`,
              `📄 *Factura:* #${order.order_number}`,
              `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}`,
              ``,
              `👤 *Cliente:* ${cust.full_name}`,
              `💵 *Monto Abonado:* $${numericAmountUsd.toFixed(2)} USD`,
              `🇻🇪 *Equivalente en Bs.:* Bs. ${(Number(amount_ves) || numericAmountUsd * (Number(exchange_rate) || 1)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `📈 *Tasa BCV del día:* Bs. ${Number(exchange_rate || 1).toFixed(2)}/USD`,
              `💳 *Método:* ${payment_method || 'Abono'}`,
              reference ? `🔢 *Referencia:* ${reference}` : '',
              ``,
              isFullyPaid
                ? `🎉 *¡FACTURA TOTALMENTE PAGADA!* Saldo restante: $0.00 USD`
                : `⚠️ *Nuevo Saldo Restante:* $${remainingUsd.toFixed(2)} USD (Bs. ${(remainingUsd * (Number(exchange_rate) || 1)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
              ``,
              `¡Muchas gracias por tu pago y preferencia!`,
            ].filter(Boolean).join('\n')

            await sendWhatsAppTextMessage(instanceName, cust.phone, abonoMsg).catch((err) =>
              console.error('[Auto-WhatsApp] Error sending abono receipt:', err)
            )
          }
        } catch (waErr) {
          console.warn('[Auto-WhatsApp] Error sending abono receipt:', waErr)
        }
      }
    }

    // 7. Registrar log inmutable de auditoría financiera
    try {
      await supabase.from('financial_audit_logs').insert({
        tenant_id,
        event_type: 'abono_created',
        order_id,
        customer_id: effectiveCustomerId || null,
        amount_usd: numericAmountUsd,
        amount_ves: Number(amount_ves) || numericAmountUsd * (Number(exchange_rate) || 1),
        exchange_rate_applied: Number(exchange_rate) || 1,
        previous_balance_usd: (previousPaidUsd > 0 ? (totalOrderUsd - previousPaidUsd) : totalOrderUsd),
        new_balance_usd: remainingUsd,
        payment_method: payment_method || 'pago_movil',
        reference: reference ? String(reference).trim() : null,
        idempotency_key: idempotencyKey || null,
        created_by: auth.userId,
        metadata: { is_fully_paid: isFullyPaid },
      })
    } catch (auditErr) {
      console.warn('[AuditLog] Error writing financial audit log:', auditErr)
    }

    const responsePayload = {
      success: true,
      order: updatedOrder,
      abono: newPaymentEntry,
      remainingUsd,
      nuevoSaldoUsd: remainingUsd,
      isFullyPaid,
      isCompleted: isFullyPaid,
      updatedCustomerDebt,
    }

    if (idempotencyKey) {
      await recordIdempotency(idempotencyKey, tenant_id, responsePayload, 200)
    }

    return NextResponse.json(responsePayload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar abono.'
    console.error('Error in /api/admin/orders/abono:', sanitizeForLogging({ message, error: String(err) }))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT: Modificar un abono existente con autorización de Clave Admin
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
      order_id,
      abono_id,
      abono_index,
      pin,
      amount_usd,
      amount_ves,
      method,
      payment_method,
      reference,
      notes,
      payment_date,
      exchange_rate,
    } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id es requerido.' }, { status: 400 })
    }

    if (!pin) {
      return NextResponse.json({ error: 'La Clave de Administrador es requerida para editar un abono.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obtener la orden existente
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, customer:customers(*)')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 })
    }

    const effectiveTenantId = tenant_id || order.tenant_id

    // 2. Validar autenticación de sesión
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: effectiveTenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    // 3. Validar Clave Admin de seguridad de la tienda
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', effectiveTenantId)
      .single()

    const configuredPin = String((tenantData?.settings as any)?.admin_security_pin || '1234').trim()
    if (String(pin).trim() !== configuredPin) {
      return NextResponse.json({ error: 'Clave de Administrador incorrecta.' }, { status: 401 })
    }

    // 4. Ubicar el abono en payment_breakdown
    const currentPayments = Array.isArray(order.payment_breakdown) ? [...order.payment_breakdown] : []
    let targetIndex = -1

    if (abono_id) {
      targetIndex = currentPayments.findIndex((p: any) => p.id === abono_id)
    }

    if (targetIndex === -1 && typeof abono_index === 'number' && abono_index >= 0 && abono_index < currentPayments.length) {
      targetIndex = abono_index
    }

    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Abono no encontrado en el desglose de la orden.' }, { status: 404 })
    }

    const oldAbono = currentPayments[targetIndex]
    const oldAmountUsd = Number(oldAbono.amount_usd) || 0
    const newAmountUsd = Number(amount_usd) > 0 ? Number(amount_usd) : oldAmountUsd
    const diffUsd = newAmountUsd - oldAmountUsd
    const appliedMethod = payment_method || method || oldAbono.method || 'pago_movil'
    const safeRate = Number(exchange_rate) || Number(oldAbono.exchange_rate_applied) || 91.5
    const computedVes = Number(amount_ves) || (newAmountUsd * safeRate)

    // Actualizar el abono
    currentPayments[targetIndex] = {
      ...oldAbono,
      id: oldAbono.id || ('abono_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      method: appliedMethod,
      amount_usd: newAmountUsd,
      amount_ves: computedVes,
      reference: reference !== undefined ? String(reference).trim() : oldAbono.reference,
      notes: notes !== undefined ? String(notes).trim() : oldAbono.notes,
      exchange_rate_applied: safeRate,
      date: payment_date ? new Date(payment_date + 'T12:00:00').toISOString() : (oldAbono.date || new Date().toISOString()),
      is_abono: true,
      edited_at: new Date().toISOString(),
      edited_by: auth.userId,
    }

    // 5. Recalcular saldo total pagado y remanente de la orden
    const totalOrderUsd = Number(order.total_usd) || 0
    const nonCreditPayments = currentPayments.filter((p: any) => p.method !== 'credit_7d')
    const totalPaidUsd = nonCreditPayments.reduce((acc: number, p: any) => acc + (Number(p.amount_usd) || 0), 0)
    const remainingUsd = Math.max(0, totalOrderUsd - totalPaidUsd)
    const isFullyPaid = remainingUsd < 0.01

    // Ajustar o remover la fila credit_7d
    const creditRowIndex = currentPayments.findIndex((p: any) => p.method === 'credit_7d')
    if (creditRowIndex > -1) {
      if (isFullyPaid) {
        currentPayments.splice(creditRowIndex, 1)
      } else {
        currentPayments[creditRowIndex] = {
          ...currentPayments[creditRowIndex],
          amount_usd: remainingUsd,
          amount_ves: remainingUsd * safeRate,
        }
      }
    } else if (!isFullyPaid) {
      currentPayments.push({
        method: 'credit_7d',
        amount_usd: remainingUsd,
        amount_ves: remainingUsd * safeRate,
        reference: 'Saldo pendiente restante',
      })
    }

    // 6. Actualizar orden
    const updateOrderPayload: Record<string, any> = {
      payment_breakdown: currentPayments,
      status: isFullyPaid ? 'completed' : 'credit',
      updated_at: new Date().toISOString(),
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateOrderPayload)
      .eq('id', order_id)
      .select('*, customer:customers(*)')
      .single()

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    // 7. Ajustar deuda del cliente
    let updatedCustomerDebt = 0
    const effectiveCustomerId = order.customer_id
    if (effectiveCustomerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('current_debt_usd')
        .eq('id', effectiveCustomerId)
        .single()

      if (cust) {
        const currentDebt = Number(cust.current_debt_usd) || 0
        updatedCustomerDebt = Math.max(0, currentDebt - diffUsd)
        await supabase
          .from('customers')
          .update({ current_debt_usd: updatedCustomerDebt })
          .eq('id', effectiveCustomerId)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Abono modificado exitosamente.',
      order: updatedOrder,
      abono: currentPayments[targetIndex],
      remainingUsd,
      isFullyPaid,
      updatedCustomerDebt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al modificar el abono.'
    console.error('Error in PUT /api/admin/orders/abono:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: Eliminar un abono erróneo con autorización de Clave Admin
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
      order_id,
      abono_id,
      abono_index,
      pin,
    } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id es requerido.' }, { status: 400 })
    }

    if (!pin) {
      return NextResponse.json({ error: 'La Clave de Administrador es requerida para eliminar un abono.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obtener orden existente
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, customer:customers(*)')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 })
    }

    const effectiveTenantId = tenant_id || order.tenant_id

    // 2. Validar autenticación de sesión
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: effectiveTenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    // 3. Validar Clave Admin de seguridad de la tienda
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', effectiveTenantId)
      .single()

    const configuredPin = String((tenantData?.settings as any)?.admin_security_pin || '1234').trim()
    if (String(pin).trim() !== configuredPin) {
      return NextResponse.json({ error: 'Clave de Administrador incorrecta.' }, { status: 401 })
    }

    // 4. Ubicar y extraer el abono a eliminar
    const currentPayments = Array.isArray(order.payment_breakdown) ? [...order.payment_breakdown] : []
    let targetIndex = -1

    if (abono_id) {
      targetIndex = currentPayments.findIndex((p: any) => p.id === abono_id)
    }

    if (targetIndex === -1 && typeof abono_index === 'number' && abono_index >= 0 && abono_index < currentPayments.length) {
      targetIndex = abono_index
    }

    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Abono no encontrado en la orden.' }, { status: 404 })
    }

    const [removedAbono] = currentPayments.splice(targetIndex, 1)
    const removedAmountUsd = Number(removedAbono.amount_usd) || 0

    // 5. Recalcular balance de la orden
    const totalOrderUsd = Number(order.total_usd) || 0
    const nonCreditPayments = currentPayments.filter((p: any) => p.method !== 'credit_7d')
    const totalPaidUsd = nonCreditPayments.reduce((acc: number, p: any) => acc + (Number(p.amount_usd) || 0), 0)
    const remainingUsd = Math.max(0, totalOrderUsd - totalPaidUsd)
    const isFullyPaid = remainingUsd < 0.01

    const safeRate = Number(order.exchange_rate_at_sale) || 91.5

    // Ajustar o crear fila credit_7d
    const creditRowIndex = currentPayments.findIndex((p: any) => p.method === 'credit_7d')
    if (creditRowIndex > -1) {
      if (isFullyPaid) {
        currentPayments.splice(creditRowIndex, 1)
      } else {
        currentPayments[creditRowIndex] = {
          ...currentPayments[creditRowIndex],
          amount_usd: remainingUsd,
          amount_ves: remainingUsd * safeRate,
        }
      }
    } else if (!isFullyPaid) {
      currentPayments.push({
        method: 'credit_7d',
        amount_usd: remainingUsd,
        amount_ves: remainingUsd * safeRate,
        reference: 'Saldo pendiente restaurado por eliminación de abono',
      })
    }

    // 6. Actualizar orden (vuelve a 'credit' si queda saldo pendiente)
    const updateOrderPayload: Record<string, any> = {
      payment_breakdown: currentPayments,
      status: isFullyPaid ? 'completed' : 'credit',
      updated_at: new Date().toISOString(),
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateOrderPayload)
      .eq('id', order_id)
      .select('*, customer:customers(*)')
      .single()

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    // 7. Revertir la deuda del cliente (se le suma de vuelta el monto eliminado)
    let updatedCustomerDebt = 0
    const effectiveCustomerId = order.customer_id
    if (effectiveCustomerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('current_debt_usd')
        .eq('id', effectiveCustomerId)
        .single()

      if (cust) {
        const currentDebt = Number(cust.current_debt_usd) || 0
        updatedCustomerDebt = currentDebt + removedAmountUsd
        await supabase
          .from('customers')
          .update({ current_debt_usd: updatedCustomerDebt })
          .eq('id', effectiveCustomerId)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Abono eliminado exitosamente y saldo restaurado.',
      order: updatedOrder,
      removedAbono,
      remainingUsd,
      isFullyPaid,
      updatedCustomerDebt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar el abono.'
    console.error('Error in DELETE /api/admin/orders/abono:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


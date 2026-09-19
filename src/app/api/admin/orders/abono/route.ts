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
    const {
      tenant_id,
      order_id,
      customer_id,
      payment_method,
      amount_usd,
      amount_ves,
      exchange_rate,
      reference,
      notes,
    } = body

    if (!tenant_id || !order_id) {
      return NextResponse.json({ error: 'tenant_id y order_id son requeridos.' }, { status: 400 })
    }

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
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

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
    const newPaymentEntry = {
      method: payment_method || 'pago_movil',
      amount_usd: numericAmountUsd,
      amount_ves: Number(amount_ves) || numericAmountUsd * (Number(exchange_rate) || 91.5),
      reference: reference ? String(reference).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      exchange_rate_applied: Number(exchange_rate) || 91.5,
      date: nowIso,
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

    const dateStr = new Date().toLocaleDateString('es-VE')
    const refText = reference ? ' Ref: ' + reference : ''
    const abonoLog = '[Abono ' + dateStr + ': $' + numericAmountUsd.toFixed(2) + ' USD via ' + (payment_method || 'Pago') + refText + ' | Tasa BCV: ' + (Number(exchange_rate) || 91.5) + ']'
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
      isFullyPaid,
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

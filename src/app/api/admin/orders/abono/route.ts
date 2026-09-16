import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

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
        .select('current_debt_usd')
        .eq('id', effectiveCustomerId)
        .single()

      if (cust) {
        const currentDebt = Number(cust.current_debt_usd) || 0
        updatedCustomerDebt = Math.max(0, currentDebt - numericAmountUsd)
        await supabase
          .from('customers')
          .update({ current_debt_usd: updatedCustomerDebt })
          .eq('id', effectiveCustomerId)
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      abono: newPaymentEntry,
      remainingUsd,
      isFullyPaid,
      updatedCustomerDebt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar abono.'
    console.error('Error in /api/admin/orders/abono:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

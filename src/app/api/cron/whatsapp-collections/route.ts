import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantFeatures } from '@/lib/planLimits'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'
import { formatDate } from '@/lib/formatters'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET o POST: Ejecuta la rutina diaria de recordatorios de cobro a crédito
export async function GET(req: Request) {
  return handleCollections(req)
}

export async function POST(req: Request) {
  return handleCollections(req)
}

async function handleCollections(req: Request) {
  try {
    const supabase = getAdminClient()

    // 1. Obtener todas las órdenes con condición de crédito y clientes asociados
    const { data: creditOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, customer:customers(*), tenant:tenants(*)')
      .or('status.eq.credit,payment_condition.eq.credit_7d')
      .neq('status', 'cancelled')
      .neq('status', 'completed')

    if (ordersErr) {
      throw new Error(ordersErr.message)
    }

    const now = new Date()
    let sentCount = 0
    const report: any[] = []

    for (const order of creditOrders || []) {
      const tenant = order.tenant
      if (!tenant) continue

      const features = getTenantFeatures(tenant)
      const tSettings = (tenant.settings || {}) as Record<string, any>
      const waSettings = tSettings.whatsapp_automation || {}

      // Solo si el comercio tiene Plan Enterprise y activada la cobranza automática
      if (!features.hasWhatsAppAutomation || !waSettings.enabled || !waSettings.auto_send_credit_reminders) {
        continue
      }

      const customer = order.customer
      if (!customer || !customer.phone) continue

      // Calcular deuda restante de la orden
      const breakdown = Array.isArray(order.payment_breakdown) ? order.payment_breakdown : []
      const paidUsd = breakdown.reduce(
        (sum: number, it: any) => (it.method !== 'credit_7d' ? sum + (Number(it.amount_usd) || 0) : sum),
        0
      )
      const totalOrderUsd = Number(order.total_usd) || 0
      const remainingDebtUsd = Math.max(0, totalOrderUsd - paidUsd)

      if (remainingDebtUsd <= 0.05) continue // Ya está prácticamente saldado

      const rate = Number(tenant.currency_rate_bcv) || 91.5
      const remainingVes = remainingDebtUsd * rate

      // Detectar si la orden tiene plan de cobro por cuotas
      const creditItem = breakdown.find((it: any) => it.method === 'credit_7d' && it.installments_plan)
      const installmentsPlan = creditItem?.installments_plan
      let activeInstallment: any = null

      if (installmentsPlan && Array.isArray(installmentsPlan.schedule)) {
        // Ubicar la cuota pendiente más prioritaria (que no esté pagada)
        activeInstallment = installmentsPlan.schedule.find((s: any) => s.status === 'pending')
      }

      let effectiveDueDate = order.due_date ? new Date(order.due_date) : new Date(new Date(order.created_at).getTime() + 7 * 86400000)
      if (activeInstallment?.due_date) {
        effectiveDueDate = new Date(`${activeInstallment.due_date}T23:59:59`)
      }

      // Diferencia en días respecto a la fecha de cobro de la cuota / orden
      const diffMs = effectiveDueDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      let subjectPrefix = ''
      let urgencyText = ''

      if (activeInstallment) {
        const instNum = activeInstallment.installment_number
        const instTotal = installmentsPlan.total_installments
        const instUsd = Number(activeInstallment.amount_usd) || 0
        const instVes = (instUsd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

        if (diffDays === 2 || diffDays === 1) {
          subjectPrefix = `⏳ *RECORDATORIO DE CUOTA #${instNum} DE ${instTotal}*`
          urgencyText = `Te recordamos que tu cuota #${instNum} por *$${instUsd.toFixed(2)} USD* (Bs. ${instVes}) vence el próximo *${formatDate(effectiveDueDate)}*.`
        } else if (diffDays === 0) {
          subjectPrefix = `📅 *HOY VENCE TU CUOTA #${instNum} DE ${instTotal}*`
          urgencyText = `Hoy es la fecha acordada de pago para tu cuota #${instNum} por *$${instUsd.toFixed(2)} USD* (Bs. ${instVes}).`
        } else if (diffDays < 0) {
          const lateDays = Math.abs(diffDays)
          subjectPrefix = `⚠️ *CUOTA #${instNum} DE ${instTotal} VENCIDA*`
          urgencyText = `Tu cuota #${instNum} por *$${instUsd.toFixed(2)} USD* (Bs. ${instVes}) presenta *${lateDays} día(s) de vencimiento* (Fecha límite: ${formatDate(effectiveDueDate)}).`
        } else {
          // Aún falta más de 2 días para esta cuota
          continue
        }
      } else {
        if (diffDays === 2 || diffDays === 1) {
          subjectPrefix = '⏳ *RECORDATORIO PREVENTIVO DE PAGO*'
          urgencyText = `Te recordamos que tu saldo a crédito vence el próximo *${formatDate(effectiveDueDate)}*.`
        } else if (diffDays === 0) {
          subjectPrefix = '📅 *HOY VENCE TU CUENTA A CRÉDITO*'
          urgencyText = `Hoy es la fecha límite de pago acordada (${formatDate(effectiveDueDate)}).`
        } else if (diffDays < 0) {
          const lateDays = Math.abs(diffDays)
          subjectPrefix = '⚠️ *ESTADO DE CUENTA VENCIDO*'
          urgencyText = `Tu factura presenta *${lateDays} día(s) de vencimiento* (Fecha límite: ${formatDate(effectiveDueDate)}).`
        } else {
          // Aún falta más de 2 días, no molestar al cliente
          continue
        }
      }

      const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`
      const reminderMsg = [
        subjectPrefix,
        `🏪 *${tenant.name}*`,
        `📄 *Factura:* #${order.order_number}`,
        `👤 *Cliente:* ${customer.full_name}`,
        ``,
        urgencyText,
        activeInstallment ? `📌 *Monto de esta cuota:* $${Number(activeInstallment.amount_usd).toFixed(2)} USD (Bs. ${(Number(activeInstallment.amount_usd) * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '',
        `💰 *Saldo Total Financiado Pendiente:* $${remainingDebtUsd.toFixed(2)} USD`,
        `🇻🇪 *Equivalente Total en Bs.:* Bs. ${remainingVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `📈 *Tasa Oficial BCV del día:* Bs. ${rate.toFixed(2)}/USD`,
        ``,
        `💡 *Condición de Abono:* Todo pago en Bolívares se liquida a la tasa oficial del BCV del día en que se procesa el abono.`,
        ``,
        `Por favor envíanos tu comprobante si ya efectuaste tu transferencia para conciliar tu estado de cuenta. ¡Muchas gracias!`,
      ].filter(Boolean).join('\n')

      await sendWhatsAppTextMessage(instanceName, customer.phone, reminderMsg)
      sentCount++
      report.push({
        order_number: order.order_number,
        customer: customer.full_name,
        phone: customer.phone,
        remainingUsd: remainingDebtUsd,
        diffDays,
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sentCount,
      report,
    })
  } catch (err: any) {
    console.error('Error in credit-reminders cron:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

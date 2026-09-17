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
      const dueDate = order.due_date ? new Date(order.due_date) : new Date(new Date(order.created_at).getTime() + 7 * 86400000)

      // Diferencia en días
      const diffMs = dueDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      let subjectPrefix = ''
      let urgencyText = ''

      if (diffDays === 2 || diffDays === 1) {
        subjectPrefix = '⏳ *RECORDATORIO PREVENTIVO DE PAGO*'
        urgencyText = `Te recordamos que tu saldo a crédito vence el próximo *${formatDate(dueDate)}*.`
      } else if (diffDays === 0) {
        subjectPrefix = '📅 *HOY VENCE TU CUENTA A CRÉDITO*'
        urgencyText = `Hoy es la fecha límite de pago acordada (${formatDate(dueDate)}).`
      } else if (diffDays < 0) {
        const lateDays = Math.abs(diffDays)
        subjectPrefix = '⚠️ *ESTADO DE CUENTA VENCIDO*'
        urgencyText = `Tu factura presenta *${lateDays} día(s) de vencimiento* (Fecha límite: ${formatDate(dueDate)}).`
      } else {
        // Aún falta más de 2 días, no molestar al cliente
        continue
      }

      const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`
      const reminderMsg = [
        subjectPrefix,
        `🏪 *${tenant.name}*`,
        `📄 *Factura:* #${order.order_number}`,
        `👤 *Cliente:* ${customer.full_name}`,
        ``,
        urgencyText,
        `💰 *Saldo Pendiente: $${remainingDebtUsd.toFixed(2)} USD*`,
        `🇻🇪 *Equivalente en Bs.:* Bs. ${remainingVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `📈 *Tasa Oficial BCV del día:* Bs. ${rate.toFixed(2)}/USD`,
        ``,
        `💡 *Condición de Abono:* Todo pago en Bolívares se liquida a la tasa oficial del BCV del día en que se procesa el abono.`,
        ``,
        `Por favor envíanos tu comprobante si ya efectuaste tu transferencia para conciliar tu estado de cuenta. ¡Muchas gracias!`,
      ].join('\n')

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

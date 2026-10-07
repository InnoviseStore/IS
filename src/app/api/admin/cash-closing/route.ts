import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export const dynamic = 'force-dynamic'

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

// GET: Consulta el estado del cierre, órdenes, abonos del día y el historial
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    const dateParam = searchParams.get('date') // YYYY-MM-DD
    const startIsoParam = searchParams.get('start_iso')
    const endIsoParam = searchParams.get('end_iso')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenantId,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Calcular ventana de tiempo (por defecto hoy en hora de Venezuela UTC-4 o la fecha solicitada)
    let startIso: string
    let endIso: string

    if (startIsoParam && endIsoParam) {
      startIso = startIsoParam
      endIso = endIsoParam
    } else if (dateParam) {
      // Usar rango del día solicitado con margen de zona horaria (-04:00)
      startIso = `${dateParam}T00:00:00-04:00`
      endIso = `${dateParam}T23:59:59.999-04:00`
    } else {
      const now = new Date()
      // En hora Venezuela: UTC-4
      const veDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now)
      startIso = `${veDateStr}T00:00:00-04:00`
      endIso = `${veDateStr}T23:59:59.999-04:00`
    }

    // 2. Consultar si existe un cierre para este período
    const { data: closing } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'closed')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 3. Consultar órdenes creadas en este período (excluyendo canceladas)
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, customer:customers(*)')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })

    if (ordersErr) {
      console.error('Error fetching orders for cash closing:', ordersErr)
    }

    // 4. Consultar abonos cobrados en este período en órdenes anteriores
    // Buscamos órdenes activas a crédito o completadas para extraer abonos con date en el rango
    const { data: candidateOrders } = await supabase
      .from('orders')
      .select('id, order_number, total_usd, payment_breakdown, created_at, customer:customers(full_name)')
      .eq('tenant_id', tenantId)
      .in('status', ['completed', 'credit'])
      .order('updated_at', { ascending: false })
      .limit(200)

    const abonosDelPeriodo: any[] = []
    const startTimestamp = new Date(startIso).getTime()
    const endTimestamp = new Date(endIso).getTime()

    for (const ord of candidateOrders || []) {
      const breakdown = Array.isArray(ord.payment_breakdown) ? ord.payment_breakdown : []
      for (const p of breakdown) {
        if (p.is_abono && p.date) {
          const abonoTime = new Date(p.date).getTime()
          if (abonoTime >= startTimestamp && abonoTime <= endTimestamp) {
            abonosDelPeriodo.push({
              order_id: ord.id,
              order_number: ord.order_number,
              customer_name: (ord.customer as any)?.full_name || 'Cliente',
              method: p.method,
              amount_usd: Number(p.amount_usd) || 0,
              amount_ves: Number(p.amount_ves) || 0,
              exchange_rate_applied: Number(p.exchange_rate_applied) || 1,
              reference: p.reference,
              notes: p.notes,
              date: p.date,
            })
          }
        }
      }
    }

    // 5. Consultar historial de los últimos 30 cierres de caja
    const { data: history } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      closed: !!closing,
      closing: closing || null,
      orders: orders || [],
      abonos: abonosDelPeriodo,
      history: history || [],
      period: { startIso, endIso },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

// POST: Realizar el cierre de caja o reabrir el turno con Clave Admin
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      action,
      tenant_id,
      closing_id,
      pin,
      summary,
      subtotal_usd,
      igtf_total,
      total_usd,
      total_ves,
      order_count,
      exchange_rate,
      actual_cash_usd,
      actual_cash_ves,
      difference_usd,
      difference_ves,
      notes,
    } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenant_id,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // ─── ACCIÓN 1: Reabrir Turno con Clave Admin ───
    if (action === 'reopen') {
      if (!pin) {
        return NextResponse.json({ error: 'La Clave de Administrador es requerida para reabrir la caja.' }, { status: 400 })
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant_id)
        .single()

      const configuredPin = String((tenantData?.settings as any)?.admin_security_pin || '1234').trim()
      if (String(pin).trim() !== configuredPin) {
        return NextResponse.json({ error: 'Clave de Administrador incorrecta.' }, { status: 401 })
      }

      if (closing_id) {
        await supabase.from('cash_closings').delete().eq('id', closing_id).eq('tenant_id', tenant_id)
      } else {
        // Eliminar el último cierre cerrado del tenant de hoy
        const now = new Date()
        const startOfToday = new Date(now.setHours(0, 0, 0, 0)).toISOString()
        await supabase
          .from('cash_closings')
          .delete()
          .eq('tenant_id', tenant_id)
          .gte('created_at', startOfToday)
      }

      return NextResponse.json({ success: true, message: 'Turno de caja reabierto con éxito.' })
    }

    // ─── ACCIÓN 2: Guardar Cierre de Caja ───
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const datePrefix = `${yyyy}${mm}${dd}`
    const closingNumber = `CC-${datePrefix}-${Math.floor(1000 + Math.random() * 9000)}`

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const openedAt = startOfToday.toISOString()
    const closedAt = now.toISOString()

    const payload = {
      tenant_id,
      closing_number: closingNumber,
      opened_at: openedAt,
      closed_at: closedAt,
      initial_cash_usd: 0,
      initial_cash_ves: 0,
      total_sales_usd: parseFloat(Number(total_usd || 0).toFixed(4)),
      total_sales_ves: parseFloat(Number(total_ves || 0).toFixed(2)),
      sales_count: Number(order_count || 0),
      breakdown_by_method: summary || [],
      actual_cash_usd: Number(actual_cash_usd) || 0,
      actual_cash_ves: Number(actual_cash_ves) || 0,
      difference_usd: Number(difference_usd) || 0,
      difference_ves: Number(difference_ves) || 0,
      status: 'closed',
      notes: notes || null,
      closed_by: auth.userId,
    }

    const { data, error } = await supabase
      .from('cash_closings')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Error inserting cash closing:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      closing: data,
    })
  } catch (err: any) {
    console.error('Catch error closing cash:', err)
    return NextResponse.json({ error: err?.message || 'Error interno del servidor' }, { status: 500 })
  }
}

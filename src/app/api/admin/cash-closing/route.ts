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

// GET: Consulta si ya existe un cierre de caja para el día de hoy
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    const todayStart = searchParams.get('today_start')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier'],
      targetTenantId: tenantId,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()
    const startIso = todayStart || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const { data: closing, error } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'closed')
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching cash closing:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      closed: !!closing,
      closing: closing || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

// POST: Realizar el cierre de caja del día
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
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
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier'],
      targetTenantId: tenant_id,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Generar número de cierre secuencial del día
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

    // 2. Insertar en la tabla cash_closings compatible con el esquema de la BD
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Service role para consultas de analíticas (bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  try {
    // Verificar que el usuario es superadmin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parámetros de consulta
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7'  // días
    const tenant_id = searchParams.get('tenant_id') || null
    const days = Math.min(parseInt(range, 10) || 7, 90)

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Resumen total por tenant en el período
    const summaryQuery = supabaseAdmin
      .from('page_views')
      .select('tenant_id, tenant_slug, visited_at')
      .gte('visited_at', since)

    if (tenant_id) {
      summaryQuery.eq('tenant_id', tenant_id)
    }

    const { data: allViews, error } = await summaryQuery.order('visited_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const views = allViews || []

    // Agrupar por tenant y por día
    const tenantMap: Record<string, {
      tenant_id: string
      tenant_slug: string
      total: number
      byDay: Record<string, number>
    }> = {}

    for (const v of views) {
      const key = v.tenant_id
      const day = v.visited_at.slice(0, 10) // YYYY-MM-DD
      if (!tenantMap[key]) {
        tenantMap[key] = {
          tenant_id: v.tenant_id,
          tenant_slug: v.tenant_slug,
          total: 0,
          byDay: {},
        }
      }
      tenantMap[key].total += 1
      tenantMap[key].byDay[day] = (tenantMap[key].byDay[day] || 0) + 1
    }

    // Calcular "hoy" y "esta semana" para cada tenant
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const tenantStats = Object.values(tenantMap).map((t) => {
      const today = t.byDay[todayStr] || 0
      const last7 = Object.entries(t.byDay)
        .filter(([d]) => d >= weekAgo)
        .reduce((acc, [, c]) => acc + c, 0)

      // Generar array de días para el gráfico (últimos N días)
      const chartDays: { date: string; count: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        chartDays.push({ date: d, count: t.byDay[d] || 0 })
      }

      return {
        tenant_id: t.tenant_id,
        tenant_slug: t.tenant_slug,
        total: t.total,
        today,
        last7,
        chart: chartDays,
      }
    })

    // Obtener todos los tenants para mostrar incluso los que tienen 0 visitas
    const { data: allTenants } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name')
      .order('name')

    // Merge tenants sin visitas
    const tenantIds = new Set(tenantStats.map((t) => t.tenant_id))
    const zeroTenants = (allTenants || [])
      .filter((t: { id: string; slug: string; name: string }) => !tenantIds.has(t.id))
      .map((t: { id: string; slug: string; name: string }) => ({
        tenant_id: t.id,
        tenant_slug: t.slug,
        tenant_name: t.name,
        total: 0,
        today: 0,
        last7: 0,
        chart: Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          count: 0,
        })),
      }))

    // Enriquecer con nombre del tenant
    const tenantNames: Record<string, string> = {}
    ;(allTenants || []).forEach((t: { id: string; name: string }) => {
      tenantNames[t.id] = t.name
    })

    const result = [
      ...tenantStats.map((t) => ({ ...t, tenant_name: tenantNames[t.tenant_id] || t.tenant_slug })),
      ...zeroTenants,
    ].sort((a, b) => b.total - a.total)

    return NextResponse.json({ ok: true, stats: result, days, since })
  } catch (err) {
    console.error('[analytics] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

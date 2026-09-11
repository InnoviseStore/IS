import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetchLiveBcvRate } from '@/lib/bcv'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getTodayFormatted(): string {
  try {
    const today = new Intl.DateTimeFormat('es-VE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
    return today.charAt(0).toUpperCase() + today.slice(1)
  } catch {
    return 'Hoy'
  }
}

/**
 * GET /api/exchange-rate?tenant=innovise&sync=true
 * Returns the current BCV exchange rate and fecha_valor for a tenant.
 * If sync=true, forces live fetch from https://www.bcv.org.ve/ and updates DB.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('tenant') || 'innovise'
  const forceSync = request.nextUrl.searchParams.get('sync') === 'true'

  const supabase = await createClient()

  // Fetch tenant
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, currency_rate_bcv, settings, updated_at')
    .eq('slug', slug)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const settings = (tenant.settings || {}) as Record<string, unknown>
  let rate = Number(tenant.currency_rate_bcv)
  let fechaValor = (settings.bcv_fecha_valor as string) || null
  let lastSync = (settings.bcv_last_sync as string) || null
  let source = (settings.bcv_source as string) || 'https://www.bcv.org.ve/'

  // Check if we should auto-sync with BCV
  // If forced, or if last sync is not from today, or older than 30 minutes
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
  const isToday = lastSync && new Date(lastSync).toDateString() === new Date().toDateString()
  const isOutdated = !lastSync || !isToday || new Date(lastSync).getTime() < thirtyMinutesAgo

  if (forceSync || isOutdated) {
    try {
      const bcvData = await fetchLiveBcvRate()
      rate = bcvData.rate
      fechaValor = bcvData.fechaValor
      source = bcvData.source
      lastSync = bcvData.timestamp

      const updatedSettings = {
        ...settings,
        bcv_fecha_valor: fechaValor,
        bcv_last_sync: lastSync,
        bcv_source: source,
      }

      const adminClient = getAdminClient()
      const dbClient = adminClient || supabase

      await dbClient
        .from('tenants')
        .update({
          currency_rate_bcv: rate,
          settings: updatedSettings,
        })
        .eq('id', tenant.id)
    } catch (bcvError) {
      console.warn('Auto-sync BCV error (using stored fallback):', (bcvError as Error).message)
    }
  }

  if (!fechaValor) {
    fechaValor = getTodayFormatted()
  }

  return NextResponse.json({
    rate,
    fechaValor,
    source,
    lastSync,
    currency: 'VES',
    base: 'USD',
    updated_at: tenant.updated_at,
  })
}

/**
 * POST /api/exchange-rate
 * Actions:
 * 1. { action: "sync_bcv" } -> Scrapes https://www.bcv.org.ve/ and updates DB
 * 2. { rate: number } -> Manual override
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Get tenant from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))

  // Option 1: Live sync from BCV website
  if (body.action === 'sync_bcv') {
    try {
      const bcvData = await fetchLiveBcvRate()

      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', profile.tenant_id)
        .single()

      const currentSettings = ((currentTenant?.settings || {}) as Record<string, unknown>)
      const newSettings = {
        ...currentSettings,
        bcv_fecha_valor: bcvData.fechaValor,
        bcv_last_sync: bcvData.timestamp,
        bcv_source: bcvData.source,
      }

      const adminClient = getAdminClient()
      const dbClient = adminClient || supabase

      await dbClient
        .from('tenants')
        .update({
          currency_rate_bcv: bcvData.rate,
          settings: newSettings,
        })
        .eq('id', profile.tenant_id)

      return NextResponse.json({
        success: true,
        rate: bcvData.rate,
        fechaValor: bcvData.fechaValor,
        source: bcvData.source,
        timestamp: bcvData.timestamp,
        message: 'Tasa sincronizada exitosamente con el Banco Central de Venezuela',
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Error al sincronizar con BCV: ${(err as Error).message}` },
        { status: 502 }
      )
    }
  }

  // Option 2: Manual override
  const rate = parseFloat(body.rate)
  if (isNaN(rate) || rate <= 0) {
    return NextResponse.json({ error: 'Monto de tasa invalido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({ currency_rate_bcv: rate })
    .eq('id', profile.tenant_id)
    .select('currency_rate_bcv')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rate: data.currency_rate_bcv, updated: true })
}
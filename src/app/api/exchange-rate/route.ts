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

interface RateHistoryEntry {
  date: string // YYYY-MM-DD
  rate: number
  fecha_valor?: string
  label?: string
  source?: string
  updated_at?: string
}

function mergeRateHistory(
  existingHistory: unknown,
  newItem: RateHistoryEntry
): RateHistoryEntry[] {
  const list: RateHistoryEntry[] = Array.isArray(existingHistory)
    ? [...(existingHistory as RateHistoryEntry[])]
    : []

  const index = list.findIndex((item) => item.date === newItem.date)
  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...newItem,
      updated_at: new Date().toISOString(),
    }
  } else {
    list.unshift({
      ...newItem,
      updated_at: new Date().toISOString(),
    })
  }

  // Sort descending by date (newest first)
  list.sort((a, b) => b.date.localeCompare(a.date))

  // Keep up to 30 days
  return list.slice(0, 30)
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
  let ratesHistory = (settings.bcv_rates_history as any[]) || []

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

      const todayDate = new Date().toISOString().split('T')[0]
      ratesHistory = mergeRateHistory(settings.bcv_rates_history, {
        date: todayDate,
        rate,
        fecha_valor: fechaValor,
        label: fechaValor,
        source,
      })

      const updatedSettings = {
        ...settings,
        bcv_fecha_valor: fechaValor,
        bcv_last_sync: lastSync,
        bcv_source: source,
        bcv_rates_history: ratesHistory,
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

  // Ensure today's rate is in history even if no sync was triggered
  if (ratesHistory.length === 0 && rate > 0) {
    const todayDate = new Date().toISOString().split('T')[0]
    ratesHistory = [{
      date: todayDate,
      rate,
      fecha_valor: fechaValor,
      label: fechaValor,
      source: 'initial',
      updated_at: new Date().toISOString(),
    }]
  }

  return NextResponse.json({
    rate,
    fechaValor,
    source,
    lastSync,
    currency: 'VES',
    base: 'USD',
    rates_history: ratesHistory,
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
      const todayDate = new Date().toISOString().split('T')[0]
      const updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
        date: todayDate,
        rate: bcvData.rate,
        fecha_valor: bcvData.fechaValor,
        label: bcvData.fechaValor,
        source: bcvData.source,
      })

      const newSettings = {
        ...currentSettings,
        bcv_fecha_valor: bcvData.fechaValor,
        bcv_last_sync: bcvData.timestamp,
        bcv_source: bcvData.source,
        bcv_rates_history: updatedHistory,
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
        rates_history: updatedHistory,
        message: 'Tasa sincronizada exitosamente con el Banco Central de Venezuela',
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Error al sincronizar con BCV: ${(err as Error).message}` },
        { status: 502 }
      )
    }
  }

  // Option 2: Save / Edit historical rate for a specific date
  if (body.action === 'save_history_rate') {
    const targetDate = String(body.date || '').trim() // YYYY-MM-DD
    const targetRate = parseFloat(body.rate)
    if (!targetDate || isNaN(targetRate) || targetRate <= 0) {
      return NextResponse.json({ error: 'Fecha y tasa válidas requeridas' }, { status: 400 })
    }

    const { data: currentTenant } = await supabase
      .from('tenants')
      .select('settings, currency_rate_bcv')
      .eq('id', profile.tenant_id)
      .single()

    const currentSettings = ((currentTenant?.settings || {}) as Record<string, unknown>)
    const updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
      date: targetDate,
      rate: targetRate,
      fecha_valor: body.fecha_valor || targetDate,
      label: body.label || targetDate,
      source: 'manual',
    })

    const newSettings = {
      ...currentSettings,
      bcv_rates_history: updatedHistory,
    }

    const updatePayload: Record<string, unknown> = {
      settings: newSettings,
    }

    // If targetDate is today, also update current currency_rate_bcv
    const todayDate = new Date().toISOString().split('T')[0]
    if (targetDate === todayDate) {
      updatePayload.currency_rate_bcv = targetRate
    }

    const adminClient = getAdminClient()
    const dbClient = adminClient || supabase

    await dbClient
      .from('tenants')
      .update(updatePayload)
      .eq('id', profile.tenant_id)

    return NextResponse.json({
      success: true,
      rates_history: updatedHistory,
      message: `Tasa para el día ${targetDate} guardada exitosamente (Bs. ${targetRate})`,
    })
  }

  // Option 3: Manual override of today's rate
  const rate = parseFloat(body.rate)
  if (isNaN(rate) || rate <= 0) {
    return NextResponse.json({ error: 'Monto de tasa invalido' }, { status: 400 })
  }

  const { data: currentTenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', profile.tenant_id)
    .single()

  const currentSettings = ((currentTenant?.settings || {}) as Record<string, unknown>)
  const todayDate = new Date().toISOString().split('T')[0]
  const updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
    date: todayDate,
    rate,
    fecha_valor: getTodayFormatted(),
    label: getTodayFormatted(),
    source: 'manual',
  })

  const newSettings = {
    ...currentSettings,
    bcv_rates_history: updatedHistory,
  }

  const adminClient = getAdminClient()
  const dbClient = adminClient || supabase

  const { data, error } = await dbClient
    .from('tenants')
    .update({
      currency_rate_bcv: rate,
      settings: newSettings,
    })
    .eq('id', profile.tenant_id)
    .select('currency_rate_bcv')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rate: data.currency_rate_bcv, rates_history: updatedHistory, updated: true })
}
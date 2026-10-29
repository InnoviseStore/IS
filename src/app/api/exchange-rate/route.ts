import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  fetchLiveBcvRate,
  obtenerTasaBcvParaFecha,
  convertirPagoConTasaHistorica,
  upsertTasaBcvHistorial,
  obtenerObservabilidadTasaBcv,
  getVenezuelaDateIso,
} from '@/lib/bcv'
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

export interface RateHistoryEntry {
  date: string // YYYY-MM-DD
  rate: number // Effective rate
  rate_usd?: number // USD rate in Bs.
  rate_eur?: number // EUR rate in Bs.
  fecha_valor?: string
  label?: string
  source?: string
  is_manual?: boolean
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
    const existing = list[index]
    list[index] = {
      ...existing,
      ...newItem,
      rate_usd: newItem.rate_usd ?? existing.rate_usd ?? (newItem.rate > 0 ? newItem.rate : undefined),
      rate_eur: newItem.rate_eur ?? existing.rate_eur,
      updated_at: new Date().toISOString(),
    }
  } else {
    list.unshift({
      ...newItem,
      rate_usd: newItem.rate_usd ?? (newItem.rate > 0 ? newItem.rate : undefined),
      updated_at: new Date().toISOString(),
    })
  }

  // Sort descending by date (newest first)
  list.sort((a, b) => b.date.localeCompare(a.date))

  // Keep up to 730 days (2 continuous years of historical records)
  return list.slice(0, 730)
}

/**
 * GET /api/exchange-rate
 *
 * Modos soportados:
 * 1. Conversión / consulta histórica por fecha (Punto 4):
 *    `GET /api/exchange-rate?date=2026-10-15&amount=1000&currency=VES`
 *    Usa `obtenerTasaBcvParaFecha` (`fecha <= '<fecha_del_pago>' order by fecha desc limit 1`).
 *
 * 2. Observabilidad del Cron y Fallbacks (Punto 5):
 *    `GET /api/exchange-rate?observability=true`
 *
 * 3. Consulta general por tenant y sincronización en vivo:
 *    `GET /api/exchange-rate?tenant=innovise&sync=true`
 */
export async function GET(request: NextRequest) {
  const adminClient = getAdminClient()
  const supabase = await createClient()
  const dbClient = adminClient || supabase

  // Modo 1: Consulta / Conversión de pago en una fecha pasada (`?date=YYYY-MM-DD`)
  const queryDate = request.nextUrl.searchParams.get('date') || request.nextUrl.searchParams.get('fecha')
  if (queryDate) {
    try {
      const amountParam = request.nextUrl.searchParams.get('amount') || request.nextUrl.searchParams.get('monto')
      const currencyParam = (request.nextUrl.searchParams.get('currency') || 'VES').toUpperCase() === 'USD' ? 'USD' : 'VES'

      if (amountParam) {
        const conversion = await convertirPagoConTasaHistorica({
          monto: parseFloat(amountParam),
          monedaOrigen: currencyParam,
          fechaPago: queryDate,
          supabaseClient: dbClient,
        })
        return NextResponse.json({
          success: true,
          conversion,
        })
      }

      const historicalRow = await obtenerTasaBcvParaFecha(queryDate, dbClient)
      if (!historicalRow) {
        return NextResponse.json(
          {
            success: false,
            error: `No se encontró tasa histórica para fecha <= ${queryDate}`,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        fecha_consultada: queryDate,
        fecha_tasa_vigente: historicalRow.fecha,
        tasa: historicalRow.tasa,
        fuente: historicalRow.fuente,
        creado_en: historicalRow.creado_en,
        es_arrastre_fin_semana_o_feriado: historicalRow.fecha !== queryDate,
      })
    } catch (err) {
      return NextResponse.json(
        { success: false, error: (err as Error).message },
        { status: 500 }
      )
    }
  }

  // Modo 2: Observabilidad (`?observability=true`)
  const wantObservability = request.nextUrl.searchParams.get('observability') === 'true'
  if (wantObservability) {
    const obs = await obtenerObservabilidadTasaBcv({ limit: 120, supabaseClient: dbClient })
    return NextResponse.json({
      success: true,
      ...obs,
    })
  }

  // Modo 3: Consulta estándar de tienda
  const slug = request.nextUrl.searchParams.get('tenant') || 'innovise'
  const forceSync = request.nextUrl.searchParams.get('sync') === 'true'

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, currency_rate_bcv, settings, updated_at')
    .eq('slug', slug)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const settings = (tenant.settings || {}) as Record<string, unknown>
  const currencyType = ((settings.currency_type as string) || 'USD').toUpperCase() === 'EUR' ? 'EUR' : 'USD'
  const rateMode = ((settings.rate_mode as string) || 'official').toLowerCase() === 'custom' ? 'custom' : 'official'
  const customRate = typeof settings.custom_rate === 'number' ? settings.custom_rate : null

  let rateUsd = typeof settings.bcv_rate_usd === 'number' ? settings.bcv_rate_usd : Number(tenant.currency_rate_bcv) || 0
  let rateEur = typeof settings.bcv_rate_eur === 'number' ? settings.bcv_rate_eur : 0
  let fechaValor = (settings.bcv_fecha_valor as string) || null
  let lastSync = (settings.bcv_last_sync as string) || null
  let source = (settings.bcv_source as string) || 'https://www.bcv.org.ve/'
  let ratesHistory = (settings.bcv_rates_history as RateHistoryEntry[]) || []

  // Check if we should auto-sync with BCV (every 30 minutes or if outdated/empty)
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
  const isToday = lastSync && new Date(lastSync).toDateString() === new Date().toDateString()
  const isOutdated = !lastSync || !isToday || new Date(lastSync).getTime() < thirtyMinutesAgo

  if (forceSync || isOutdated) {
    try {
      const bcvData = await fetchLiveBcvRate({
        persistInHistorial: true,
        supabaseClient: dbClient,
      })
      rateUsd = bcvData.rate
      if (bcvData.rateEur && bcvData.rateEur > 0) {
        rateEur = bcvData.rateEur
      }
      fechaValor = bcvData.fechaValor
      source = bcvData.fuenteCodigo
      lastSync = bcvData.timestamp

      const effectiveDailyRate = currencyType === 'EUR' ? (rateEur || rateUsd) : rateUsd

      // CRITERIO DE ACEPTACIÓN (Punto 2c):
      // Si se llegó al último recurso (`shouldPersistToday === false`), NO insertar un registro
      // fantasma con la fecha de hoy.
      if (bcvData.shouldPersistToday) {
        ratesHistory = mergeRateHistory(settings.bcv_rates_history, {
          date: bcvData.fecha,
          rate: effectiveDailyRate,
          rate_usd: rateUsd,
          rate_eur: rateEur > 0 ? rateEur : undefined,
          fecha_valor: fechaValor,
          label: fechaValor,
          source: bcvData.fuenteCodigo,
          is_manual: false,
        })
      }

      const updatedSettings = {
        ...settings,
        bcv_rate_usd: rateUsd,
        bcv_rate_eur: rateEur > 0 ? rateEur : undefined,
        bcv_fecha_valor: fechaValor,
        bcv_last_sync: lastSync,
        bcv_source: bcvData.fuenteCodigo,
        bcv_rates_history: ratesHistory,
      }

      const newCurrencyRate = rateMode === 'custom' && customRate && customRate > 0
        ? customRate
        : effectiveDailyRate

      await dbClient
        .from('tenants')
        .update({
          currency_rate_bcv: newCurrencyRate,
          settings: updatedSettings,
        })
        .eq('id', tenant.id)
    } catch (bcvError) {
      console.warn('Auto-sync BCV error (using stored fallback):', (bcvError as Error).message)
    }
  }

  // Enriquecer `ratesHistory` con las filas almacenadas en la tabla dedicada `tasa_bcv_historial`
  try {
    const { data: dbHistorialRows } = await dbClient
      .from('tasa_bcv_historial')
      .select('fecha, tasa, fuente, creado_en')
      .order('fecha', { ascending: false })
      .limit(365)

    if (Array.isArray(dbHistorialRows) && dbHistorialRows.length > 0) {
      let merged = [...ratesHistory]
      for (const row of dbHistorialRows) {
        const fechaStr = String(row.fecha)
        const tasaNum = Number(row.tasa)
        const existsIdx = merged.findIndex((m) => m.date === fechaStr)
        if (existsIdx === -1) {
          merged.push({
            date: fechaStr,
            rate: tasaNum,
            rate_usd: tasaNum,
            fecha_valor: fechaStr,
            label: `Tasa Oficial (${row.fuente})`,
            source: String(row.fuente),
            is_manual: row.fuente === 'manual',
            updated_at: String(row.creado_en),
          })
        } else if (!merged[existsIdx].source || merged[existsIdx].source === 'https://www.bcv.org.ve/') {
          merged[existsIdx] = {
            ...merged[existsIdx],
            source: String(row.fuente),
          }
        }
      }
      merged.sort((a, b) => b.date.localeCompare(a.date))
      ratesHistory = merged.slice(0, 730)
    }
  } catch {
    // La tabla puede estar pendiente de migración en entornos locales
  }

  if (!fechaValor) {
    fechaValor = getTodayFormatted()
  }

  let effectiveRate = rateUsd
  if (rateMode === 'custom' && customRate && customRate > 0) {
    effectiveRate = customRate
  } else if (currencyType === 'EUR' && rateEur > 0) {
    effectiveRate = rateEur
  } else {
    effectiveRate = rateUsd || Number(tenant.currency_rate_bcv) || 0
  }

  if (ratesHistory.length === 0 && effectiveRate > 0) {
    const todayDate = getVenezuelaDateIso()
    ratesHistory = [{
      date: todayDate,
      rate: effectiveRate,
      rate_usd: rateUsd,
      rate_eur: rateEur > 0 ? rateEur : undefined,
      fecha_valor: fechaValor,
      label: fechaValor,
      source: 'initial',
      updated_at: new Date().toISOString(),
    }]
  }

  return NextResponse.json({
    rate: effectiveRate,
    rate_usd: rateUsd,
    rate_eur: rateEur,
    currency_type: currencyType,
    rate_mode: rateMode,
    custom_rate: customRate,
    fechaValor,
    source,
    lastSync,
    currency: 'VES',
    base: currencyType,
    rates_history: ratesHistory,
    updated_at: tenant.updated_at,
  })
}

/**
 * POST /api/exchange-rate
 * Actions:
 * 1. { action: "sync_bcv", tenant_id?: string } -> Ejecuta la cadena (a -> b -> c) y hace upsert en `tasa_bcv_historial`
 * 2. { action: "save_history_rate", ... } -> Agrega/edita tasa histórica y sincroniza en `tasa_bcv_historial`
 * 3. { action: "delete_history_rate", ... } -> Elimina fecha del historial y de `tasa_bcv_historial`
 * 4. { action: "update_store_currency", ... } -> Configura moneda ($ USD / € EUR) y modo
 * 5. { rate: number } -> Override manual
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 })
  }

  const isSuperAdmin = profile.role === 'superadmin'
  const isOwner = profile.role === 'owner' || isSuperAdmin

  const body = await request.json().catch(() => ({}))
  const targetTenantId = (isSuperAdmin && body.tenant_id) ? body.tenant_id : profile.tenant_id

  if (!targetTenantId) {
    return NextResponse.json({ error: 'Tienda no especificada' }, { status: 400 })
  }

  const adminClient = getAdminClient()
  const dbClient = adminClient || supabase

  const { data: currentTenant, error: fetchErr } = await dbClient
    .from('tenants')
    .select('id, name, slug, settings, currency_rate_bcv')
    .eq('id', targetTenantId)
    .single()

  if (fetchErr || !currentTenant) {
    return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 })
  }

  const currentSettings = ((currentTenant?.settings || {}) as Record<string, unknown>)
  const currencyType = ((currentSettings.currency_type as string) || 'USD').toUpperCase() === 'EUR' ? 'EUR' : 'USD'
  const rateMode = ((currentSettings.rate_mode as string) || 'official').toLowerCase() === 'custom' ? 'custom' : 'official'

  // ACTION 1: Live sync from BCV website (con cadena a -> b -> c y upsert en `tasa_bcv_historial`)
  if (body.action === 'sync_bcv') {
    try {
      const bcvData = await fetchLiveBcvRate({
        persistInHistorial: true,
        supabaseClient: dbClient,
      })
      const rateUsd = bcvData.rate
      const rateEur = bcvData.rateEur || 0
      const effectiveRate = currencyType === 'EUR' && rateEur > 0 ? rateEur : rateUsd

      let updatedHistory = Array.isArray(currentSettings.bcv_rates_history)
        ? [...(currentSettings.bcv_rates_history as RateHistoryEntry[])]
        : []

      // Solo insertar fila del día si vino de (a) o (b), NUNCA si vino del último recurso (c)
      if (bcvData.shouldPersistToday) {
        updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
          date: bcvData.fecha,
          rate: effectiveRate,
          rate_usd: rateUsd,
          rate_eur: rateEur > 0 ? rateEur : undefined,
          fecha_valor: bcvData.fechaValor,
          label: bcvData.fechaValor,
          source: bcvData.fuenteCodigo,
          is_manual: false,
        })
      }

      const newSettings = {
        ...currentSettings,
        bcv_rate_usd: rateUsd,
        bcv_rate_eur: rateEur > 0 ? rateEur : undefined,
        bcv_fecha_valor: bcvData.fechaValor,
        bcv_last_sync: bcvData.timestamp,
        bcv_source: bcvData.fuenteCodigo,
        bcv_rates_history: updatedHistory,
      }

      const newRateToSave = rateMode === 'custom' && typeof currentSettings.custom_rate === 'number'
        ? currentSettings.custom_rate
        : effectiveRate

      await dbClient
        .from('tenants')
        .update({
          currency_rate_bcv: newRateToSave,
          settings: newSettings,
        })
        .eq('id', targetTenantId)

      return NextResponse.json({
        success: true,
        rate: effectiveRate,
        rate_usd: rateUsd,
        rate_eur: rateEur,
        fecha: bcvData.fecha,
        fechaValor: bcvData.fechaValor,
        source: bcvData.fuenteCodigo,
        used_fallback: bcvData.usedFallback,
        persisted_today: bcvData.shouldPersistToday,
        failed_attempts: bcvData.failedAttempts,
        timestamp: bcvData.timestamp,
        rates_history: updatedHistory,
        message: bcvData.usedFallback
          ? `⚠️ Tasa obtenida mediante fallback (${bcvData.fuenteCodigo}): Bs. ${rateUsd}`
          : 'Tasas oficiales (USD & EUR) sincronizadas exitosamente por scraping directo del BCV',
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Error al sincronizar con BCV: ${(err as Error).message}` },
        { status: 502 }
      )
    }
  }

  // ACTION 2: Save / Edit historical rate for a specific date
  if (body.action === 'save_history_rate') {
    const targetDate = String(body.date || '').trim() // YYYY-MM-DD
    const inputUsd = parseFloat(body.rate_usd || body.rate)
    const inputEur = body.rate_eur ? parseFloat(body.rate_eur) : undefined

    if (!targetDate || isNaN(inputUsd) || inputUsd <= 0) {
      return NextResponse.json({ error: 'Fecha y tasa USD válidas requeridas' }, { status: 400 })
    }

    const effectiveRate = currencyType === 'EUR' && inputEur && inputEur > 0 ? inputEur : inputUsd
    const fuenteGuardada = body.source || 'manual'

    // Persistir también en la tabla `tasa_bcv_historial` con upsert (onConflict: 'fecha')
    await upsertTasaBcvHistorial({
      fecha: targetDate,
      tasa: inputUsd,
      fuente: fuenteGuardada,
      supabaseClient: dbClient,
    }).catch((e) => {
      console.warn('[BCV] No se pudo hacer upsert manual en tasa_bcv_historial:', (e as Error).message)
    })

    const updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
      date: targetDate,
      rate: effectiveRate,
      rate_usd: inputUsd,
      rate_eur: inputEur && !isNaN(inputEur) && inputEur > 0 ? inputEur : undefined,
      fecha_valor: body.fecha_valor || targetDate,
      label: body.label || body.fecha_valor || targetDate,
      source: fuenteGuardada,
      is_manual: true,
    })

    const newSettings = {
      ...currentSettings,
      bcv_rates_history: updatedHistory,
    }

    const updatePayload: Record<string, unknown> = {
      settings: newSettings,
    }

    const todayDate = getVenezuelaDateIso()
    if (targetDate === todayDate && rateMode === 'official') {
      updatePayload.currency_rate_bcv = effectiveRate
    }

    await dbClient
      .from('tenants')
      .update(updatePayload)
      .eq('id', targetTenantId)

    return NextResponse.json({
      success: true,
      rates_history: updatedHistory,
      message: `Tasa para el día ${targetDate} guardada exitosamente en tasa_bcv_historial (USD: Bs. ${inputUsd}${inputEur ? `, EUR: Bs. ${inputEur}` : ''})`,
    })
  }

  // ACTION 3: Delete rate from history
  if (body.action === 'delete_history_rate') {
    const targetDate = String(body.date || '').trim()
    if (!targetDate) {
      return NextResponse.json({ error: 'Fecha requerida para eliminar registro' }, { status: 400 })
    }

    try {
      await dbClient
        .from('tasa_bcv_historial')
        .delete()
        .eq('fecha', targetDate)
    } catch {
      // Ignorar si no existe en tasa_bcv_historial
    }

    const existingList: RateHistoryEntry[] = Array.isArray(currentSettings.bcv_rates_history)
      ? [...(currentSettings.bcv_rates_history as RateHistoryEntry[])]
      : []

    const updatedHistory = existingList.filter((item) => item.date !== targetDate)

    const newSettings = {
      ...currentSettings,
      bcv_rates_history: updatedHistory,
    }

    await dbClient
      .from('tenants')
      .update({ settings: newSettings })
      .eq('id', targetTenantId)

    return NextResponse.json({
      success: true,
      rates_history: updatedHistory,
      message: `Registro del día ${targetDate} eliminado del historial.`,
    })
  }

  // ACTION 4: Update store currency type ($ USD / € EUR) and rate mode (official / custom)
  if (body.action === 'update_store_currency') {
    if (!isSuperAdmin && !isOwner) {
      return NextResponse.json({ error: 'Solo el administrador puede configurar la moneda de la tienda' }, { status: 403 })
    }

    const newCurrencyType = body.currency_type === 'EUR' ? 'EUR' : 'USD'
    const newRateMode = body.rate_mode === 'custom' ? 'custom' : 'official'
    const newCustomRate = typeof body.custom_rate === 'number' && body.custom_rate > 0 ? body.custom_rate : null

    let newCurrencyRate: number
    if (newRateMode === 'custom' && newCustomRate && newCustomRate > 0) {
      newCurrencyRate = newCustomRate
    } else {
      const bcvRateUsd = typeof currentSettings.bcv_rate_usd === 'number' ? currentSettings.bcv_rate_usd : Number(currentTenant.currency_rate_bcv)
      const bcvRateEur = typeof currentSettings.bcv_rate_eur === 'number' ? currentSettings.bcv_rate_eur : 0
      newCurrencyRate = newCurrencyType === 'EUR' && bcvRateEur > 0 ? bcvRateEur : bcvRateUsd
    }

    const newSettings = {
      ...currentSettings,
      currency_type: newCurrencyType,
      rate_mode: newRateMode,
      custom_rate: newCustomRate,
    }

    await dbClient
      .from('tenants')
      .update({
        currency_rate_bcv: newCurrencyRate,
        settings: newSettings,
      })
      .eq('id', targetTenantId)

    return NextResponse.json({
      success: true,
      currency_type: newCurrencyType,
      rate_mode: newRateMode,
      custom_rate: newCustomRate,
      effective_rate: newCurrencyRate,
      message: `Configuración monetaria actualizada: Moneda base ${newCurrencyType}, Modo ${newRateMode === 'custom' ? 'Tasa Personalizada' : 'Tasa Oficial BCV'}`,
    })
  }

  // ACTION 5: Simple manual rate override
  const rate = parseFloat(body.rate)
  if (isNaN(rate) || rate <= 0) {
    return NextResponse.json({ error: 'Monto de tasa inválido' }, { status: 400 })
  }

  const todayDate = getVenezuelaDateIso()
  await upsertTasaBcvHistorial({
    fecha: todayDate,
    tasa: rate,
    fuente: 'manual',
    supabaseClient: dbClient,
  }).catch(() => {})

  const updatedHistory = mergeRateHistory(currentSettings.bcv_rates_history, {
    date: todayDate,
    rate,
    rate_usd: currencyType === 'USD' ? rate : (typeof currentSettings.bcv_rate_usd === 'number' ? currentSettings.bcv_rate_usd : rate),
    rate_eur: currencyType === 'EUR' ? rate : (typeof currentSettings.bcv_rate_eur === 'number' ? currentSettings.bcv_rate_eur : undefined),
    fecha_valor: getTodayFormatted(),
    label: getTodayFormatted(),
    source: 'manual',
    is_manual: true,
  })

  const newSettings = {
    ...currentSettings,
    bcv_rates_history: updatedHistory,
  }

  const { data, error } = await dbClient
    .from('tenants')
    .update({
      currency_rate_bcv: rate,
      settings: newSettings,
    })
    .eq('id', targetTenantId)
    .select('currency_rate_bcv')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rate: data.currency_rate_bcv, rates_history: updatedHistory, updated: true })
}

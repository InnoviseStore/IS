/**
 * =============================================================================
 * Módulo Central de Tasa BCV y Conversión Histórica (`src/lib/bcv.ts`)
 * =============================================================================
 *
 * ARQUITECTURA Y DOCUMENTACIÓN DE MANTENIMIENTO:
 *
 * 1. Selector CSS utilizado en el portal oficial del BCV (`https://www.bcv.org.ve/`):
 *    - USD: `#dolar strong` (bloque contenedor `<div id="dolar">` -> `<strong>`).
 *    - EUR: `#euro strong` (bloque contenedor `<div id="euro">` -> `<strong>`).
 *    - Parseo numérico: Se reemplazan los puntos de miles (`"." -> ""`) y la coma
 *      decimal (`"," -> "."`) antes de convertir a `float`, validando `tasa > 0`.
 *    - ⚠️ Nota: Si el BCV rediseña el HTML de su portal Drupal, este selector
 *      puede requerir actualización. Cualquier fallo queda registrado en logs con
 *      la fuente y el motivo exacto, activando inmediatamente la cadena de fallback.
 *
 * 2. Cadena de Obtención de Tasa (3 niveles en orden estricto):
 *    a) Scraping directo a `https://www.bcv.org.ve/` (`fuente = 'scraping-bcv'`).
 *    b) Fallback API pública: `GET https://tasa-bcv-api-production.up.railway.app/v1/rates/latest`
 *       (con respaldo secundario en `ve.dolarapi.com` si la instancia de Railway no responde)
 *       (`fuente = 'fallback-api-railway'` o `'fallback-dolarapi'`).
 *    c) Último recurso: lectura de la fila más reciente en `tasa_bcv_historial`
 *       (`ORDER BY fecha DESC LIMIT 1`). Si se llega al paso (c), **NO se inserta**
 *       una fila fantasma con la fecha de hoy; la consulta histórica arrastrará
 *       automáticamente la última tasa conocida.
 *
 * 3. Limitación conocida del Certificado SSL en Deno (Supabase Edge Functions):
 *    - En Node.js se utiliza `new https.Agent({ rejectUnauthorized: false })` porque
 *      el servidor del BCV suele omitir certificados intermedios gubernamentales.
 *    - En Deno (Edge Function `supabase/functions/sync-tasa-bcv/index.ts`), `fetch`
 *      no soporta `rejectUnauthorized: false` por petición. Para no degradar la
 *      seguridad TLS global del runtime Edge, si la verificación TLS falla en Deno,
 *      la Edge Function registra el error y pasa limpiamente a la fuente (b).
 *
 * 4. Ajuste de Zona Horaria del Cron (`pg_cron` + `pg_net`):
 *    - Hora objetivo: 1:00 PM hora de Venezuela (VET, UTC-4).
 *    - Expresión cron en UTC: `0 17 * * *` (17:00 UTC).
 * =============================================================================
 */

import https from 'https'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// TIPOS E INTERFACES
// -----------------------------------------------------------------------------
export type BcvFuenteTipo =
  | 'scraping-bcv'
  | 'fallback-api-railway'
  | 'fallback-dolarapi'
  | 'ultimo-recurso-db'
  | 'manual'

export interface BcvFailedAttemptLog {
  fuente: string
  motivo: string
  timestamp: string
}

export interface BcvRateResult {
  rate: number
  rateEur?: number
  fecha: string // YYYY-MM-DD (Hora Venezuela)
  fechaValor: string
  source: string
  fuenteCodigo: BcvFuenteTipo
  shouldPersistToday: boolean
  usedFallback: boolean
  failedAttempts: BcvFailedAttemptLog[]
  timestamp: string
}

export interface TasaBcvHistorialRow {
  id: number
  fecha: string
  tasa: number
  fuente: string
  creado_en: string
}

export interface ConversionPagoHistoricoResult {
  fechaPago: string
  fechaTasaAplicada: string
  tasaAplicada: number
  fuenteTasa: string
  montoOriginal: number
  monedaOriginal: 'USD' | 'VES'
  montoUsd: number
  montoVes: number
  esArrastreFinDeSemanaOFeriado: boolean
}

const BCV_OFFICIAL_URL = 'https://www.bcv.org.ve/'
const RAILWAY_FALLBACK_API_URL = 'https://tasa-bcv-api-production.up.railway.app/v1/rates/latest'
const DOLARAPI_MIRROR_USD_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'
const DOLARAPI_MIRROR_EUR_URL = 'https://ve.dolarapi.com/v1/euros/oficial'
const HTTP_TIMEOUT_MS = 6000

// -----------------------------------------------------------------------------
// HELPERS DE CONEXIÓN SUPABASE (SERVICE ROLE) Y FECHAS
// -----------------------------------------------------------------------------
export function getServiceRoleSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Devuelve la fecha actual en zona horaria de Venezuela (`America/Caracas`, UTC-4)
 * en formato `YYYY-MM-DD`.
 */
export function getVenezuelaDateIso(dateInput?: Date | string): string {
  const target = dateInput ? new Date(dateInput) : new Date()
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(target)
  } catch {
    const caracasOffsetMs = 4 * 60 * 60 * 1000
    return new Date(target.getTime() - caracasOffsetMs).toISOString().split('T')[0]
  }
}

/**
 * Normaliza una fecha recibida (`Date`, ISO timestamp o `YYYY-MM-DD`) a `YYYY-MM-DD`.
 */
export function normalizeDateString(fechaInput: string | Date): string {
  if (fechaInput instanceof Date) {
    return getVenezuelaDateIso(fechaInput)
  }
  const clean = String(fechaInput).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean
  }
  if (clean.includes('T')) {
    return clean.split('T')[0]
  }
  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }
  return getVenezuelaDateIso()
}

/**
 * Parsea un número de tasa reemplazando "." por "" y "," por "." antes de
 * convertir a float (Requisito 2a), soportando también números ya formateados con punto decimal.
 */
export function parseBcvRateNumber(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : NaN
  }

  const trimmed = String(raw).trim().replace(/\s+/g, '')
  if (!trimmed) return NaN

  let normalized: string
  if (trimmed.includes(',')) {
    // Formato BCV: "1.234,56780000" o "91,50000000" -> eliminar "." y cambiar "," por "."
    normalized = trimmed.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = trimmed
  }

  const value = parseFloat(normalized)
  return Number.isFinite(value) && value > 0 ? value : NaN
}

/**
 * Fetch con timeout explícito mediante `AbortController` para evitar bloqueos.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}

// -----------------------------------------------------------------------------
// FUENTE (A): SCRAPING DIRECTO A https://www.bcv.org.ve/ (`#dolar strong`)
// -----------------------------------------------------------------------------
export function scrapeDirectFromBcv(): Promise<{
  rateUsd: number
  rateEur: number
  fechaValor: string
}> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false })

    const req = https.get(
      BCV_OFFICIAL_URL,
      {
        agent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Status ${res.statusCode} desde ${BCV_OFFICIAL_URL}`))
        }

        let html = ''
        res.on('data', (chunk) => (html += chunk))
        res.on('end', () => {
          try {
            // Selector equivalente a `#dolar strong`
            const dolarSection = html.split(/id=["']dolar["']/i)[1]?.substring(0, 800)
            const dolarStrongMatch = dolarSection?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)

            // Selector equivalente a `#euro strong`
            const euroSection = html.split(/id=["']euro["']/i)[1]?.substring(0, 800)
            const euroStrongMatch = euroSection?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)

            if (!dolarStrongMatch || !dolarStrongMatch[1]) {
              return reject(
                new Error('No se encontró el selector "#dolar strong" en el HTML del BCV.')
              )
            }

            const rateUsd = parseBcvRateNumber(dolarStrongMatch[1])
            if (isNaN(rateUsd) || rateUsd <= 0) {
              return reject(
                new Error(`Valor numérico inválido en "#dolar strong": "${dolarStrongMatch[1].trim()}"`)
              )
            }

            const parsedEur = euroStrongMatch?.[1] ? parseBcvRateNumber(euroStrongMatch[1]) : NaN
            const rateEur = !isNaN(parsedEur) && parsedEur > 0 ? parsedEur : parseFloat((rateUsd * 1.08).toFixed(4))

            const dateMatch =
              html.match(/class=["'][^"']*date-display-single[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
              html.match(/Fecha\s*Valor:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)

            const rawDate = dateMatch ? dateMatch[1].replace(/\s+/g, ' ').trim() : ''
            const fallbackDate = new Date().toLocaleDateString('es-VE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            const baseDate = rawDate || fallbackDate
            const fechaValor = baseDate.charAt(0).toUpperCase() + baseDate.slice(1)

            resolve({ rateUsd, rateEur, fechaValor })
          } catch (parseErr) {
            reject(parseErr)
          }
        })
      }
    )

    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      req.destroy()
      reject(new Error(`Timeout de conexión a ${BCV_OFFICIAL_URL} tras ${HTTP_TIMEOUT_MS}ms`))
    })

    req.on('error', (err) => reject(err))
  })
}

// -----------------------------------------------------------------------------
// FUENTE (B): FALLBACK API PÚBLICA (`tasa-bcv-api-production.up.railway.app/v1/rates/latest`)
// -----------------------------------------------------------------------------
function extractUsdRateFromApiShape(payload: unknown): { rateUsd: number; rateEur?: number; fecha?: string } {
  if (!payload || typeof payload !== 'object') {
    return { rateUsd: NaN }
  }

  const obj = payload as Record<string, unknown>

  // Búsqueda flexible de la tasa USD según posibles shapes del endpoint:
  // `{ usd: 36.5 }`, `{ rate: 36.5 }`, `{ promedio: 36.5 }`, `{ data: { usd: 36.5 } }`, `{ rates: { USD: 36.5 } }`
  const directCandidates: unknown[] = [
    obj.usd,
    obj.USD,
    obj.rate,
    obj.tasa,
    obj.promedio,
    obj.value,
    obj.valor,
    obj.dolar,
  ]

  let rateUsd = NaN
  for (const candidate of directCandidates) {
    if (typeof candidate === 'number' || typeof candidate === 'string') {
      const parsed = parseBcvRateNumber(candidate)
      if (!isNaN(parsed) && parsed > 0) {
        rateUsd = parsed
        break
      }
    } else if (candidate && typeof candidate === 'object') {
      const sub = candidate as Record<string, unknown>
      const subVal = sub.rate ?? sub.value ?? sub.promedio ?? sub.tasa ?? sub.usd
      if (typeof subVal === 'number' || typeof subVal === 'string') {
        const parsed = parseBcvRateNumber(subVal)
        if (!isNaN(parsed) && parsed > 0) {
          rateUsd = parsed
          break
        }
      }
    }
  }

  if (isNaN(rateUsd)) {
    const nestedContainers = [
      obj.data,
      obj.rates,
      obj.bcv,
      (obj.monitors as Record<string, unknown>)?.usd,
    ]
    for (const container of nestedContainers) {
      if (container && typeof container === 'object') {
        const c = container as Record<string, unknown>
        const val = c.usd ?? c.USD ?? c.rate ?? c.tasa ?? c.promedio ?? c.price ?? c.value
        if (typeof val === 'number' || typeof val === 'string') {
          const parsed = parseBcvRateNumber(val)
          if (!isNaN(parsed) && parsed > 0) {
            rateUsd = parsed
            break
          }
        }
      }
    }
  }

  // Extraer EUR si está disponible en el mismo payload
  const eurCandidate =
    obj.eur ??
    obj.EUR ??
    obj.euro ??
    (obj.data as Record<string, unknown>)?.eur ??
    (obj.rates as Record<string, unknown>)?.EUR ??
    (obj.rates as Record<string, unknown>)?.eur
  const parsedEur =
    typeof eurCandidate === 'number' || typeof eurCandidate === 'string'
      ? parseBcvRateNumber(eurCandidate)
      : NaN

  const rawDate =
    (obj.date as string) ||
    (obj.fecha as string) ||
    (obj.fechaActualizacion as string) ||
    ((obj.data as Record<string, unknown>)?.date as string) ||
    undefined

  return {
    rateUsd,
    rateEur: !isNaN(parsedEur) && parsedEur > 0 ? parsedEur : undefined,
    fecha: rawDate,
  }
}

async function fetchFromFallbackApi(): Promise<{
  rateUsd: number
  rateEur: number
  fechaValor: string
  sourceLabel: string
  fuenteCodigo: BcvFuenteTipo
}> {
  const formatSpanishDate = (d: Date) => {
    const s = d.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // B.1: Intentar `https://tasa-bcv-api-production.up.railway.app/v1/rates/latest`
  try {
    const res = await fetchWithTimeout(RAILWAY_FALLBACK_API_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'InnoviseStore/1.0' },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} en Railway API`)
    }

    const json = await res.json()
    const extracted = extractUsdRateFromApiShape(json)

    if (isNaN(extracted.rateUsd) || extracted.rateUsd <= 0) {
      throw new Error(`Payload de Railway API sin tasa USD válida: ${JSON.stringify(json).slice(0, 180)}`)
    }

    const rateEur = extracted.rateEur || parseFloat((extracted.rateUsd * 1.08).toFixed(4))
    const dateObj = extracted.fecha ? new Date(extracted.fecha) : new Date()
    const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date()

    return {
      rateUsd: extracted.rateUsd,
      rateEur,
      fechaValor: formatSpanishDate(validDate),
      sourceLabel: RAILWAY_FALLBACK_API_URL,
      fuenteCodigo: 'fallback-api-railway',
    }
  } catch (railwayErr) {
    const railwayReason = railwayErr instanceof Error ? railwayErr.message : String(railwayErr)
    console.warn(
      `[BCV][FALLBACK-API] Falló ${RAILWAY_FALLBACK_API_URL} (${railwayReason}). Intentando mirror secundario (${DOLARAPI_MIRROR_USD_URL})...`
    )

    // B.2: Mirror secundario de respaldo (`ve.dolarapi.com`)
    const [usdRes, eurRes] = await Promise.all([
      fetchWithTimeout(DOLARAPI_MIRROR_USD_URL, {
        headers: { Accept: 'application/json', 'User-Agent': 'InnoviseStore/1.0' },
      }),
      fetchWithTimeout(DOLARAPI_MIRROR_EUR_URL, {
        headers: { Accept: 'application/json', 'User-Agent': 'InnoviseStore/1.0' },
      }).catch(() => null),
    ])

    if (!usdRes.ok) {
      throw new Error(
        `Railway API falló (${railwayReason}) y Mirror secundario respondió HTTP ${usdRes.status}`
      )
    }

    const jsonUsd = await usdRes.json()
    const extractedUsd = extractUsdRateFromApiShape(jsonUsd)
    if (isNaN(extractedUsd.rateUsd) || extractedUsd.rateUsd <= 0) {
      throw new Error(`Mirror secundario devolvió tasa inválida: ${JSON.stringify(jsonUsd).slice(0, 180)}`)
    }

    let rateEur = parseFloat((extractedUsd.rateUsd * 1.08).toFixed(4))
    if (eurRes && eurRes.ok) {
      try {
        const jsonEur = await eurRes.json()
        const extractedEur = extractUsdRateFromApiShape(jsonEur)
        if (!isNaN(extractedEur.rateUsd) && extractedEur.rateUsd > 0) {
          rateEur = extractedEur.rateUsd
        }
      } catch {
        // Ignorar fallo opcional de EUR
      }
    }

    const dateObj = extractedUsd.fecha ? new Date(extractedUsd.fecha) : new Date()
    const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date()

    return {
      rateUsd: extractedUsd.rateUsd,
      rateEur,
      fechaValor: formatSpanishDate(validDate),
      sourceLabel: 'Mirror Oficial BCV (dolarapi.com)',
      fuenteCodigo: 'fallback-dolarapi',
    }
  }
}

// -----------------------------------------------------------------------------
// FUENTE (C): ÚLTIMO RECURSO — LEER FILA MÁS RECIENTE DE `tasa_bcv_historial`
// -----------------------------------------------------------------------------
async function fetchLatestFromHistorialTable(
  supabaseClient?: SupabaseClient | null
): Promise<TasaBcvHistorialRow> {
  const client = supabaseClient || getServiceRoleSupabaseClient()
  if (!client) {
    throw new Error('Cliente Supabase no disponible para consultar tasa_bcv_historial.')
  }

  const { data, error } = await client
    .from('tasa_bcv_historial')
    .select('id, fecha, tasa, fuente, creado_en')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Error al leer tasa_bcv_historial: ${error.message}`)
  }

  if (!data || Number(data.tasa) <= 0) {
    throw new Error('No existen registros previos en tasa_bcv_historial.')
  }

  return {
    id: Number(data.id),
    fecha: String(data.fecha),
    tasa: Number(data.tasa),
    fuente: String(data.fuente),
    creado_en: String(data.creado_en),
  }
}

// -----------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL (PUNTO 2): OBTENCIÓN CON FALLBACK EN CADENA Y PERSISTENCIA
// -----------------------------------------------------------------------------
/**
 * Obtiene la tasa oficial del BCV intentando en estricto orden:
 *   a) Scraping directo a `https://www.bcv.org.ve/` (`#dolar strong`)
 *   b) Fallback API (`https://tasa-bcv-api-production.up.railway.app/v1/rates/latest`)
 *   c) Último recurso: fila más reciente de `tasa_bcv_historial` (`ORDER BY fecha DESC LIMIT 1`).
 *
 * Si `persistInHistorial = true` (por defecto) y la tasa provino de (a) o (b),
 * realiza automáticamente el `UPSERT` (`onConflict: 'fecha'`) en `tasa_bcv_historial`.
 * Si se llegó a (c), **NO inserta fila nueva con la fecha de hoy** (evita registros fantasma).
 */
export async function fetchLiveBcvRate(options?: {
  persistInHistorial?: boolean
  supabaseClient?: SupabaseClient | null
}): Promise<BcvRateResult> {
  const persistInHistorial = options?.persistInHistorial ?? true
  const fechaHoy = getVenezuelaDateIso()
  const failedAttempts: BcvFailedAttemptLog[] = []

  // ── INTENTO (A): Scraping directo al BCV ────────────────────────────────────
  try {
    const direct = await scrapeDirectFromBcv()
    const result: BcvRateResult = {
      rate: direct.rateUsd,
      rateEur: direct.rateEur,
      fecha: fechaHoy,
      fechaValor: direct.fechaValor,
      source: BCV_OFFICIAL_URL,
      fuenteCodigo: 'scraping-bcv',
      shouldPersistToday: true,
      usedFallback: false,
      failedAttempts,
      timestamp: new Date().toISOString(),
    }

    if (persistInHistorial) {
      await upsertTasaBcvHistorial({
        fecha: fechaHoy,
        tasa: direct.rateUsd,
        fuente: 'scraping-bcv',
        supabaseClient: options?.supabaseClient,
      }).catch((dbErr) => {
        console.error('[BCV][DB-WARN] No se pudo guardar en tasa_bcv_historial:', (dbErr as Error).message)
      })
    }

    return result
  } catch (errA) {
    const reasonA = errA instanceof Error ? errA.message : String(errA)
    failedAttempts.push({
      fuente: `scraping-bcv (${BCV_OFFICIAL_URL})`,
      motivo: reasonA,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `[BCV][FALLO FUENTE A - SCRAPING DIRECTO] Fuente: ${BCV_OFFICIAL_URL} | Motivo: ${reasonA}`
    )
  }

  // ── INTENTO (B): Fallback API Pública ───────────────────────────────────────
  try {
    const fallbackApi = await fetchFromFallbackApi()
    console.warn(
      `⚠️ [BCV][ALERTA DE FALLBACK] La tasa del día (${fechaHoy}) NO provino de la fuente primaria (scraping-bcv). Se está usando "${fallbackApi.fuenteCodigo}" (Bs. ${fallbackApi.rateUsd}). Fallos previos: ${JSON.stringify(failedAttempts)}`
    )

    const result: BcvRateResult = {
      rate: fallbackApi.rateUsd,
      rateEur: fallbackApi.rateEur,
      fecha: fechaHoy,
      fechaValor: fallbackApi.fechaValor,
      source: fallbackApi.sourceLabel,
      fuenteCodigo: fallbackApi.fuenteCodigo,
      shouldPersistToday: true,
      usedFallback: true,
      failedAttempts,
      timestamp: new Date().toISOString(),
    }

    if (persistInHistorial) {
      await upsertTasaBcvHistorial({
        fecha: fechaHoy,
        tasa: fallbackApi.rateUsd,
        fuente: fallbackApi.fuenteCodigo,
        supabaseClient: options?.supabaseClient,
      }).catch((dbErr) => {
        console.error('[BCV][DB-WARN] No se pudo guardar fallback en tasa_bcv_historial:', (dbErr as Error).message)
      })
    }

    return result
  } catch (errB) {
    const reasonB = errB instanceof Error ? errB.message : String(errB)
    failedAttempts.push({
      fuente: `fallback-api (${RAILWAY_FALLBACK_API_URL})`,
      motivo: reasonB,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `[BCV][FALLO FUENTE B - FALLBACK API] Fuente: ${RAILWAY_FALLBACK_API_URL} | Motivo: ${reasonB}`
    )
  }

  // ── INTENTO (C): Último recurso — Leer fila más reciente de `tasa_bcv_historial`
  // IMPORTANTE: NO insertar fila nueva con la fecha de hoy.
  try {
    const lastRow = await fetchLatestFromHistorialTable(options?.supabaseClient)
    console.warn(
      `🚨 [BCV][ALERTA CRÍTICA - ÚLTIMO RECURSO DB] Fallaron todas las fuentes externas (A y B) para ${fechaHoy}. Se emplea la última tasa registrada en tasa_bcv_historial: Bs. ${lastRow.tasa} (fecha ${lastRow.fecha}, fuente original: ${lastRow.fuente}). NO se insertará registro fantasma para hoy.`
    )

    return {
      rate: lastRow.tasa,
      rateEur: parseFloat((lastRow.tasa * 1.08).toFixed(4)),
      fecha: lastRow.fecha,
      fechaValor: `Última tasa oficial disponible (${lastRow.fecha})`,
      source: `Histórico DB (${lastRow.fecha})`,
      fuenteCodigo: 'ultimo-recurso-db',
      shouldPersistToday: false,
      usedFallback: true,
      failedAttempts,
      timestamp: new Date().toISOString(),
    }
  } catch (errC) {
    const reasonC = errC instanceof Error ? errC.message : String(errC)
    failedAttempts.push({
      fuente: 'ultimo-recurso-db (tasa_bcv_historial)',
      motivo: reasonC,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `❌ [BCV][FALLO TOTAL] Fallaron las fuentes A, B y C. Detalles: ${JSON.stringify(failedAttempts)}`
    )
    throw new Error(
      `No se pudo obtener la tasa oficial del BCV tras agotar las 3 fuentes. Detalles: ${failedAttempts
        .map((f) => `${f.fuente}: ${f.motivo}`)
        .join(' | ')}`
    )
  }
}

// -----------------------------------------------------------------------------
// PERSISTENCIA EN `tasa_bcv_historial` (UPSERT CON ONCONFLICT: 'fecha')
// -----------------------------------------------------------------------------
export async function upsertTasaBcvHistorial(params: {
  fecha: string
  tasa: number
  fuente?: string
  supabaseClient?: SupabaseClient | null
}): Promise<TasaBcvHistorialRow | null> {
  const client = params.supabaseClient || getServiceRoleSupabaseClient()
  if (!client) return null

  const cleanDate = normalizeDateString(params.fecha)
  const numericRate = Number(params.tasa)
  if (!cleanDate || isNaN(numericRate) || numericRate <= 0) {
    throw new Error(`Datos inválidos para upsert en tasa_bcv_historial: fecha=${cleanDate}, tasa=${params.tasa}`)
  }

  const { data, error } = await client
    .from('tasa_bcv_historial')
    .upsert(
      {
        fecha: cleanDate,
        tasa: numericRate,
        fuente: params.fuente || 'scraping-bcv',
      },
      { onConflict: 'fecha' }
    )
    .select('id, fecha, tasa, fuente, creado_en')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
    ? {
        id: Number(data.id),
        fecha: String(data.fecha),
        tasa: Number(data.tasa),
        fuente: String(data.fuente),
        creado_en: String(data.creado_en),
      }
    : null
}

// -----------------------------------------------------------------------------
// PUNTO 4: HELPER REUTILIZABLE DE CONVERSIÓN HISTÓRICA EN BACKEND
// -----------------------------------------------------------------------------
/**
 * Obtiene la tasa BCV aplicable para una fecha dada usando la regla:
 *   `fecha <= '<fecha_del_pago>' ORDER BY fecha DESC LIMIT 1`
 *
 * Esto garantiza que pagos realizados en sábados, domingos, feriados bancarios
 * o días en que todas las fuentes externas fallaron arrastren automáticamente
 * la última tasa oficial vigente publicada.
 */
export async function obtenerTasaBcvParaFecha(
  fechaPago: string | Date,
  supabaseClient?: SupabaseClient | null
): Promise<TasaBcvHistorialRow | null> {
  const client = supabaseClient || getServiceRoleSupabaseClient()
  if (!client) {
    throw new Error('No se pudo inicializar el cliente Supabase para consultar tasa_bcv_historial.')
  }

  const fechaNormalizada = normalizeDateString(fechaPago)

  const { data, error } = await client
    .from('tasa_bcv_historial')
    .select('id, fecha, tasa, fuente, creado_en')
    .lte('fecha', fechaNormalizada)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      `[BCV][QUERY-HISTORICA-ERROR] Error consultando tasa <= ${fechaNormalizada}:`,
      error.message
    )
    throw new Error(`Error al consultar tasa histórica para ${fechaNormalizada}: ${error.message}`)
  }

  if (!data || Number(data.tasa) <= 0) {
    return null
  }

  return {
    id: Number(data.id),
    fecha: String(data.fecha),
    tasa: Number(data.tasa),
    fuente: String(data.fuente),
    creado_en: String(data.creado_en),
  }
}

/**
 * Helper de negocio para convertir un pago realizado en una fecha pasada
 * (de VES a USD o de USD a VES) utilizando la tasa exacta vigente ese día
 * (`fecha <= fechaPago ORDER BY fecha DESC LIMIT 1`).
 */
export async function convertirPagoConTasaHistorica(params: {
  monto: number
  monedaOrigen: 'VES' | 'USD'
  fechaPago: string | Date
  tasaRespaldo?: number
  supabaseClient?: SupabaseClient | null
}): Promise<ConversionPagoHistoricoResult> {
  const fechaPagoStr = normalizeDateString(params.fechaPago)
  const montoNumerico = Number(params.monto) || 0

  const registroHistorico = await obtenerTasaBcvParaFecha(
    fechaPagoStr,
    params.supabaseClient
  ).catch(() => null)

  let tasaAplicada = registroHistorico?.tasa || Number(params.tasaRespaldo) || 0
  let fechaTasaAplicada = registroHistorico?.fecha || fechaPagoStr
  let fuenteTasa = registroHistorico?.fuente || 'fallback-parametro'

  // Si aún no había registros<=fechaPago y no se pasó tasaRespaldo, intentar la tasa en vivo
  if (tasaAplicada <= 0) {
    const live = await fetchLiveBcvRate({
      persistInHistorial: true,
      supabaseClient: params.supabaseClient,
    })
    tasaAplicada = live.rate
    fechaTasaAplicada = live.fecha
    fuenteTasa = live.fuenteCodigo
  }

  const montoUsd =
    params.monedaOrigen === 'USD'
      ? parseFloat(montoNumerico.toFixed(4))
      : parseFloat((montoNumerico / tasaAplicada).toFixed(4))

  const montoVes =
    params.monedaOrigen === 'VES'
      ? parseFloat(montoNumerico.toFixed(2))
      : parseFloat((montoNumerico * tasaAplicada).toFixed(2))

  return {
    fechaPago: fechaPagoStr,
    fechaTasaAplicada,
    tasaAplicada,
    fuenteTasa,
    montoOriginal: montoNumerico,
    monedaOriginal: params.monedaOrigen,
    montoUsd,
    montoVes,
    esArrastreFinDeSemanaOFeriado: fechaTasaAplicada !== fechaPagoStr,
  }
}

/**
 * Obtiene el listado reciente de `tasa_bcv_historial` y las estadísticas de observabilidad
 * (incluyendo qué días fueron guardados por fallback en lugar de scraping directo).
 */
export async function obtenerObservabilidadTasaBcv(options?: {
  limit?: number
  supabaseClient?: SupabaseClient | null
}) {
  const client = options?.supabaseClient || getServiceRoleSupabaseClient()
  if (!client) {
    return {
      historial: [] as TasaBcvHistorialRow[],
      diasFallbackCount: 0,
      cronStatus: null,
    }
  }

  const limit = options?.limit || 90

  const [historialRes, cronRpcRes] = await Promise.all([
    client
      .from('tasa_bcv_historial')
      .select('id, fecha, tasa, fuente, creado_en')
      .order('fecha', { ascending: false })
      .limit(limit),
    client.rpc('obtener_estado_cron_bcv', { p_limit: 15 }),
  ])

  const historial: TasaBcvHistorialRow[] = (historialRes.data || []).map((r: any) => ({
    id: Number(r.id),
    fecha: String(r.fecha),
    tasa: Number(r.tasa),
    fuente: String(r.fuente),
    creado_en: String(r.creado_en),
  }))

  const diasFallbackCount = historial.filter((h) => h.fuente !== 'scraping-bcv').length

  return {
    historial,
    diasFallbackCount,
    cronStatus: cronRpcRes.error ? null : cronRpcRes.data,
  }
}

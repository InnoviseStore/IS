/**
 * =============================================================================
 * Supabase Edge Function: `sync-tasa-bcv`
 * Runtime: Deno (TypeScript)
 * Deployment:
 *   supabase functions deploy sync-tasa-bcv --no-verify-jwt
 *
 * PROPÓSITO:
 * Obtiene la tasa de cambio oficial del BCV (USD) aplicando una cadena de
 * fallback resiliente y la almacena en `public.tasa_bcv_historial` mediante
 * `UPSERT` (`onConflict: 'fecha'`), evitando duplicados y registros fantasma.
 *
 * DOCUMENTACIÓN TÉCNICA Y LIMITACIONES CONOCIDAS:
 * 1. Selector CSS utilizado (Fuente Primaria - Scraping BCV):
 *    - URL: https://www.bcv.org.ve/
 *    - Selector objetivo: `#dolar strong`
 *    - Nota de mantenimiento: Si el BCV modifica la estructura DOM o los IDs
 *      de su portal (Drupal), el parser detectará la ausencia o invalidez del
 *      valor, registrará el error detallado y degradará automáticamente a la
 *      fuente de respaldo (b).
 *
 * 2. Limitación conocida del Certificado SSL en Deno (Edge Runtime):
 *    - El servidor `www.bcv.org.ve` frecuentemente presenta una cadena de
 *      certificados SSL incompleta (autoridad intermedia gubernamental no
 *      incluida en el bundle Mozilla CA de Deno).
 *    - A diferencia de Node.js (`https.Agent({ rejectUnauthorized: false })`),
 *      `fetch` en Deno Edge Runtime NO permite desactivar la verificación TLS
 *      por petición sin comprometer la seguridad global del aislado.
 *    - Por diseño de seguridad, NO se fuerza una desactivación insegura de TLS:
 *      si `fetch` hacia el BCV lanza un error de certificado TLS/SSL, se
 *      registra explícitamente en los logs y se degrada inmediatamente a la
 *      Fuente (b) (`tasa-bcv-api-production.up.railway.app`).
 *
 * 3. Ajuste de Zona Horaria del Cron (`pg_cron` + `pg_net`):
 *    - Horario objetivo: 1:00 PM hora de Venezuela (VET, UTC-4).
 *    - Expresión en `pg_cron` (que opera en UTC): `0 17 * * *` (17:00 UTC).
 * =============================================================================
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts'

// -----------------------------------------------------------------------------
// TIPOS E INTERFACES
// -----------------------------------------------------------------------------
export type TasaFuente =
  | 'scraping-bcv'
  | 'fallback-api-railway'
  | 'fallback-dolarapi'
  | 'ultimo-recurso-db'

export interface IntentoFallidoLog {
  fuente: string
  motivo: string
  timestamp: string
}

export interface ResultadoObtencionTasa {
  tasa: number
  fuente: TasaFuente
  fecha: string
  debeInsertarEnDb: boolean
  usandoFallback: boolean
  intentosFallidos: IntentoFallidoLog[]
}

const BCV_URL = 'https://www.bcv.org.ve/'
const RAILWAY_FALLBACK_URL = 'https://tasa-bcv-api-production.up.railway.app/v1/rates/latest'
const SECONDARY_FALLBACK_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'
const HTTP_TIMEOUT_MS = 8000

// -----------------------------------------------------------------------------
// UTILIDADES DE PARSEO Y FECHA
// -----------------------------------------------------------------------------

/**
 * Obtiene la fecha actual en zona horaria de Venezuela (America/Caracas, UTC-4)
 * en formato ISO `YYYY-MM-DD`.
 */
function obtenerFechaHoyVenezuela(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(new Date())
  } catch {
    // Fallback manual UTC-4
    const now = new Date()
    const caracasTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    return caracasTime.toISOString().split('T')[0]
  }
}

/**
 * Parsea un string numérico en formato venezolano/europeo ("36,50000000" o "1.234,56")
 * reemplazando "." por "" y "," por "." antes de convertir a float.
 * Si el string ya viene en formato anglosajón estándar ("36.5000") sin comas,
 * lo convierte directamente.
 */
function parsearNumeroTasa(rawValor: string | number): number {
  if (typeof rawValor === 'number') {
    return Number.isFinite(rawValor) && rawValor > 0 ? rawValor : NaN
  }

  const limpio = String(rawValor).trim().replace(/\s+/g, '')
  if (!limpio) return NaN

  let normalizado: string
  if (limpio.includes(',')) {
    // Regla explícita del requerimiento 2a:
    // Reemplazar "." por "" (separador de miles) y "," por "." (separador decimal)
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else {
    normalizado = limpio
  }

  const numero = parseFloat(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : NaN
}

/**
 * Wrapper de `fetch` con `AbortController` para asegurar que ninguna llamada
 * HTTP bloquee la ejecución del cron indefinidamente.
 */
async function fetchConTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

// -----------------------------------------------------------------------------
// FUENTE (A): SCRAPING DIRECTO A https://www.bcv.org.ve/ (`#dolar strong`)
// -----------------------------------------------------------------------------
async function obtenerDesdeScrapingBcv(): Promise<number> {
  const response = await fetchConTimeout(BCV_URL, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} desde ${BCV_URL}`)
  }

  const html = await response.text()

  // Intento 1: Selección DOM estricta con `#dolar strong`
  let rawRateText: string | null = null
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const strongElement = doc?.querySelector('#dolar strong')
    if (strongElement && strongElement.textContent) {
      rawRateText = strongElement.textContent
    }
  } catch {
    // Si falla el parser WASM, usamos regex focalizado en el bloque id="dolar"
  }

  // Intento 2 (Respaldo sobre el mismo HTML): Regex focalizado en `#dolar ... <strong>`
  if (!rawRateText) {
    const bloqueDolar = html.split(/id=["']dolar["']/i)[1]?.substring(0, 800)
    const matchStrong = bloqueDolar?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
    if (matchStrong?.[1]) {
      rawRateText = matchStrong[1]
    }
  }

  if (!rawRateText) {
    throw new Error('No se encontró el selector "#dolar strong" en el HTML devuelto por el BCV.')
  }

  const tasa = parsearNumeroTasa(rawRateText)
  if (isNaN(tasa) || tasa <= 0) {
    throw new Error(`Valor numérico inválido en "#dolar strong": "${rawRateText.trim()}"`)
  }

  return tasa
}

// -----------------------------------------------------------------------------
// FUENTE (B): FALLBACK API PÚBLICA (Railway / Mirror BCV)
// -----------------------------------------------------------------------------

/**
 * Inspecciona el payload JSON de la API de respaldo para extraer el valor de USD
 * sin importar variaciones menores en el shape (`usd`, `rate`, `promedio`, `data.usd`, etc.).
 */
function extraerTasaDePayloadApi(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    return NaN
  }

  const obj = payload as Record<string, unknown>

  // Candidatos directos en primer nivel
  const candidatosDirectos: unknown[] = [
    obj.usd,
    obj.USD,
    obj.rate,
    obj.tasa,
    obj.promedio,
    obj.value,
    obj.valor,
    obj.dolar,
  ]

  for (const candidato of candidatosDirectos) {
    if (typeof candidato === 'number' || typeof candidato === 'string') {
      const parsed = parsearNumeroTasa(candidato)
      if (!isNaN(parsed) && parsed > 0) return parsed
    } else if (candidato && typeof candidato === 'object') {
      const sub = candidato as Record<string, unknown>
      const subVal = sub.rate ?? sub.value ?? sub.promedio ?? sub.tasa ?? sub.usd
      if (typeof subVal === 'number' || typeof subVal === 'string') {
        const parsed = parsearNumeroTasa(subVal)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
  }

  // Candidatos anidados comunes (`data`, `rates`, `bcv`, `monitors.usd`)
  const contenedores = [obj.data, obj.rates, obj.bcv, (obj.monitors as Record<string, unknown>)?.usd]
  for (const contenedor of contenedores) {
    if (contenedor && typeof contenedor === 'object') {
      const c = contenedor as Record<string, unknown>
      const val = c.usd ?? c.USD ?? c.rate ?? c.tasa ?? c.promedio ?? c.price ?? c.value
      if (typeof val === 'number' || typeof val === 'string') {
        const parsed = parsearNumeroTasa(val)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
  }

  return NaN
}

async function obtenerDesdeFallbackApi(): Promise<{ tasa: number; fuente: TasaFuente }> {
  // B.1: Endpoint primario indicado en la especificación (Railway)
  try {
    const response = await fetchConTimeout(RAILWAY_FALLBACK_URL, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'InnoviseStore-BCV-Sync/1.0' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} desde ${RAILWAY_FALLBACK_URL}`)
    }

    const payload = await response.json()
    const tasa = extraerTasaDePayloadApi(payload)

    if (isNaN(tasa) || tasa <= 0) {
      throw new Error(
        `Shape inesperado o tasa inválida en respuesta de Railway: ${JSON.stringify(payload).slice(0, 200)}`
      )
    }

    return { tasa, fuente: 'fallback-api-railway' }
  } catch (railwayErr) {
    const motivoRailway = railwayErr instanceof Error ? railwayErr.message : String(railwayErr)
    console.warn(
      `[BCV-SYNC][FALLBACK-RAILWAY-ERROR] Falló ${RAILWAY_FALLBACK_URL}: ${motivoRailway}. Intentando mirror secundario (${SECONDARY_FALLBACK_URL})...`
    )

    // B.2: Si la instancia de Railway está inactiva o da timeout, probamos el mirror oficial secundario
    const responseSec = await fetchConTimeout(SECONDARY_FALLBACK_URL, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'InnoviseStore-BCV-Sync/1.0' },
    })

    if (!responseSec.ok) {
      throw new Error(
        `Railway falló (${motivoRailway}) y Mirror secundario devolvió HTTP ${responseSec.status}`
      )
    }

    const payloadSec = await responseSec.json()
    const tasaSec = extraerTasaDePayloadApi(payloadSec)

    if (isNaN(tasaSec) || tasaSec <= 0) {
      throw new Error(`Tasa inválida en Mirror secundario: ${JSON.stringify(payloadSec).slice(0, 200)}`)
    }

    return { tasa: tasaSec, fuente: 'fallback-dolarapi' }
  }
}

// -----------------------------------------------------------------------------
// FUENTE (C): ÚLTIMO RECURSO — LEER FILA MÁS RECIENTE DE `tasa_bcv_historial`
// -----------------------------------------------------------------------------
async function obtenerUltimaTasaConocidaDb(
  supabase: SupabaseClient
): Promise<{ tasa: number; fechaUltima: string }> {
  const { data, error } = await supabase
    .from('tasa_bcv_historial')
    .select('fecha, tasa, fuente')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Error consultando tasa_bcv_historial: ${error.message}`)
  }

  if (!data || Number(data.tasa) <= 0) {
    throw new Error('La tabla tasa_bcv_historial aún no contiene registros previos válidos.')
  }

  return {
    tasa: Number(data.tasa),
    fechaUltima: String(data.fecha),
  }
}

// -----------------------------------------------------------------------------
// ORQUESTADOR CON FALLBACK EN CADENA (a -> b -> c)
// -----------------------------------------------------------------------------
export async function obtenerTasaConFallbackEnCadena(
  supabase: SupabaseClient
): Promise<ResultadoObtencionTasa> {
  const fechaHoy = obtenerFechaHoyVenezuela()
  const intentosFallidos: IntentoFallidoLog[] = []

  // 1. Intento (a): Scraping directo a https://www.bcv.org.ve/
  try {
    const tasaScraping = await obtenerDesdeScrapingBcv()
    console.info(
      `[BCV-SYNC][OK] Tasa obtenida exitosamente por scraping directo (${BCV_URL}): Bs. ${tasaScraping} para fecha ${fechaHoy}`
    )
    return {
      tasa: tasaScraping,
      fuente: 'scraping-bcv',
      fecha: fechaHoy,
      debeInsertarEnDb: true,
      usandoFallback: false,
      intentosFallidos,
    }
  } catch (errA) {
    const motivoA = errA instanceof Error ? errA.message : String(errA)
    intentosFallidos.push({
      fuente: 'scraping-bcv (https://www.bcv.org.ve/)',
      motivo: motivoA,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `[BCV-SYNC][FALLO FUENTE A - SCRAPING BCV] No se pudo obtener tasa desde ${BCV_URL}. Motivo: ${motivoA}`
    )
  }

  // 2. Intento (b): Fallback API Pública
  try {
    const { tasa: tasaApi, fuente: fuenteApi } = await obtenerDesdeFallbackApi()
    console.warn(
      `⚠️ [BCV-SYNC][ALERTA DE FALLBACK] La tasa del día (${fechaHoy}) NO provino del scraping primario del BCV. Se obtuvo Bs. ${tasaApi} mediante ${fuenteApi}. Fallos previos: ${JSON.stringify(intentosFallidos)}`
    )
    return {
      tasa: tasaApi,
      fuente: fuenteApi,
      fecha: fechaHoy,
      debeInsertarEnDb: true,
      usandoFallback: true,
      intentosFallidos,
    }
  } catch (errB) {
    const motivoB = errB instanceof Error ? errB.message : String(errB)
    intentosFallidos.push({
      fuente: `fallback-api (${RAILWAY_FALLBACK_URL})`,
      motivo: motivoB,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `[BCV-SYNC][FALLO FUENTE B - FALLBACK API] Falló la API de respaldo. Motivo: ${motivoB}`
    )
  }

  // 3. Intento (c): Último recurso — Leer la fila más reciente de `tasa_bcv_historial`
  // CRITERIO DE ACEPTACIÓN: NO insertar una fila nueva con la fecha de hoy ("registro fantasma").
  try {
    const { tasa: ultimaTasa, fechaUltima } = await obtenerUltimaTasaConocidaDb(supabase)
    console.warn(
      `🚨 [BCV-SYNC][ALERTA CRÍTICA - ÚLTIMO RECURSO DB] Todas las fuentes externas (A y B) fallaron para ${fechaHoy}. Se mantiene la última tasa histórica conocida (Bs. ${ultimaTasa} del ${fechaUltima}). NO se insertará fila fantasma para hoy.`
    )
    return {
      tasa: ultimaTasa,
      fuente: 'ultimo-recurso-db',
      fecha: fechaUltima,
      debeInsertarEnDb: false, // Evita registro fantasma
      usandoFallback: true,
      intentosFallidos,
    }
  } catch (errC) {
    const motivoC = errC instanceof Error ? errC.message : String(errC)
    intentosFallidos.push({
      fuente: 'ultimo-recurso-db (tasa_bcv_historial)',
      motivo: motivoC,
      timestamp: new Date().toISOString(),
    })
    console.error(
      `❌ [BCV-SYNC][FALLO TOTAL] Fallaron las fuentes A, B y C: ${JSON.stringify(intentosFallidos)}`
    )
    throw new Error(
      `Fallo total al obtener tasa BCV. Detalles: ${intentosFallidos.map((i) => `${i.fuente}: ${i.motivo}`).join(' | ')}`
    )
  }
}

// -----------------------------------------------------------------------------
// HANDLER HTTP DE LA EDGE FUNCTION
// -----------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[BCV-SYNC][CONFIG-ERROR] Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const resultado = await obtenerTasaConFallbackEnCadena(supabase)

    let registroGuardado = null

    // Solo hacemos UPSERT si la tasa provino de (a) o (b).
    // Si provino de (c), NO insertamos fila con la fecha de hoy.
    if (resultado.debeInsertarEnDb) {
      const { data, error: upsertError } = await supabase
        .from('tasa_bcv_historial')
        .upsert(
          {
            fecha: resultado.fecha,
            tasa: resultado.tasa,
            fuente: resultado.fuente,
          },
          { onConflict: 'fecha' }
        )
        .select('*')
        .single()

      if (upsertError) {
        console.error(
          `[BCV-SYNC][DB-UPSERT-ERROR] Error al hacer upsert en tasa_bcv_historial: ${upsertError.message}`
        )
        throw new Error(`Error al guardar en tasa_bcv_historial: ${upsertError.message}`)
      }

      registroGuardado = data
    }

    return new Response(
      JSON.stringify({
        success: true,
        fecha: resultado.fecha,
        tasa: resultado.tasa,
        fuente: resultado.fuente,
        insertado_en_db: resultado.debeInsertarEnDb,
        alerta_fallback: resultado.usandoFallback
          ? `ADVERTENCIA: No se usó la fuente primaria (scraping-bcv). Fuente empleada: ${resultado.fuente}`
          : null,
        intentos_fallidos: resultado.intentosFallidos,
        registro: registroGuardado,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

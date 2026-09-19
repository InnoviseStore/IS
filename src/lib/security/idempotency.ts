import { createClient } from '@supabase/supabase-js'

interface IdempotencyRecord {
  key: string
  tenantId: string
  responsePayload: any
  statusCode: number
  createdAt: number
}

declare global {
  var __isIdempotencyCache: Map<string, IdempotencyRecord> | undefined
}

const memoryCache: Map<string, IdempotencyRecord> =
  globalThis.__isIdempotencyCache || (globalThis.__isIdempotencyCache = new Map())

const TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Consulta si una llave de idempotencia ya fue procesada exitosamente en las últimas 24h.
 */
export async function checkIdempotency(
  key: string | null | undefined,
  tenantId: string
): Promise<{ exists: boolean; payload?: any; statusCode?: number }> {
  if (!key || !key.trim()) return { exists: false }
  const cleanKey = `${tenantId}:${key.trim()}`
  const now = Date.now()

  // 1. Verificar cache en memoria ultrarrápida
  const cached = memoryCache.get(cleanKey)
  if (cached && now - cached.createdAt <= TTL_MS) {
    return { exists: true, payload: cached.responsePayload, statusCode: cached.statusCode }
  }

  // 2. Verificar en la base de datos (persistencia distribuida)
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('idempotency_keys')
      .select('response_payload, status_code, created_at')
      .eq('key', key.trim())
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (data && data.response_payload) {
      memoryCache.set(cleanKey, {
        key: key.trim(),
        tenantId,
        responsePayload: data.response_payload,
        statusCode: data.status_code || 200,
        createdAt: new Date(data.created_at).getTime(),
      })
      return { exists: true, payload: data.response_payload, statusCode: data.status_code || 200 }
    }
  } catch (err) {
    // Si la tabla aún no existe o falla la conexión, continuar sin bloquear
  }

  return { exists: false }
}

/**
 * Registra una llave de idempotencia con su respuesta exitosa.
 */
export async function recordIdempotency(
  key: string | null | undefined,
  tenantId: string,
  payload: any,
  statusCode = 200
): Promise<void> {
  if (!key || !key.trim()) return
  const cleanKey = `${tenantId}:${key.trim()}`
  const now = Date.now()

  // 1. Guardar en memoria
  memoryCache.set(cleanKey, {
    key: key.trim(),
    tenantId,
    responsePayload: payload,
    statusCode,
    createdAt: now,
  })

  // Limpiar memoria si supera 5000 entradas
  if (memoryCache.size > 5000) {
    for (const [k, v] of memoryCache.entries()) {
      if (now - v.createdAt > TTL_MS) {
        memoryCache.delete(k)
      }
    }
  }

  // 2. Guardar en base de datos de manera no bloqueante
  try {
    const supabase = getAdminClient()
    await supabase.from('idempotency_keys').upsert({
      key: key.trim(),
      tenant_id: tenantId,
      response_payload: payload,
      status_code: statusCode,
      created_at: new Date(now).toISOString(),
    })
  } catch {
    // Fallo silencioso en DB
  }
}

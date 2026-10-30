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

export interface LivePresenceRecord {
  userId: string
  tenantId: string
  fullName: string
  email: string
  role: string
  tenantName?: string
  connectedAt: number // timestamp ms de inicio de sesión
  lastActive: number // timestamp ms de último latido
  sessionId?: string
  minutesAgo?: number
  connectedSeconds?: number
  connectedMinutes?: number
}

declare global {
  var __isLivePresence: Map<string, LivePresenceRecord> | undefined
}

const presenceMap: Map<string, LivePresenceRecord> =
  globalThis.__isLivePresence || (globalThis.__isLivePresence = new Map())

const INACTIVE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutos para considerar conectado en vivo
const SESSION_CONTINUITY_MS = 30 * 60 * 1000 // 30 minutos para conservar el inicio de sesión (connectedAt)
const CONCURRENT_ACTIVE_WINDOW_MS = 90 * 1000 // 90 segundos para considerar dispositivo activo simultáneo

// POST: Heartbeat de presencia periódica & Control de Sesión Única
export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json().catch(() => ({}))
    const { action, sessionId, sessionStartedAt, activeTenantId, force_takeover } = body
    const now = Date.now()
    const supabase = getAdminClient()

    // 1. Desconexión explícita
    if (action === 'logout') {
      const current = presenceMap.get(auth.userId)
      if (current && (!sessionId || current.sessionId === sessionId)) {
        presenceMap.delete(auth.userId)
      }

      // Limpiar también del registro persistente en tenant.settings._live_presence
      try {
        const targetTid = current?.tenantId || auth.tenantId
        if (targetTid) {
          const { data: tenantRow } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', targetTid)
            .maybeSingle()
          if (tenantRow?.settings && typeof tenantRow.settings === 'object') {
            const settingsObj = { ...(tenantRow.settings as Record<string, any>) }
            if (settingsObj._live_presence && typeof settingsObj._live_presence === 'object') {
              const nextPresence = { ...settingsObj._live_presence }
              delete nextPresence[auth.userId]
              settingsObj._live_presence = nextPresence
              await supabase.from('tenants').update({ settings: settingsObj }).eq('id', targetTid)
            }
          }
        }
      } catch {
        // Ignorar error de limpieza
      }

      return NextResponse.json({ success: true, loggedOut: true })
    }

    const existing = presenceMap.get(auth.userId)

    // 2. Comprobar si hay otra sesión activa simultánea en otro dispositivo
    if (existing && existing.sessionId && sessionId && existing.sessionId !== sessionId) {
      const isOtherDeviceActive = now - existing.lastActive < CONCURRENT_ACTIVE_WINDOW_MS

      if (isOtherDeviceActive) {
        if (action === 'check_session') {
          return NextResponse.json({
            activeOnOtherDevice: true,
            lastActive: existing.lastActive,
          })
        }

        if (!force_takeover) {
          return NextResponse.json({
            forcedLogout: true,
            reason: 'concurrent_session',
            message: 'Tu sesión está activa en otro dispositivo. Solo se permite 1 dispositivo conectado a la vez.',
          })
        }
      }
    }

    // 3. Obtener perfil del usuario y su tienda
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, tenant_id, tenants(id, name, settings)')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profile) {
      const effectiveTenantId =
        (auth.isSuperAdmin && activeTenantId) ? activeTenantId : (profile.tenant_id || auth.tenantId)

      let tenantName = (profile.tenants as any)?.name || 'IS System'
      let tenantSettingsObj: Record<string, any> | null =
        (profile.tenants as any)?.settings && typeof (profile.tenants as any)?.settings === 'object'
          ? { ...(profile.tenants as any).settings }
          : null

      // Si el superadmin cambió de tienda activa, consultar el nombre de esa tienda
      if (effectiveTenantId && effectiveTenantId !== profile.tenant_id) {
        const { data: switchedTenant } = await supabase
          .from('tenants')
          .select('id, name, settings')
          .eq('id', effectiveTenantId)
          .maybeSingle()
        if (switchedTenant) {
          tenantName = switchedTenant.name || tenantName
          tenantSettingsObj =
            switchedTenant.settings && typeof switchedTenant.settings === 'object'
              ? { ...(switchedTenant.settings as Record<string, any>) }
              : null
        }
      }

      // Determinar connectedAt (inicio de la sesión actual)
      const persistedUserRecord =
        tenantSettingsObj?._live_presence?.[auth.userId] as LivePresenceRecord | undefined

      let connectedAt = now
      if (
        typeof sessionStartedAt === 'number' &&
        sessionStartedAt > 0 &&
        sessionStartedAt <= now &&
        now - sessionStartedAt < 24 * 60 * 60 * 1000
      ) {
        connectedAt = sessionStartedAt
      } else if (existing && now - existing.lastActive <= SESSION_CONTINUITY_MS && existing.connectedAt) {
        connectedAt = existing.connectedAt
      } else if (
        persistedUserRecord &&
        now - persistedUserRecord.lastActive <= SESSION_CONTINUITY_MS &&
        persistedUserRecord.connectedAt
      ) {
        connectedAt = persistedUserRecord.connectedAt
      }

      const effectiveRole = auth.isSuperAdmin ? 'superadmin' : (profile.role || auth.role || 'cajero')

      const record: LivePresenceRecord = {
        userId: auth.userId,
        tenantId: effectiveTenantId,
        fullName: profile.full_name || auth.email?.split('@')[0] || 'Colaborador',
        email: profile.email || auth.email || '',
        role: effectiveRole,
        tenantName,
        connectedAt,
        lastActive: now,
        sessionId: sessionId || existing?.sessionId || persistedUserRecord?.sessionId,
      }

      presenceMap.set(auth.userId, record)

      // 4. Persistir en tenant.settings._live_presence para compartir estado entre instancias Serverless (Netlify)
      try {
        const targetTenantIdForPersistence = profile.tenant_id || effectiveTenantId
        if (targetTenantIdForPersistence) {
          let baseSettings = tenantSettingsObj
          if (!baseSettings || effectiveTenantId !== profile.tenant_id) {
            const { data: tRow } = await supabase
              .from('tenants')
              .select('settings')
              .eq('id', targetTenantIdForPersistence)
              .maybeSingle()
            baseSettings =
              tRow?.settings && typeof tRow.settings === 'object'
                ? { ...(tRow.settings as Record<string, any>) }
                : {}
          }

          const currentPresenceMap: Record<string, LivePresenceRecord> =
            baseSettings._live_presence && typeof baseSettings._live_presence === 'object'
              ? { ...baseSettings._live_presence }
              : {}

          // Limpiar registros inactivos (> 15 min)
          for (const [uid, rec] of Object.entries(currentPresenceMap)) {
            if (!rec || now - (rec.lastActive || 0) > 15 * 60 * 1000) {
              delete currentPresenceMap[uid]
            }
          }

          currentPresenceMap[auth.userId] = record
          baseSettings._live_presence = currentPresenceMap

          await supabase
            .from('tenants')
            .update({ settings: baseSettings })
            .eq('id', targetTenantIdForPersistence)
        }
      } catch {
        // Ignorar fallo de escritura en settings
      }

      // 5. Intentar actualizar last_active_at en profiles si la columna existe
      try {
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date(now).toISOString() })
          .eq('id', auth.userId)
      } catch {
        // Ignorar si la columna no existe en DB
      }

      return NextResponse.json({
        success: true,
        timestamp: now,
        connectedAt,
        sessionId: record.sessionId,
      })
    }

    return NextResponse.json({ success: true, timestamp: now, sessionId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: Consultar usuarios activos en vivo con tiempo de conexión exacto
export async function GET(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const now = Date.now()
    const { searchParams } = new URL(req.url)
    const requestedTenantId = searchParams.get('tenant_id')
    const filterAll = auth.isSuperAdmin && searchParams.get('all') !== 'false'
    const targetTenantId = (auth.isSuperAdmin && requestedTenantId) ? requestedTenantId : auth.tenantId

    // Limpiar entradas muy viejas (> 15 minutos) en memoria
    for (const [uid, record] of presenceMap.entries()) {
      if (now - record.lastActive > 15 * 60 * 1000) {
        presenceMap.delete(uid)
      }
    }

    // Mapa unificado (Memoria + Base de Datos para soportar múltiples instancias Serverless)
    const mergedMap = new Map<string, LivePresenceRecord>()

    for (const [uid, record] of presenceMap.entries()) {
      if (now - record.lastActive <= INACTIVE_THRESHOLD_MS) {
        mergedMap.set(uid, record)
      }
    }

    const supabase = getAdminClient()

    // Leer registros persistidos en tenants.settings._live_presence
    try {
      let tenantsQuery = supabase.from('tenants').select('id, name, settings')
      if (!filterAll && targetTenantId) {
        tenantsQuery = tenantsQuery.eq('id', targetTenantId)
      }
      const { data: tenantsData } = await tenantsQuery
      if (Array.isArray(tenantsData)) {
        for (const t of tenantsData) {
          const settings = (t.settings || {}) as Record<string, any>
          const liveObj = settings._live_presence
          if (liveObj && typeof liveObj === 'object') {
            for (const [uid, rec] of Object.entries(liveObj as Record<string, LivePresenceRecord>)) {
              if (!rec || typeof rec.lastActive !== 'number') continue
              if (now - rec.lastActive <= INACTIVE_THRESHOLD_MS) {
                const prev = mergedMap.get(uid)
                if (!prev || rec.lastActive >= prev.lastActive) {
                  mergedMap.set(uid, {
                    ...rec,
                    tenantName: rec.tenantName || t.name,
                    connectedAt: rec.connectedAt || prev?.connectedAt || rec.lastActive,
                  })
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignorar error de lectura de settings
    }

    // Fallback adicional a profiles.last_active_at si existe la columna
    try {
      let q = supabase
        .from('profiles')
        .select('id, full_name, email, role, tenant_id, last_active_at, tenants(name)')
        .order('last_active_at', { ascending: false })
        .limit(30)

      if (!filterAll && targetTenantId) {
        q = q.eq('tenant_id', targetTenantId)
      }

      const { data: dbProfiles } = await q
      if (dbProfiles) {
        for (const p of dbProfiles) {
          if (p.last_active_at) {
            const lastActiveMs = new Date(p.last_active_at).getTime()
            if (now - lastActiveMs <= INACTIVE_THRESHOLD_MS && !mergedMap.has(p.id)) {
              mergedMap.set(p.id, {
                userId: p.id,
                tenantId: p.tenant_id,
                fullName: p.full_name || p.email?.split('@')[0] || 'Usuario',
                email: p.email || '',
                role: p.role || 'cajero',
                tenantName: (p.tenants as any)?.name || 'IS System',
                connectedAt: lastActiveMs,
                lastActive: lastActiveMs,
              })
            }
          }
        }
      }
    } catch {
      // Ignorar si last_active_at no existe en profiles
    }

    // Filtrar según permisos y calcular tiempos de conexión y actividad
    const activeList: LivePresenceRecord[] = []
    for (const record of mergedMap.values()) {
      const matchesScope =
        filterAll ||
        record.tenantId === targetTenantId ||
        (auth.isSuperAdmin && (!requestedTenantId || record.tenantId === requestedTenantId))

      if (matchesScope) {
        const connectedAt = record.connectedAt && record.connectedAt <= record.lastActive
          ? record.connectedAt
          : record.lastActive
        const minutesAgo = Math.max(0, Math.floor((now - record.lastActive) / 60000))
        const connectedSeconds = Math.max(1, Math.floor((now - connectedAt) / 1000))
        const connectedMinutes = Math.max(0, Math.floor(connectedSeconds / 60))

        activeList.push({
          ...record,
          connectedAt,
          minutesAgo,
          connectedSeconds,
          connectedMinutes,
        })
      }
    }

    // Ordenar: primero los más recientes
    activeList.sort((a, b) => b.lastActive - a.lastActive)

    return NextResponse.json({
      success: true,
      users: activeList,
      activeCount: activeList.length,
      total: activeList.length,
      isSuperAdmin: auth.isSuperAdmin,
      timestamp: now,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

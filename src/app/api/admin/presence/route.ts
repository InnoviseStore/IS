import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

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
  lastActive: number // timestamp ms
  sessionId?: string
}

declare global {
  var __isLivePresence: Map<string, LivePresenceRecord> | undefined
}

const presenceMap: Map<string, LivePresenceRecord> =
  globalThis.__isLivePresence || (globalThis.__isLivePresence = new Map())

const INACTIVE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutos
const CONCURRENT_ACTIVE_WINDOW_MS = 90 * 1000 // 90 segundos para considerar dispositivo activo simultáneo

// POST: Heartbeat de presencia periódica & Control de Sesión Única
export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json().catch(() => ({}))
    const { action, sessionId, force_takeover } = body
    const now = Date.now()

    // 1. Desconexión explícita
    if (action === 'logout') {
      const current = presenceMap.get(auth.userId)
      if (current && (!sessionId || current.sessionId === sessionId)) {
        presenceMap.delete(auth.userId)
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
          // Sesión concurrente detectada: este dispositivo debe cerrarse
          return NextResponse.json({
            forcedLogout: true,
            reason: 'concurrent_session',
            message: 'Tu sesión está activa en otro dispositivo. Solo se permite 1 dispositivo conectado a la vez.',
          })
        }
      }
    }

    const supabase = getAdminClient()

    // 3. Obtener/actualizar perfil del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, tenant_id, tenants(name)')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profile) {
      const tenantName = (profile.tenants as any)?.name || 'IS System'
      presenceMap.set(auth.userId, {
        userId: auth.userId,
        tenantId: profile.tenant_id || auth.tenantId,
        fullName: profile.full_name || 'Colaborador',
        email: profile.email || '',
        role: profile.role || 'cajero',
        tenantName,
        lastActive: now,
        sessionId: sessionId || existing?.sessionId,
      })

      // Actualizar en base de datos de manera silenciosa
      try {
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date(now).toISOString() })
          .eq('id', auth.userId)
      } catch {
        // Ignorar si la columna no existe en DB
      }
    }

    return NextResponse.json({ success: true, timestamp: now, sessionId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: Consultar usuarios activos en vivo
export async function GET(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const now = Date.now()
    const { searchParams } = new URL(req.url)
    const filterAll = auth.isSuperAdmin && searchParams.get('all') === 'true'

    // Limpiar entradas muy viejas (> 15 minutos)
    for (const [uid, record] of presenceMap.entries()) {
      if (now - record.lastActive > 15 * 60 * 1000) {
        presenceMap.delete(uid)
      }
    }

    // Filtrar activos en los últimos 5 minutos
    const activeList: LivePresenceRecord[] = []
    for (const record of presenceMap.values()) {
      if (now - record.lastActive <= INACTIVE_THRESHOLD_MS) {
        if (filterAll || auth.isSuperAdmin) {
          activeList.push(record)
        } else if (record.tenantId === auth.tenantId) {
          activeList.push(record)
        }
      }
    }

    // Si la memoria del servidor está vacía (ej. reinicio reciente), fallback a la DB buscando profiles
    if (activeList.length === 0) {
      const supabase = getAdminClient()
      try {
        let q = supabase
          .from('profiles')
          .select('id, full_name, email, role, tenant_id, last_active_at, tenants(name)')
          .order('last_active_at', { ascending: false })
          .limit(20)

        if (!filterAll && !auth.isSuperAdmin) {
          q = q.eq('tenant_id', auth.tenantId)
        }

        const { data: dbProfiles } = await q
        if (dbProfiles) {
          for (const p of dbProfiles) {
            if (p.last_active_at) {
              const diff = now - new Date(p.last_active_at).getTime()
              if (diff <= INACTIVE_THRESHOLD_MS) {
                activeList.push({
                  userId: p.id,
                  tenantId: p.tenant_id,
                  fullName: p.full_name,
                  email: p.email,
                  role: p.role,
                  tenantName: (p.tenants as any)?.name,
                  lastActive: new Date(p.last_active_at).getTime(),
                })
              }
            }
          }
        }
      } catch {
        // Ignorar fallo de columna en DB
      }
    }

    return NextResponse.json({
      success: true,
      users: activeList,
      total: activeList.length,
      timestamp: now,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

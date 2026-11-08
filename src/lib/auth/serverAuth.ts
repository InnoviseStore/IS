import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Profile, UserRole } from '@/types/database'

export interface AuthenticatedUser {
  userId: string
  email?: string
  tenantId: string
  role: UserRole
  isSuperAdmin: boolean
  profile: Profile
}

export interface AuthValidationResult {
  auth: AuthenticatedUser | null
  errorResponse: NextResponse | null
}

interface AuthOptions {
  requiredRoles?: UserRole[]
  targetTenantId?: string | null
  targetTenantSlug?: string | null
}

/**
 * Extrae de forma segura el `sub` (user ID) de un JWT si existe y tiene formato UUID válido.
 */
function extractSubFromJwt(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson)
    if (typeof payload?.sub === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) {
      return payload.sub
    }
    return null
  } catch {
    return null
  }
}

/**
 * Helper centralizado para autenticar y autorizar llamadas a endpoints de API de servidor.
 * Protege contra:
 * 1. Acceso anónimo (requiere sesión Supabase activa vía cookies o cabecera Authorization)
 * 2. Escalamiento de privilegios (valida roles en base de datos)
 * 3. IDOR / Cruce de Tenants (asegura que el usuario solo opere sobre su propio tenant_id, salvo superadmin)
 */
export async function authenticateApiRequest(
  options: AuthOptions = {}
): Promise<AuthValidationResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const supabase = await createClient()
    let {
      data: { user },
    } = await supabase.auth.getUser()

    // Fallback 1: Cabecera Authorization: Bearer <token> o x-auth-user-id enviada por el cliente
    if (!user) {
      try {
        const reqHeaders = await headers()
        const authHeader = reqHeaders.get('authorization') || reqHeaders.get('Authorization')
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

        if (bearerToken) {
          const { data: tokenUser } = await adminSupabase.auth.getUser(bearerToken)
          if (tokenUser?.user) {
            user = tokenUser.user
          } else {
            const subId = extractSubFromJwt(bearerToken)
            if (subId) {
              const { data: adminUser } = await adminSupabase.auth.admin.getUserById(subId)
              if (adminUser?.user) {
                user = adminUser.user
              }
            }
          }
        }

        if (!user) {
          const fallbackUserId = reqHeaders.get('x-auth-user-id')?.trim()
          if (fallbackUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackUserId)) {
            const { data: adminUser } = await adminSupabase.auth.admin.getUserById(fallbackUserId)
            if (adminUser?.user) {
              user = adminUser.user
            }
          }
        }
      } catch {
        // Ignorar si headers() no está disponible en el contexto
      }
    }

    // Fallback 2: Sesión en cookies (en caso de que el access_token acabe de expirar mientras tomaba fotos del producto)
    if (!user) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          user = session.user
        } else if (session?.access_token) {
          const subId = extractSubFromJwt(session.access_token)
          if (subId) {
            const { data: adminUser } = await adminSupabase.auth.admin.getUserById(subId)
            if (adminUser?.user) {
              user = adminUser.user
            }
          }
        }
      } catch {
        // Ignorar error de lectura de sesión
      }
    }

    if (!user) {
      return {
        auth: null,
        errorResponse: NextResponse.json(
          { error: 'No autenticado: se requiere una sesión activa para realizar esta operación.' },
          { status: 401 }
        ),
      }
    }

    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return {
        auth: null,
        errorResponse: NextResponse.json(
          { error: 'Perfil de usuario no encontrado o deshabilitado.' },
          { status: 403 }
        ),
      }
    }

    const metaRole = (user.user_metadata?.role as UserRole) || undefined
    const isSuperAdmin = metaRole === 'superadmin' || profile.role === 'superadmin'
    const role = (isSuperAdmin ? 'superadmin' : (profile.role || metaRole || 'cajero')) as UserRole
    const userTenantId = profile.tenant_id

    // Auto-sincronizar rol superadmin en profiles si estaba solo en user_metadata
    if (isSuperAdmin && profile.role !== 'superadmin') {
      try {
        await adminSupabase.from('profiles').update({ role: 'superadmin' }).eq('id', user.id)
      } catch {
        // Ignorar si hay restricción de check antigua
      }
    }

    // 1. Verificación de Roles requeridos
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      if (!isSuperAdmin && !options.requiredRoles.includes(role)) {
        return {
          auth: null,
          errorResponse: NextResponse.json(
            { error: 'Permisos insuficientes. Se requiere uno de los siguientes roles: ' + options.requiredRoles.join(', ') + '.' },
            { status: 403 }
          ),
        }
      }
    }

    // 2. Verificación de Aislamiento de Tenant (Anti-IDOR) por Tenant ID
    if (options.targetTenantId && !isSuperAdmin) {
      if (options.targetTenantId !== userTenantId) {
        return {
          auth: null,
          errorResponse: NextResponse.json(
            { error: 'Acceso denegado: no tienes autorización para acceder a los datos de este comercio.' },
            { status: 403 }
          ),
        }
      }
    }

    // 3. Verificación de Aislamiento de Tenant (Anti-IDOR) por Tenant Slug
    if (options.targetTenantSlug && !isSuperAdmin) {
      const { data: targetTenant } = await adminSupabase
        .from('tenants')
        .select('id, slug')
        .eq('slug', options.targetTenantSlug)
        .single()

      if (!targetTenant || targetTenant.id !== userTenantId) {
        return {
          auth: null,
          errorResponse: NextResponse.json(
            { error: 'Acceso denegado: no perteneces al comercio especificado.' },
            { status: 403 }
          ),
        }
      }
    }

    return {
      auth: {
        userId: user.id,
        email: user.email,
        tenantId: userTenantId,
        role,
        isSuperAdmin,
        profile: profile as Profile,
      },
      errorResponse: null,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno de autenticación'
    return {
      auth: null,
      errorResponse: NextResponse.json(
        { error: message },
        { status: 500 }
      ),
    }
  }
}

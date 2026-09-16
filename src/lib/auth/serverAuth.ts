import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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
 * Helper centralizado para autenticar y autorizar llamadas a endpoints de API de servidor.
 * Protege contra:
 * 1. Acceso anónimo (requiere sesión Supabase activa vía cookies)
 * 2. Escalamiento de privilegios (valida roles en base de datos)
 * 3. IDOR / Cruce de Tenants (asegura que el usuario solo opere sobre su propio tenant_id, salvo superadmin)
 */
export async function authenticateApiRequest(
  options: AuthOptions = {}
): Promise<AuthValidationResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return {
        auth: null,
        errorResponse: NextResponse.json(
          { error: 'No autenticado: se requiere una sesión activa para realizar esta operación.' },
          { status: 401 }
        ),
      }
    }

    // Obtener perfil del usuario con permisos de servicio para evitar bloqueos por RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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
    const role = (metaRole || profile.role || 'cajero') as UserRole
    const isSuperAdmin = role === 'superadmin' || profile.role === 'superadmin'
    const userTenantId = profile.tenant_id

    // 1. Verificación de Roles requeridos
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      if (!options.requiredRoles.includes(role)) {
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

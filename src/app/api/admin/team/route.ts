import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import type { UserRole } from '@/types/database'

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

// GET: Obtener lista del equipo de la tienda y límites del plan
export async function GET(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { searchParams } = new URL(req.url)
    const targetTenantId = auth.isSuperAdmin
      ? (searchParams.get('tenant_id') || auth.tenantId)
      : auth.tenantId

    const supabase = getAdminClient()

    // 1. Obtener datos del tenant para verificar plan y límites
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, settings')
      .eq('id', targetTenantId)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Comercio no encontrado.' }, { status: 404 })
    }

    const features = getTenantFeatures(tenant)

    // 2. Obtener miembros del equipo (excluyendo superadmin global que no pertenece a una tienda específica)
    const { data: team, error: teamErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .neq('role', 'superadmin')
      .order('created_at', { ascending: true })

    if (teamErr) throw new Error(teamErr.message)

    const isEnterprise = features.planId === 'enterprise'
    const isUnlimited = isEnterprise || features.maxUsers === Infinity

    return NextResponse.json({
      success: true,
      team: team || [],
      currentCount: (team || []).length,
      maxUsers: isUnlimited ? -1 : features.maxUsers,
      isUnlimited,
      planName: features.name,
      planId: features.planId,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener equipo de la tienda.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST: Crear nuevo colaborador en Supabase Auth y registrar su perfil
export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json()
    const { email, password, full_name, role, tenant_id } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios (nombre, correo, contraseña y rol).' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      )
    }

    const validRoles: UserRole[] = ['cajero', 'almacen', 'vendedor', 'admin']
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json(
        { error: 'Rol no válido. Los roles disponibles son: cajero, almacen, vendedor o admin.' },
        { status: 400 }
      )
    }

    const targetTenantId = auth.isSuperAdmin
      ? (tenant_id || auth.tenantId)
      : auth.tenantId

    const supabase = getAdminClient()

    // 1. Validar límite de usuarios por Plan
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, settings')
      .eq('id', targetTenantId)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Comercio no encontrado.' }, { status: 404 })
    }

    const features = getTenantFeatures(tenant)

    const { count: currentCount, error: countErr } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', targetTenantId)
      .neq('role', 'superadmin')

    const isEnterprise = features.planId === 'enterprise'
    const isUnlimited = isEnterprise || features.maxUsers === Infinity

    if (!countErr && !isUnlimited && (currentCount ?? 0) >= features.maxUsers) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de ${features.maxUsers} usuario(s) permitidos en tu Plan ${features.name}. Para incorporar más colaboradores (cajeros, bodegueros o vendedores), actualiza tu suscripción a Plan Pro o Enterprise.`,
          limitReached: true,
          maxUsers: features.maxUsers,
        },
        { status: 403 }
      )
    }

    // 2. Crear usuario en Supabase Auth
    const cleanEmail = email.trim().toLowerCase()
    const cleanFullName = full_name.trim()

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        tenant_id: targetTenantId,
        role: role,
      },
    })

    if (authErr || !authUser.user) {
      return NextResponse.json(
        { error: authErr?.message || 'Error al crear usuario en el sistema de autenticación.' },
        { status: 400 }
      )
    }

    // 3. Crear o actualizar perfil en la tabla profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUser.user.id,
          tenant_id: targetTenantId,
          full_name: cleanFullName,
          email: cleanEmail,
          role: role,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (profileErr) {
      console.warn('Error upserting profile, attempting fallback insert:', profileErr.message)
    }

    return NextResponse.json({
      success: true,
      user: profile || {
        id: authUser.user.id,
        tenant_id: targetTenantId,
        full_name: cleanFullName,
        email: cleanEmail,
        role,
      },
      message: 'Colaborador creado exitosamente.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar alta de usuario.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH: Cambiar rol o datos de un colaborador
export async function PATCH(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { userId, role, full_name, password } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Verificar que el usuario pertenezca al mismo tenant
    const { data: targetProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single()

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    if (!auth.isSuperAdmin && targetProfile.tenant_id !== auth.tenantId) {
      return NextResponse.json(
        { error: 'Acceso denegado: este usuario no pertenece a tu comercio.' },
        { status: 403 }
      )
    }

    // No permitir modificar superadmin si no eres superadmin
    if (targetProfile.role === 'superadmin' && !auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'No se puede modificar una cuenta de Super Administrador global.' },
        { status: 403 }
      )
    }

    // No permitir cambiar el rol del owner si no eres superadmin
    if (targetProfile.role === 'owner' && !auth.isSuperAdmin && role && role !== 'owner') {
      return NextResponse.json(
        { error: 'No se puede modificar el rol del propietario principal.' },
        { status: 403 }
      )
    }

    // Si viene password, actualizar la contraseña en Supabase Auth
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json(
          { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
          { status: 400 }
        )
      }
      const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
      })
      if (pwdErr) {
        throw new Error(`Error al restablecer contraseña: ${pwdErr.message}`)
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (role) updatePayload.role = role
    if (full_name) updatePayload.full_name = full_name.trim()

    let updated = targetProfile
    if (Object.keys(updatePayload).length > 0) {
      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select()
        .single()

      if (updateErr) throw new Error(updateErr.message)
      updated = updatedProfile
    }

    return NextResponse.json({
      success: true,
      profile: updated,
      message: password ? 'Contraseña y datos actualizados correctamente.' : 'Datos actualizados correctamente.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar usuario.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE: Eliminar colaborador del equipo
export async function DELETE(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 })
    }

    if (userId === auth.userId) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta de administrador.' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 1. Verificar pertenencia de tenant
    const { data: targetProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single()

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    if (!auth.isSuperAdmin && targetProfile.tenant_id !== auth.tenantId) {
      return NextResponse.json(
        { error: 'Acceso denegado: este usuario no pertenece a tu comercio.' },
        { status: 403 }
      )
    }

    if (targetProfile.role === 'superadmin') {
      return NextResponse.json(
        { error: 'No se puede eliminar la cuenta de un Super Administrador global de la plataforma.' },
        { status: 403 }
      )
    }

    if (targetProfile.role === 'owner' && !auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'No se puede eliminar la cuenta del propietario principal.' },
        { status: 403 }
      )
    }

    // 2. Eliminar de profiles y de auth.users
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.admin.deleteUser(userId)

    return NextResponse.json({ success: true, message: 'Colaborador eliminado correctamente.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar usuario.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

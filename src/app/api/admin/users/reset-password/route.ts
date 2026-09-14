import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export async function POST(req: Request) {
  try {
    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'El ID de usuario y una contraseña de al menos 6 caracteres son requeridos.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 2. Control de Acceso Estricto: Si no es superadmin, solo el dueño (owner) del mismo tenant puede restablecer
    if (!auth.isSuperAdmin) {
      if (auth.role !== 'owner') {
        return NextResponse.json(
          { error: 'Solo el propietario de la tienda o un superadmin pueden restablecer contraseñas.' },
          { status: 403 }
        )
      }

      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .single()

      if (profileErr || !targetProfile || targetProfile.tenant_id !== auth.tenantId) {
        return NextResponse.json(
          { error: 'Acceso denegado: este usuario no pertenece a tu comercio.' },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

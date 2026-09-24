import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { userId, newEmail } = await req.json()

    if (!userId || !newEmail || !newEmail.includes('@')) {
      return NextResponse.json(
        { error: 'El ID de usuario y un correo electrónico válido son requeridos.' },
        { status: 400 }
      )
    }

    const cleanEmail = newEmail.trim().toLowerCase()

    // Solo superadmin o el dueño (owner) del mismo tenant
    if (!auth.isSuperAdmin) {
      if (auth.role !== 'owner') {
        return NextResponse.json(
          { error: 'Solo el propietario de la tienda o un superadmin pueden modificar correos.' },
          { status: 403 }
        )
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Actualizar usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email: cleanEmail,
      email_confirm: true,
    })

    if (authError) {
      throw authError
    }

    // 2. Actualizar registro en profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email: cleanEmail })
      .eq('id', userId)

    if (profileError) {
      console.warn('Warning updating profile email:', profileError.message)
    }

    return NextResponse.json({ success: true, email: cleanEmail, user: authData.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar el correo.' }, { status: 500 })
  }
}

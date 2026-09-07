import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
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

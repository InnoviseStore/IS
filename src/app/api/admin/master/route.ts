import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const [{ data: tenants, error: tErr }, { data: profiles, error: pErr }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])

    if (tErr) throw new Error(tErr.message)
    if (pErr) throw new Error(pErr.message)

    return NextResponse.json({
      success: true,
      tenants: tenants || [],
      profiles: profiles || [],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al cargar directorio master.'
    console.error('Error in /api/admin/master:', msg)
    return NextResponse.json({ error: msg, tenants: [], profiles: [] }, { status: 500 })
  }
}

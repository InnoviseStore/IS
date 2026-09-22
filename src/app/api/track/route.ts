import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usamos service role para bypassar RLS en la inserción
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DEDUP_WINDOW_HOURS = 4

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tenant_slug, path, session_id } = body as {
      tenant_slug?: string
      path?: string
      session_id?: string
    }

    // Validaciones mínimas
    if (!tenant_slug || !session_id) {
      return NextResponse.json({ ok: false }, { status: 200 }) // siempre 200 (fire-and-forget)
    }

    // Buscar el tenant_id por slug
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', tenant_slug)
      .single()

    if (tenantError || !tenantData) {
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const tenant_id = tenantData.id

    // Deduplicación: verificar si ya existe un registro con mismo session_id + tenant_id en la ventana de tiempo
    const dedupWindow = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabaseAdmin
      .from('page_views')
      .select('id')
      .eq('session_id', session_id)
      .eq('tenant_id', tenant_id)
      .gte('visited_at', dedupWindow)
      .limit(1)
      .single()

    if (existing) {
      // Ya registrado en la ventana de deduplicación, no insertar de nuevo
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 })
    }

    // Obtener user-agent
    const user_agent = req.headers.get('user-agent') || null

    // Insertar el evento de visita
    await supabaseAdmin.from('page_views').insert({
      tenant_id,
      tenant_slug,
      session_id,
      path: path || `/${tenant_slug}`,
      user_agent,
      visited_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    // Nunca fallar visiblemente — siempre 200
    console.error('[track] Error:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

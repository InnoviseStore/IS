import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')
    const supabase = getAdminClient()

    let tenant = null

    if (tenantId) {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .maybeSingle()
      tenant = data
    }

    if (!tenant) {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      tenant = data
    }

    const storeName = tenant?.name || 'Innovise Store'
    const logoUrl = tenant?.logo_url || '/logo.png'

    const manifest = {
      name: `${storeName} — Sistema POS & Administrativo`,
      short_name: storeName,
      description: `Sistema de punto de venta, inventario y gestión de ${storeName}.`,
      start_url: '/admin',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#2563eb',
      orientation: 'portrait-primary',
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/favicon.ico',
          sizes: '64x64 32x32 24x24 16x16',
          type: 'image/x-icon',
        },
      ],
      categories: ['business', 'finance', 'productivity'],
    }

    return new NextResponse(JSON.stringify(manifest), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Error generating tenant manifest:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

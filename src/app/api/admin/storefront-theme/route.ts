import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, theme_config } = body

    if (!tenant_id || !theme_config) {
      return NextResponse.json(
        { error: 'tenant_id y theme_config son requeridos' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 1. Obtener settings actuales de la tienda
    const { data: tenantData, error: fetchErr } = await supabase
      .from('tenants')
      .select('id, slug, settings')
      .eq('id', tenant_id)
      .single()

    if (fetchErr || !tenantData) {
      return NextResponse.json(
        { error: 'Tienda no encontrada o error de base de datos' },
        { status: 404 }
      )
    }

    const currentSettings = (tenantData.settings || {}) as Record<string, unknown>
    const updatedSettings = {
      ...currentSettings,
      storefront_theme: theme_config,
    }

    // 2. Actualizar con permisos de servicio (garantizado al 100% sin restricciones de RLS)
    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ settings: updatedSettings })
      .eq('id', tenant_id)

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    // 3. Revalidar la caché de la página de la tienda pública inmediatamente
    if (tenantData.slug) {
      try {
        revalidatePath(`/${tenantData.slug}`)
        revalidatePath(`/${tenantData.slug}/p/[id]`, 'page')
      } catch (cacheErr) {
        console.warn('Cache revalidation notice:', cacheErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tema y configuración de vitrina guardados con éxito',
      storefront_theme: theme_config,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar la configuración del tema'
    console.error('Error in POST /api/admin/storefront-theme:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

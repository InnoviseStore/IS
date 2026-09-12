import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const {
      tenant_id,
      name,
      phone_whatsapp,
      logo_url,
      isotype_url,
      imagotype_url,
      slogan,
      instagram_handle,
      theme,
      rubro,
      plan,
    } = await req.json()

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'El ID de la tienda (tenant_id) es requerido.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Obtener datos actuales del tenant para no sobreescribir settings previos
    const { data: currentTenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single()

    if (fetchErr || !currentTenant) {
      return NextResponse.json(
        { error: 'No se encontró la tienda especificada.' },
        { status: 404 }
      )
    }

    const prevSettings = (currentTenant.settings || {}) as Record<string, unknown>

    const cleanPhone = phone_whatsapp !== undefined
      ? (phone_whatsapp || '').replace(/[^0-9]/g, '')
      : currentTenant.phone_whatsapp

    const cleanInstagram = instagram_handle !== undefined
      ? (instagram_handle || '').replace(/^@/, '').trim()
      : prevSettings.instagram_handle

    const finalLogoUrl = imagotype_url || logo_url || isotype_url || (prevSettings.logo_url as string) || '/logo.png'

    // Fusionar settings preservando llaves existentes (ej. quotations, bcv, etc.)
    const updatedSettings = {
      ...prevSettings,
      ...(rubro ? { rubro } : {}),
      ...(slogan !== undefined ? { slogan, description: slogan } : {}),
      ...(isotype_url !== undefined ? { isotype_url } : {}),
      ...(imagotype_url !== undefined ? { imagotype_url } : {}),
      logo_url: finalLogoUrl,
      ...(instagram_handle !== undefined ? { instagram_handle: cleanInstagram || null } : {}),
      ...(theme ? { theme } : {}),
      ...(plan ? { plan } : {}),
    }

    // 2. Actualizar tenant en la base de datos
    const updatePayload: Record<string, unknown> = {
      settings: updatedSettings,
    }

    if (name && name.trim()) {
      updatePayload.name = name.trim()
    }

    if (cleanPhone !== undefined) {
      updatePayload.phone_whatsapp = cleanPhone || null
    }

    const { data: updatedTenant, error: updateErr } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenant_id)
      .select()
      .single()

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar la tienda.'
    console.error('Error in /api/admin/tenants/update:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

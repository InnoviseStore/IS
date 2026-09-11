import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(req: Request) {
  try {
    const { tenantId, isActive } = await req.json()

    if (!tenantId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'tenantId y isActive son requeridos.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Obtener settings actuales para actualizar is_active sin sobreescribir otros datos
    const { data: currentTenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single()

    if (fetchErr) throw fetchErr

    const currentSettings = (currentTenant?.settings || {}) as Record<string, unknown>
    const updatedSettings = {
      ...currentSettings,
      is_active: isActive,
    }

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ settings: updatedSettings })
      .eq('id', tenantId)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true, is_active: isActive })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

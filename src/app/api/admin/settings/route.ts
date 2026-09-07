import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { tenant_id, phone_whatsapp, currency_rate_bcv, name } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'El ID de la tienda (tenant_id) es obligatorio.' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    const updateData: Record<string, unknown> = {}

    if (phone_whatsapp !== undefined) {
      const cleanPhone = (phone_whatsapp || '').toString().replace(/[^0-9]/g, '')
      updateData.phone_whatsapp = cleanPhone || null
    }

    if (currency_rate_bcv !== undefined) {
      const rateNum = Number(currency_rate_bcv)
      if (!isNaN(rateNum) && rateNum > 0) {
        updateData.currency_rate_bcv = rateNum
      }
    }

    if (name !== undefined && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No se enviaron datos para actualizar.' },
        { status: 400 }
      )
    }

    const { data: updatedTenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenant_id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar la configuración.'
    console.error('Error in /api/admin/settings:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

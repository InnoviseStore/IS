import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

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
    const { tenant_id, phone_whatsapp, currency_rate_bcv, name, plan, about, admin_security_pin, checkout_mode, customer_auth_mode, payment_accounts, whatsapp_automation } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'El ID de la tienda (tenant_id) es obligatorio.' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    // 2. Solo superadmin puede modificar el plan
    if (plan !== undefined && !auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo un superadministrador puede modificar el plan de suscripción.' },
        { status: 403 }
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

    if (plan !== undefined || about !== undefined || admin_security_pin !== undefined || checkout_mode !== undefined || customer_auth_mode !== undefined || payment_accounts !== undefined || whatsapp_automation !== undefined) {
      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant_id)
        .single()
      const prevSettings = (currentTenant?.settings || {}) as Record<string, unknown>
      const newSettings = { ...prevSettings }
      if (plan !== undefined) newSettings.plan = plan
      if (about !== undefined) newSettings.about = about
      if (checkout_mode !== undefined) newSettings.checkout_mode = checkout_mode
      if (customer_auth_mode !== undefined) newSettings.customer_auth_mode = customer_auth_mode
      if (payment_accounts !== undefined) newSettings.payment_accounts = payment_accounts
      if (whatsapp_automation !== undefined) newSettings.whatsapp_automation = whatsapp_automation
      if (admin_security_pin !== undefined) {
        const cleanPin = String(admin_security_pin).trim()
        if (cleanPin.length < 4) {
          return NextResponse.json(
            { error: 'La clave de administrador debe tener al menos 4 caracteres o dígitos.' },
            { status: 400 }
          )
        }
        newSettings.admin_security_pin = cleanPin
      }
      updateData.settings = newSettings
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

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import { getTenantGatewayStatus } from '@/lib/whatsappGateway'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET: Consulta el estado de la instancia y devuelve QR si está pendiente
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenantId,
    })
    if (errorResponse || !auth) return errorResponse!

    const supabase = getAdminClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, slug, phone_whatsapp, settings')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    // Validar plan Enterprise
    const features = getTenantFeatures(tenant)
    if (!features.hasWhatsAppAutomation && !auth.isSuperAdmin) {
      return NextResponse.json({
        isAllowed: false,
        error: 'Esta función es exclusiva del Plan Enterprise.',
      }, { status: 403 })
    }

    const settings = (tenant.settings || {}) as Record<string, any>
    const waSettings = settings.whatsapp_automation || {}
    const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`

    const gatewayStatus = await getTenantGatewayStatus(instanceName, tenant.phone_whatsapp)

    return NextResponse.json({
      isAllowed: true,
      instanceName,
      status: gatewayStatus.status,
      phone: gatewayStatus.phone || tenant.phone_whatsapp,
      qrcode: gatewayStatus.qrcode,
      settings: waSettings,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Actualiza opciones de automatización o simula reconexión
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
      enabled,
      auto_send_invoice,
      auto_send_abono,
      auto_send_web_order,
      auto_send_credit_reminders,
      action,
    } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) return errorResponse!

    const supabase = getAdminClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, slug, phone_whatsapp, settings')
      .eq('id', tenant_id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    const prevSettings = (tenant.settings || {}) as Record<string, any>
    const prevWa = prevSettings.whatsapp_automation || {}

    const newWa = {
      ...prevWa,
      instance_name: prevWa.instance_name || `tenant_${tenant.slug}`,
      enabled: enabled !== undefined ? Boolean(enabled) : (prevWa.enabled ?? true),
      auto_send_invoice: auto_send_invoice !== undefined ? Boolean(auto_send_invoice) : (prevWa.auto_send_invoice ?? true),
      auto_send_abono: auto_send_abono !== undefined ? Boolean(auto_send_abono) : (prevWa.auto_send_abono ?? true),
      auto_send_web_order: auto_send_web_order !== undefined ? Boolean(auto_send_web_order) : (prevWa.auto_send_web_order ?? true),
      auto_send_credit_reminders: auto_send_credit_reminders !== undefined ? Boolean(auto_send_credit_reminders) : (prevWa.auto_send_credit_reminders ?? true),
      status: action === 'disconnect' ? 'disconnected' : 'connected',
      connected_phone: action === 'disconnect' ? null : (tenant.phone_whatsapp || '584245259193'),
      last_connected_at: new Date().toISOString(),
    }

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({
        settings: {
          ...prevSettings,
          whatsapp_automation: newWa,
        },
      })
      .eq('id', tenant_id)

    if (updateErr) throw new Error(updateErr.message)

    return NextResponse.json({
      success: true,
      whatsapp_automation: newWa,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

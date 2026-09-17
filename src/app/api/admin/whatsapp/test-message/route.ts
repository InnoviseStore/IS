import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, test_phone } = body

    if (!tenant_id || !test_phone) {
      return NextResponse.json({ error: 'tenant_id y test_phone son requeridos.' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) return errorResponse!

    const supabase = getAdminClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, slug, settings')
      .eq('id', tenant_id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const settings = (tenant.settings || {}) as Record<string, any>
    const waSettings = settings.whatsapp_automation || {}
    const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`

    const testText = `🤖 *¡Conexión Exitosa con Innovise Store!*\n\nTu línea de WhatsApp Business ha quedado vinculada al servidor de automatización de *${tenant.name}*.\n\n✅ Facturación automática en POS: Activa\n✅ Comprobantes de Abono: Activos\n✅ Alertas de Pedidos Web: Activas\n✅ Cobranza de Créditos: Activa\n\n_Mensaje de verificación del Plan Enterprise._`

    const result = await sendWhatsAppTextMessage(instanceName, test_phone, testText)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'No se pudo enviar el mensaje.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

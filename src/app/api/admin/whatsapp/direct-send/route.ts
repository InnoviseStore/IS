import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import { sendWhatsAppTextMessage, sendWhatsAppDocument, sendWhatsAppButtons } from '@/lib/whatsappGateway'

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
    const {
      tenant_id,
      phone,
      type = 'text',
      message = '',
      title = '',
      buttons = [],
      media_base64,
      file_name = 'Documento.pdf',
    } = body

    if (!tenant_id || !phone) {
      return NextResponse.json(
        { error: 'tenant_id y phone son campos obligatorios.' },
        { status: 400 }
      )
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) return errorResponse!

    const supabase = getAdminClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, slug, phone_whatsapp, settings')
      .eq('id', tenant_id)
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const features = getTenantFeatures(tenant)
    if (!features.hasWhatsAppAutomation && !auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'El envío directo por WhatsApp es exclusivo del Plan Enterprise.' },
        { status: 403 }
      )
    }

    const settings = (tenant.settings || {}) as Record<string, any>
    const waSettings = settings.whatsapp_automation || {}
    const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`

    let result
    if (type === 'document') {
      if (!media_base64) {
        return NextResponse.json(
          { error: 'El archivo media_base64 es requerido para envío de documentos.' },
          { status: 400 }
        )
      }
      result = await sendWhatsAppDocument(instanceName, phone, media_base64, file_name, message)
    } else if (type === 'buttons' || (Array.isArray(buttons) && buttons.length > 0)) {
      result = await sendWhatsAppButtons(
        instanceName,
        phone,
        title || tenant.name,
        message,
        buttons
      )
    } else {
      if (!message.trim()) {
        return NextResponse.json(
          { error: 'El contenido del mensaje no puede estar vacío.' },
          { status: 400 }
        )
      }
      result = await sendWhatsAppTextMessage(instanceName, phone, message)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'No se pudo enviar el mensaje por WhatsApp.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      simulated: Boolean(result.simulated),
    })
  } catch (err: any) {
    console.error('[DirectSend API Error]', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 })
  }
}

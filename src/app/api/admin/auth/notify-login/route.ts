import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'
import { getRoleLabel } from '@/types/database'
import type { UserRole } from '@/types/database'

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
    const { auth, errorResponse } = await authenticateApiRequest()
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()
    const now = new Date().toISOString()

    // 1. Obtener perfil del usuario autenticado
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, tenant_id')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 })
    }

    // Actualizar last_active_at en profiles (en caso de que exista la columna)
    try {
      await supabase
        .from('profiles')
        .update({ last_active_at: now })
        .eq('id', auth.userId)
    } catch {
      // Ignorar si la columna aún no está creada en DB
    }

    // 2. Si no es superadmin, verificar si la tienda tiene configurado el aviso por WhatsApp
    if (profile.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, slug, phone_whatsapp, settings')
        .eq('id', profile.tenant_id)
        .maybeSingle()

      if (tenant && tenant.phone_whatsapp) {
        const settings = (tenant.settings || {}) as Record<string, any>
        const wa = (settings.whatsapp_automation || {}) as Record<string, any>
        const isNotificationEnabled = wa.auto_send_employee_login !== false

        if (isNotificationEnabled) {
          const roleText = getRoleLabel((profile.role || 'cajero') as UserRole)
          const currentTimeStr = new Date().toLocaleString('es-VE', {
            timeZone: 'America/Caracas',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })

          const alertMessage = [
            `🔐 *INICIO DE SESIÓN REGISTRADO*`,
            `━━━━━━━━━━━━━━━━━━━━━`,
            `🏪 *Tienda:* ${tenant.name}`,
            `👤 *Usuario:* ${profile.full_name || 'Sin nombre'}`,
            `💼 *Rol:* ${roleText}`,
            `📧 *Correo:* ${profile.email || '—'}`,
            `🕒 *Fecha y Hora:* ${currentTimeStr}`,
            `━━━━━━━━━━━━━━━━━━━━━`,
            `_Notificación automática de seguridad Innovise Store._`,
          ].join('\n')

          // Enviar mensaje en segundo plano
          sendWhatsAppTextMessage(tenant.slug, tenant.phone_whatsapp, alertMessage).catch(err => {
            console.warn('[NotifyLogin] Error sending WhatsApp login alert:', err)
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in notify-login route:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

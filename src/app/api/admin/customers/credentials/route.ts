import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { getTenantFeatures } from '@/lib/planLimits'
import {
  hashCustomerPassword,
  normalizeIdNumber,
  normalizePhoneDigits,
  parseCustomerAuth,
  serializeCustomerNotes,
} from '@/lib/customerUtils'
import { sendWhatsAppTextMessage } from '@/lib/whatsappGateway'
import { normalizeWhatsAppPhone } from '@/lib/whatsapp'

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
      customer_id,
      email,
      password,
      user_notes,
      phone,
      full_name,
      id_number,
      send_whatsapp_direct = false,
      custom_whatsapp_message,
    } = body

    if (!tenant_id || !customer_id) {
      return NextResponse.json(
        { error: 'tenant_id y customer_id son campos obligatorios.' },
        { status: 400 }
      )
    }

    if (!password || String(password).trim().length < 4) {
      return NextResponse.json(
        { error: 'La contraseña debe contener al menos 4 caracteres.' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación y permisos de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) return errorResponse!

    const supabase = getAdminClient()

    // 2. Obtener tienda y cliente
    const [tenantRes, customerRes] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenant_id).single(),
      supabase.from('customers').select('*').eq('id', customer_id).eq('tenant_id', tenant_id).single(),
    ])

    if (tenantRes.error || !tenantRes.data) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }
    if (customerRes.error || !customerRes.data) {
      return NextResponse.json({ error: 'Cliente no encontrado en esta tienda.' }, { status: 404 })
    }

    const tenant = tenantRes.data
    const customer = customerRes.data

    // 3. Normalizar datos
    const cleanEmail = email ? String(email).trim().toLowerCase() : customer.email
    const cleanPhone = phone ? normalizePhoneDigits(phone) : customer.phone
    const idInfo = id_number ? normalizeIdNumber(id_number) : normalizeIdNumber(customer.id_number)
    const cleanName = full_name ? String(full_name).trim() : customer.full_name

    // 4. Si se proporcionó email, verificar que no esté duplicado en otro cliente del mismo tenant
    if (cleanEmail && cleanEmail !== customer.email) {
      const { data: existingWithEmail } = await supabase
        .from('customers')
        .select('id, full_name')
        .eq('tenant_id', tenant_id)
        .ilike('email', cleanEmail)
        .neq('id', customer_id)
        .limit(1)

      if (existingWithEmail && existingWithEmail.length > 0) {
        return NextResponse.json(
          {
            error: `El correo "${cleanEmail}" ya está asignado a otro cliente (${existingWithEmail[0].full_name}).`,
          },
          { status: 409 }
        )
      }
    }

    // 5. Hashear contraseña y empaquetar notas
    const passwordHash = hashCustomerPassword(String(password).trim())
    const existingAuth = parseCustomerAuth(customer.notes)
    const newNotes = serializeCustomerNotes(
      passwordHash,
      user_notes !== undefined ? user_notes : existingAuth.userNotes,
      {
        ...existingAuth.metadata,
        account_created_by: auth.userId,
        account_created_at: existingAuth.metadata.account_created_at || new Date().toISOString(),
        last_credentials_update: new Date().toISOString(),
      }
    )

    // 6. Actualizar cliente en Supabase
    const { data: updatedCustomer, error: updateErr } = await supabase
      .from('customers')
      .update({
        full_name: cleanName,
        email: cleanEmail || null,
        phone: cleanPhone || null,
        id_number: idInfo.canonical || customer.id_number,
        notes: newNotes,
        is_active: true,
      })
      .eq('id', customer_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single()

    if (updateErr || !updatedCustomer) {
      throw new Error(updateErr?.message || 'Error al actualizar las credenciales del cliente.')
    }

    // 7. Enviar WhatsApp directo si está solicitado y disponible
    let directWhatsAppSent = false
    let directWhatsAppError: string | null = null

    if (send_whatsapp_direct) {
      const targetPhone = updatedCustomer.phone || customer.phone
      if (targetPhone) {
        const features = getTenantFeatures(tenant)
        if (features.hasWhatsAppAutomation || auth.isSuperAdmin) {
          try {
            const settings = (tenant.settings || {}) as Record<string, any>
            const waSettings = settings.whatsapp_automation || {}
            const instanceName = waSettings.instance_name || `tenant_${tenant.slug}`
            const fullPhone = normalizeWhatsAppPhone(targetPhone)

            const messageToSend =
              custom_whatsapp_message ||
              `👋 ¡Hola, *${updatedCustomer.full_name}*!\n\nTe damos la bienvenida a la tienda oficial de *${tenant.name}*. Hemos creado tu cuenta de cliente para que realices tus pedidos en 1 clic.\n\n🔐 *Tus datos de acceso:*\n👤 *Usuario / Identificador:* ${updatedCustomer.id_number || updatedCustomer.phone || updatedCustomer.email}\n🔑 *Contraseña:* ${password}\n\n🌐 *Ingresa a tu cuenta aquí:*\nhttps://system-is.netlify.app/${tenant.slug}/cuenta`

            const waResult = await sendWhatsAppTextMessage(instanceName, fullPhone, messageToSend)
            if (waResult.success) {
              directWhatsAppSent = true
            } else {
              directWhatsAppError = waResult.error || 'No se pudo enviar el mensaje directo por WhatsApp.'
            }
          } catch (waErr: any) {
            directWhatsAppError = waErr.message || 'Error en el gateway de WhatsApp.'
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciales de acceso web configuradas exitosamente.',
      customer: updatedCustomer,
      credentials: {
        identifier: updatedCustomer.id_number || updatedCustomer.email || updatedCustomer.phone,
        password: String(password).trim(),
      },
      direct_whatsapp_sent: directWhatsAppSent,
      direct_whatsapp_error: directWhatsAppError,
    })
  } catch (err: any) {
    console.error('[CustomerCredentials API Error]', err)
    return NextResponse.json(
      { error: err.message || 'Error interno al procesar las credenciales.' },
      { status: 500 }
    )
  }
}

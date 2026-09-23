import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import {
  hashCustomerPassword,
  normalizeIdNumber,
  normalizePhoneDigits,
  parseCustomerAuth,
  serializeCustomerNotes,
} from '@/lib/customerUtils'

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

// POST: Crear o actualizar cliente con normalización segura y hash de contraseña en servidor
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      id,
      tenant_id,
      full_name,
      id_number,
      phone,
      email,
      address,
      credit_limit_usd,
      user_notes,
      custom_password,
      enable_web_access,
    } = body

    if (!tenant_id || !full_name?.trim()) {
      return NextResponse.json(
        { error: 'tenant_id y nombre del cliente son obligatorios.' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 2. Normalizar cédula / RIF (solo números sin puntos, con prefijo estándar V-, J-, E-, G-)
    let normalizedIdNumber: string | null = null
    if (id_number && String(id_number).trim()) {
      const idInfo = normalizeIdNumber(String(id_number))
      if (idInfo.digits) {
        normalizedIdNumber = idInfo.canonical // e.g. V-12345678
      }
    }

    // 3. Normalizar teléfono
    const normalizedPhone = phone ? normalizePhoneDigits(phone) || String(phone).trim() : null
    const cleanEmail = email ? String(email).trim().toLowerCase() : null
    const cleanName = String(full_name).trim()
    const cleanAddress = address ? String(address).trim() : null
    const numericCreditLimit = Number(credit_limit_usd) >= 0 ? Number(credit_limit_usd) : 100

    let existingCustomer: any = null
    if (id) {
      const { data: found } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant_id)
        .single()
      existingCustomer = found
      if (!existingCustomer) {
        return NextResponse.json({ error: 'Cliente no encontrado para actualizar.' }, { status: 404 })
      }
    }

    // 4. Determinar credenciales y notas
    const existingAuth = parseCustomerAuth(existingCustomer?.notes)
    let passwordHash = existingAuth.passwordHash

    if (custom_password && String(custom_password).trim().length >= 4) {
      passwordHash = hashCustomerPassword(String(custom_password).trim())
    }

    const finalNotes = enable_web_access || existingAuth.hasAccount || passwordHash
      ? serializeCustomerNotes(passwordHash, (user_notes ?? existingAuth.userNotes ?? '').trim(), {
          ...existingAuth.metadata,
          last_saved_at: new Date().toISOString(),
        })
      : (user_notes ?? existingAuth.userNotes ?? '').trim() || null

    const customerPayload: Record<string, any> = {
      tenant_id,
      full_name: cleanName,
      id_number: normalizedIdNumber,
      phone: normalizedPhone,
      email: cleanEmail,
      address: cleanAddress,
      credit_limit_usd: numericCreditLimit,
      notes: finalNotes,
      is_active: true,
    }

    let savedCustomer: any = null

    if (id) {
      const { data, error: updateErr } = await supabase
        .from('customers')
        .update(customerPayload)
        .eq('id', id)
        .eq('tenant_id', tenant_id)
        .select()
        .single()

      if (updateErr) throw new Error(updateErr.message)
      savedCustomer = data
    } else {
      const { data, error: insertErr } = await supabase
        .from('customers')
        .insert({
          ...customerPayload,
          current_debt_usd: 0,
        })
        .select()
        .single()

      if (insertErr) throw new Error(insertErr.message)
      savedCustomer = data
    }

    return NextResponse.json({ success: true, customer: savedCustomer })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar cliente'
    console.error('Error in POST /api/admin/customers:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Eliminar cliente de forma segura
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const tenantId = searchParams.get('tenant_id')

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'id y tenant_id son requeridos' }, { status: 400 })
    }

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Obtener datos del cliente
    const { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('id, full_name, current_debt_usd')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchErr || !customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 2. Intentar eliminación directa
    const { error: deleteErr } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (deleteErr) {
      // Si falla por restricción de clave foránea (órdenes asociadas), realizar soft-delete
      console.warn('Direct delete failed, falling back to soft-delete (is_active: false):', deleteErr.message)
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateErr) {
        throw new Error(updateErr.message)
      }

      return NextResponse.json({
        success: true,
        action: 'soft_deleted',
        message: 'Cliente desactivado correctamente (posee historial de pedidos).',
      })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Cliente eliminado permanentemente.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar cliente'
    console.error('Error in DELETE /api/admin/customers:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

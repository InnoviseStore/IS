import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantFeatures } from '@/lib/planLimits'
import {
  normalizeIdNumber,
  normalizePhoneDigits,
  hashCustomerPassword,
  verifyCustomerPassword,
  generateCustomerToken,
  verifyCustomerToken,
  parseCustomerAuth,
  serializeCustomerNotes,
} from '@/lib/customerUtils'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}


// GET: Obtener sesión de cliente autenticado, historial de compras y saldo de créditos
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenant_slug')
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!tenantSlug || !token) {
      return NextResponse.json({ error: 'Faltan parámetros de sesión' }, { status: 401 })
    }

    const session = verifyCustomerToken(token)
    if (!session || session.tenant_slug !== tenantSlug) {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 })
    }

    const supabase = getAdminClient()

    // 1. Obtener cliente
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, full_name, id_number, phone, email, address, credit_limit_usd, current_debt_usd, is_active, notes, created_at')
      .eq('id', session.customer_id)
      .eq('tenant_id', session.tenant_id)
      .single()

    if (custErr || !customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 2. Obtener historial de pedidos del cliente
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_condition, total_usd, total_ves, exchange_rate_at_sale, due_date, payment_breakdown, created_at, order_items(*)')
      .eq('customer_id', customer.id)
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false })
      .limit(30)

    const authMeta = parseCustomerAuth(customer.notes)

    return NextResponse.json({
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        id_number: customer.id_number,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        credit_limit_usd: customer.credit_limit_usd,
        current_debt_usd: customer.current_debt_usd,
        created_at: customer.created_at,
        metadata: authMeta.metadata,
      },
      orders: orders || [],
    })
  } catch (err: any) {
    console.error('[CustomerAuth GET Error]', err)
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}

// POST: Login, Registro o Actualización de Perfil
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action = 'login', tenant_slug } = body

    if (!tenant_slug) {
      return NextResponse.json({ error: 'El slug de la tienda es requerido' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Validar tienda y plan
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, slug, phone_whatsapp, currency_rate_bcv, settings')
      .eq('slug', tenant_slug)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    const features = getTenantFeatures(tenant)
    if (!features.hasCustomerPortal) {
      return NextResponse.json(
        { error: 'El portal de clientes no está disponible en el plan actual de esta tienda.' },
        { status: 403 }
      )
    }

    // ─── LOGIN ─────────────────────────────────────────────────────────────────
    if (action === 'login') {
      const { identifier, password } = body
      if (!identifier || !password) {
        return NextResponse.json({ error: 'Ingresa tu cédula, teléfono o correo y tu contraseña.' }, { status: 400 })
      }

      const idInfo = normalizeIdNumber(identifier)
      const phoneDigits = normalizePhoneDigits(identifier)
      const cleanIdent = String(identifier).trim().toLowerCase()

      // Buscar cliente por cédula, teléfono o email
      let customer: any = null

      if (idInfo.digits && idInfo.digits.length >= 4) {
        const { data: byId } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .in('id_number', idInfo.variants)
          .limit(1)

        if (byId && byId.length > 0) customer = byId[0]
      }

      if (!customer && phoneDigits) {
        const { data: byPhone } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or(`phone.eq.${phoneDigits},phone.eq.${identifier}`)
          .limit(1)
          .maybeSingle()

        if (byPhone) customer = byPhone
      }

      if (!customer && cleanIdent.includes('@')) {
        const { data: byEmail } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .ilike('email', cleanIdent)
          .limit(1)
          .maybeSingle()

        if (byEmail) customer = byEmail
      }

      if (!customer) {
        return NextResponse.json({ error: 'No encontramos ninguna cuenta registrada con esos datos.' }, { status: 404 })
      }

      const { passwordHash, metadata } = parseCustomerAuth(customer.notes)

      if (!passwordHash) {
        return NextResponse.json(
          {
            error: 'Esta cuenta aún no tiene contraseña configurada. Por favor regístrate para asignarle una contraseña.',
            can_register: true,
            suggested_data: {
              full_name: customer.full_name,
              id_number: customer.id_number,
              phone: customer.phone,
              address: customer.address,
            },
          },
          { status: 400 }
        )
      }

      if (!verifyCustomerPassword(password, passwordHash)) {
        return NextResponse.json({ error: 'Contraseña incorrecta. Verifica e intenta nuevamente.' }, { status: 401 })
      }

      const token = generateCustomerToken({
        customer_id: customer.id,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        full_name: customer.full_name,
        id_number: customer.id_number,
      })

      return NextResponse.json({
        success: true,
        token,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          id_number: customer.id_number,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          credit_limit_usd: customer.credit_limit_usd,
          current_debt_usd: customer.current_debt_usd,
          metadata,
        },
      })
    }

    // ─── REGISTRO ──────────────────────────────────────────────────────────────
    if (action === 'register') {
      const { full_name, id_number, phone, email, address, password } = body

      if (!full_name || !password || password.length < 4) {
        return NextResponse.json(
          { error: 'El nombre completo y una contraseña de al menos 4 caracteres son obligatorios.' },
          { status: 400 }
        )
      }

      if (!id_number && !phone && !email) {
        return NextResponse.json(
          { error: 'Debes proporcionar al menos tu cédula o número de teléfono.' },
          { status: 400 }
        )
      }

      const idInfo = normalizeIdNumber(id_number)
      const phoneDigits = normalizePhoneDigits(phone)
      const cleanEmail = email ? String(email).trim().toLowerCase() : null
      const passwordHash = hashCustomerPassword(password)

      // Verificar si ya existe cliente con esa cédula o teléfono
      let existingCustomer: any = null

      if (idInfo.digits && idInfo.digits.length >= 4) {
        const { data: matches } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .in('id_number', idInfo.variants)
          .limit(1)

        if (matches && matches.length > 0) existingCustomer = matches[0]
      }

      if (!existingCustomer && phoneDigits) {
        const { data: byPhone } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or(`phone.eq.${phoneDigits},phone.eq.${phone}`)
          .limit(1)
          .maybeSingle()

        if (byPhone) existingCustomer = byPhone
      }

      let customerId: string

      if (existingCustomer) {
        const existingAuth = parseCustomerAuth(existingCustomer.notes)
        if (existingAuth.passwordHash) {
          return NextResponse.json(
            { error: 'Ya existe una cuenta con esta cédula o teléfono. Por favor inicia sesión con tu clave.' },
            { status: 409 }
          )
        }

        // Asignar contraseña al cliente existente y actualizar datos
        const newNotes = serializeCustomerNotes(passwordHash, existingAuth.userNotes)
        const updatePayload: Record<string, any> = {
          notes: newNotes,
        }
        if (full_name && (!existingCustomer.full_name || existingCustomer.full_name === 'Cliente')) {
          updatePayload.full_name = full_name.trim()
        }
        if (idInfo.canonical && !existingCustomer.id_number) {
          updatePayload.id_number = idInfo.canonical
        }
        if (phoneDigits && !existingCustomer.phone) {
          updatePayload.phone = phoneDigits
        }
        if (cleanEmail && !existingCustomer.email) {
          updatePayload.email = cleanEmail
        }
        if (address && !existingCustomer.address) {
          updatePayload.address = address.trim()
        }

        await supabase.from('customers').update(updatePayload).eq('id', existingCustomer.id)
        customerId = existingCustomer.id
      } else {
        // Crear nuevo cliente
        const initialNotes = serializeCustomerNotes(passwordHash, 'Registrado desde Portal de Clientes')
        const { data: newCust, error: createErr } = await supabase
          .from('customers')
          .insert({
            tenant_id: tenant.id,
            full_name: full_name.trim(),
            id_number: idInfo.canonical || id_number || null,
            phone: phoneDigits || phone || null,
            email: cleanEmail,
            address: address ? address.trim() : null,
            notes: initialNotes,
            is_active: true,
          })
          .select()
          .single()

        if (createErr || !newCust) {
          throw new Error(createErr?.message || 'No se pudo crear la cuenta de cliente.')
        }
        customerId = newCust.id
      }

      const token = generateCustomerToken({
        customer_id: customerId,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        full_name,
        id_number: idInfo.canonical || id_number,
      })

      return NextResponse.json({
        success: true,
        token,
        customer: {
          id: customerId,
          full_name,
          id_number: idInfo.canonical || id_number,
          phone: phoneDigits || phone,
          email: cleanEmail,
          address,
        },
      })
    }

    // ─── ACTUALIZAR PERFIL ─────────────────────────────────────────────────────
    if (action === 'update_profile') {
      const authHeader = req.headers.get('authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      const session = verifyCustomerToken(token)

      if (!session || session.tenant_slug !== tenant_slug) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }

      const { full_name, phone, address, default_delivery } = body
      const updateData: Record<string, any> = {}
      if (full_name) updateData.full_name = full_name.trim()
      if (phone) updateData.phone = normalizePhoneDigits(phone)
      if (address !== undefined) updateData.address = address.trim()

      const { data: cust } = await supabase
        .from('customers')
        .select('notes')
        .eq('id', session.customer_id)
        .single()

      if (cust) {
        const auth = parseCustomerAuth(cust.notes)
        const updatedMeta = { ...auth.metadata }
        if (default_delivery) updatedMeta.default_delivery = default_delivery
        updateData.notes = serializeCustomerNotes(auth.passwordHash, auth.userNotes, updatedMeta)
      }

      const { data: updated, error: updErr } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', session.customer_id)
        .select()
        .single()

      if (updErr || !updated) {
        throw new Error(updErr?.message || 'Error actualizando perfil')
      }

      return NextResponse.json({ success: true, customer: updated })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (err: any) {
    console.error('[CustomerAuth POST Error]', err)
    return NextResponse.json({ error: err.message || 'Error al procesar la solicitud' }, { status: 500 })
  }
}

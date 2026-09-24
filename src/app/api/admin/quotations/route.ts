import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { generateNextQuotationNumber } from '@/lib/tenantDocSequence'

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

// GET: Obtener lista de presupuestos / cotizaciones
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor'],
      targetTenantId: tenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Consultar tabla 'quotations' (fuente de verdad)
    const { data: dbQuotations, error: dbError } = await supabase
      .from('quotations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (!dbError && dbQuotations) {
      return NextResponse.json({ success: true, quotations: dbQuotations })
    }

    // 2. Fallback solo si la tabla quotations falla o no existe
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single()

    const settings = (tenantData?.settings || {}) as Record<string, unknown>
    const fallbackList = Array.isArray(settings.quotations) ? settings.quotations : []

    return NextResponse.json({
      success: true,
      quotations: fallbackList,
      source: 'settings_fallback',
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al consultar cotizaciones.' },
      { status: 500 }
    )
  }
}

// POST: Guardar nuevo presupuesto / cotización
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_id_number,
      items,
      subtotal_usd,
      total_usd,
      total_ves,
      exchange_rate,
      valid_until,
      notes,
      created_by,
    } = body

    if (!tenant_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (artículos o comercio).' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // Generar un número de cotización secuencial y correlativo por tienda
    const quotationNumber = await generateNextQuotationNumber(supabase, tenant_id)

    // Notas limpias (sin anexar UUIDs técnicos de base de datos)
    const finalNotes = notes?.trim() || ''

    // OMITIR customer_id del insert a la tabla para evitar PGRST204
    const quotePayload = {
      tenant_id,
      customer_name: (customer_name && String(customer_name).trim()) || 'Cliente General',
      customer_phone: (customer_phone && String(customer_phone).trim()) || null,
      customer_email: (customer_email && String(customer_email).trim()) || null,
      customer_id_number: (customer_id_number && String(customer_id_number).trim()) || null,
      quotation_number: quotationNumber,
      status: 'draft',
      items,
      subtotal_usd: Number(subtotal_usd) || 0,
      total_usd: Number(total_usd) || 0,
      total_ves: Number(total_ves) || 0,
      exchange_rate: Number(exchange_rate) || 91.5,
      valid_until: valid_until || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      notes: finalNotes || null,
      created_by: created_by || null,
    }

    // 1. Insertar en tabla 'quotations'
    const { data: inserted, error: insertErr } = await supabase
      .from('quotations')
      .insert(quotePayload)
      .select()
      .single()

    if (!insertErr && inserted) {
      return NextResponse.json({ success: true, quotation: inserted })
    }

    if (insertErr) {
      console.warn('Fallback insert required due to table error:', insertErr.message)
    }

    // 2. Fallback: Si la tabla falla, guardar en settings->'quotations' del tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenant_id)
      .single()

    const currentSettings = ((tenantData?.settings || {}) as Record<string, unknown>)
    const currentList = Array.isArray(currentSettings.quotations) ? currentSettings.quotations : []

    const fallbackQuotation = {
      id: crypto.randomUUID(),
      ...quotePayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const updatedList = [fallbackQuotation, ...currentList]

    await supabase
      .from('tenants')
      .update({
        settings: {
          ...currentSettings,
          quotations: updatedList,
        },
      })
      .eq('id', tenant_id)

    return NextResponse.json({
      success: true,
      quotation: fallbackQuotation,
      source: 'settings_fallback',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar el presupuesto.'
    console.error('Error in /api/admin/quotations:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Eliminar cotización
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
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor'],
      targetTenantId: tenantId,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Obtener número de cotización antes de borrar (para limpiar fallback por número si aplica)
    const { data: existingQuote } = await supabase
      .from('quotations')
      .select('id, quotation_number')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const quoteNumber = existingQuote?.quotation_number

    // 2. Borrar en tabla 'quotations'
    const { error: delErr } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (delErr) {
      throw new Error(`Error al eliminar de la base de datos: ${delErr.message}`)
    }

    // 3. Limpiar también de settings si quedó alguna entrada en el fallback antiguo
    if (tenantId) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single()

      const currentSettings = ((tenantData?.settings || {}) as Record<string, unknown>)
      if (Array.isArray(currentSettings.quotations)) {
        const updatedList = currentSettings.quotations.filter(
          (q: { id?: string; quotation_number?: string }) =>
            q.id !== id && (!quoteNumber || q.quotation_number !== quoteNumber)
        )
        await supabase
          .from('tenants')
          .update({
            settings: {
              ...currentSettings,
              quotations: updatedList,
            },
          })
          .eq('id', tenantId)
      }
    }

    return NextResponse.json({ success: true, message: 'Presupuesto eliminado correctamente.' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar cotización' },
      { status: 500 }
    )
  }
}

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

// GET: Obtener lista de presupuestos / cotizaciones
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Intentar consultar tabla 'quotations'
    const { data: dbQuotations, error: dbError } = await supabase
      .from('quotations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (!dbError && dbQuotations) {
      return NextResponse.json({ success: true, quotations: dbQuotations })
    }

    // 2. Fallback: Si la tabla no existe aún en PostgreSQL, leer de settings->'quotations' del tenant
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

    const supabase = getAdminClient()

    // Generar un número de cotización infalible
    const now = new Date()
    const year = now.getFullYear()
    const randSeq = Math.floor(1000 + Math.random() * 9000)
    const quotationNumber = `COT-${year}-${randSeq}`

    const quotePayload = {
      tenant_id,
      customer_id: customer_id || null,
      quotation_number: quotationNumber,
      status: 'draft',
      items,
      subtotal_usd: Number(subtotal_usd) || 0,
      total_usd: Number(total_usd) || 0,
      total_ves: Number(total_ves) || 0,
      exchange_rate: Number(exchange_rate) || 91.5,
      valid_until: valid_until || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      notes: notes?.trim() || null,
      created_by: created_by || null,
    }

    // 1. Intentar insertar en tabla 'quotations'
    const { data: inserted, error: insertErr } = await supabase
      .from('quotations')
      .insert(quotePayload)
      .select()
      .single()

    if (!insertErr && inserted) {
      return NextResponse.json({ success: true, quotation: inserted })
    }

    // 2. Fallback: Si la tabla no existe en la base de datos, guardar en settings->'quotations' del tenant
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

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deriva un prefijo limpio y representativo de la tienda para documentos (Facturas, Pedidos, Cotizaciones)
 * Si la tienda tiene configurado `invoice_prefix` en settings, se respeta estrictamente.
 * De lo contrario, se deduce a partir del slug o nombre comercial de la tienda.
 */
export function getTenantDocPrefix(tenant: { name?: string; slug?: string; settings?: any } | null | undefined): string {
  const settings = (tenant?.settings as Record<string, any>) || {}
  if (settings.invoice_prefix && typeof settings.invoice_prefix === 'string' && settings.invoice_prefix.trim()) {
    return settings.invoice_prefix.trim().toUpperCase()
  }

  const slug = tenant?.slug?.toLowerCase().trim() || ''
  if (slug === 'innovise') return 'IS'
  if (slug.startsWith('vlc')) return 'VLC'
  if (slug.startsWith('emeve')) return 'EMV'

  // Si el slug tiene guiones (ej. "auto-repuestos-lara"), tomar iniciales o primer segmento
  if (slug) {
    const parts = slug.split('-').filter(Boolean)
    if (parts.length > 1 && parts[0].length >= 2 && parts[0].length <= 5) {
      return parts[0].toUpperCase()
    }
    if (parts.length >= 2) {
      return parts.map((p) => p[0]).join('').slice(0, 4).toUpperCase()
    }
    return slug.slice(0, 4).toUpperCase()
  }

  const name = tenant?.name?.trim() || ''
  if (name) {
    const ignoredWords = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'and', 've', 'c.a', 'c.a.', 'sa', 's.a', 'ca'])
    const words = name.split(/\s+/).filter((w) => !ignoredWords.has(w.toLowerCase()))
    if (words.length >= 2) {
      return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase()
    }
    return name.slice(0, 3).toUpperCase()
  }

  return 'IS'
}

/**
 * Genera el siguiente número secuencial de Factura / Pedido asociado estrictamente a la tienda (tenant_id).
 * Formato: {PREFIJO}-{YYYY}-{NNNN} (ej. VLC-2026-0001, IS-2026-0011)
 * Garantiza unicidad e incrementa correlativamente sin números aleatorios.
 */
export async function generateNextOrderNumber(
  supabase: SupabaseClient,
  tenantId: string,
  tenantObj?: { name?: string; slug?: string; settings?: any } | null
): Promise<string> {
  const year = new Date().getFullYear().toString()
  let tenant = tenantObj

  if (!tenant) {
    const { data } = await supabase.from('tenants').select('name, slug, settings').eq('id', tenantId).single()
    tenant = data
  }

  const prefix = getTenantDocPrefix(tenant)

  // Contar órdenes existentes de esta tienda en el año actual o en general
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  let nextSeq = (count ?? 0) + 1

  // Asegurar que el número no exista (en caso de órdenes eliminadas o saltos)
  let candidate = `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`
  let exists = true
  let attempts = 0

  while (exists && attempts < 50) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('order_number', candidate)
      .maybeSingle()

    if (!existing) {
      exists = false
    } else {
      nextSeq++
      candidate = `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`
      attempts++
    }
  }

  return candidate
}

/**
 * Genera el siguiente número secuencial de Cotización / Presupuesto asociado estrictamente a la tienda (tenant_id).
 * Formato: {PREFIJO}-COT-{YYYY}-{NNNN} (ej. VLC-COT-2026-0001, IS-COT-2026-0001)
 * Garantiza correlatividad estricta para cada tienda sin números aleatorios.
 */
export async function generateNextQuotationNumber(
  supabase: SupabaseClient,
  tenantId: string,
  tenantObj?: { name?: string; slug?: string; settings?: any } | null
): Promise<string> {
  const year = new Date().getFullYear().toString()
  let tenant = tenantObj

  if (!tenant) {
    const { data } = await supabase.from('tenants').select('name, slug, settings').eq('id', tenantId).single()
    tenant = data
  }

  const prefix = getTenantDocPrefix(tenant)
  const docPrefix = prefix ? `${prefix}-COT` : 'COT'

  // Contar cotizaciones existentes de esta tienda
  const { count } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  let nextSeq = (count ?? 0) + 1

  let candidate = `${docPrefix}-${year}-${String(nextSeq).padStart(4, '0')}`
  let exists = true
  let attempts = 0

  while (exists && attempts < 50) {
    const { data: existing } = await supabase
      .from('quotations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('quotation_number', candidate)
      .maybeSingle()

    if (!existing) {
      exists = false
    } else {
      nextSeq++
      candidate = `${docPrefix}-${year}-${String(nextSeq).padStart(4, '0')}`
      attempts++
    }
  }

  return candidate
}

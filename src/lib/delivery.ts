/**
 * Helper para gestión y extracción de información de Servicio de Delivery
 * en Facturación POS, Pedidos Web, Mensajes de WhatsApp y Facturas PDF.
 */

export interface DeliveryInfo {
  hasDelivery: boolean
  amountUsd: number
  amountVes: number
  address: string
}

/**
 * Extrae la información de delivery desde notas estructuradas o texto libre.
 */
export function extractDeliveryInfo(notes?: string | null, exchangeRate = 91.5): DeliveryInfo {
  if (!notes) {
    return { hasDelivery: false, amountUsd: 0, amountVes: 0, address: '' }
  }

  // 1. Tag estructurado: <!--DELIVERY:{"hasDelivery":true,"amountUsd":5,"amountVes":457.5,"address":"..."}-->
  const tagMatch = notes.match(/<!--DELIVERY:(.*?)-->/)
  if (tagMatch && tagMatch[1]) {
    try {
      const parsed = JSON.parse(tagMatch[1])
      const amtUsd = Number(parsed.amountUsd ?? parsed.amount_usd ?? 0)
      const amtVes = Number(parsed.amountVes ?? parsed.amount_ves ?? (amtUsd * exchangeRate))
      const addr = String(parsed.address ?? parsed.delivery_address ?? '').trim()
      const hasDel = Boolean(parsed.hasDelivery ?? parsed.has_delivery ?? (amtUsd > 0 || addr.length > 0))

      return {
        hasDelivery: hasDel,
        amountUsd: amtUsd,
        amountVes: amtVes,
        address: addr,
      }
    } catch {
      // Continuar con heurística si falla el parse JSON
    }
  }

  // 2. Búsqueda por patrones en el texto de notas (ej. "🛵 Delivery: $5.00 USD (Bs. 457.50) | Dir: Calle 15...")
  let hasDelivery = false
  let amountUsd = 0
  let amountVes = 0
  let address = ''

  const lower = notes.toLowerCase()
  if (lower.includes('delivery') || lower.includes('flete')) {
    hasDelivery = true

    // Extraer monto USD
    const usdMatch = notes.match(/(?:delivery|flete)[^$]*\$\s*([\d,.]+)/i)
    if (usdMatch && usdMatch[1]) {
      amountUsd = parseFloat(usdMatch[1].replace(',', '.')) || 0
    }

    // Extraer monto VES
    const vesMatch = notes.match(/(?:bs\.?|ves)\s*([\d.,]+)/i)
    if (vesMatch && vesMatch[1]) {
      amountVes = parseFloat(vesMatch[1].replace(/\./g, '').replace(',', '.')) || 0
    } else if (amountUsd > 0) {
      amountVes = amountUsd * exchangeRate
    }

    // Extraer dirección
    const dirMatch = notes.match(/(?:dirección|direccion|dir|destino|entrega):\s*([^|]+)/i)
    if (dirMatch && dirMatch[1]) {
      address = dirMatch[1].replace(/<!--.*?-->/g, '').trim()
    }
  }

  return { hasDelivery, amountUsd, amountVes, address }
}

/**
 * Genera el tag serializado inmutable para almacenar en orders.notes.
 */
export function formatDeliveryTag(info: DeliveryInfo): string {
  if (!info.hasDelivery && info.amountUsd <= 0 && !info.address) {
    return ''
  }
  return `<!--DELIVERY:${JSON.stringify({
    hasDelivery: Boolean(info.hasDelivery),
    amountUsd: Number(info.amountUsd.toFixed(2)),
    amountVes: Number(info.amountVes.toFixed(2)),
    address: info.address.trim(),
  })}-->`
}

/**
 * Limpia el tag de delivery de las notas para visualización legible por el usuario.
 */
export function cleanNotesFromDeliveryTag(notes?: string | null): string {
  if (!notes) return ''
  return notes.replace(/<!--DELIVERY:.*?-->/g, '').trim()
}

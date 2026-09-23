/**
 * Utilidades para manejo de códigos de productos:
 * - SKU / Código interno asignado por el usuario
 * - Código de barras (EAN-13, UPC, Code-128, etc.)
 */

import { Product } from '@/types/database'

const BARCODE_REGEX = /<!--BARCODE:(.*?)-->/

/**
 * Extrae el código de barras si está presente en el producto o serializado en description
 */
export function getProductBarcode(product: Partial<Product> | null | undefined): string | null {
  if (!product) return null
  if (product.barcode && typeof product.barcode === 'string' && product.barcode.trim()) {
    return product.barcode.trim()
  }
  if (product.description && typeof product.description === 'string') {
    const match = product.description.match(BARCODE_REGEX)
    if (match && match[1] && match[1].trim()) {
      return match[1].trim()
    }
  }
  return null
}

/**
 * Extrae el código de barras directamente de una cadena de descripción
 */
export function extractBarcodeFromDescription(description?: string | null): string | null {
  if (!description) return null
  const match = description.match(BARCODE_REGEX)
  return match && match[1] ? match[1].trim() : null
}

/**
 * Elimina la etiqueta <!--BARCODE:...--> del texto de la descripción
 */
export function stripBarcodeFromDescription(description?: string | null): string {
  if (!description) return ''
  return description.replace(BARCODE_REGEX, '').trim()
}

/**
 * Inyecta o actualiza la etiqueta <!--BARCODE:...--> en la descripción
 */
export function injectBarcodeIntoDescription(description: string, barcode: string | null | undefined): string {
  const clean = stripBarcodeFromDescription(description)
  if (!barcode || !barcode.trim()) return clean
  return `<!--BARCODE:${barcode.trim()}-->\n${clean}`
}

/**
 * Normaliza un código eliminando espacios y convirtiendo a minúsculas
 */
export function normalizeCode(code?: string | null): string {
  if (!code) return ''
  return code.toLowerCase().trim()
}

/**
 * Comprueba si un código (escaneado o buscado) coincide con el producto:
 * - Coincide con el SKU
 * - Coincide con el Código de Barras
 * - Coincide con el ID
 */
export function matchesProductCode(product: Partial<Product>, codeQuery: string): boolean {
  if (!codeQuery) return false
  const q = normalizeCode(codeQuery)
  if (!q) return false

  const sku = normalizeCode(product.sku)
  if (sku && (sku === q || sku.includes(q))) return true

  const barcode = normalizeCode(getProductBarcode(product))
  if (barcode && (barcode === q || barcode.includes(q))) return true

  const id = normalizeCode(product.id)
  if (id && id === q) return true

  return false
}

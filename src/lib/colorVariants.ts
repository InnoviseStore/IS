export interface ColorVariantItem {
  name: string
  hex?: string
  image_url?: string
  stock?: number
}

/**
 * Parsea las variantes de color serializadas dentro del campo description del producto.
 */
export function parseColorVariants(description?: string | null): {
  cleanDescription: string
  baseDescription: string
  colors: ColorVariantItem[]
} {
  if (!description) return { cleanDescription: '', baseDescription: '', colors: [] }

  const match = description.match(/<!--COLOR_VARIANTS:(.*?)-->/)
  if (!match) return { cleanDescription: description, baseDescription: description, colors: [] }

  try {
    const rawColors = JSON.parse(match[1]) as Array<Record<string, unknown>>
    const colors: ColorVariantItem[] = Array.isArray(rawColors)
      ? rawColors.map((c) => ({
          name: String(c.name || '').trim(),
          hex: c.hex ? String(c.hex) : undefined,
          image_url: c.image_url ? String(c.image_url) : undefined,
          stock: typeof c.stock === 'number' ? c.stock : c.stock ? parseInt(String(c.stock), 10) : undefined,
        }))
      : []

    const cleanDescription = description.replace(/<!--COLOR_VARIANTS:(.*?)-->/, '').trim()
    return { cleanDescription, baseDescription: cleanDescription, colors }
  } catch {
    return { cleanDescription: description, baseDescription: description, colors: [] }
  }
}

/**
 * Verifica si un producto tiene colores habilitados
 */
export function hasColorVariants(description?: string | null): boolean {
  const { colors } = parseColorVariants(description)
  return colors.length > 0
}

/**
 * Calcula la suma total de stock de los colores registrados
 */
export function getTotalColorStock(colors: ColorVariantItem[]): number {
  return colors.reduce((acc, c) => acc + (typeof c.stock === 'number' ? c.stock : 0), 0)
}

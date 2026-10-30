export interface SizeStockItem {
  size: string
  stock: number
}

export interface ApparelAttributes {
  garmentType?: string
  gender?: string
  sizes: string[]
  sizeStock?: SizeStockItem[]
}

/**
 * Parsea los atributos especializados de ropa y calzado (<!--APPAREL_ATTRIBUTES:{...}-->)
 */
export function parseApparelAttributes(desc?: string | null): {
  cleanDescription: string
  apparel: ApparelAttributes
} {
  if (!desc) return { cleanDescription: '', apparel: { sizes: [] } }
  const match = desc.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/)
  if (!match) {
    return { cleanDescription: desc, apparel: { sizes: [] } }
  }
  try {
    const apparel = JSON.parse(match[1]) as ApparelAttributes
    const cleanDescription = desc
      .replace(/<!--APPAREL_ATTRIBUTES:(.*?)-->/, '')
      .replace(/^🏷️[^\n]+\n\n?/m, '')
      .trim()
    return {
      cleanDescription,
      apparel: {
        garmentType: apparel.garmentType || '',
        gender: apparel.gender || '',
        sizes: Array.isArray(apparel.sizes) ? apparel.sizes : [],
        sizeStock: Array.isArray(apparel.sizeStock) ? apparel.sizeStock : [],
      },
    }
  } catch {
    return { cleanDescription: desc, apparel: { sizes: [] } }
  }
}

/**
 * Genera la línea visual de resumen de atributos (🏷️ ...)
 */
export function buildApparelBadgeLine(apparel: ApparelAttributes): string {
  const badgeParts: string[] = []
  if (apparel.garmentType) badgeParts.push(apparel.garmentType)
  if (apparel.gender) badgeParts.push(apparel.gender)
  if (apparel.sizes && apparel.sizes.length > 0) {
    if (apparel.sizeStock && apparel.sizeStock.length > 0) {
      const sizeDetails = apparel.sizeStock.map((s) => `${s.size} (${s.stock})`).join(', ')
      badgeParts.push(`Tallas: ${sizeDetails}`)
    } else {
      badgeParts.push(`Tallas: ${apparel.sizes.join(', ')}`)
    }
  }
  return badgeParts.length > 0 ? `🏷️ ${badgeParts.join(' | ')}` : ''
}

/**
 * Serializa los atributos y la línea descriptiva visual
 */
export function serializeApparelAttributes(
  baseDesc: string,
  apparel: ApparelAttributes
): string {
  if (!apparel.garmentType && !apparel.gender && (!apparel.sizes || apparel.sizes.length === 0)) {
    return baseDesc
  }

  const badgeText = buildApparelBadgeLine(apparel)
  const badgeLine = badgeText ? `${badgeText}\n\n` : ''
  return `<!--APPAREL_ATTRIBUTES:${JSON.stringify(apparel)}-->\n${badgeLine}${baseDesc}`
}

/**
 * Formatea el sufijo de variante para el nombre del producto en el ticket/factura
 * Ejemplo: " (Talla: 38 | Color: Blanco)"
 */
export function formatVariantSuffix(size?: string | null, color?: string | null): string {
  const parts: string[] = []
  if (size && size.trim()) parts.push(`Talla: ${size.trim()}`)
  if (color && color.trim()) parts.push(`Color: ${color.trim()}`)
  return parts.length > 0 ? ` (${parts.join(' | ')})` : ''
}

/**
 * Extrae la talla y/o color desde el nombre del ítem facturado
 * Ejemplo: "Sneakers Nike (Talla: 38 | Color: Blanco)" -> { baseName: "Sneakers Nike", size: "38", color: "Blanco" }
 */
export function extractVariantFromProductName(name?: string | null): {
  baseName: string
  size?: string
  color?: string
} {
  if (!name) return { baseName: '' }

  let size: string | undefined
  let color: string | undefined

  const sizeMatch = name.match(/Talla:\s*([^|)\]]+)/i)
  if (sizeMatch && sizeMatch[1]) {
    size = sizeMatch[1].trim()
  }

  const colorMatch = name.match(/Color:\s*([^|)\]]+)/i)
  if (colorMatch && colorMatch[1]) {
    color = colorMatch[1].trim()
  }

  const baseName = name
    .replace(/\s*\((?:Talla:[^)]*|Color:[^)]*)\)\s*$/i, '')
    .trim()

  return { baseName, size, color }
}

/**
 * Ajusta (descuenta o restaura) el stock específico de una talla y/o color dentro de `product.description`
 * sin alterar los demás metadatos (categoría, marca, código de barras, etc.).
 */
export function adjustProductVariantsInDescription(
  description: string | null | undefined,
  options: {
    size?: string | null
    color?: string | null
    quantityDelta: number // Negativo para venta (-1), positivo para devolución/reversión (+1)
  }
): {
  updatedDescription: string | null
  variantAdjusted: boolean
} {
  if (!description) {
    return { updatedDescription: description ?? null, variantAdjusted: false }
  }

  let updatedDesc = description
  let variantAdjusted = false
  const targetSize = options.size?.trim().toLowerCase()
  const targetColor = options.color?.trim().toLowerCase()

  // 1. Ajustar stock en APPAREL_ATTRIBUTES (sizeStock) si se especificó talla
  if (targetSize) {
    const apparelMatch = updatedDesc.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/)
    if (apparelMatch) {
      try {
        const apparel = JSON.parse(apparelMatch[1]) as ApparelAttributes
        if (Array.isArray(apparel.sizeStock) && apparel.sizeStock.length > 0) {
          let sizeFound = false
          const updatedSizeStock = apparel.sizeStock.map((item) => {
            if (String(item.size).trim().toLowerCase() === targetSize) {
              sizeFound = true
              const currentQty = Number(item.stock) || 0
              const nextQty = Math.max(0, currentQty + options.quantityDelta)
              return { ...item, stock: nextQty }
            }
            return item
          })

          // Si la talla estaba en `sizes` pero aún no en `sizeStock` y es una reversión (+), agregarla
          if (!sizeFound && options.quantityDelta > 0) {
            const matchingLabel =
              apparel.sizes?.find((s) => s.trim().toLowerCase() === targetSize) || options.size!.trim()
            updatedSizeStock.push({ size: matchingLabel, stock: options.quantityDelta })
            sizeFound = true
          }

          if (sizeFound) {
            const updatedApparel: ApparelAttributes = {
              ...apparel,
              sizeStock: updatedSizeStock,
            }
            const newApparelTag = `<!--APPAREL_ATTRIBUTES:${JSON.stringify(updatedApparel)}-->`
            const newBadgeLine = buildApparelBadgeLine(updatedApparel)

            updatedDesc = updatedDesc.replace(/<!--APPAREL_ATTRIBUTES:(.*?)-->/, newApparelTag)
            if (newBadgeLine) {
              if (/^🏷️[^\n]+/m.test(updatedDesc)) {
                updatedDesc = updatedDesc.replace(/^🏷️[^\n]+/m, newBadgeLine)
              }
            }
            variantAdjusted = true
          }
        }
      } catch {
        // Ignorar si el JSON de atributos está corrupto
      }
    }
  }

  // 2. Ajustar stock en COLOR_VARIANTS si se especificó color
  if (targetColor) {
    const colorMatch = updatedDesc.match(/<!--COLOR_VARIANTS:(.*?)-->/)
    if (colorMatch) {
      try {
        const colors = JSON.parse(colorMatch[1]) as Array<{
          name: string
          hex?: string
          image_url?: string
          stock?: number
        }>
        if (Array.isArray(colors) && colors.length > 0) {
          let colorFound = false
          const updatedColors = colors.map((col) => {
            if (String(col.name).trim().toLowerCase() === targetColor && typeof col.stock === 'number') {
              colorFound = true
              return {
                ...col,
                stock: Math.max(0, col.stock + options.quantityDelta),
              }
            }
            return col
          })

          if (colorFound) {
            updatedDesc = updatedDesc.replace(
              /<!--COLOR_VARIANTS:(.*?)-->/,
              `<!--COLOR_VARIANTS:${JSON.stringify(updatedColors)}-->`
            )
            variantAdjusted = true
          }
        }
      } catch {
        // Ignorar si el JSON de colores está corrupto
      }
    }
  }

  return { updatedDescription: updatedDesc, variantAdjusted }
}

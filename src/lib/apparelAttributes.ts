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
      .replace(/^🏷️[^\n]+\n\n?/, '')
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
 * Serializa los atributos y la línea descriptiva visual
 */
export function serializeApparelAttributes(
  baseDesc: string,
  apparel: ApparelAttributes
): string {
  if (!apparel.garmentType && !apparel.gender && (!apparel.sizes || apparel.sizes.length === 0)) {
    return baseDesc
  }

  const badgeParts = []
  if (apparel.garmentType) badgeParts.push(apparel.garmentType)
  if (apparel.gender) badgeParts.push(apparel.gender)
  if (apparel.sizes && apparel.sizes.length > 0) {
    if (apparel.sizeStock && apparel.sizeStock.length > 0) {
      const sizeDetails = apparel.sizeStock.map(s => `${s.size} (${s.stock})`).join(', ')
      badgeParts.push(`Tallas: ${sizeDetails}`)
    } else {
      badgeParts.push(`Tallas: ${apparel.sizes.join(', ')}`)
    }
  }

  const badgeLine = badgeParts.length > 0 ? `🏷️ ${badgeParts.join(' | ')}\n\n` : ''
  return `<!--APPAREL_ATTRIBUTES:${JSON.stringify(apparel)}-->\n${badgeLine}${baseDesc}`
}

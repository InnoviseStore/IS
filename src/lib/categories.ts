// ─── Helpers y Utilidades de Categorías y Subcategorías por Rubro ───────────────

export interface RubroCategoryConfig {
  name: string
  subcategories: string[]
}

export const RUBRO_CATEGORIES_MAP: Record<string, RubroCategoryConfig[]> = {
  tecnologia: [
    {
      name: 'Audio & Sonido',
      subcategories: ['Audífonos Bluetooth / TWS', 'Cornetas & Altavoces Portátiles', 'Audífonos de Diadema / Gaming', 'Cables Auxiliares & Adaptadores'],
    },
    {
      name: 'Cables & Conectividad',
      subcategories: ['Cables Tipo-C a Tipo-C', 'Cables Lightning / iPhone', 'Cables USB a Tipo-C', 'Adaptadores OTG & Hubs USB'],
    },
    {
      name: 'Cargadores & Energía',
      subcategories: ['Cargadores de Pared GaN', 'Cargadores para Auto', 'Power Banks / Baterías Externas', 'Cargadores Inalámbricos / MagSafe'],
    },
    {
      name: 'Fundas & Carcasas',
      subcategories: ['Fundas Silicona / MagSafe', 'Carcasas Antigolpe / Bumper', 'Estuches de Lujo', 'Fundas para Tablets / Laptops'],
    },
    {
      name: 'Vidrios Templados & Protección',
      subcategories: ['Vidrios Templados 9D / 11D', 'Micas de Cerámica / Privacidad', 'Micas de Hidrogel', 'Protectores de Cámara'],
    },
    {
      name: 'Smartwatches & Wearables',
      subcategories: ['Relojes Inteligentes', 'Correas & Pulseras de Reloj', 'Micas para Smartwatch', 'Cargadores Magnéticos'],
    },
    {
      name: 'Periféricos & Computación',
      subcategories: ['Mouse & Teclados', 'Mousepads', 'Memorias USB & MicroSD', 'Soportes de Laptop & Celular'],
    },
    {
      name: 'Repuestos & Servicio Técnico',
      subcategories: ['Pantallas & Módulos Display', 'Baterías Internas', 'Pines de Carga & Flex', 'Herramientas de Servicio'],
    },
  ],
  automotriz: [
    {
      name: 'Frenos & Suspensión',
      subcategories: ['Pastillas de Freno', 'Discos de Freno', 'Amortiguadores', 'Muñones & Terminales'],
    },
    {
      name: 'Filtros & Lubricantes',
      subcategories: ['Filtros de Aceite', 'Filtros de Aire', 'Filtros de Gasolina', 'Aceites de Motor & Fluidos'],
    },
    {
      name: 'Motor & Transmisión',
      subcategories: ['Bujías & Bobinas', 'Correas de Tiempo & Accesorios', 'Empacaduras', 'Bomba de Agua & Termostatos'],
    },
    {
      name: 'Sistema Eléctrico & Iluminación',
      subcategories: ['Baterías para Auto', 'Bombillos LED / Halógenos', 'Alternadores & Arranques', 'Fusibles & Relés'],
    },
    {
      name: 'Accesorios & Cuidado del Vehículo',
      subcategories: ['Cuidado & Limpieza (Shampoo/Cera)', 'Ambientadores', 'Soportes & Cargadores de Auto', 'Herramientas & Gatos'],
    },
  ],
  moda: [
    {
      name: 'Calzado & Zapatos',
      subcategories: ['Calzado Deportivo / Sneakers', 'Calzado Casual & Mocasines', 'Botas & Botines', 'Sandalias & Pantuflas'],
    },
    {
      name: 'Prendas Superiores',
      subcategories: ['Franelas / T-Shirts', 'Camisas Manga Larga & Corta', 'Polos & Chemises', 'Sweaters & Hoodies', 'Chaquetas & Abrigos'],
    },
    {
      name: 'Pantalones & Jeans',
      subcategories: ['Jeans Denim', 'Joggers & Monos', 'Pantalones Casuales / Chinos', 'Shorts & Bermudas'],
    },
    {
      name: 'Vestidos & Faldas',
      subcategories: ['Vestidos Casuales', 'Vestidos de Fiesta', 'Faldas Cortas & Largas', 'Enterizos & Sets'],
    },
    {
      name: 'Bolsos, Carteras & Accesorios',
      subcategories: ['Mochilas & Morrales', 'Carteras & Bolsos', 'Billeteras & Monederos', 'Gorras & Sombreros', 'Cinturones & Correas'],
    },
  ],
  bodegon: [
    {
      name: 'Licores & Bebidas',
      subcategories: ['Whisky & Ron', 'Vinos & Espumantes', 'Cervezas Importadas & Nacionales', 'Vodka, Ginebra & Tequila'],
    },
    {
      name: 'Snacks & Confitería',
      subcategories: ['Chocolates Importados', 'Snacks Salados & Papas', 'Galletas & Dulces', 'Frutos Secos'],
    },
    {
      name: 'Víveres & Gourmet',
      subcategories: ['Pastas & Salsas Italianas', 'Embutidos & Quesos Madurados', 'Café & Té Gourmet', 'Aceites de Oliva & Especias'],
    },
  ],
  farmacia: [
    {
      name: 'Medicamentos & Salud',
      subcategories: ['Analgésicos & Antiinflamatorios', 'Gripales & Antialérgicos', 'Antibióticos', 'Salud Digestiva'],
    },
    {
      name: 'Cuidado Personal & Higiene',
      subcategories: ['Cuidado Bucal', 'Shampoo & Cuidado Capilar', 'Jabones & Desodorantes', 'Cuidado Femenino'],
    },
    {
      name: 'Vitaminas & Suplementos',
      subcategories: ['Multivitamínicos', 'Vitamina C & Zinc', 'Proteínas & Colágeno', 'Suplementos Deportivos'],
    },
  ],
  ferreteria: [
    {
      name: 'Herramientas Manuales & Eléctricas',
      subcategories: ['Taladros & Esmeriles', 'Destornilladores & Llaves', 'Martillos & Alicates', 'Cintas Métricas & Niveles'],
    },
    {
      name: 'Electricidad & Iluminación',
      subcategories: ['Cables Eléctricos', 'Bombillos LED & Reflectores', 'Tomacorrientes & Interruptores', 'Breakers & Tableros'],
    },
    {
      name: 'Plomería & Tuberías',
      subcategories: ['Tubos PVC & Conexiones', 'Llaves & Grifería', 'Pegamentos & Selladores', 'Bombas de Agua'],
    },
  ],
  belleza: [
    {
      name: 'Maquillaje',
      subcategories: ['Bases & Correctores', 'Labiales & Gloss', 'Sombras & Delineadores', 'Polvos & Rubores'],
    },
    {
      name: 'Skincare & Cuidado Facial',
      subcategories: ['Serums & Ácido Hialurónico', 'Cremas Hidratantes', 'Protectores Solares', 'Limpiadores & Tónicos'],
    },
    {
      name: 'Perfumería & Fragancias',
      subcategories: ['Perfumes para Dama', 'Perfumes para Caballero', 'Body Mist & Splashes'],
    },
  ],
  general: [
    {
      name: 'Artículos Destacados',
      subcategories: ['Lo Más Vendido', 'Nuevos Ingresos', 'Ofertas & Promociones'],
    },
    {
      name: 'Variedades & Hogar',
      subcategories: ['Accesorios de Uso Diario', 'Artículos para el Hogar', 'Regalos & Novedades'],
    },
  ],
}

/**
 * Obtiene las categorías configuradas para un rubro dado.
 */
export function getRubroCategories(rubro?: string | null): RubroCategoryConfig[] {
  const r = (rubro || 'tecnologia').toLowerCase().trim()
  return RUBRO_CATEGORIES_MAP[r] || RUBRO_CATEGORIES_MAP.tecnologia || RUBRO_CATEGORIES_MAP.general
}

/**
 * Limpia un nombre de categoría removiendo etiquetas HTML, comentarios o residuos como <!--CATEGORY:...-->
 */
export function cleanCategoryName(cat?: string | null): string {
  if (!cat) return ''
  return cat
    .replace(/<!--CATEGORY:(.*?)-->/gi, '$1')
    .replace(/<!--SUBCATEGORY:(.*?)-->/gi, '')
    .replace(/<!--[a-z0-9_-]+:(.*?)-->/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

/**
 * Limpia un nombre de subcategoría
 */
export function cleanSubcategoryName(sub?: string | null): string {
  if (!sub) return ''
  return sub
    .replace(/<!--SUBCATEGORY:(.*?)-->/gi, '$1')
    .replace(/<!--CATEGORY:(.*?)-->/gi, '')
    .replace(/<!--[a-z0-9_-]+:(.*?)-->/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

/**
 * Extrae la categoría explícita codificada en la descripción.
 */
export function extractCategory(description?: string | null): string | null {
  if (!description) return null
  const catMatch = description.match(/<!--CATEGORY:(.*?)-->/i)
  if (catMatch && catMatch[1].trim()) {
    return cleanCategoryName(catMatch[1])
  }
  return null
}

/**
 * Extrae la subcategoría explícita codificada en la descripción.
 */
export function extractSubcategory(description?: string | null): string | null {
  if (!description) return null
  const subMatch = description.match(/<!--SUBCATEGORY:(.*?)-->/i)
  if (subMatch && subMatch[1].trim()) {
    return cleanSubcategoryName(subMatch[1])
  }
  return null
}

/**
 * Extrae la marca de un producto desde la descripción
 */
export function extractBrand(description?: string | null): string {
  if (!description) return ''
  const match = description.match(/<!--BRAND:(.*?)-->/i)
  return match ? match[1].trim() : ''
}

/**
 * Inyecta o actualiza la etiqueta de marca dentro de la descripción del producto
 */
export function injectBrandIntoDescription(description?: string | null, brand?: string | null): string {
  const cleanBrand = brand ? brand.trim() : ''
  const withoutBrand = (description || '').replace(/<!--BRAND:(.*?)-->/gi, '').trim()
  if (!cleanBrand) return withoutBrand
  return `<!--BRAND:${cleanBrand}-->\n${withoutBrand}`
}

/**
 * Limpia minuciosamente la descripción de un producto, eliminando cualquier tag interno
 * de serialización (<!--CATEGORY:...-->, <!--SUBCATEGORY:...-->, <!--APPAREL_ATTRIBUTES:...-->, <!--BRAND:...-->, etc.)
 * y badges como 🏷️ Rodamientos para que NUNCA aparezca texto técnico o código en textareas ni vistas.
 */
export function cleanProductDescription(description?: string | null): string {
  if (!description) return ''
  return description
    .replace(/<!--[\s\S]*?-->/g, '') // elimina cualquier tag técnico HTML o metadata
    .replace(/🏷️[^\n]*/g, '')         // elimina cualquier etiqueta de badge
    .replace(/^\s+|\s+$/g, '')        // trim
    .replace(/\n{3,}/g, '\n\n')       // normalizar saltos de línea
    .trim()
}

/**
 * Infiere o detecta la categoría de un producto por su nombre o descripción si no está explícita.
 */
export function detectCategory(name: string, description?: string | null): string {
  const explicitCategory = extractCategory(description)
  if (explicitCategory) {
    return cleanCategoryName(explicitCategory)
  }

  if (description) {
    const match = description.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/i)
    if (match) {
      try {
        const data = JSON.parse(match[1])
        if (data.garmentType) return cleanCategoryName(data.garmentType)
      } catch {}
    }
    const badgeMatch = description.match(/^🏷️\s*([^|\n]+)/)
    if (badgeMatch) return cleanCategoryName(badgeMatch[1])
  }

  const n = (name || '').toLowerCase()

  // Tecnología
  if (n.includes('funda') || n.includes('case') || n.includes('estuche')) return 'Fundas & Carcasas'
  if (n.includes('vidrio') || n.includes('mica') || n.includes('pantalla') || n.includes('hidrogel') || n.includes('protector')) return 'Vidrios Templados & Protección'
  if (n.includes('cable') || n.includes('adaptador') || n.includes('otg') || n.includes('hub')) return 'Cables & Conectividad'
  if (n.includes('cargador') || n.includes('power bank') || n.includes('bateria') || n.includes('cubo')) return 'Cargadores & Energía'
  if (n.includes('audifono') || n.includes('earbud') || n.includes('sound') || n.includes('audio') || n.includes('altavoz') || n.includes('corneta') || n.includes('auricular')) return 'Audio & Sonido'
  if (n.includes('smartwatch') || n.includes('reloj') || n.includes('smart band')) return 'Smartwatches & Wearables'

  // Automotriz
  if (n.includes('freno') || n.includes('pastilla') || n.includes('amortiguador')) return 'Frenos & Suspensión'
  if (n.includes('filtro') || n.includes('aceite') || n.includes('lubricante')) return 'Filtros & Lubricantes'
  if (n.includes('bujia') || n.includes('bujía') || n.includes('correa') || n.includes('bomba')) return 'Motor & Transmisión'

  // Ropa / Calzado
  if (n.includes('zapato') || n.includes('sneaker') || n.includes('calzado') || n.includes('zapatilla') || n.includes('sandalia') || n.includes('bota') || n.includes('tacón') || n.includes('tacon')) return 'Calzado & Zapatos'
  if (n.includes('pantalon') || n.includes('pantalón') || n.includes('jean') || n.includes('short') || n.includes('bermuda') || n.includes('jogger')) return 'Pantalones & Jeans'
  if (n.includes('camisa') || n.includes('franela') || n.includes('top') || n.includes('blusa') || n.includes('sweater') || n.includes('chaqueta') || n.includes('polo')) return 'Prendas Superiores'
  if (n.includes('vestido') || n.includes('falda')) return 'Vestidos & Faldas'
  if (n.includes('bolso') || n.includes('cartera') || n.includes('mochila') || n.includes('billetera')) return 'Bolsos, Carteras & Accesorios'

  return 'General'
}

/**
 * Convierte un nombre de categoría en un slug seguro para URLs.
 */
export function slugifyCategory(category: string): string {
  return cleanCategoryName(category)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

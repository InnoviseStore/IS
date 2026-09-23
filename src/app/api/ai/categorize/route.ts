import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

interface CategoryRule {
  keywords: string[]
  category: string
  prefix: string
}

// Reglas ultra-específicas de respaldo (30+ categorías detalladas de e-commerce)
const SPECIFIC_CATEGORY_RULES: CategoryRule[] = [
  // Pantallas, vidrios y protección
  {
    keywords: ['vidrio templado', 'mica de vidrio', 'ceramico', 'cerámico', 'privacy glass', 'hidrogel', 'mica hidrogel', 'vidrio 9d', 'vidrio 11d', 'vidrio uv'],
    category: 'Vidrios Templados & Micas',
    prefix: 'VID',
  },
  {
    keywords: ['magsafe', 'funda magsafe', 'case magsafe', 'estuche magsafe'],
    category: 'Fundas & Accesorios MagSafe',
    prefix: 'MAG',
  },
  {
    keywords: ['funda', 'case', 'estuche', 'forro', 'antigolpe', 'bumper', 'silicone case', 'carcasa'],
    category: 'Fundas & Carcasas Protectoras',
    prefix: 'CAS',
  },
  {
    keywords: ['pantalla', 'modulo', 'módulo', 'display oled', 'display amoled', 'tactil', 'touch screen'],
    category: 'Pantallas & Módulos de Reemplazo',
    prefix: 'DIS',
  },
  {
    keywords: ['bateria interna', 'batería iphone', 'bateria samsung', 'pila interna', 'flex de carga', 'pin de carga', 'repuesto'],
    category: 'Repuestos & Baterías de Móviles',
    prefix: 'REP',
  },

  // Carga y cables
  {
    keywords: ['cargador rapido', 'cargador rápido', 'cargador gan', 'adaptador de corriente', 'cubo de carga', 'cargador 20w', 'cargador 30w', 'cargador 45w', 'cargador 65w'],
    category: 'Cargadores de Pared & GaN',
    prefix: 'CRG',
  },
  {
    keywords: ['cargador carro', 'cargador auto', 'cargador vehiculo', 'transmisor fm'],
    category: 'Cargadores & Accesorios para Auto',
    prefix: 'CAU',
  },
  {
    keywords: ['cargador inalambrico', 'cargador inalámbrico', 'wireless charger', 'base de carga inalambrica'],
    category: 'Cargadores Inalámbricos',
    prefix: 'CWI',
  },
  {
    keywords: ['cable tipo c', 'cable lightning', 'cable usb c', 'cable usb a', 'cable micro usb', 'cable otg', 'cable datos'],
    category: 'Cables & Conectividad Rápida',
    prefix: 'CAB',
  },
  {
    keywords: ['powerbank', 'power bank', 'bateria portatil', 'batería portátil', 'bateria externa'],
    category: 'Power Banks & Baterías Externas',
    prefix: 'POW',
  },

  // Audio
  {
    keywords: ['airpod', 'earbud', 'tws', 'audifonos inalambricos', 'audífonos inalámbricos', 'auriculares bluetooth', 'auricular inalambrico'],
    category: 'Audífonos Bluetooth & TWS',
    prefix: 'TWS',
  },
  {
    keywords: ['audifono diadema', 'headset', 'diadema gamer', 'audifono cable', 'auricular cable', 'manos libres'],
    category: 'Audífonos de Diadema & Gaming',
    prefix: 'AUD',
  },
  {
    keywords: ['altavoz', 'bocina', 'corneta', 'speaker bluetooth', 'parlante portatil', 'soundbar'],
    category: 'Cornetas & Altavoces Portátiles',
    prefix: 'ALT',
  },

  // Wearables & Accesorios de reloj
  {
    keywords: ['correa reloj', 'correa smartwatch', 'pulsera silicona reloj', 'extensible apple watch'],
    category: 'Correas & Protectores para Smartwatch',
    prefix: 'COR',
  },
  {
    keywords: ['smartwatch', 'reloj inteligente', 'smart band', 'banda inteligente', 'reloj digital'],
    category: 'Smartwatches & Pulseras Inteligentes',
    prefix: 'REL',
  },

  // Computación, Gaming y Periféricos
  {
    keywords: ['mouse', 'raton gamer', 'ratón', 'mousepad', 'teclado mecanico', 'teclado inalámbrico', 'keyboard', 'webcam', 'microfono usb'],
    category: 'Periféricos & Computación',
    prefix: 'PER',
  },
  {
    keywords: ['pendrive', 'memoria usb', 'microsd', 'disco duro', 'disco ssd', 'tarjeta sd'],
    category: 'Almacenamiento & Memorias',
    prefix: 'MEM',
  },
  {
    keywords: ['soporte celular', 'tripode', 'trípode', 'aro de luz', 'anillo selfie', 'soporte escritorio', 'base celular'],
    category: 'Soportes, Trípodes & Aros de Luz',
    prefix: 'SOP',
  },
  {
    keywords: ['camara seguridad', 'cámara wifi', 'camara ip', 'bombillo inteligente', 'enchufe inteligente', 'domotica'],
    category: 'Cámaras de Seguridad & Smart Home',
    prefix: 'CAM',
  },
  {
    keywords: ['herramienta', 'destornillador', 'estacion soldadura', 'cautin', 'pinza de precision', 'multimetro', 'manta termica'],
    category: 'Herramientas de Servicio Técnico',
    prefix: 'HER',
  },

  // Calzado y Moda
  {
    keywords: ['sneaker', 'zapato deportivo', 'zapatilla', 'tenis', 'calzado running', 'tacos futbol'],
    category: 'Calzado Deportivo & Sneakers',
    prefix: 'SNE',
  },
  {
    keywords: ['zapato casual', 'bota', 'botin', 'sandalia', 'chancleta', 'croc', 'tacón', 'mocasín'],
    category: 'Calzado Casual & Sandalias',
    prefix: 'CAL',
  },
  {
    keywords: ['franela', 'remera', 't-shirt', 'camisa polo', 'top deportivo', 'blusa'],
    category: 'Prendas Superiores & Franelas',
    prefix: 'FRA',
  },
  {
    keywords: ['pantalon', 'pantalón', 'jean', 'denim', 'jogger', 'short', 'bermuda', 'cargo'],
    category: 'Pantalones, Jeans & Shorts',
    prefix: 'PAN',
  },
  {
    keywords: ['chaqueta', 'suéter', 'sweater', 'hoodie', 'abrigo', 'cortaviento'],
    category: 'Chaquetas & Abrigos',
    prefix: 'ABR',
  },
  {
    keywords: ['gorra', 'sombrero', 'lentes de sol', 'cinturon', 'correa cuero'],
    category: 'Accesorios de Moda & Gorras',
    prefix: 'ACC',
  },
  {
    keywords: ['bolso', 'mochila', 'backpack', 'morral', 'bulto', 'mariconera', 'cangurera'],
    category: 'Bolsos, Mochilas & Morrales',
    prefix: 'BOL',
  },
  {
    keywords: ['billetera', 'cartera', 'tarjetero', 'monedero'],
    category: 'Billeteras & Tarjeteros',
    prefix: 'BIL',
  },
  {
    keywords: ['perfume', 'colonia', 'fragancia', 'splash', 'body mist'],
    category: 'Perfumería & Fragancias',
    prefix: 'PRF',
  },
]

export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'almacen', 'vendedor', 'cashier', 'cajero'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { name, tenantId, tenantSlug } = await req.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nombre de producto requerido' }, { status: 400 })
    }

    const cleanName = name.trim()
    const n = cleanName.toLowerCase()
    const supabase = getAdminClient()

    // 1. Resolver tenant_id efectivo
    let targetTenantId = tenantId
    if (!targetTenantId && tenantSlug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, settings')
        .eq('slug', tenantSlug)
        .maybeSingle()
      if (tenant) targetTenantId = tenant.id
    }

    // 2. Obtener clave de Gemini disponible (en env o en tenant settings)
    let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    let existingCategories: string[] = []

    if (targetTenantId) {
      try {
        const [tenantRes, catsRes] = await Promise.all([
          supabase.from('tenants').select('settings').eq('id', targetTenantId).maybeSingle(),
          supabase.from('products').select('category').eq('tenant_id', targetTenantId).not('category', 'is', null).limit(100),
        ])

        const tSettings = (tenantRes.data?.settings || {}) as Record<string, unknown>
        if (!geminiKey) {
          geminiKey = (tSettings?.gemini_api_key || tSettings?.google_api_key) as string | undefined
        }

        if (catsRes.data) {
          const rawCats = catsRes.data.map(p => (p.category as string)?.trim()).filter(Boolean)
          existingCategories = Array.from(new Set(rawCats))
        }
      } catch (err) {
        console.warn('Error reading tenant categories:', err)
      }
    }

    let category = ''
    let prefix = ''
    let confidence = 0.85

    // 3. Si hay Gemini disponible, solicitar categorización ultra-específica
    if (geminiKey) {
      try {
        const prompt = `Actúa como un experto en catalogación de inventario y comercio electrónico minorista.
Clasifica este producto en una subcategoría de producto MUY ESPECÍFICA y precisa (no uses categorías genéricas como "Tecnología", "Accesorios" o "Varios").

Nombre del Producto: "${cleanName}"
${existingCategories.length > 0 ? `Categorías ya utilizadas en esta tienda: ${existingCategories.slice(0, 20).join(', ')}` : ''}

REGLAS DE CATEGORIZACIÓN:
1. La categoría debe ser específica y describir el tipo exacto de producto (ejemplos: "Vidrios Templados & Micas", "Fundas & Carcasas Antigolpe", "Cables & Conectividad Rápida", "Cargadores de Pared & GaN", "Audífonos Bluetooth & TWS", "Correas para Smartwatch", "Repuestos & Pantallas", "Calzado Deportivo & Sneakers", "Pantalones & Jeans", "Perfumería & Fragancias", etc.).
2. Si coincide con una de las categorías ya utilizadas en la tienda, reutilízala preferentemente.
3. El prefijo SKU ("prefix") debe ser exactamente de 3 o 4 letras mayúsculas alusivas (ej. VID, CRG, CAB, TWS, AUD, CAS, MAG, REP, SNE, CAL, FRA, PAN, BOL).
4. Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{"category": "Nombre Específico de Categoría", "prefix": "PRE"}`

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 150,
            },
          }),
        })

        if (res.ok) {
          const gData = await res.json()
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (rawText) {
            const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
            const parsed = JSON.parse(cleanJson)
            if (parsed.category && typeof parsed.category === 'string') {
              category = parsed.category.trim()
              prefix = (parsed.prefix || '').trim().toUpperCase().slice(0, 4)
              confidence = 0.98
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini categorization error, falling back to rules:', geminiErr)
      }
    }

    // 4. Si Gemini no arrojó categoría, evaluar las reglas específicas locales
    if (!category) {
      const match = SPECIFIC_CATEGORY_RULES.find((rule) =>
        rule.keywords.some((kw) => n.includes(kw))
      )

      if (match) {
        category = match.category
        prefix = match.prefix
        confidence = 0.92
      } else {
        // Asignación inteligente por palabras del nombre
        const words = cleanName.split(/\s+/).filter((w) => w.length >= 3)
        const primary = words[0] || 'Articulo'
        category = `${primary.charAt(0).toUpperCase() + primary.slice(1).toLowerCase()} & Accesorios`
        prefix = primary.slice(0, 3).toUpperCase()
        confidence = 0.75
      }
    }

    if (!prefix) {
      const words = cleanName.split(/\s+/).filter((w) => w.length >= 3)
      prefix = (words[0] || 'PRD').slice(0, 3).toUpperCase()
    }

    // 5. Determinar el siguiente número correlativo de SKU en la base de datos
    let nextNumber = 1

    if (targetTenantId) {
      try {
        const { data: existingProducts } = await supabase
          .from('products')
          .select('sku')
          .eq('tenant_id', targetTenantId)
          .ilike('sku', `${prefix}-%`)

        if (existingProducts && existingProducts.length > 0) {
          const numbers = existingProducts
            .map((p) => {
              if (!p.sku) return 0
              const parts = p.sku.split('-')
              const num = parseInt(parts[parts.length - 1], 10)
              return isNaN(num) ? 0 : num
            })
            .filter((n) => n > 0)

          if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1
          }
        }
      } catch (skuErr) {
        console.warn('Error calculating correlative SKU:', skuErr)
      }
    }

    const suggestedSku = `${prefix}-${String(nextNumber).padStart(3, '0')}`

    return NextResponse.json({
      success: true,
      category,
      prefix,
      suggestedSku,
      confidence,
    })
  } catch (err) {
    console.error('Categorize error:', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}

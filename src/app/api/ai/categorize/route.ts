import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}

interface CategoryRule {
  keywords: string[]
  category: string
  prefix: string
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    keywords: ['altavoz', 'bocina', 'corneta', 'speaker', 'parlante', 'soundbar', 'subwoofer'],
    category: 'Altavoz / Corneta / Bocina',
    prefix: 'ALT',
  },
  {
    keywords: ['audifono', 'auricular', 'headphone', 'earphone', 'earbuds', 'headset', 'diadema', 'airpod'],
    category: 'Audífonos / Auriculares',
    prefix: 'AUD',
  },
  {
    keywords: ['bolso', 'mochila', 'backpack', 'morral', 'maletin', 'bulto'],
    category: 'Bolsos / Mochilas / Estuches',
    prefix: 'BOL',
  },
  {
    keywords: ['cable', 'adaptador', 'cargador', 'hub', 'usb', 'tipo c', 'lightning', 'hdmi', 'auxiliar'],
    category: 'Cables / Cargadores / Conectividad',
    prefix: 'CAB',
  },
  {
    keywords: ['mouse', 'teclado', 'keyboard', 'raton', 'pad', 'mousepad', 'webcam', 'microfono'],
    category: 'Periféricos & Computación',
    prefix: 'PER',
  },
  {
    keywords: ['reloj', 'smartwatch', 'band', 'pulsera'],
    category: 'Smartwatches & Wearables',
    prefix: 'REL',
  },
  {
    keywords: ['forro', 'funda', 'case', 'protector', 'vidrio', 'mica', 'pantalla'],
    category: 'Protectores & Fundas',
    prefix: 'CAS',
  },
  {
    keywords: ['memoria', 'pendrive', 'microsd', 'disco', 'ssd', 'almacenamiento', 'ram'],
    category: 'Almacenamiento & Memorias',
    prefix: 'MEM',
  },
  {
    keywords: ['powerbank', 'power bank', 'bateria', 'pila'],
    category: 'Power Banks & Energía',
    prefix: 'POW',
  },
  {
    keywords: ['soporte', 'tripode', 'stand', 'base', 'anillo'],
    category: 'Soportes & Accesorios',
    prefix: 'SOP',
  },
]

export async function POST(req: Request) {
  try {
    const { name, tenantId, tenantSlug } = await req.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nombre de producto requerido' }, { status: 400 })
    }

    const cleanName = name.trim().toLowerCase()

    // 1. Detectar categoría y prefijo con reglas inteligentes de IA
    let match = CATEGORY_RULES.find((rule) =>
      rule.keywords.some((kw) => cleanName.includes(kw))
    )

    let category = match ? match.category : 'Accesorios & Tecnología'
    let prefix = match ? match.prefix : ''

    if (!prefix) {
      // Extraer prefijo de 3 letras de la primera palabra relevante
      const words = cleanName.split(/\s+/).filter((w) => w.length >= 3)
      const baseWord = words[0] || 'PRD'
      prefix = baseWord.slice(0, 3).toUpperCase()
    }

    // 2. Consultar productos existentes para encontrar el siguiente código correlativo
    const supabase = getAdminClient()

    let targetTenantId = tenantId

    if (!targetTenantId && tenantSlug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single()
      if (tenant) targetTenantId = tenant.id
    }

    let nextNumber = 1

    if (targetTenantId) {
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
    }

    const suggestedSku = `${prefix}-${String(nextNumber).padStart(3, '0')}`

    return NextResponse.json({
      success: true,
      category,
      prefix,
      suggestedSku,
      confidence: match ? 0.95 : 0.70,
    })
  } catch (err) {
    console.error('Categorize error:', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export const dynamic = 'force-dynamic'

interface ApparelAttributes {
  garmentType?: string
  gender?: string
  sizes?: string[]
}

interface ColorItem {
  name: string
  hex?: string
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'almacen', 'vendedor', 'cashier', 'cajero'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json()
    const {
      name,
      category,
      barcode,
      sku,
      priceUsd,
      apparelAttributes,
      colors,
      tenantId,
      tenantSlug,
    }: {
      name?: string
      category?: string
      barcode?: string
      sku?: string
      priceUsd?: number
      apparelAttributes?: ApparelAttributes
      colors?: ColorItem[]
      tenantId?: string
      tenantSlug?: string
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Por favor indica el nombre del producto para generar su descripción.' },
        { status: 400 }
      )
    }

    const cleanName = name.trim()

    // Formatear cadenas auxiliares
    const sizesStr =
      apparelAttributes?.sizes && apparelAttributes.sizes.length > 0
        ? apparelAttributes.sizes.join(', ')
        : ''

    const colorsStr =
      colors && colors.length > 0
        ? colors.map((c) => c.name).join(', ')
        : ''

    const genderStr = apparelAttributes?.gender ? apparelAttributes.gender : ''

    // 1. Obtener posible clave de Gemini (variables de entorno o configuración del tenant)
    let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!geminiKey && (tenantId || tenantSlug)) {
      try {
        const supabase = getAdminClient()
        let query = supabase.from('tenants').select('settings')
        if (tenantId) {
          query = query.eq('id', tenantId)
        } else if (tenantSlug) {
          query = query.eq('slug', tenantSlug)
        }
        const { data: tenantData } = await query.maybeSingle()
        const tSettings = (tenantData?.settings || {}) as Record<string, unknown>
        geminiKey = (tSettings?.gemini_api_key || tSettings?.google_api_key) as string | undefined
      } catch (err) {
        console.warn('Error reading tenant settings for Gemini key:', err)
      }
    }

    // 2. Si hay clave de Gemini, invocar investigación profunda con IA
    if (geminiKey) {
      try {
        const prompt = `Eres un redactor técnico y especialista en e-commerce minorista. Tu objetivo es investigar las características reales de este producto e identificar qué lo hace destacar en el mercado para redactar una descripción persuasiva, profesional y técnicamente precisa.

DATOS DEL PRODUCTO:
- Nombre o Modelo: "${cleanName}"
${category ? `- Categoría: ${category}` : ''}
${barcode ? `- Código de Barras / EAN / UPC: ${barcode}` : ''}
${sku ? `- Código Interno / SKU: ${sku}` : ''}
${priceUsd ? `- Precio aproximado: $${priceUsd} USD` : ''}
${colorsStr ? `- Colores / Variantes: ${colorsStr}` : ''}
${sizesStr ? `- Tallas disponibles: ${sizesStr}` : ''}
${genderStr ? `- Género / Público objetivo: ${genderStr}` : ''}

PAUTAS DE INVESTIGACIÓN Y REDACCIÓN:
1. Identifica el tipo de producto y marca (si es visible en el nombre como Apple, Samsung, Xiaomi, JBL, Anker, Sony, Nike, Huawei, Baseus, Lenovo, etc.).
2. Explica especificaciones técnicas reales esperadas para este tipo de producto (potencia en Watts, protocolos de carga rápida, versiones de conectividad inalámbrica, capacidad, materiales duraderos como aleaciones, silicona líquida o vidrio templado 9H, ergonomía, etc.).
3. Escribe en un formato estructurado con viñetas en Markdown limpio:
   - **Párrafo introductorio** (1-2 oraciones atractivas destacando su propuesta de valor).
   - ✨ **Características Principales** (3 a 5 viñetas concisas con beneficios claros).
   - ⚙️ **Ficha Técnica & Especificaciones** (datos concretos como conectividad, materiales, compatibilidad o potencia).
   - 📦 **Compatibilidad & Uso Recomendado** (con qué dispositivos o situaciones funciona mejor).
${colorsStr ? `   - 🎨 **Colores disponibles**: ${colorsStr}\n` : ''}${sizesStr ? `   - 📏 **Tallas disponibles**: ${sizesStr}\n` : ''}
4. Tono comercial en español latinoamericano, profesional, claro y vendedor.
5. NO incluyas introducciones ("Aquí está...", "Claro, con gusto..."), ni bloques de código \`\`\`markdown. Entrega exclusivamente el contenido de la descripción.`

        // Intentar con gemini-1.5-flash y fallback a gemini-2.0-flash
        const models = ['gemini-1.5-flash', 'gemini-2.0-flash']
        for (const model of models) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
            const geminiRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 1200,
                },
              }),
            })

            if (geminiRes.ok) {
              const gData = await geminiRes.json()
              const generatedText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
              if (generatedText && generatedText.length > 50) {
                const cleanText = generatedText
                  .replace(/^```markdown\s*/i, '')
                  .replace(/^```\s*/i, '')
                  .replace(/\s*```$/i, '')
                  .trim()

                return NextResponse.json({
                  success: true,
                  description: cleanText,
                  source: 'gemini-ai',
                })
              }
            }
          } catch (mErr) {
            console.warn(`Error trying ${model}:`, mErr)
          }
        }
      } catch (geminiError) {
        console.warn('Error connecting to Gemini for description:', geminiError)
      }
    }

    // 3. Fallback Heurístico Avanzado y Enriquecido (cuando no hay clave o falla conexión)
    const n = cleanName.toLowerCase()
    let profile = 'general'

    if (
      category?.toLowerCase().includes('calzado') ||
      category?.toLowerCase().includes('zapato') ||
      n.includes('zapato') ||
      n.includes('sneaker') ||
      n.includes('zapatilla') ||
      n.includes('bota') ||
      n.includes('sandalia')
    ) {
      profile = 'footwear'
    } else if (
      category?.toLowerCase().includes('ropa') ||
      category?.toLowerCase().includes('pantalon') ||
      category?.toLowerCase().includes('camisa') ||
      category?.toLowerCase().includes('franela') ||
      n.includes('franela') ||
      n.includes('pantalon') ||
      n.includes('pantalón') ||
      n.includes('jean') ||
      n.includes('camisa') ||
      n.includes('vestido') ||
      n.includes('chaqueta')
    ) {
      profile = 'apparel'
    } else if (
      category?.toLowerCase().includes('audio') ||
      category?.toLowerCase().includes('auricular') ||
      category?.toLowerCase().includes('corneta') ||
      category?.toLowerCase().includes('altavoz') ||
      n.includes('audifono') ||
      n.includes('auricular') ||
      n.includes('altavoz') ||
      n.includes('corneta') ||
      n.includes('soundbar') ||
      n.includes('tws')
    ) {
      profile = 'audio'
    } else if (
      category?.toLowerCase().includes('cargador') ||
      category?.toLowerCase().includes('cable') ||
      n.includes('cargador') ||
      n.includes('cable') ||
      n.includes('adaptador') ||
      n.includes('powerbank') ||
      n.includes('usb')
    ) {
      profile = 'charging'
    } else if (
      category?.toLowerCase().includes('vidrio') ||
      category?.toLowerCase().includes('mica') ||
      category?.toLowerCase().includes('protector') ||
      category?.toLowerCase().includes('funda') ||
      category?.toLowerCase().includes('case') ||
      n.includes('vidrio') ||
      n.includes('mica') ||
      n.includes('funda') ||
      n.includes('case') ||
      n.includes('protector')
    ) {
      profile = 'protection'
    } else if (
      n.includes('reloj') ||
      n.includes('smartwatch') ||
      n.includes('band')
    ) {
      profile = 'smartwatch'
    } else if (
      n.includes('bolso') ||
      n.includes('mochila') ||
      n.includes('morral') ||
      n.includes('cartera')
    ) {
      profile = 'bags'
    }

    let description = ''

    if (profile === 'charging') {
      description = `Optimiza la energía de tus dispositivos con ${cleanName}. Diseñado con componentes de alta conductividad y protección electrónica de vanguardia para garantizar cargas estables, rápidas y seguras en todo momento.

✨ Características Principales:
• Transferencia de corriente eficiente con disipación térmica optimizada para evitar sobrecalentamientos.
• Conectores reforzados con alivio de tensión para máxima resistencia a la flexión y tirones accidentales.
• Protección contra sobrevoltaje, cortocircuito y fluctuaciones de energía.

⚙️ Especificaciones Técnicas:
• Compatibilidad: Dispositivos con puerto USB / Tipo-C / Lightning según corresponda.
• Construcción de alta durabilidad con recubrimiento ignífugo y pines de contacto blindados.`
    } else if (profile === 'protection') {
      description = `Brinda a tu equipo la protección superior que merece con ${cleanName}. Elaborado para absorber impactos directos y preservar la estética original de tu pantalla y chasis sin añadir volumen innecesario.

✨ Beneficios Clave:
• Resistencia de alto nivel contra golpes, rayones de llaves y caídas cotidianas.
• Claridad visual absoluta con revestimiento oleofóbico que minimiza las huellas dactilares y manchas de grasa.
• Calce exacto con recortes milimétricos para botones, cámaras y puertos.

⚙️ Especificaciones:
• Material: Polímero de alta resistencia / Vidrio templado templado térmicamente.
• Instalación rápida y libre de burbujas con adherencia total.`
    } else if (profile === 'audio') {
      description = `Experimenta una acústica envolvente y nítida con ${cleanName}. Creado para los amantes del buen sonido, ofrece graves profundos, agudos definidos y una reproducción balanceada para tu música, series y llamadas.

✨ Puntos Destacados:
• Transductores de alta precisión para un audio balanceado sin distorsión a volumen elevado.
• Conectividad inalámbrica estable de baja latencia para disfrutar de videos y videojuegos sin desfase.
• Micrófono integrado de alta fidelidad para llamadas telefónicas y notas de voz transparentes.
• Batería eficiente para múltiples horas de reproducción continua.`
    } else if (profile === 'footwear') {
      description = `Disfruta del máximo confort y estilo contemporáneo con ${cleanName}. Concebido para adaptarse a tu ritmo diario, combinando amortiguación superior con un diseño versátil para cualquier ocasión.

✨ Aspectos Destacados:
• Suela antideslizante con dibujo de tracción profunda para máxima adherencia en diversas superficies.
• Plantilla ergonómica que distribuye el peso de la pisada, reduciendo la fatiga al caminar o entrenar.
• Materiales exteriores transpirables que mantienen el pie fresco y cómodo todo el día.`
    } else if (profile === 'apparel') {
      const garment = apparelAttributes?.garmentType || 'prenda'
      description = `Eleva tu estilo con ${cleanName}. Este ${garment} destaca por su confección de alta calidad, textura suave al tacto y corte ergonómico que favorece la silueta con total libertad de movimiento.

✨ Características:
• Tejido premium resistente al desgaste que conserva forma y color tras continuas lavadas.
• Acabados y costuras reforzadas pensadas para brindar durabilidad y distinción.
• Versatilidad ideal tanto para el día a día como para ocasiones especiales.`
    } else if (profile === 'smartwatch') {
      description = `Mantén el control de tu salud, entrenamientos y notificaciones en tu muñeca con ${cleanName}. Combina tecnología de monitoreo biométrico con una interfaz intuitiva y elegante.

✨ Funcionalidades Clave:
• Sensores biométricos para medición de pasos, frecuencia cardíaca y monitoreo de descanso.
• Sincronización continua de llamadas, mensajes y notificaciones de aplicaciones en tiempo real.
• Batería de gran autonomía con modo de ahorro de energía y resistencia a salpicaduras diarias.`
    } else if (profile === 'bags') {
      description = `Transporta y resguarda tus artículos personales y tecnología con ${cleanName}. Diseñado con un enfoque funcional para el estilo de vida urbano, combinando practicidad y resistencia.

✨ Características:
• Compartimentos interiores acolchados diseñados para proteger laptops, tablets y accesorios.
• Tejido impermeable de alta densidad resistente a rasgaduras y salpicaduras de lluvia.
• Correas ajustables ergonómicas para una distribución cómoda del peso.`
    } else {
      description = `Descubre el rendimiento, practicidad y calidad que ofrece ${cleanName}. Fabricado con estándares estrictos para ofrecerte una solución confiable y moderna que supera tus expectativas diarias.

✨ Beneficios Destacados:
• Construcción de primera categoría diseñada para una vida útil prolongada y uso continuo.
• Diseño funcional, ergonómico y fácil de integrar en tus rutinas cotidianas.
• Excelente relación precio-rendimiento con total respaldo de satisfacción.`
    }

    if (colorsStr) {
      description += `\n\n🎨 Variantes de Color: ${colorsStr}.`
    }
    if (sizesStr) {
      description += `\n📏 Tallas Disponibles: ${sizesStr}.`
    }

    description += `\n\n📦 Producto garantizado. ¡Listo para entrega inmediata!`

    return NextResponse.json({
      success: true,
      description,
      source: 'enhanced-heuristic',
    })
  } catch (err) {
    console.error('Error generating description:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Error al generar la descripción del producto' },
      { status: 500 }
    )
  }
}

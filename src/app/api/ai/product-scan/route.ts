import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

interface DetectedData {
  brand?: string
  model?: string
  code?: string
  color?: string
  keywords?: string[]
  description?: string
  raw_text?: string
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { image, tenantId, textQuery } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId es obligatorio.' }, { status: 400 })
    }

    // 1. Autenticación y control de acceso
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'almacen', 'vendedor'],
      targetTenantId: tenantId,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 2. Obtener catálogo de productos activos del comercio
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, base_price_usd, stock, is_active, image_url, description')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (prodErr || !products || products.length === 0) {
      return NextResponse.json({
        success: true,
        detected: { description: 'No hay productos activos en este comercio para contrastar.' },
        matches: [],
      })
    }

    let detected: DetectedData = {
      keywords: [],
    }

    // 3. Si se envió imagen y hay clave de Gemini disponible, invocar Gemini Flash Vision
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (image && geminiKey) {
      try {
        // Extraer base64 y tipo MIME
        let mimeType = 'image/jpeg'
        let base64Data = image
        if (image.includes(';base64,')) {
          const parts = image.split(';base64,')
          mimeType = parts[0].replace('data:', '') || 'image/jpeg'
          base64Data = parts[1]
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Eres un asistente de inventario y punto de venta. Analiza esta fotografía de un producto, caja, empaque o etiqueta.
Extrae la siguiente información técnica en formato JSON estricto:
- "brand": Marca o fabricante si es visible o identificable (ej. Samsung, Apple, Xiaomi, Sony, JBL, etc.).
- "model": Nombre o modelo específico del producto (ej. Audífonos Bluetooth, Altavoz Portátil, Case Silicona, etc.).
- "code": Código alfanumérico, SKU, número de modelo o código de barras que aparezca escrito en la etiqueta o empaque.
- "color": Color principal del artículo.
- "keywords": Lista de 3 a 6 palabras clave descriptivas en español para buscar en inventario.
- "description": Breve descripción de 1 frase de lo que se ve en la foto.

Responde ÚNICAMENTE con el objeto JSON sin bloques de código ni markdown.`
                    },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500,
              }
            })
          }
        )

        if (geminiRes.ok) {
          const gData = await geminiRes.json()
          const rawReply = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (rawReply) {
            const cleanJson = rawReply.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
            try {
              const parsed = JSON.parse(cleanJson)
              detected = {
                brand: parsed.brand || '',
                model: parsed.model || '',
                code: parsed.code || '',
                color: parsed.color || '',
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                description: parsed.description || '',
              }
            } catch (pErr) {
              console.warn('Error parsing Gemini JSON response:', pErr)
            }
          }
        }
      } catch (gErr) {
        console.warn('Error al contactar Gemini Vision:', gErr)
      }
    }

    // 4. Heurística de respaldo o enriquecimiento con texto adicional
    if (textQuery && typeof textQuery === 'string') {
      const qTokens = normalizeString(textQuery).split(/\s+/).filter(t => t.length > 1)
      detected.keywords = Array.from(new Set([...(detected.keywords || []), ...qTokens]))
      if (!detected.description) {
        detected.description = textQuery
      }
    }

    // 5. Algoritmo de puntuación y coincidencia contra la base de datos de productos
    interface ScoredMatch {
      product: typeof products[0]
      score: number
      match_reason: string
    }

    const scoredMatches: ScoredMatch[] = []

    const normCode = detected.code ? normalizeString(detected.code) : ''
    const normBrand = detected.brand ? normalizeString(detected.brand) : ''
    const normModel = detected.model ? normalizeString(detected.model) : ''
    const allSearchTokens = [
      ...normBrand.split(/\s+/),
      ...normModel.split(/\s+/),
      ...(detected.keywords || []).map(normalizeString),
      ...(textQuery ? normalizeString(textQuery).split(/\s+/) : []),
    ].filter(t => t.length > 2)

    for (const prod of products) {
      let score = 0
      const reasons: string[] = []

      const prodSkuNorm = prod.sku ? normalizeString(prod.sku) : ''
      const prodNameNorm = normalizeString(prod.name)
      const prodDescNorm = prod.description ? normalizeString(prod.description) : ''

      // A. Coincidencia por Código / SKU
      if (normCode && prodSkuNorm) {
        if (prodSkuNorm === normCode) {
          score += 85
          reasons.push('Código exacto coincide con SKU')
        } else if (prodSkuNorm.includes(normCode) || normCode.includes(prodSkuNorm)) {
          score += 65
          reasons.push('Coincidencia parcial de código/SKU')
        }
      }

      // B. Coincidencia por Marca
      if (normBrand && normBrand.length > 2) {
        if (prodNameNorm.includes(normBrand) || prodDescNorm.includes(normBrand)) {
          score += 35
          reasons.push(`Marca "${detected.brand}" detectada`)
        }
      }

      // C. Coincidencia por Modelo / Tipo de Producto
      if (normModel && normModel.length > 2) {
        const modelTokens = normModel.split(/\s+/).filter(t => t.length > 2)
        let modelMatches = 0
        for (const token of modelTokens) {
          if (prodNameNorm.includes(token)) {
            modelMatches++
          }
        }
        if (modelMatches > 0) {
          const ratio = modelMatches / modelTokens.length
          score += Math.round(ratio * 40)
          reasons.push('Modelo o tipo de producto coincide')
        }
      }

      // D. Coincidencia por Palabras Clave y Tokens
      let tokenMatches = 0
      for (const token of allSearchTokens) {
        if (prodNameNorm.includes(token)) {
          tokenMatches++
          score += 15
        } else if (prodDescNorm.includes(token)) {
          tokenMatches += 0.5
          score += 8
        }
      }

      if (tokenMatches > 0 && reasons.length === 0) {
        reasons.push(`${Math.round(tokenMatches)} término(s) coincidente(s)`)
      }

      // Normalizar puntaje máximo a 100
      const finalScore = Math.min(100, Math.max(0, score))

      // Solo incluir si tiene al menos 30% de afinidad o si no hay ninguna coincidencia alta
      if (finalScore >= 30) {
        scoredMatches.push({
          product: prod,
          score: finalScore,
          match_reason: reasons.join(' · ') || 'Coincidencia por similitud de catálogo',
        })
      }
    }

    // Ordenar de mayor a menor puntuación
    scoredMatches.sort((a, b) => b.score - a.score)

    // Si no hubo coincidencias con score >= 30, pero hay productos, devolver los primeros más cercanos si hay búsqueda
    const topMatches = scoredMatches.slice(0, 8)

    return NextResponse.json({
      success: true,
      detected: {
        brand: detected.brand || null,
        model: detected.model || null,
        code: detected.code || null,
        color: detected.color || null,
        description: detected.description || (allSearchTokens.length > 0 ? allSearchTokens.join(' ') : 'Sin descripción'),
        keywords: detected.keywords || [],
      },
      matches: topMatches,
      total_candidates: products.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al escanear producto con IA.'
    console.error('Error in /api/ai/product-scan:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

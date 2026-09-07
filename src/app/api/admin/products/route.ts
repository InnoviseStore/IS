import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      id,
      tenant_id,
      name,
      description,
      sku,
      base_price_usd,
      cost_usd,
      stock,
      is_active,
      image_url,
      images,
    } = body

    if (!tenant_id || !name) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (nombre o comercio).' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // Preparar lista de imágenes
    const sanitizedImages: string[] = Array.isArray(images)
      ? images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : []

    // Imagen principal de portada
    const primaryImage = sanitizedImages[0] || (typeof image_url === 'string' && image_url.trim() ? image_url.trim() : null)

    const payloadWithImages = {
      tenant_id,
      name: name.trim(),
      description: description?.trim() || null,
      sku: sku?.trim() || null,
      base_price_usd: Number(base_price_usd) || 0,
      cost_usd: cost_usd ? Number(cost_usd) : null,
      stock: parseInt(stock, 10) || 0,
      is_active: is_active ?? true,
      image_url: primaryImage,
      images: sanitizedImages,
    }

    let savedProduct = null

    if (id) {
      // 1. Intentar actualizar con columna 'images'
      const { data, error: updateErr } = await supabase
        .from('products')
        .update(payloadWithImages)
        .eq('id', id)
        .select()
        .single()

      if (updateErr) {
        // Fallback: si la columna 'images' no existe en PostgreSQL
        if (updateErr.message.includes('images') || updateErr.code === 'PGRST204') {
          const { images: _, ...fallbackPayload } = payloadWithImages
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('products')
            .update(fallbackPayload)
            .eq('id', id)
            .select()
            .single()

          if (fallbackErr) throw new Error(fallbackErr.message)
          savedProduct = fallbackData
        } else {
          throw new Error(updateErr.message)
        }
      } else {
        savedProduct = data
      }
    } else {
      // 2. Intentar insertar con columna 'images'
      const { data, error: insertErr } = await supabase
        .from('products')
        .insert(payloadWithImages)
        .select()
        .single()

      if (insertErr) {
        // Fallback: si la columna 'images' no existe en PostgreSQL
        if (insertErr.message.includes('images') || insertErr.code === 'PGRST204') {
          const { images: _, ...fallbackPayload } = payloadWithImages
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('products')
            .insert(fallbackPayload)
            .select()
            .single()

          if (fallbackErr) throw new Error(fallbackErr.message)
          savedProduct = fallbackData
        } else {
          throw new Error(insertErr.message)
        }
      } else {
        savedProduct = data
      }
    }

    return NextResponse.json({
      success: true,
      product: savedProduct,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al procesar el producto.'
    console.error('Error in /api/admin/products:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar el producto.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

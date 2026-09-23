import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

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
      barcode,
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

    // 1. Validar autenticación y pertenencia de tenant
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // Validación de límite de productos para Plan Básico (150 productos máx)
    if (!id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant_id)
        .single()
      const tenantPlan = (tenantData?.settings as Record<string, unknown>)?.plan || 'pro'
      if (tenantPlan === 'basic') {
        const { count, error: countErr } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant_id)
          .eq('is_active', true)
        if (!countErr && (count ?? 0) >= 150) {
          return NextResponse.json(
            { error: 'Has alcanzado el límite de 150 productos permitido en el Plan Básico. Solicita la actualización a Plan Pro al Administrador para disfrutar de productos ilimitados.' },
            { status: 403 }
          )
        }
      }
    }

    // Preparar lista de imágenes
    const sanitizedImages: string[] = Array.isArray(images)
      ? images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : []

    // Imagen principal de portada
    const primaryImage = sanitizedImages[0] || (typeof image_url === 'string' && image_url.trim() ? image_url.trim() : null)

    const cleanBarcode = typeof barcode === 'string' && barcode.trim() ? barcode.trim() : null

    const payloadWithImages: Record<string, any> = {
      tenant_id,
      name: name.trim(),
      description: description?.trim() || null,
      sku: sku?.trim() || null,
      barcode: cleanBarcode,
      base_price_usd: Number(base_price_usd) || 0,
      cost_usd: cost_usd ? Number(cost_usd) : null,
      stock: parseInt(stock, 10) || 0,
      is_active: is_active ?? true,
      image_url: primaryImage,
      images: sanitizedImages,
    }

    let savedProduct = null

    // Función auxiliar resiliente para ejecutar update/insert manejando columnas que puedan no existir
    async function executeSave(payload: Record<string, any>) {
      let current = { ...payload }
      let query = id
        ? supabase.from('products').update(current).eq('id', id).select().single()
        : supabase.from('products').insert(current).select().single()

      let res = await query

      // Si falla por columna barcode inexistente
      if (res.error && (res.error.message?.includes('barcode') || res.error.code === 'PGRST204')) {
        delete current.barcode
        query = id
          ? supabase.from('products').update(current).eq('id', id).select().single()
          : supabase.from('products').insert(current).select().single()
        res = await query
      }

      // Si falla por columna images inexistente
      if (res.error && (res.error.message?.includes('images') || res.error.code === 'PGRST204')) {
        delete current.images
        query = id
          ? supabase.from('products').update(current).eq('id', id).select().single()
          : supabase.from('products').insert(current).select().single()
        res = await query
      }

      if (res.error) {
        throw new Error(res.error.message)
      }
      return res.data
    }

    savedProduct = await executeSave(payloadWithImages)

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
    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 2. Verificar que el producto pertenezca al tenant del usuario
    const { data: prod, error: fetchErr } = await supabase
      .from('products')
      .select('tenant_id')
      .eq('id', id)
      .single()

    if (fetchErr || !prod) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    }

    if (!auth.isSuperAdmin && prod.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'Acceso denegado: no puedes eliminar productos de otro comercio.' }, { status: 403 })
    }

    // 3. Desvincular de order_items para conservar el historial de ventas pasadas
    await supabase.from('order_items').update({ product_id: null }).eq('product_id', id)

    // 4. Eliminar logs de inventario asociados a este producto
    await supabase.from('inventory_logs').delete().eq('product_id', id)

    // 5. Eliminar el producto de la tabla products
    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar el producto.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

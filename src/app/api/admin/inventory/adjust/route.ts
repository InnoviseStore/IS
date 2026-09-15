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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      product_id,
      tenant_id,
      adjustment_type, // 'set' (conteo físico real) o 'delta' (sumar/restar)
      new_stock,       // Usado cuando adjustment_type === 'set'
      delta,           // Usado cuando adjustment_type === 'delta'
      reason,          // 'audit' | 'purchase' | 'damage' | 'correction' | 'manual'
      notes,
    } = body

    if (!product_id || !tenant_id) {
      return NextResponse.json(
        { error: 'product_id y tenant_id son obligatorios.' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación y permisos de rol (superadmin, owner, admin, almacen)
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'almacen'],
      targetTenantId: tenant_id,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 2. Obtener producto actual para verificar stock previo y pertenencia
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, stock, tenant_id')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (prodErr || !product) {
      return NextResponse.json(
        { error: 'Producto no encontrado o no pertenece a este comercio.' },
        { status: 404 }
      )
    }

    const previousStock = Number(product.stock) || 0
    let finalStock = previousStock

    if (adjustment_type === 'set') {
      const target = Number(new_stock)
      if (isNaN(target) || target < 0) {
        return NextResponse.json(
          { error: 'El conteo físico debe ser un número mayor o igual a 0.' },
          { status: 400 }
        )
      }
      finalStock = Math.round(target)
    } else if (adjustment_type === 'delta') {
      const diff = Number(delta)
      if (isNaN(diff)) {
        return NextResponse.json(
          { error: 'El valor de ajuste debe ser un número válido.' },
          { status: 400 }
        )
      }
      finalStock = previousStock + Math.round(diff)
      if (finalStock < 0) {
        return NextResponse.json(
          { error: `El ajuste daría como resultado stock negativo (${finalStock}). El stock mínimo es 0.` },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Tipo de ajuste no reconocido (debe ser "set" o "delta").' },
        { status: 400 }
      )
    }

    const stockDiff = finalStock - previousStock

    // Formatear motivo para el registro de auditoría
    const reasonLabels: Record<string, string> = {
      audit: 'Toma física de inventario (Auditoría)',
      purchase: 'Recepción / Entrada de mercancía',
      damage: 'Avería / Producto dañado / Merma',
      correction: 'Corrección de descuadre',
      manual: 'Ajuste manual de stock',
    }
    const reasonText = reasonLabels[reason] || reasonLabels.audit
    const detailedNote = [
      reasonText,
      notes?.trim() ? `— ${notes.trim()}` : '',
      stockDiff > 0 ? `(+${stockDiff} unid. sobrantes)` : stockDiff < 0 ? `(${stockDiff} unid. faltantes)` : '(conteo verificado sin cambios)'
    ].filter(Boolean).join(' ')

    // 3. Actualizar stock en tabla products
    const { data: updatedProduct, error: updateErr } = await supabase
      .from('products')
      .update({
        stock: finalStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .select('id, name, sku, stock, base_price_usd, image_url')
      .single()

    if (updateErr || !updatedProduct) {
      return NextResponse.json(
        { error: 'Error al actualizar el stock del producto: ' + updateErr?.message },
        { status: 500 }
      )
    }

    // 4. Insertar traza en inventory_logs
    const { data: logEntry, error: logErr } = await supabase
      .from('inventory_logs')
      .insert({
        tenant_id,
        product_id,
        change_type: 'adjustment',
        quantity: stockDiff,
        previous_stock: previousStock,
        new_stock: finalStock,
        notes: detailedNote,
        created_by: auth.userId,
      })
      .select('*')
      .single()

    if (logErr) {
      console.warn('Advertencia: No se pudo registrar inventory_log:', logErr.message)
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      previous_stock: previousStock,
      new_stock: finalStock,
      difference: stockDiff,
      log: logEntry,
      message: `Stock de "${updatedProduct.name}" actualizado de ${previousStock} a ${finalStock} unidades.`
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar el ajuste de inventario.'
    console.error('Error in /api/admin/inventory/adjust:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

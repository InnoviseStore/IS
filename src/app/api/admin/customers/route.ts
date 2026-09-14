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

// DELETE: Eliminar cliente de forma segura
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const tenantId = searchParams.get('tenant_id')

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'id y tenant_id son requeridos' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obtener datos del cliente
    const { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('id, full_name, current_debt_usd')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchErr || !customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 2. Intentar eliminación directa
    const { error: deleteErr } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (deleteErr) {
      // Si falla por restricción de clave foránea (órdenes asociadas), realizar soft-delete
      console.warn('Direct delete failed, falling back to soft-delete (is_active: false):', deleteErr.message)
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateErr) {
        throw new Error(updateErr.message)
      }

      return NextResponse.json({
        success: true,
        action: 'soft_deleted',
        message: 'Cliente desactivado correctamente (posee historial de pedidos).',
      })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Cliente eliminado permanentemente.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar cliente'
    console.error('Error in DELETE /api/admin/customers:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

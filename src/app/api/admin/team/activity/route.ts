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

export async function GET(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero', 'vendedor', 'almacen'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('user_id') || auth.userId
    const targetTenantId = auth.isSuperAdmin
      ? (searchParams.get('tenant_id') || auth.tenantId)
      : auth.tenantId

    // Si el usuario no es admin/owner y no es superadmin, solo puede ver su propia actividad
    const isOwnerOrAdmin = auth.isSuperAdmin || auth.role === 'owner' || auth.role === 'admin'
    if (!isOwnerOrAdmin && targetUserId !== auth.userId) {
      return NextResponse.json({ error: 'No tienes permisos para ver la actividad de otros usuarios.' }, { status: 403 })
    }

    const supabase = getAdminClient()

    // 1. Obtener perfil del usuario
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('id', targetUserId)
      .maybeSingle()

    if (profileErr || !userProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    // 2. Obtener órdenes facturadas / atendidas por el usuario
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, order_number, total_usd, total_ves, status, payment_condition, created_at, customer_id')
      .eq('tenant_id', targetTenantId)
      .eq('created_by', targetUserId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (ordersErr) {
      console.warn('Error fetching staff orders:', ordersErr)
    }

    // Enriquecer órdenes con nombres de clientes
    const customerIds = Array.from(new Set((orders || []).map(o => o.customer_id).filter(Boolean)))
    let customerMap: Record<string, string> = {}
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, full_name')
        .in('id', customerIds)
      
      if (customers) {
        customers.forEach(c => {
          customerMap[c.id] = c.full_name
        })
      }
    }

    const enrichedOrders = (orders || []).map(o => ({
      ...o,
      customer_name: customerMap[o.customer_id] || 'Cliente General',
    }))

    // Métricas acumuladas de ventas
    const { data: allUserOrders } = await supabase
      .from('orders')
      .select('total_usd, total_ves, status')
      .eq('tenant_id', targetTenantId)
      .eq('created_by', targetUserId)

    const totalOrdersCount = allUserOrders?.length || 0
    const completedOrders = (allUserOrders || []).filter(o => o.status === 'completed' || o.status === 'credit')
    const totalSalesUsd = completedOrders.reduce((sum, o) => sum + (Number(o.total_usd) || 0), 0)
    const totalSalesVes = completedOrders.reduce((sum, o) => sum + (Number(o.total_ves) || 0), 0)

    // 3. Obtener movimientos de inventario registrados por el usuario
    const { data: inventoryLogs, error: invErr } = await supabase
      .from('inventory_logs')
      .select('id, product_id, change_type, quantity, previous_stock, new_stock, notes, created_at')
      .eq('tenant_id', targetTenantId)
      .eq('created_by', targetUserId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (invErr) {
      console.warn('Error fetching staff inventory logs:', invErr)
    }

    // Enriquecer logs con nombres de productos
    const productIds = Array.from(new Set((inventoryLogs || []).map(l => l.product_id).filter(Boolean)))
    let productMap: Record<string, { name: string; sku?: string }> = {}
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds)

      if (products) {
        products.forEach(p => {
          productMap[p.id] = { name: p.name, sku: p.sku }
        })
      }
    }

    const enrichedInventoryLogs = (inventoryLogs || []).map(l => ({
      ...l,
      product_name: productMap[l.product_id]?.name || 'Producto eliminado',
      product_sku: productMap[l.product_id]?.sku || '',
    }))

    return NextResponse.json({
      success: true,
      user: userProfile,
      metrics: {
        totalOrdersCount,
        completedOrdersCount: completedOrders.length,
        totalSalesUsd: Number(totalSalesUsd.toFixed(2)),
        totalSalesVes: Number(totalSalesVes.toFixed(2)),
        averageTicketUsd: completedOrders.length > 0 ? Number((totalSalesUsd / completedOrders.length).toFixed(2)) : 0,
        inventoryLogsCount: inventoryLogs?.length || 0,
      },
      orders: enrichedOrders,
      inventory_logs: enrichedInventoryLogs,
    })
  } catch (error: any) {
    console.error('Error in staff activity API:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 })
  }
}

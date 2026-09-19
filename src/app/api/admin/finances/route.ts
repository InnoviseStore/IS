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

// GET: Cálculo de P&L (Ventas, Costo, Utilidad Bruta, Gastos, Utilidad Neta) y Balance General
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    const period = searchParams.get('period') || 'this_month' // 'this_week' | 'this_month' | 'last_month' | 'year' | 'all'

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenantId,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Obtener tenant y tasa BCV
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('currency_rate_bcv, name')
      .eq('id', tenantId)
      .single()

    const exchangeRate = Number(tenantData?.currency_rate_bcv || 36.5)

    // 2. Determinar rango de fechas según período
    const now = new Date()
    let startDate: Date
    let endDate: Date = new Date(now)

    if (period === 'this_week') {
      const dayOfWeek = now.getDay() // 0 is Sunday, 1 is Monday
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Lunes
      startDate = new Date(now.setDate(diff))
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    } else if (period === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    } else {
      // All time
      startDate = new Date('2020-01-01T00:00:00.000Z')
    }

    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    const startDateOnly = startIso.split('T')[0]
    const endDateOnly = endIso.split('T')[0]

    // 3. Consultas paralelas: Órdenes del período, Gastos del período, Inventario actual y Cuentas por cobrar
    const [
      { data: ordersData },
      { data: expensesData },
      { data: productsData },
      { data: customersData },
    ] = await Promise.all([
      // Órdenes facturadas en el rango con sus order_items
      supabase
        .from('orders')
        .select('id, total_usd, total_ves, status, created_at, order_items(product_id, quantity, unit_price_usd, subtotal_usd)')
        .eq('tenant_id', tenantId)
        .in('status', ['completed', 'credit'])
        .gte('created_at', startIso)
        .lte('created_at', endIso),

      // Gastos en el rango
      supabase
        .from('expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('expense_date', startDateOnly)
        .lte('expense_date', endDateOnly),

      // Todos los productos activos para cálculo de inventario y costos
      supabase
        .from('products')
        .select('id, name, sku, stock, base_price_usd, cost_usd, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),

      // Clientes para cuentas por cobrar
      supabase
        .from('customers')
        .select('id, full_name, phone, current_debt_usd')
        .eq('tenant_id', tenantId)
        .gt('current_debt_usd', 0.01),
    ])

    // Crear mapa de costos por producto
    const productCostMap = new Map<string, number>()
    let inventoryTotalCostUsd = 0
    let inventoryTotalSaleUsd = 0
    let totalStockUnits = 0

    for (const p of productsData || []) {
      const stock = Number(p.stock) || 0
      const cost = Number(p.cost_usd) || 0
      const price = Number(p.base_price_usd) || 0

      productCostMap.set(p.id, cost)
      if (stock > 0) {
        inventoryTotalCostUsd += stock * cost
        inventoryTotalSaleUsd += stock * price
        totalStockUnits += stock
      }
    }

    // 4. Calcular métricas de P&L de órdenes
    let totalSalesUsd = 0
    let cogsUsd = 0 // Costo de los productos vendidos
    const ordersList = ordersData || []

    for (const ord of ordersList) {
      totalSalesUsd += Number(ord.total_usd) || 0
      const items = ord.order_items || []
      for (const it of items) {
        const pId = it.product_id
        const qty = Number(it.quantity) || 1
        const unitCost = pId && productCostMap.has(pId) ? (productCostMap.get(pId) || 0) : 0
        cogsUsd += qty * unitCost
      }
    }

    const grossProfitUsd = Math.max(0, totalSalesUsd - cogsUsd)
    const grossMarginPercent = totalSalesUsd > 0 ? (grossProfitUsd / totalSalesUsd) * 100 : 0

    // 5. Separar gastos operativos de reinversión en inventario
    const allExpenses = expensesData || []
    let operatingExpensesUsd = 0
    let reinvestmentUsd = 0
    const reinvestmentsList: any[] = []

    for (const exp of allExpenses) {
      const amt = Number(exp.amount_usd) || 0
      if (exp.category === 'Reinversión en Inventario' || exp.category === 'Reinversión / Compra de Inventario') {
        reinvestmentUsd += amt
        reinvestmentsList.push(exp)
      } else {
        operatingExpensesUsd += amt
      }
    }

    // Utilidad Neta Real = Utilidad Bruta - Gastos Operativos
    const netProfitUsd = grossProfitUsd - operatingExpensesUsd
    const netMarginPercent = totalSalesUsd > 0 ? (netProfitUsd / totalSalesUsd) * 100 : 0

    // 6. Cuentas por Cobrar
    const accountsReceivableUsd = (customersData || []).reduce(
      (acc, c) => acc + (Number(c.current_debt_usd) || 0),
      0
    )

    // 7. Balance Patrimonial Estimado de la Tienda
    // Activos = Inventario (a costo) + Cuentas por cobrar + Ganancia líquida disponible
    const inventoryPotentialProfitUsd = Math.max(0, inventoryTotalSaleUsd - inventoryTotalCostUsd)
    const totalAssetsUsd = inventoryTotalCostUsd + accountsReceivableUsd + Math.max(0, netProfitUsd)

    return NextResponse.json({
      success: true,
      period,
      exchange_rate: exchangeRate,
      pnl: {
        total_sales_usd: parseFloat(totalSalesUsd.toFixed(2)),
        total_sales_ves: parseFloat((totalSalesUsd * exchangeRate).toFixed(2)),
        cogs_usd: parseFloat(cogsUsd.toFixed(2)),
        gross_profit_usd: parseFloat(grossProfitUsd.toFixed(2)),
        gross_margin_percent: parseFloat(grossMarginPercent.toFixed(1)),
        operating_expenses_usd: parseFloat(operatingExpensesUsd.toFixed(2)),
        net_profit_usd: parseFloat(netProfitUsd.toFixed(2)),
        net_margin_percent: parseFloat(netMarginPercent.toFixed(1)),
        reinvestment_usd: parseFloat(reinvestmentUsd.toFixed(2)),
        orders_count: ordersList.length,
      },
      balance: {
        inventory_cost_usd: parseFloat(inventoryTotalCostUsd.toFixed(2)),
        inventory_sale_usd: parseFloat(inventoryTotalSaleUsd.toFixed(2)),
        inventory_potential_profit_usd: parseFloat(inventoryPotentialProfitUsd.toFixed(2)),
        total_stock_units: totalStockUnits,
        accounts_receivable_usd: parseFloat(accountsReceivableUsd.toFixed(2)),
        debtors_count: (customersData || []).length,
        total_assets_usd: parseFloat(totalAssetsUsd.toFixed(2)),
      },
      reinvestments: reinvestmentsList,
      recent_expenses: allExpenses.slice(0, 15),
    })
  } catch (err: any) {
    console.error('Error in GET /api/admin/finances:', err)
    return NextResponse.json({ error: err?.message || 'Error al calcular finanzas' }, { status: 500 })
  }
}

// POST: Registrar una nueva Reinversión en Inventario (compra de stock con utilidades)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id,
      amount_usd,
      amount_ves,
      supplier_name,
      description,
      payment_method,
      expense_date,
      reinvested_products, // Array de { product_id, quantity_added, unit_cost_usd }
    } = body

    if (!tenant_id || !amount_usd) {
      return NextResponse.json({ error: 'tenant_id y amount_usd son requeridos' }, { status: 400 })
    }

    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
      targetTenantId: tenant_id,
    })

    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()

    // 1. Insertar en la tabla expenses con categoría 'Reinversión en Inventario'
    const payload = {
      tenant_id,
      category: 'Reinversión en Inventario',
      description: description || 'Compra de mercancía / Reinversión en inventario',
      amount_usd: parseFloat(Number(amount_usd).toFixed(4)),
      amount_ves: parseFloat(Number(amount_ves || 0).toFixed(2)),
      payment_method: payment_method || 'transfer_ves',
      supplier_name: supplier_name || 'Proveedor de Mercancía',
      is_recurring: false,
      expense_date: expense_date || new Date().toISOString().split('T')[0],
      created_by: auth.userId,
    }

    const { data: expenseRecord, error: expErr } = await supabase
      .from('expenses')
      .insert(payload)
      .select()
      .single()

    if (expErr) {
      return NextResponse.json({ error: 'Error al registrar reinversión: ' + expErr.message }, { status: 500 })
    }

    // 2. Si se especificaron productos para aumentar stock:
    if (Array.isArray(reinvested_products) && reinvested_products.length > 0) {
      for (const item of reinvested_products) {
        if (!item.product_id || !item.quantity_added) continue
        const qty = Math.max(1, parseInt(item.quantity_added) || 1)

        // Obtener stock actual
        const { data: prod } = await supabase
          .from('products')
          .select('id, stock, cost_usd')
          .eq('id', item.product_id)
          .eq('tenant_id', tenant_id)
          .single()

        if (prod) {
          const prevStock = Number(prod.stock) || 0
          const newStock = prevStock + qty
          const updatePayload: any = {
            stock: newStock,
            updated_at: new Date().toISOString(),
          }
          if (item.unit_cost_usd) {
            updatePayload.cost_usd = parseFloat(Number(item.unit_cost_usd).toFixed(4))
          }

          await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', item.product_id)

          // Registrar traza en inventory_logs
          await supabase.from('inventory_logs').insert({
            tenant_id,
            product_id: item.product_id,
            change_type: 'purchase',
            quantity: qty,
            previous_stock: prevStock,
            new_stock: newStock,
            notes: `Reinversión de utilidades — Entrada de mercancía (${qty} uds)`,
            created_by: auth.userId,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reinversión registrada exitosamente e inventario actualizado.',
      reinvestment: expenseRecord,
    })
  } catch (err: any) {
    console.error('Error in POST /api/admin/finances:', err)
    return NextResponse.json({ error: err?.message || 'Error al procesar reinversión' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'
import { extractDeliveryInfo } from '@/lib/delivery'

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

    // 3. Consultas paralelas: Órdenes del período, Órdenes anteriores para abonos, Gastos del período, Inventario y Cuentas por cobrar
    const [
      { data: ordersData },
      { data: olderOrdersData },
      { data: expensesData },
      { data: productsData },
      { data: customersData },
    ] = await Promise.all([
      // Órdenes facturadas en el rango con sus order_items y payment_breakdown
      supabase
        .from('orders')
        .select('id, order_number, total_usd, total_ves, subtotal_usd, notes, status, created_at, payment_breakdown, order_items(product_id, quantity, unit_price_usd, subtotal_usd)')
        .eq('tenant_id', tenantId)
        .in('status', ['completed', 'credit'])
        .gte('created_at', startIso)
        .lte('created_at', endIso),

      // Órdenes emitidas ANTES del período para capturar abonos cobrados en este período
      supabase
        .from('orders')
        .select('id, order_number, total_usd, payment_breakdown, created_at')
        .eq('tenant_id', tenantId)
        .lt('created_at', startIso)
        .or('status.eq.credit,status.eq.completed'),

      // Gastos en el rango
      supabase
        .from('expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', startDateOnly)
        .lte('date', endDateOnly),

      // Todos los productos activos para cálculo de inventario y costos
      supabase
        .from('products')
        .select('id, name, sku, stock, base_price_usd, cost_usd, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),

      // Clientes para cuentas por cobrar acumuladas
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

    // 4. Calcular Facturación (Ventas Facturadas - Criterio Devengado) y Costo de Mercancía
    let totalBilledUsd = 0
    let cogsUsd = 0
    const ordersList = ordersData || []

    for (const ord of ordersList) {
      const del = extractDeliveryInfo(ord.notes, exchangeRate)
      const merchandiseUsd = (ord.subtotal_usd !== undefined && Number(ord.subtotal_usd) > 0)
        ? Number(ord.subtotal_usd)
        : Math.max(0, (Number(ord.total_usd) || 0) - del.amountUsd)
      totalBilledUsd += merchandiseUsd
      const items = ord.order_items || []
      for (const it of items) {
        const pId = it.product_id
        const qty = Number(it.quantity) || 1
        const unitCost = pId && productCostMap.has(pId) ? (productCostMap.get(pId) || 0) : 0
        cogsUsd += qty * unitCost
      }
    }

    const grossProfitUsd = Math.max(0, totalBilledUsd - cogsUsd)
    const grossMarginPercent = totalBilledUsd > 0 ? (grossProfitUsd / totalBilledUsd) * 100 : 0

    // 5. CÁLCULO DE INGRESOS REALES COBRADOS (Criterio de Caja / Flujo de Efectivo) Y MÉTODOS DE PAGO
    // Mapa para consolidar ingresos por tipo de pago
    const methodsMap: Record<string, { total_usd: number; total_ves: number; count: number; label: string; currency: 'USD' | 'VES' }> = {
      pago_movil: { total_usd: 0, total_ves: 0, count: 0, label: 'Pago Móvil (VES)', currency: 'VES' },
      cash_usd: { total_usd: 0, total_ves: 0, count: 0, label: 'Efectivo Divisas (USD)', currency: 'USD' },
      cash_ves: { total_usd: 0, total_ves: 0, count: 0, label: 'Efectivo Bolívares (VES)', currency: 'VES' },
      zelle: { total_usd: 0, total_ves: 0, count: 0, label: 'Zelle (USD)', currency: 'USD' },
      binance_pay: { total_usd: 0, total_ves: 0, count: 0, label: 'Binance Pay (USDT)', currency: 'USD' },
      transfer_ves: { total_usd: 0, total_ves: 0, count: 0, label: 'Transferencia Bancaria (VES)', currency: 'VES' },
      debit_ves: { total_usd: 0, total_ves: 0, count: 0, label: 'Punto de Venta / Débito (VES)', currency: 'VES' },
      other: { total_usd: 0, total_ves: 0, count: 0, label: 'Otros Métodos', currency: 'USD' },
    }

    let directCollectedUsd = 0
    let abonosCollectedUsd = 0
    let creditPendingGeneratedUsd = 0

    // A. Procesar pagos de órdenes emitidas en el período
    for (const ord of ordersList) {
      const breakdown = Array.isArray(ord.payment_breakdown) ? ord.payment_breakdown : []
      for (const p of breakdown) {
        const amtUsd = Number(p.amount_usd) || 0
        const amtVes = Number(p.amount_ves) || (amtUsd * (Number(p.exchange_rate_applied) || exchangeRate))

        if (p.method === 'credit_7d') {
          // Ventas a crédito que quedaron pendientes (NO son ingresos en caja aún)
          creditPendingGeneratedUsd += amtUsd
        } else if (p.is_abono) {
          // Verificar si la fecha del abono cae en el rango del período
          const abonoDateStr = p.date || ord.created_at
          if (abonoDateStr >= startIso && abonoDateStr <= endIso) {
            abonosCollectedUsd += amtUsd
            const methodKey = methodsMap[p.method] ? p.method : 'other'
            methodsMap[methodKey].total_usd += amtUsd
            methodsMap[methodKey].total_ves += amtVes
            methodsMap[methodKey].count += 1
          }
        } else {
          // Pago inmediato cobrado en el momento de la venta
          directCollectedUsd += amtUsd
          const methodKey = methodsMap[p.method] ? p.method : 'other'
          methodsMap[methodKey].total_usd += amtUsd
          methodsMap[methodKey].total_ves += amtVes
          methodsMap[methodKey].count += 1
        }
      }
    }

    // B. Procesar abonos cobrados en este período correspondientes a órdenes anteriores
    for (const ord of olderOrdersData || []) {
      const breakdown = Array.isArray(ord.payment_breakdown) ? ord.payment_breakdown : []
      for (const p of breakdown) {
        if (p.is_abono) {
          const abonoDateStr = p.date
          if (abonoDateStr && abonoDateStr >= startIso && abonoDateStr <= endIso) {
            const amtUsd = Number(p.amount_usd) || 0
            const amtVes = Number(p.amount_ves) || (amtUsd * (Number(p.exchange_rate_applied) || exchangeRate))
            abonosCollectedUsd += amtUsd
            const methodKey = methodsMap[p.method] ? p.method : 'other'
            methodsMap[methodKey].total_usd += amtUsd
            methodsMap[methodKey].total_ves += amtVes
            methodsMap[methodKey].count += 1
          }
        }
      }
    }

    // Total Ingresos Reales Cobrados (Caja)
    const totalCollectedUsd = directCollectedUsd + abonosCollectedUsd
    const totalCollectedVes = totalCollectedUsd * exchangeRate

    // Armar lista de métodos con porcentajes
    const paymentMethodsBreakdown = Object.entries(methodsMap)
      .map(([key, val]) => ({
        method: key,
        label: val.label,
        currency: val.currency,
        total_usd: parseFloat(val.total_usd.toFixed(2)),
        total_ves: parseFloat(val.total_ves.toFixed(2)),
        count: val.count,
        percentage: totalCollectedUsd > 0 ? parseFloat(((val.total_usd / totalCollectedUsd) * 100).toFixed(1)) : 0,
      }))
      .filter((m) => m.count > 0 || m.total_usd > 0)
      .sort((a, b) => b.total_usd - a.total_usd)

    // 6. Separar gastos operativos de reinversión en inventario
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

    // Flujo de Caja Neto Real = Dinero Real Cobrado - Gastos Operativos
    const netCashFlowUsd = totalCollectedUsd - operatingExpensesUsd
    // Utilidad Neta Devengada = Utilidad Bruta Facturada - Gastos Operativos
    const netProfitUsd = grossProfitUsd - operatingExpensesUsd
    const netMarginPercent = totalBilledUsd > 0 ? (netProfitUsd / totalBilledUsd) * 100 : 0

    // 7. Cuentas por Cobrar Totales Acumuladas
    const accountsReceivableUsd = (customersData || []).reduce(
      (acc, c) => acc + (Number(c.current_debt_usd) || 0),
      0
    )

    // 8. Balance Patrimonial Estimado de la Tienda
    const inventoryPotentialProfitUsd = Math.max(0, inventoryTotalSaleUsd - inventoryTotalCostUsd)
    const totalAssetsUsd = inventoryTotalCostUsd + accountsReceivableUsd + Math.max(0, netCashFlowUsd)

    return NextResponse.json({
      success: true,
      period,
      exchange_rate: exchangeRate,
      pnl: {
        // Facturación
        total_billed_usd: parseFloat(totalBilledUsd.toFixed(2)),
        total_billed_ves: parseFloat((totalBilledUsd * exchangeRate).toFixed(2)),
        total_sales_usd: parseFloat(totalBilledUsd.toFixed(2)), // retrocompatibilidad
        total_sales_ves: parseFloat((totalBilledUsd * exchangeRate).toFixed(2)),
        cogs_usd: parseFloat(cogsUsd.toFixed(2)),
        gross_profit_usd: parseFloat(grossProfitUsd.toFixed(2)),
        gross_margin_percent: parseFloat(grossMarginPercent.toFixed(1)),

        // Ventas a Crédito No Cobradas en el período
        credit_pending_usd: parseFloat(creditPendingGeneratedUsd.toFixed(2)),
        credit_pending_ves: parseFloat((creditPendingGeneratedUsd * exchangeRate).toFixed(2)),

        // Ingresos Reales Cobrados (Caja)
        total_collected_usd: parseFloat(totalCollectedUsd.toFixed(2)),
        total_collected_ves: parseFloat(totalCollectedVes.toFixed(2)),
        direct_sales_collected_usd: parseFloat(directCollectedUsd.toFixed(2)),
        abonos_collected_usd: parseFloat(abonosCollectedUsd.toFixed(2)),

        // Flujo y Utilidad
        operating_expenses_usd: parseFloat(operatingExpensesUsd.toFixed(2)),
        net_cash_flow_usd: parseFloat(netCashFlowUsd.toFixed(2)),
        net_profit_usd: parseFloat(netProfitUsd.toFixed(2)),
        net_margin_percent: parseFloat(netMarginPercent.toFixed(1)),
        reinvestment_usd: parseFloat(reinvestmentUsd.toFixed(2)),
        orders_count: ordersList.length,
      },
      payment_methods_breakdown: paymentMethodsBreakdown,
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
      reference: supplier_name || 'Proveedor de Mercancía',
      date: expense_date || new Date().toISOString().split('T')[0],
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

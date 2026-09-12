import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface PaymentItem {
  method: string
  amount_usd?: number
  amount_ves?: number
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export async function POST(req: Request) {
  try {
    const { prompt, tenantSlug, exchangeRate } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt es requerido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Cargar datos del tenant específico (Aislamiento Multi-Tenant Estricto)
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, slug, currency_rate_bcv, settings')
      .eq('slug', tenantSlug || 'innovise')
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ reply: 'No se encontró información del comercio actual.' })
    }

    // Validación de plan: Edith requiere Plan Pro o Enterprise
    const tenantSettings = (tenant.settings || {}) as Record<string, unknown>
    const plan = (tenantSettings.plan as string) || 'pro'
    if (plan === 'basic') {
      return NextResponse.json({
        reply: '🔒 **Copiloto IA no disponible en Plan Básico**\n\nEl asistente inteligente con IA de Edith es exclusivo de los planes **Pro** y **Enterprise**. Para acceder a métricas en lenguaje natural, proyecciones financieras y detección de inventario crítico con IA, contacta al Administrador de la plataforma para actualizar tu suscripción.',
      })
    }

    const rate = exchangeRate || Number(tenant.currency_rate_bcv) || 91.50
    const now = new Date()
    const currentMonthName = MONTH_NAMES[now.getMonth()]
    const todayStr = now.toISOString().split('T')[0]
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    // 2. Consultas contextuales restringidas ESTRICTAMENTE a tenant.id
    const [
      { data: ordersTodayData },
      { data: ordersMonthData },
      { data: expensesTodayData },
      { data: expensesMonthData },
      { data: lowStockData },
      { data: debtorsData },
    ] = await Promise.all([
      // Ventas de hoy
      supabase
        .from('orders')
        .select('total_usd, total_ves, payment_breakdown, status')
        .eq('tenant_id', tenant.id)
        .gte('created_at', `${todayStr}T00:00:00.000Z`)
        .in('status', ['completed', 'credit']),
      // Ventas del mes
      supabase
        .from('orders')
        .select('total_usd, total_ves')
        .eq('tenant_id', tenant.id)
        .gte('created_at', `${firstDayOfMonth}T00:00:00.000Z`)
        .eq('status', 'completed'),
      // Gastos de hoy
      supabase
        .from('expenses')
        .select('amount_usd')
        .eq('tenant_id', tenant.id)
        .eq('expense_date', todayStr),
      // Gastos del mes
      supabase
        .from('expenses')
        .select('amount_usd')
        .eq('tenant_id', tenant.id)
        .gte('expense_date', firstDayOfMonth),
      // Productos con bajo stock (< 5)
      supabase
        .from('products')
        .select('name, sku, stock, base_price_usd')
        .eq('tenant_id', tenant.id)
        .lte('stock', 5)
        .eq('is_active', true)
        .order('stock', { ascending: true })
        .limit(8),
      // Clientes deudores
      supabase
        .from('customers')
        .select('full_name, current_debt_usd')
        .eq('tenant_id', tenant.id)
        .gt('current_debt_usd', 0)
        .order('current_debt_usd', { ascending: false })
        .limit(5),
    ])

    // 3. Métricas de Ventas Hoy
    const ordersToday = ordersTodayData || []
    const salesTodayUsd = ordersToday.reduce((sum, o) => sum + (Number(o.total_usd) || 0), 0)
    const salesTodayVes = salesTodayUsd * rate
    const countToday = ordersToday.length
    const avgTicketToday = countToday > 0 ? salesTodayUsd / countToday : 0

    // Desglose de dinero por método hoy (para dinero disponible)
    let cashUsd = 0
    let cashVes = 0
    let pagoMovilVes = 0
    let zelleUsd = 0
    let otherUsd = 0

    ordersToday.forEach((o) => {
      const breakdown = (o.payment_breakdown || []) as PaymentItem[]
      breakdown.forEach((p) => {
        const m = (p.method || '').toLowerCase()
        const amtUsd = Number(p.amount_usd) || 0
        const amtVes = Number(p.amount_ves) || 0
        if (m.includes('cash_usd') || m.includes('efectivo usd')) {
          cashUsd += amtUsd
        } else if (m.includes('cash_ves') || m.includes('efectivo ves')) {
          cashVes += amtVes
        } else if (m.includes('pago_movil') || m.includes('pago móvil')) {
          pagoMovilVes += amtVes
        } else if (m.includes('zelle')) {
          zelleUsd += amtUsd
        } else {
          otherUsd += amtUsd
        }
      })
    })

    const expensesToday = (expensesTodayData || []).reduce((sum, e) => sum + (Number(e.amount_usd) || 0), 0)
    const totalLiquidUsd = (cashUsd + zelleUsd + otherUsd + ((cashVes + pagoMovilVes) / rate)) - expensesToday
    const totalLiquidSafeUsd = Math.max(0, totalLiquidUsd)

    // 4. Métricas de Utilidad del Mes
    const ordersMonth = ordersMonthData || []
    const totalSalesMonthUsd = ordersMonth.reduce((sum, o) => sum + (Number(o.total_usd) || 0), 0)
    const totalExpensesMonthUsd = (expensesMonthData || []).reduce((sum, e) => sum + (Number(e.amount_usd) || 0), 0)
    const netProfitUsd = totalSalesMonthUsd - totalExpensesMonthUsd
    const netProfitVes = netProfitUsd * rate
    const marginPercent = totalSalesMonthUsd > 0
      ? ((netProfitUsd / totalSalesMonthUsd) * 100).toFixed(1)
      : '0.0'

    const formatUsd = (val: number) => `$${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
    const formatVes = (val: number) => `Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    // 5. Análisis del Prompt con Respuestas Concretas, Enfoque Exclusivo en la Tienda y Guardrails
    const p = prompt.trim().toLowerCase()

    // Guardrail Multi-Tenant: Intentos de consultar otras tiendas o comercios
    const otherStoresKeywords = [
      'otra tienda', 'otras tiendas', 'demas tiendas', 'demás tiendas', 'otros comercios',
      'otra sucursal', 'otros usuarios', 'otra empresa', 'competencia', 'amazon', 'mercadolibre'
    ]
    if (otherStoresKeywords.some((kw) => p.includes(kw))) {
      return NextResponse.json({
        reply: `🔒 Por estrictas políticas de confidencialidad y aislamiento de datos multi-tenant, solo tengo acceso y autorización para gestionar la información exclusiva de **${tenant.name}**. No tengo acceso a datos de otras tiendas ni comercios.`
      })
    }

    // Comprobación de Guardrail: Temas no relacionados con el comercio o la tienda
    const offTopicKeywords = [
      'receta', 'clima', 'chiste', 'futbol', 'fútbol', 'pelicula', 'película',
      'historia de', 'politica', 'política', 'poema', 'cancion', 'canción',
      'cuento', 'tarea', 'filosofia', 'filosofía', 'juego', 'videojuego',
      'capital de', 'quien descubrio', 'quien invento', 'amor', 'novia', 'novio'
    ]
    const businessKeywords = [
      'venta', 'vendi', 'factur', 'ticket', 'orden', 'pedido',
      'stock', 'inventario', 'agot', 'quedan', 'repon', 'producto', 'articulo', 'catalogo',
      'dinero', 'caja', 'saldo', 'disponible', 'efectivo', 'zelle', 'pago movil', 'bcv', 'tasa', 'dolar', 'bolivar',
      'utilidad', 'ganancia', 'margen', 'gane', 'gasto', 'rentab',
      'deuda', 'cobrar', 'fiado', 'credito', 'cliente',
      'hola', 'buenos', 'buenas', 'resumen', 'estado', 'edith', 'tienda', 'negocio'
    ]

    const isExplicitlyOffTopic = offTopicKeywords.some((kw) => p.includes(kw))
    const hasBusinessTopic = businessKeywords.some((kw) => p.includes(kw))

    if (isExplicitlyOffTopic || !hasBusinessTopic) {
      return NextResponse.json({
        reply: `🤖 Como copiloto inteligente exclusivo de **${tenant.name}**, solo estoy autorizada para responder consultas sobre la gestión comercial, inventario, ventas, utilidades, dinero en caja y clientes de tu negocio.\n\nPuedes usar los botones predeterminados o preguntarme directamente sobre estos temas.`
      })
    }

    let reply = ''

    // CASO 1: 📦 ¿Qué productos están por agotarse? / Stock bajo / Reposición
    if (
      p.includes('agot') ||
      p.includes('reponer') ||
      p.includes('stock') ||
      p.includes('inventario') ||
      p.includes('existencia') ||
      p.includes('quedan')
    ) {
      const items = lowStockData || []
      if (items.length === 0) {
        reply = `📦 **Inventario Saludable en ${tenant.name}:**\nNo tienes productos con stock crítico actualmente (todos tienen más de 5 unidades en inventario). Todo tu catálogo está listo para facturación.`
      } else {
        const listStr = items
          .map((i) => `• **${i.name}** (${i.sku || 'S/N'}): Quedan **${i.stock}** unid. (Precio: ${formatUsd(Number(i.base_price_usd) || 0)})`)
          .join('\n')
        reply = `📦 **Productos por Agotarse en ${tenant.name} (${items.length} críticos):**\n${listStr}\n\n⚠️ *Te sugiero emitir una orden de reposición prioritaria para evitar rotura de inventario.*`
      }
    }
    // CASO 2: 🛒 ¿Cómo van mis ventas hoy? / Facturación de hoy
    else if (
      p.includes('ventas hoy') ||
      p.includes('venta hoy') ||
      p.includes('ventas de hoy') ||
      p.includes('facturacion hoy') ||
      p.includes('cuanto vendi hoy') ||
      p.includes('como van mis ventas') ||
      (p.includes('venta') && p.includes('hoy'))
    ) {
      if (countToday === 0) {
        reply = `🛒 **Ventas de Hoy en ${tenant.name}:**\nAún no se han registrado ventas hoy (${todayStr}). El Punto de Venta (POS) está activo y preparado para registrar pedidos.`
      } else {
        reply = `🛒 **Resumen de Ventas de Hoy en ${tenant.name}:**\n• **Total Facturado:** ${formatUsd(salesTodayUsd)} (${formatVes(salesTodayVes)} a tasa BCV)\n• **Ventas Cerradas:** ${countToday} ticket(s)\n• **Ticket Promedio:** ${formatUsd(avgTicketToday)}\n• **Tasa Aplicada:** Bs. ${rate.toFixed(2)}/USD`
      }
    }
    // CASO 3: 🏠 ¿Cuánto dinero tengo disponible? / Caja / Efectivo / Saldo
    else if (
      p.includes('disponible') ||
      p.includes('dinero tengo') ||
      p.includes('cuanto dinero') ||
      p.includes('en caja') ||
      p.includes('saldo') ||
      p.includes('efectivo')
    ) {
      reply = `🏠 **Dinero Disponible Hoy en ${tenant.name}:**\n• **Efectivo en Caja USD:** ${formatUsd(cashUsd)}\n• **Efectivo en Caja VES:** ${formatVes(cashVes)}\n• **Pago Móvil Recibido:** ${formatVes(pagoMovilVes)} (${formatUsd(pagoMovilVes / rate)})\n• **Zelle:** ${formatUsd(zelleUsd)}\n• **Gastos deducidos hoy:** -${formatUsd(expensesToday)}\n• **Total Líquido Estimado:** **${formatUsd(totalLiquidSafeUsd)}** (${formatVes(totalLiquidSafeUsd * rate)} a tasa oficial).`
    }
    // CASO 4: 📊 ¿Cuánta utilidad generé este mes? / Ganancia / Margen
    else if (
      p.includes('utilidad') ||
      p.includes('ganancia') ||
      p.includes('margen') ||
      p.includes('gane') ||
      p.includes('este mes')
    ) {
      reply = `📊 **Utilidad Neta de ${currentMonthName} en ${tenant.name}:**\n• **Ventas Totales Completadas:** ${formatUsd(totalSalesMonthUsd)}\n• **Gastos Operativos del Mes:** -${formatUsd(totalExpensesMonthUsd)}\n• **Utilidad Neta Real:** **${formatUsd(netProfitUsd)}** (${formatVes(netProfitVes)})\n• **Margen Operativo:** ${marginPercent}%\n\n*(Cálculo exacto: Ventas Totales menos Gastos Operativos según la fórmula contable oficial).*`
    }
    // CASO 5: 👥 Deudas / Clientes con Créditos
    else if (
      p.includes('deuda') ||
      p.includes('cobrar') ||
      p.includes('fiado') ||
      p.includes('credito')
    ) {
      const debtors = debtorsData || []
      if (debtors.length === 0) {
        reply = `👥 **Cuentas por Cobrar en ${tenant.name}:**\nNo tienes clientes con saldos pendientes por cobrar en este momento. Todos los pagos están al día.`
      } else {
        const debtStr = debtors.map((d) => `• **${d.full_name}:** ${formatUsd(Number(d.current_debt_usd) || 0)}`).join('\n')
        const totalDebt = debtors.reduce((s, d) => s + (Number(d.current_debt_usd) || 0), 0)
        reply = `👥 **Clientes con Crédito Pendiente en ${tenant.name}:**\n${debtStr}\n\n**Total por cobrar:** ${formatUsd(totalDebt)}. Puedes gestionar recordatorios directos por WhatsApp desde la sección de Clientes.`
      }
    }
    // CASO 6: Respuesta Ejecutiva General (Concreta y enfocada en el comercio)
    else {
      reply = `Hola. Aquí tienes el estado ejecutivo de **${tenant.name}**:\n• **Ventas de Hoy:** ${formatUsd(salesTodayUsd)} (${countToday} ventas)\n• **Ventas del Mes:** ${formatUsd(totalSalesMonthUsd)}\n• **Utilidad Neta (${currentMonthName}):** ${formatUsd(netProfitUsd)}\n• **Productos por agotar:** ${lowStockData?.length || 0} productos con stock crítico.\n\nPuedes presionar los botones rápidos o preguntarme por inventario, ventas del día, dinero en caja o utilidades.`
    }

    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado en Edith IA'
    console.error('Error in /api/ai/assistant:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

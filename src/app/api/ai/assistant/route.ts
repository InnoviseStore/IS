import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { prompt, tenantSlug, exchangeRate } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt es requerido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Cargar datos contextuales del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', tenantSlug || 'innovise')
      .single()

    if (!tenant) {
      return NextResponse.json({ reply: 'No se encontró información del comercio.' })
    }

    const today = new Date().toISOString().split('T')[0]
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    // Consultas agregadas rápidas
    const [
      { data: ordersMonth },
      { data: expensesMonth },
      { data: lowStockProducts },
      { data: debtors },
    ] = await Promise.all([
      supabase.from('orders').select('total_usd').eq('tenant_id', tenant.id).gte('created_at', firstDayOfMonth).eq('status', 'completed'),
      supabase.from('expenses').select('amount_usd').eq('tenant_id', tenant.id).gte('expense_date', firstDayOfMonth),
      supabase.from('products').select('name, stock').eq('tenant_id', tenant.id).lt('stock', 5).eq('is_active', true).limit(5),
      supabase.from('customers').select('full_name, current_debt_usd').eq('tenant_id', tenant.id).gt('current_debt_usd', 0).limit(5),
    ])

    const totalSales = (ordersMonth ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0)
    const totalExpenses = (expensesMonth ?? []).reduce((s, e) => s + (e.amount_usd ?? 0), 0)
    const netProfit = totalSales - totalExpenses
    const rate = exchangeRate || 91.50

    const lowStockNames = (lowStockProducts ?? []).map((p) => `${p.name} (quedan ${p.stock})`).join(', ') || 'Ninguno'
    const debtorNames = (debtors ?? []).map((d) => `${d.full_name} ($${d.current_debt_usd})`).join(', ') || 'Ninguno'

    // Respuesta inteligente contextual
    const pLower = prompt.toLowerCase()
    let reply = ''

    if (pLower.includes('reponer') || pLower.includes('agot') || pLower.includes('stock')) {
      reply = `📦 Productos críticos para reposición urgente: ${lowStockNames}. Te sugiero emitir una orden de compra o revisar almacén.`
    } else if (pLower.includes('ganancia') || pLower.includes('utilidad') || pLower.includes('margen')) {
      reply = `📊 Tu Utilidad Neta estimada del mes en curso es de $${netProfit.toFixed(2)} USD (Bs. ${(netProfit * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}). Proviene de $${totalSales.toFixed(2)} en ventas menos $${totalExpenses.toFixed(2)} en gastos operativos.`
    } else if (pLower.includes('venta') || pLower.includes('ingreso') || pLower.includes('factur')) {
      reply = `💰 Llevas un total facturado en el mes de $${totalSales.toFixed(2)} USD (equivalente a Bs. ${(totalSales * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 })} a tasa BCV oficial).`
    } else if (pLower.includes('deuda') || pLower.includes('cobrar') || pLower.includes('fiado') || pLower.includes('cliente')) {
      reply = `👥 Clientes con saldos pendientes por cobrar: ${debtorNames}. Puedes usar el botón de cobranza rápida por WhatsApp en el módulo de Clientes.`
    } else if (pLower.includes('gasto') || pLower.includes('egreso')) {
      reply = `📋 Los gastos operativos registrados este mes suman $${totalExpenses.toFixed(2)} USD (Bs. ${(totalExpenses * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}).`
    } else {
      reply = `Hola, soy Edith. Veo que para ${tenant.name} tienes registrados este mes $${totalSales.toFixed(2)} USD en ventas y $${totalExpenses.toFixed(2)} en gastos operativos, dejando una utilidad neta estimada de $${netProfit.toFixed(2)} USD. Además, tienes ${lowStockProducts?.length ?? 0} productos con stock bajo. ¿Deseas detalles sobre alguno de estos puntos?`
    }

    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

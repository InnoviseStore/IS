'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Package,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Plus,
  Calendar,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Layers,
  Building2,
  Receipt,
  X,
  ArrowDownRight,
  Sparkles,
  Smartphone,
  Zap,
  Coins,
  CreditCard,
  Banknote,
  Info,
  PieChart,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'

interface PaymentMethodSummary {
  method: string
  label: string
  currency: 'USD' | 'VES'
  total_usd: number
  total_ves: number
  count: number
  percentage: number
}

interface FinancialData {
  period: string
  exchange_rate: number
  pnl: {
    total_billed_usd: number
    total_billed_ves: number
    total_sales_usd: number
    total_sales_ves: number
    cogs_usd: number
    gross_profit_usd: number
    gross_margin_percent: number
    credit_pending_usd: number
    credit_pending_ves: number
    total_collected_usd: number
    total_collected_ves: number
    direct_sales_collected_usd: number
    abonos_collected_usd: number
    operating_expenses_usd: number
    net_cash_flow_usd: number
    net_profit_usd: number
    net_margin_percent: number
    reinvestment_usd: number
    orders_count: number
  }
  payment_methods_breakdown: PaymentMethodSummary[]
  balance: {
    inventory_cost_usd: number
    inventory_sale_usd: number
    inventory_potential_profit_usd: number
    total_stock_units: number
    accounts_receivable_usd: number
    debtors_count: number
    total_assets_usd: number
  }
  reinvestments: any[]
  recent_expenses: any[]
}

function getMethodMeta(methodKey: string) {
  switch (methodKey) {
    case 'pago_movil':
      return {
        label: 'Pago Móvil (VES)',
        icon: Smartphone,
        badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        barColor: 'bg-blue-600 dark:bg-blue-500',
      }
    case 'cash_usd':
      return {
        label: 'Efectivo Divisas (USD)',
        icon: DollarSign,
        badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        barColor: 'bg-emerald-600 dark:bg-emerald-500',
      }
    case 'cash_ves':
      return {
        label: 'Efectivo Bolívares (VES)',
        icon: Banknote,
        badgeBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        barColor: 'bg-teal-600 dark:bg-teal-500',
      }
    case 'zelle':
      return {
        label: 'Zelle (USD)',
        icon: Zap,
        badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        barColor: 'bg-indigo-600 dark:bg-indigo-500',
      }
    case 'binance_pay':
      return {
        label: 'Binance Pay (USDT)',
        icon: Coins,
        badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        barColor: 'bg-amber-500 dark:bg-amber-400',
      }
    case 'transfer_ves':
      return {
        label: 'Transferencia Bancaria (VES)',
        icon: Building2,
        badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        barColor: 'bg-sky-600 dark:bg-sky-500',
      }
    case 'debit_ves':
      return {
        label: 'Punto de Venta / Débito (VES)',
        icon: CreditCard,
        badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        barColor: 'bg-purple-600 dark:bg-purple-500',
      }
    default:
      return {
        label: 'Otros Métodos',
        icon: Wallet,
        badgeBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        barColor: 'bg-slate-600 dark:bg-slate-400',
      }
  }
}

export default function FinancesPage() {
  const { tenant, exchangeRate } = useTenant()
  const [period, setPeriod] = useState<'this_week' | 'this_month' | 'last_month' | 'year' | 'all'>('this_month')
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modal de reinversión
  const [isReinvestModalOpen, setIsReinvestModalOpen] = useState(false)
  const [reinvestAmount, setReinvestAmount] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer_ves')
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantityToAdd, setQuantityToAdd] = useState('')
  const [unitCostInput, setUnitCostInput] = useState('')
  const [submittingReinvest, setSubmittingReinvest] = useState(false)
  const [reinvestSuccess, setReinvestSuccess] = useState<string | null>(null)

  const loadFinances = useCallback(async (isSilent = false) => {
    if (!tenant) return
    if (isSilent) setRefreshing(true)
    else setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/admin/finances?tenant_id=${tenant.id}&period=${period}`)
      const resData = await res.json()
      if (res.ok && resData.success) {
        setData(resData)
      } else {
        setErrorMsg(resData.error || 'Error al cargar métricas financieras.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de red al consultar finanzas.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenant, period])

  useEffect(() => {
    loadFinances()
  }, [loadFinances])

  // Cargar productos para modal de reinversión
  useEffect(() => {
    if (!tenant || !isReinvestModalOpen) return
    const supabase = createClient()
    supabase
      .from('products')
      .select('id, name, sku, stock, cost_usd, base_price_usd')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data: prods }) => {
        setProducts(prods || [])
      })
  }, [tenant, isReinvestModalOpen])

  async function handleRegisterReinvestment(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || !reinvestAmount) return
    setSubmittingReinvest(true)
    setErrorMsg(null)

    const amtUsd = parseFloat(reinvestAmount) || 0
    const amtVes = amtUsd * exchangeRate

    const reinvestedProducts = selectedProductId && quantityToAdd ? [
      {
        product_id: selectedProductId,
        quantity_added: parseInt(quantityToAdd) || 0,
        unit_cost_usd: unitCostInput ? parseFloat(unitCostInput) : undefined,
      }
    ] : []

    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          amount_usd: amtUsd,
          amount_ves: amtVes,
          supplier_name: supplierName.trim() || 'Proveedor',
          description: description.trim() || 'Reinversión de utilidades en nuevo inventario',
          payment_method: paymentMethod,
          reinvested_products: reinvestedProducts,
        }),
      })

      const resData = await res.json()
      if (res.ok && resData.success) {
        setReinvestSuccess('¡Reinversión registrada exitosamente e inventario actualizado!')
        setTimeout(() => setReinvestSuccess(null), 4000)
        setIsReinvestModalOpen(false)
        setReinvestAmount('')
        setSupplierName('')
        setDescription('')
        setSelectedProductId('')
        setQuantityToAdd('')
        setUnitCostInput('')
        loadFinances(true)
      } else {
        alert(resData.error || 'No se pudo registrar la reinversión.')
      }
    } catch (err: any) {
      alert(err.message || 'Error al procesar la reinversión.')
    } finally {
      setSubmittingReinvest(false)
    }
  }

  const pnl = data?.pnl
  const balance = data?.balance
  const breakdownMethods = data?.payment_methods_breakdown || []

  // Calcular totales por divisas vs bolívares recaudados
  const totalUsdMethods = breakdownMethods
    .filter((m) => m.currency === 'USD')
    .reduce((acc, m) => acc + m.total_usd, 0)
  const totalVesMethodsInUsd = breakdownMethods
    .filter((m) => m.currency === 'VES')
    .reduce((acc, m) => acc + m.total_usd, 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Finanzas, Ingresos Reales & Balance General
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Control exacto de ingresos recaudados en caja/bancos vs ventas facturadas a crédito
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadFinances(true)}
            disabled={loading || refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Actualizar finanzas"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsReinvestModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Reinvertir en Inventario</span>
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 w-fit overflow-x-auto max-w-full">
        {[
          { key: 'this_week', label: 'Esta Semana' },
          { key: 'this_month', label: 'Este Mes' },
          { key: 'last_month', label: 'Mes Anterior' },
          { key: 'year', label: 'Año Actual' },
          { key: 'all', label: 'Todo el Historial' },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key as any)}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
              period === p.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {reinvestSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{reinvestSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="font-semibold">Calculando estado de ganancias, ingresos recaudados y balance...</p>
        </div>
      ) : (
        <>
          {/* BANNER EXPLICATIVO: CRITERIO DE CAJA VS FACTURACIÓN */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-200 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Criterio de Ingresos Reales en Caja y Bancos
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Una venta facturada no se convierte en <strong>ingreso</strong> hasta que es efectivamente cobrada. Aquí verás separado el dinero que <strong>realmente ingresó</strong> de los créditos fiados aún pendientes.
                </p>
              </div>
            </div>
            <div className="shrink-0 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Tasa BCV: Bs. {exchangeRate.toFixed(2)}/USD
            </div>
          </div>

          {/* SECCIÓN 1: KPI CARDS COMPARATIVAS (VENTAS FACTURADAS vs INGRESOS REALES) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Ventas Facturadas (Total Pedidos) */}
            <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ventas Facturadas</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-900">
                  {pnl?.orders_count || 0} pedidos
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  ${(pnl?.total_billed_usd ?? pnl?.total_sales_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  Bs. {(pnl?.total_billed_ves ?? pnl?.total_sales_ves ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Total órdenes emitidas en el período
              </p>
            </div>

            {/* Card 2: Crédito Otorgado Pendiente (No es ingreso aún) */}
            <div className="glass-card p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Créditos Otorgados</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                  Por Cobrar
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  ${(pnl?.credit_pending_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Bs. {(pnl?.credit_pending_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 font-medium">
                Ventas fiadas que no han entrado a caja
              </p>
            </div>

            {/* Card 3: Ingresos Reales Cobrados (Caja) */}
            <div className="glass-card p-5 rounded-3xl border-2 border-emerald-500/50 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-md shadow-emerald-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Ingresos Reales Cobrados
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                  En Caja / Bancos
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  ${(pnl?.total_collected_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Bs. {(pnl?.total_collected_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex justify-between">
                <span>Ventas Directas: ${(pnl?.direct_sales_collected_usd || 0).toFixed(2)}</span>
                <span className="font-bold text-emerald-600">Abonos: +${(pnl?.abonos_collected_usd || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Card 4: Flujo de Caja Neto Real */}
            <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flujo de Caja Neto</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                  (pnl?.net_cash_flow_usd || 0) >= 0
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  Dinero Disponible
                </span>
              </div>
              <div>
                <p className={`text-2xl font-black ${(pnl?.net_cash_flow_usd || 0) >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                  ${(pnl?.net_cash_flow_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Bs. {((pnl?.net_cash_flow_usd || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-[11px] text-slate-400 font-medium flex justify-between">
                <span>Gastos Operativos:</span>
                <span className="font-bold text-rose-600">-${(pnl?.operating_expenses_usd || 0).toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DESGLOSE DE INGRESOS REALES POR TIPO DE PAGO */}
          <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  Desglose de Ingresos Reales por Método de Pago
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Detalle de cómo fue recibido el dinero efectivamente cobrado (ventas al contado + abonos recibidos en el período)
                </p>
              </div>

              {/* Pills de recaudación Divisas vs Bolívares */}
              <div className="flex items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Divisas (USD/USDT): ${totalUsdMethods.toFixed(2)}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bolívares: Bs. {(totalVesMethodsInUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {breakdownMethods.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs space-y-1">
                <Wallet className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 opacity-60" />
                <p className="font-bold">No se han registrado cobros o abonos en este período.</p>
                <p className="text-[11px] text-slate-500">Los pagos cobrados al procesar ventas o registrar abonos aparecerán aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {breakdownMethods.map((m) => {
                  const meta = getMethodMeta(m.method)
                  const Icon = meta.icon

                  return (
                    <div
                      key={m.method}
                      className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${meta.badgeBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {m.label}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {m.count} {m.count === 1 ? 'cobro registrado' : 'cobros registrados'}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {m.percentage}%
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-black text-slate-900 dark:text-white">
                            ${m.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                          </span>
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            Bs. {m.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Barra de Progreso */}
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
                            style={{ width: `${Math.min(100, Math.max(2, m.percentage))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: ESTADO DE GANANCIAS & COSTOS (P&L) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Estado de Resultados y Rentabilidad
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Costo Mercancía Vendida */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Mercancía (COGS)</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${(pnl?.cogs_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Costo de reposición estimado
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Basado en costo unitario de los productos vendidos
                </p>
              </div>

              {/* Utilidad Bruta */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilidad Bruta</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                    {pnl?.gross_margin_percent || 0}% margen
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ${(pnl?.gross_profit_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                    Bs. {((pnl?.gross_profit_usd || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Ventas facturadas menos costo de productos
                </p>
              </div>

              {/* Utilidad Neta Líquida */}
              <div className="glass-card p-5 rounded-3xl border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-950/30 dark:to-teal-950/20 shadow-md shadow-emerald-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Utilidad Neta Real
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                    {pnl?.net_margin_percent || 0}% neto
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    ${(pnl?.net_profit_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Bs. {((pnl?.net_profit_usd || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex justify-between">
                  <span>Gastos Operativos:</span>
                  <span className="font-bold text-rose-600">-${(pnl?.operating_expenses_usd || 0).toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: BALANCE GENERAL DE LA TIENDA */}
          <div className="pt-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Balance Patrimonial de la Tienda (Activos Actuales)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Activo 1: Inventario Valorizado */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mercancía en Bodega</span>
                  </div>
                  <span className="text-[11px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                    {balance?.total_stock_units || 0} unidades
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-medium">Valor a Costo:</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      ${(balance?.inventory_cost_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-medium">Valor a Precio Venta:</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      ${(balance?.inventory_sale_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-100 dark:border-slate-800 text-emerald-600 font-bold text-xs">
                    <span>Ganancia Potencial:</span>
                    <span>+${(balance?.inventory_potential_profit_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Activo 2: Cuentas por Cobrar */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cuentas por Cobrar</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                    {balance?.debtors_count || 0} clientes
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    ${(balance?.accounts_receivable_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-amber-700/80 dark:text-amber-400/80">
                    Bs. {((balance?.accounts_receivable_usd || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Créditos acumulados pendientes por cobrar
                  </p>
                </div>
              </div>

              {/* Activo 3: Patrimonio Estimado */}
              <div className="glass-card p-5 rounded-3xl border-2 border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-blue-900 dark:text-blue-200">Patrimonio Total Estimado</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-slate-900 dark:text-white">
                    ${(balance?.total_assets_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Bs. {((balance?.total_assets_usd || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-medium">
                    Inventario a Costo + Deudores + Liquidez en Caja
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: REINVERSIÓN EN INVENTARIO */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Historial de Reinversiones en Inventario
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Registro de compras de mercancía a proveedores financiadas con las ganancias del negocio
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium">Reinversión del período: </span>
                <span className="text-sm font-black text-emerald-600">${(pnl?.reinvestment_usd || 0).toFixed(2)} USD</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              {(!data?.reinvestments || data.reinvestments.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="font-semibold">No se han registrado reinversiones en este período.</p>
                  <button
                    onClick={() => setIsReinvestModalOpen(true)}
                    className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                  >
                    + Registrar primera reinversión
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Proveedor</th>
                        <th className="py-3 px-4">Descripción</th>
                        <th className="py-3 px-4">Método de Pago</th>
                        <th className="py-3 px-4 text-right">Monto ($ USD)</th>
                        <th className="py-3 px-4 text-right">Monto (Bs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.reinvestments.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {formatDate(r.date || r.expense_date)}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {r.supplier_name || r.reference || 'Proveedor'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {r.description}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {r.payment_method || 'transfer_ves'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                            ${Number(r.amount_usd).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                            Bs. {Number(r.amount_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL PARA REGISTRAR REINVERSIÓN EN INVENTARIO */}
      {isReinvestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Registrar Reinversión en Inventario
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Compra de mercancía con utilidades del negocio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReinvestModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterReinvestment} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monto a Reinvertir ($ USD) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={reinvestAmount}
                      onChange={(e) => setReinvestAmount(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>
                  {reinvestAmount && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">
                      Equivalente: Bs. {(parseFloat(reinvestAmount) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Distribuidora Caracas C.A."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Método de Fondo / Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="transfer_ves">Transferencia Bancaria VES</option>
                  <option value="pago_movil">Pago Móvil VES</option>
                  <option value="cash_usd">Efectivo USD (Caja)</option>
                  <option value="cash_ves">Efectivo VES (Caja)</option>
                  <option value="zelle">Zelle (USD)</option>
                  <option value="binance_pay">Binance Pay (USDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detalle o Descripción de la Mercancía
                </label>
                <input
                  type="text"
                  placeholder="Ej. Compra de 20 cargadores y 10 audífonos bluetooth"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Reposición directa a producto existente (opcional) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                  Sumar stock a un producto del catálogo (opcional)
                </span>

                <div>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value)
                      const found = products.find((p) => p.id === e.target.value)
                      if (found && found.cost_usd) {
                        setUnitCostInput(String(found.cost_usd))
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="">-- Sin actualizar stock específico --</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} (Stock actual: {prod.stock})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProductId && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Unidades compradas:
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Ej. 10"
                        value={quantityToAdd}
                        onChange={(e) => setQuantityToAdd(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Costo unitario ($):
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={unitCostInput}
                        onChange={(e) => setUnitCostInput(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReinvestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReinvest}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingReinvest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Reinversión</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

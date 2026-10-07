'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import type { PaymentMethodType, Order, CashClosingSummaryItem } from '@/types/database'
import {
  CheckCircle2, Clock, Banknote, Loader2, RefreshCw,
  Receipt, TrendingUp, AlertTriangle, Lock, Truck,
  Calendar, History, Printer, Eye, ArrowLeft, KeyRound,
  Unlock, ChevronDown, ChevronUp, DollarSign, X, Check
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { extractDeliveryInfo } from '@/lib/delivery'
import { AdminAuthPinModal } from '@/components/admin/AdminAuthPinModal'

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  binance_pay: '🟡 Binance Pay (USDT)',
  zelle: '🏦 Zelle (USD)',
  pago_movil: '📱 Pago Móvil',
  cash_usd: '💵 Efectivo USD',
  cash_ves: '💴 Efectivo VES',
  transfer_ves: '🏛️ Transferencia VES',
  debit_ves: '💳 Punto / Débito',
  credit_7d: '⏳ Venta a Crédito',
}

const VES_METHODS: PaymentMethodType[] = ['pago_movil', 'cash_ves', 'transfer_ves', 'debit_ves']

export default function CashClosingPage() {
  const { tenant, profile, exchangeRate } = useTenant()

  // Control de fechas y pestañas
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
  }, [])
  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(d)
  }, [])

  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [activeTab, setActiveTab] = useState<'closing' | 'history'>('closing')

  const [orders, setOrders] = useState<Order[]>([])
  const [abonos, setAbonos] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [savedClosing, setSavedClosing] = useState<any | null>(null)
  const [alreadyClosed, setAlreadyClosed] = useState(false)
  const [closedAt, setClosedAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [closingNotes, setClosingNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Arqueo físico de caja (efectivo contado por el cajero)
  const [actualCashUsdInput, setActualCashUsdInput] = useState('')
  const [actualCashVesInput, setActualCashVesInput] = useState('')

  // Modales
  const [reopenPinModalOpen, setReopenPinModalOpen] = useState(false)
  const [selectedHistoryClosing, setSelectedHistoryClosing] = useState<any | null>(null)
  const [showMovements, setShowMovements] = useState(false)

  // ─── Carga de datos del turno y de la fecha seleccionada ───────────────────
  const loadData = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/admin/cash-closing?tenant_id=${tenant.id}&date=${selectedDate}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar datos del cierre.')
      }

      setAlreadyClosed(Boolean(data.closed))
      setSavedClosing(data.closing || null)
      setClosedAt(data.closing?.closed_at || data.closing?.created_at || null)
      setOrders((data.orders || []) as Order[])
      setAbonos(data.abonos || [])
      setHistory(data.history || [])

      if (data.closing) {
        setActualCashUsdInput(String(data.closing.actual_cash_usd || ''))
        setActualCashVesInput(String(data.closing.actual_cash_ves || ''))
        setClosingNotes(data.closing.notes || '')
      } else {
        setActualCashUsdInput('')
        setActualCashVesInput('')
        setClosingNotes('')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al cargar cierre de caja.')
    } finally {
      setLoading(false)
    }
  }, [tenant, selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Resumen Combinado: Ventas Directas + Abonos Cobrados ──────────────────
  const summary = useMemo(() => {
    if (alreadyClosed && savedClosing?.breakdown_by_method) {
      return savedClosing.breakdown_by_method as CashClosingSummaryItem[]
    }
    return computeCombinedSummary(orders, abonos, exchangeRate)
  }, [alreadyClosed, savedClosing, orders, abonos, exchangeRate])

  // Ventas totales facturadas en nuevas órdenes
  const facturadoTotalUsd = useMemo(() => {
    return orders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0)
  }, [orders])

  // Total cobrado de abonos hoy
  const abonosTotalUsd = useMemo(() => {
    return abonos.reduce((s, a) => s + (Number(a.amount_usd) || 0), 0)
  }, [abonos])

  // Fletes / Delivery
  const deliveryTotalUsd = useMemo(() => {
    return orders.reduce((s, o) => s + extractDeliveryInfo(o.notes, exchangeRate).amountUsd, 0)
  }, [orders, exchangeRate])

  // IGTF cobrado
  const igtfTotal = useMemo(() => {
    if (alreadyClosed && savedClosing) return 0
    return orders.reduce((s, o) => s + (Number(o.igtf_total) || 0), 0)
  }, [alreadyClosed, savedClosing, orders])

  // Total Real Cobrado en Caja / Bancos (Ventas directas + Abonos, excluyendo crédito pendiente)
  const grandTotalUsd = useMemo(() => {
    if (alreadyClosed && savedClosing) {
      return Number(savedClosing.total_sales_usd) || 0
    }
    // Suma de todos los métodos reales de pago (excluyendo credit_7d)
    return summary
      .filter((r) => r.method !== 'credit_7d')
      .reduce((sum, r) => sum + r.total_usd, 0)
  }, [alreadyClosed, savedClosing, summary])

  const grandTotalVes = grandTotalUsd * exchangeRate

  // Efectivo físico esperado en sistema
  const systemCashUsd = useMemo(() => {
    const row = summary.find((r) => r.method === 'cash_usd')
    return row ? row.total_usd : 0
  }, [summary])

  const systemCashVes = useMemo(() => {
    const row = summary.find((r) => r.method === 'cash_ves')
    return row ? row.total_ves : 0
  }, [summary])

  // Crédito pendiente otorgado hoy (cuentas por cobrar)
  const creditGrantedUsd = useMemo(() => {
    const row = summary.find((r) => r.method === 'credit_7d')
    return row ? row.total_usd : 0
  }, [summary])

  // Diferencias de arqueo físico
  const actualCashUsd = parseFloat(actualCashUsdInput) || 0
  const actualCashVes = parseFloat(actualCashVesInput) || 0
  const diffUsd = actualCashUsdInput ? actualCashUsd - systemCashUsd : 0
  const diffVes = actualCashVesInput ? actualCashVes - systemCashVes : 0

  // ─── Guardar Cierre de Caja ───────────────────────────────────────────────
  async function handleClose() {
    if (!tenant || !profile) return
    setClosing(true)
    setErrorMsg(null)
    setSuccessBanner(null)

    try {
      const res = await fetch('/api/admin/cash-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          tenant_id: tenant.id,
          summary,
          subtotal_usd: parseFloat(facturadoTotalUsd.toFixed(4)),
          igtf_total: parseFloat(igtfTotal.toFixed(4)),
          total_usd: parseFloat(grandTotalUsd.toFixed(4)),
          total_ves: parseFloat(grandTotalVes.toFixed(2)),
          order_count: orders.length + abonos.length,
          exchange_rate: exchangeRate,
          actual_cash_usd: actualCashUsdInput ? parseFloat(actualCashUsd.toFixed(2)) : 0,
          actual_cash_ves: actualCashVesInput ? parseFloat(actualCashVes.toFixed(2)) : 0,
          difference_usd: actualCashUsdInput ? parseFloat(diffUsd.toFixed(2)) : 0,
          difference_ves: actualCashVesInput ? parseFloat(diffVes.toFixed(2)) : 0,
          notes: closingNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar el cierre de caja.')
      }

      setAlreadyClosed(true)
      setClosedAt(data.closing?.closed_at || data.closing?.created_at || new Date().toISOString())
      setSavedClosing(data.closing)
      setSuccessBanner('✓ Cierre de caja registrado exitosamente.')
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al cerrar la caja.')
    } finally {
      setClosing(false)
    }
  }

  // ─── Reabrir Turno con Clave Admin ─────────────────────────────────────────
  async function handleConfirmReopen(pin: string) {
    if (!tenant) return
    setLoading(true)
    setErrorMsg(null)
    setSuccessBanner(null)

    try {
      const res = await fetch('/api/admin/cash-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen',
          tenant_id: tenant.id,
          closing_id: savedClosing?.id,
          pin,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al reabrir el turno.')
      }

      setAlreadyClosed(false)
      setSavedClosing(null)
      setClosedAt(null)
      setSuccessBanner('✓ Turno de caja reabierto con éxito. Ahora puedes realizar cambios y cerrar nuevamente.')
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reabrir turno.')
      setLoading(false)
    }
  }

  // ─── Imprimir Comprobante de Cierre ───────────────────────────────────────
  const handlePrintClosing = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Cierre de Caja y Arqueo</span>
            {alreadyClosed && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cerrada
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
            Control de cobros, arqueo físico y cuadre contable del turno
          </p>
        </div>

        {/* Acciones de Cabecera: Selector de Fecha y Botón Actualizar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botones rápidos de Fecha */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedDate === todayStr
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(yesterdayStr)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedDate === yesterdayStr
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Ayer
            </button>
          </div>

          {/* Input de Fecha Calendario */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
            title="Refrescar datos del turno"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Navegación: Cierre del Día vs Historial */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('closing')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'closing'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Cierre del Turno ({selectedDate})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historial de Cierres ({history.length})</span>
        </button>
      </div>

      {/* Banners de estado */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-5 py-4 text-rose-800 dark:text-rose-200 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successBanner && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 px-5 py-4 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ─── PESTAÑA 1: ARQUEO Y CIERRE DEL DÍA ─── */}
      {activeTab === 'closing' && (
        <>
          {/* Banner de Caja Cerrada */}
          {alreadyClosed && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                    Turno Cerrado — {savedClosing?.closing_number || 'Cierre Registrado'}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                    Registrado el {closedAt ? formatDateTime(closedAt) : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintClosing}
                  className="px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReopenPinModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Reabrir caja con clave admin para registrar ventas tardías o corregir arqueo"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reabrir Turno (Clave Admin)</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Calculando movimientos y arqueo de caja…</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tarjetas KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <KpiCard
                  icon={Receipt}
                  color="text-blue-600 dark:text-blue-400"
                  bg="bg-blue-50 dark:bg-blue-950/50"
                  label="Órdenes del Turno"
                  value={String(orders.length)}
                  sub={`Facturado: $${facturadoTotalUsd.toFixed(2)} USD`}
                />
                <KpiCard
                  icon={DollarSign}
                  color="text-teal-600 dark:text-teal-400"
                  bg="bg-teal-50 dark:bg-teal-950/50"
                  label="Abonos Cobrados"
                  value={`$${abonosTotalUsd.toFixed(2)}`}
                  sub={`${abonos.length} abonos recibidos hoy`}
                />
                <KpiCard
                  icon={Banknote}
                  color="text-emerald-600 dark:text-emerald-400"
                  bg="bg-emerald-50 dark:bg-emerald-950/50"
                  label="Total Cobrado en Caja"
                  value={`$${grandTotalUsd.toFixed(2)}`}
                  sub={`Bs. ${grandTotalVes.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
                />
                <KpiCard
                  icon={TrendingUp}
                  color="text-amber-600 dark:text-amber-400"
                  bg="bg-amber-50 dark:bg-amber-950/50"
                  label="Créditos Otorgados"
                  value={`$${creditGrantedUsd.toFixed(2)}`}
                  sub="Por cobrar en 7-15 días"
                />
                <KpiCard
                  icon={Truck}
                  color="text-sky-600 dark:text-sky-400"
                  bg="bg-sky-50 dark:bg-sky-950/50"
                  label="Fletes / Delivery"
                  value={`$${deliveryTotalUsd.toFixed(2)}`}
                  sub="Repartidores (Externo)"
                />
              </div>

              {/* Desglose por Método de Pago */}
              <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>Desglose de Ingresos por Método de Pago</span>
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">
                    Tasa Oficial BCV: Bs. {exchangeRate.toFixed(2)}/USD
                  </span>
                </div>

                {summary.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No se registran movimientos para esta fecha.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider">
                          <th className="pb-3 font-bold">Método</th>
                          <th className="pb-3 font-bold text-center">Transacciones</th>
                          <th className="pb-3 font-bold text-right">Total USD ($)</th>
                          <th className="pb-3 font-bold text-right">Total VES (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {summary.map((row) => {
                          const isCreditRow = row.method === 'credit_7d'
                          return (
                            <tr
                              key={row.method}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                                isCreditRow ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                              }`}
                            >
                              <td className="py-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span>{row.label}</span>
                                {isCreditRow && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                    Cuentas por Cobrar
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-center text-slate-500">{row.count}</td>
                              <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                                ${row.total_usd.toFixed(2)}
                              </td>
                              <td className="py-3 text-right text-slate-500 font-mono">
                                Bs. {row.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-extrabold text-sm text-slate-900 dark:text-white">
                          <td className="pt-3">TOTAL COBRADO EN CAJA</td>
                          <td className="pt-3 text-center text-xs text-slate-500">
                            {orders.length + abonos.length} mov.
                          </td>
                          <td className="pt-3 text-right text-indigo-600 dark:text-indigo-400">
                            ${grandTotalUsd.toFixed(2)}
                          </td>
                          <td className="pt-3 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">
                            Bs. {grandTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Botón para Desplegar el Detalle de Movimientos Individuales */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowMovements(!showMovements)}
                  className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-500" />
                    <span>Ver Detalle de Ventas ({orders.length}) y Abonos ({abonos.length}) del Turno</span>
                  </span>
                  {showMovements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showMovements && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    {/* Tabla de Abonos Cobrados */}
                    {abonos.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-extrabold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Abonos Recibidos en este Turno ({abonos.length})</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[9px]">
                                <th className="pb-1.5">Factura</th>
                                <th className="pb-1.5">Cliente</th>
                                <th className="pb-1.5">Método</th>
                                <th className="pb-1.5">Referencia</th>
                                <th className="pb-1.5 text-right">Monto USD</th>
                                <th className="pb-1.5 text-right">Monto Bs.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {abonos.map((a, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                  <td className="py-2 font-bold text-slate-800 dark:text-slate-200">
                                    #{a.order_number}
                                  </td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300">{a.customer_name}</td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300 uppercase">
                                    {a.method}
                                  </td>
                                  <td className="py-2 font-mono text-slate-500">{a.reference || '—'}</td>
                                  <td className="py-2 text-right font-bold text-emerald-600">
                                    ${Number(a.amount_usd || 0).toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right font-mono text-slate-500">
                                    Bs. {Number(a.amount_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Órdenes Nuevas */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Ventas y Facturas Emitidas ({orders.length})</span>
                      </h4>
                      {orders.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">No se emitieron nuevas facturas hoy.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[9px]">
                                <th className="pb-1.5">Factura</th>
                                <th className="pb-1.5">Hora</th>
                                <th className="pb-1.5">Cliente</th>
                                <th className="pb-1.5">Estado</th>
                                <th className="pb-1.5 text-right">Total Factura</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {orders.map((o) => (
                                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                  <td className="py-2 font-bold text-slate-800 dark:text-slate-200">
                                    #{o.order_number}
                                  </td>
                                  <td className="py-2 text-slate-400">
                                    {new Date(o.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300">
                                    {(o as any).customer?.full_name || 'Consumidor Final'}
                                  </td>
                                  <td className="py-2 uppercase font-bold text-[10px]">
                                    <span className={o.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}>
                                      {o.status}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right font-bold text-slate-900 dark:text-white">
                                    ${Number(o.total_usd || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Arqueo Físico y Formulario de Cierre */}
              {!alreadyClosed && (
                <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80 space-y-5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Arqueo Físico de Caja (Conteo de Efectivo)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cuenta el dinero físico que hay físicamente en la gaveta y digítalo a continuación para calcular sobrante o faltante.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Efectivo USD */}
                    <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Efectivo USD Contado ($)</span>
                        <span className="text-slate-500 font-mono">Esperado: ${systemCashUsd.toFixed(2)}</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={actualCashUsdInput}
                          onChange={(e) => setActualCashUsdInput(e.target.value)}
                          placeholder={systemCashUsd.toFixed(2)}
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      {actualCashUsdInput && (
                        <div className={`text-[11px] font-bold flex items-center justify-between ${
                          diffUsd === 0 ? 'text-emerald-600' : diffUsd > 0 ? 'text-blue-600' : 'text-rose-600'
                        }`}>
                          <span>Diferencia USD:</span>
                          <span>
                            {diffUsd === 0 ? '✓ Cuadre exacto ($0.00)' : diffUsd > 0 ? `+ Sobrante: +$${diffUsd.toFixed(2)}` : `- Faltante: -$${Math.abs(diffUsd).toFixed(2)}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Efectivo VES */}
                    <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Efectivo Bolívares Contado (Bs.)</span>
                        <span className="text-slate-500 font-mono">Esperado: Bs. {systemCashVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs.</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={actualCashVesInput}
                          onChange={(e) => setActualCashVesInput(e.target.value)}
                          placeholder={systemCashVes.toFixed(2)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      {actualCashVesInput && (
                        <div className={`text-[11px] font-bold flex items-center justify-between ${
                          diffVes === 0 ? 'text-emerald-600' : diffVes > 0 ? 'text-blue-600' : 'text-rose-600'
                        }`}>
                          <span>Diferencia Bs:</span>
                          <span>
                            {diffVes === 0 ? '✓ Cuadre exacto (0.00 Bs)' : diffVes > 0 ? `+ Sobrante: +Bs. ${diffVes.toFixed(2)}` : `- Faltante: -Bs. ${Math.abs(diffVes).toFixed(2)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Observaciones del turno o novedades del arqueo (opcional)…"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs resize-none"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleClose}
                      disabled={closing}
                      className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm transition-all duration-200 shadow-md shadow-indigo-500/25 active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {closing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando Cierre…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cerrar Caja del Turno</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── PESTAÑA 2: HISTORIAL DE CIERRES ANTERIORES ─── */}
      {activeTab === 'history' && (
        <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Historial de Cierres de Caja Registrados</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              Últimos {history.length} cierres
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <History className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Aún no hay cierres de caja registrados en el historial.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-bold">N° Cierre</th>
                    <th className="pb-3 font-bold">Fecha / Hora</th>
                    <th className="pb-3 font-bold text-center">Movimientos</th>
                    <th className="pb-3 font-bold text-right">Total USD ($)</th>
                    <th className="pb-3 font-bold text-right">Total VES (Bs.)</th>
                    <th className="pb-3 font-bold text-center">Estado</th>
                    <th className="pb-3 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {history.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {c.closing_number || 'CC-N/D'}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {c.closed_at ? formatDateTime(c.closed_at) : formatDateTime(c.created_at)}
                      </td>
                      <td className="py-3 text-center text-slate-500">
                        {c.sales_count || 0}
                      </td>
                      <td className="py-3 text-right font-extrabold text-emerald-600">
                        ${Number(c.total_sales_usd || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-500">
                        Bs. {Number(c.total_sales_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {c.status || 'closed'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryClosing(c)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Detalle de Cierre del Historial */}
      {selectedHistoryClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Detalle de Cierre {selectedHistoryClosing.closing_number}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(selectedHistoryClosing.closed_at || selectedHistoryClosing.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryClosing(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-500 block">Total Recaudado (USD):</span>
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    ${Number(selectedHistoryClosing.total_sales_usd || 0).toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total en Bolívares:</span>
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                    Bs. {Number(selectedHistoryClosing.total_sales_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Desglose de Métodos */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Desglose por Métodos:</h4>
                <div className="space-y-1.5">
                  {(selectedHistoryClosing.breakdown_by_method || []).map((m: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                      <span className="font-semibold">{m.label || m.method}</span>
                      <span className="font-bold font-mono">
                        ${Number(m.total_usd || 0).toFixed(2)} (Bs. {Number(m.total_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedHistoryClosing.notes && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <span className="font-bold block mb-1">Observaciones:</span>
                  <p className="italic">{selectedHistoryClosing.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoryClosing(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Autorizar Reapertura de Turno con Clave Admin */}
      <AdminAuthPinModal
        isOpen={reopenPinModalOpen}
        onClose={() => setReopenPinModalOpen(false)}
        onSuccess={handleConfirmReopen}
        title="Autorizar Reapertura de Turno"
        description="Ingresa la Clave de Administrador de la tienda para reabrir este turno y permitir ajustes o nuevas facturas."
      />
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, color, bg, label, value, sub }: {
  icon: React.ElementType; color: string; bg: string; label: string; value: string; sub: string
}) {
  return (
    <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ─── Cálculo Combinado de Métodos: Ventas Directas + Abonos Cobrados ───────────
function computeCombinedSummary(orders: Order[], abonos: any[], exchangeRate: number): CashClosingSummaryItem[] {
  const map = new Map<PaymentMethodType, CashClosingSummaryItem>()

  function addEntry(methodRaw: string, amountUsd: number, amountVes: number) {
    const method = methodRaw as PaymentMethodType
    const isVes = VES_METHODS.includes(method)
    const amtUsd = Number(amountUsd) || 0
    const amtVes = isVes && amountVes > 0 ? Number(amountVes) : amtUsd * exchangeRate

    if (!map.has(method)) {
      map.set(method, {
        method,
        label: METHOD_LABELS[method] ?? method,
        total_usd: 0,
        total_ves: 0,
        count: 0,
      })
    }
    const row = map.get(method)!
    row.total_usd += amtUsd
    row.total_ves += amtVes
    row.count += 1
  }

  // 1. Pagos de órdenes del turno
  for (const order of orders) {
    const breakdown = Array.isArray(order.payment_breakdown) ? (order.payment_breakdown as any[]) : []
    for (const p of breakdown) {
      if (p.is_abono) {
        // Los abonos se procesan en la lista de abonos del día
        continue
      }
      addEntry(p.method, p.amount_usd, p.amount_ves)
    }
  }

  // 2. Abonos cobrados hoy (incluso de órdenes creadas en días previos)
  for (const a of abonos) {
    addEntry(a.method, a.amount_usd, a.amount_ves)
  }

  return Array.from(map.values())
}

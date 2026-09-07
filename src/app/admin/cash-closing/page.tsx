'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { PaymentMethodType, Order, CashClosingSummaryItem } from '@/types/database'
import {
  CheckCircle2, Clock, Banknote, Loader2, RefreshCw,
  Receipt, TrendingUp, AlertTriangle, Lock
} from 'lucide-react'

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  zelle: '🏦 Zelle (USD)',
  pago_movil: '📱 Pago Móvil',
  cash_usd: '💵 Efectivo USD',
  cash_ves: '💴 Efectivo VES',
  transfer_ves: '🏛️ Transferencia VES',
  debit_ves: '💳 Punto / Débito',
}

const VES_METHODS: PaymentMethodType[] = ['pago_movil', 'cash_ves', 'transfer_ves', 'debit_ves']

export default function CashClosingPage() {
  const { tenant, profile, exchangeRate } = useTenant()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [closingNotes, setClosingNotes] = useState('')
  const [alreadyClosed, setAlreadyClosed] = useState(false)
  const [closedAt, setClosedAt] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const loadOrders = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const supabase = createClient()

    // Check if already closed today
    const { data: existing } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('closing_date', today)
      .eq('status', 'closed')
      .maybeSingle()

    if (existing) {
      setAlreadyClosed(true)
      setClosedAt(existing.created_at)
      setLoading(false)
      return
    }

    // Load today's completed orders
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('status', 'completed')
      .gte('created_at', today)
      .order('created_at', { ascending: false })

    setOrders((data ?? []) as Order[])
    setLoading(false)
  }, [tenant, today])

  useEffect(() => { loadOrders() }, [loadOrders])

  // ─── Compute summary from orders ─────────────────────────────────────────
  const summary = computeSummary(orders, exchangeRate)
  const subtotalUsd = orders.reduce((s, o) => s + o.subtotal_usd, 0)
  const igtfTotal = orders.reduce((s, o) => s + (o.igtf_total ?? 0), 0)
  const grandTotalUsd = orders.reduce((s, o) => s + o.total_usd, 0)
  const grandTotalVes = grandTotalUsd * exchangeRate

  async function handleClose() {
    if (!tenant || !profile) return
    setClosing(true)
    const supabase = createClient()

    await supabase.from('cash_closings').insert({
      tenant_id: tenant.id,
      closing_date: today,
      status: 'closed',
      summary_by_method: summary,
      subtotal_usd: parseFloat(subtotalUsd.toFixed(4)),
      igtf_total: parseFloat(igtfTotal.toFixed(4)),
      total_usd: parseFloat(grandTotalUsd.toFixed(4)),
      total_ves: parseFloat(grandTotalVes.toFixed(2)),
      order_count: orders.length,
      exchange_rate_used: exchangeRate,
      notes: closingNotes || null,
      closed_by: profile.id,
    })

    setAlreadyClosed(true)
    setClosedAt(new Date().toISOString())
    setClosing(false)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Cierre de Caja</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
            Resumen del día — {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading || alreadyClosed}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Already closed banner */}
      {alreadyClosed && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 px-5 py-4">
          <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Caja cerrada exitosamente</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
              Cierre registrado el {closedAt ? new Date(closedAt).toLocaleString('es-VE') : '—'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Calculando cierre de caja…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              icon={Receipt} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/50"
              label="Órdenes del día" value={String(orders.length)} sub="completadas"
            />
            <KpiCard
              icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-950/50"
              label="Subtotal Ventas" value={`$${subtotalUsd.toFixed(2)}`} sub={`Bs. ${(subtotalUsd * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
            />
            <KpiCard
              icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/50"
              label="IGTF Cobrado" value={`$${igtfTotal.toFixed(2)}`} sub={igtfTotal > 0 ? 'Divisas 3%' : 'Sin IGTF hoy'}
            />
            <KpiCard
              icon={Banknote} color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-950/50"
              label="Total Final" value={`$${grandTotalUsd.toFixed(2)}`} sub={`Bs. ${grandTotalVes.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
            />
          </div>

          {/* Method breakdown */}
          <div className="glass-card border border-slate-200/80 dark:border-slate-800/80 p-6">
            <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Desglose por Método de Pago
            </h2>

            {summary.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No hay ventas completadas hoy.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Método</th>
                      <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Transacciones</th>
                      <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total USD</th>
                      <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Bs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.map((row) => (
                      <tr key={row.method} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{row.label}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">{row.count}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white">${row.total_usd.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                          Bs. {row.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                    {/* IGTF row if applicable */}
                    {igtfTotal > 0 && (
                      <tr className="bg-amber-50/50 dark:bg-amber-950/20 border-t-2 border-amber-200 dark:border-amber-900/60">
                        <td className="py-3 px-4 font-bold text-amber-700 dark:text-amber-400">⚠️ IGTF (3% divisas)</td>
                        <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-extrabold text-amber-600 dark:text-amber-400">+${igtfTotal.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                          +Bs. {(igtfTotal * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}

                    {/* Grand total row */}
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50">
                      <td className="py-4 px-4 font-extrabold text-slate-900 dark:text-white">TOTAL DEL DÍA</td>
                      <td className="py-4 px-4 text-right font-extrabold text-slate-900 dark:text-white">{orders.length}</td>
                      <td className="py-4 px-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400 text-base">${grandTotalUsd.toFixed(2)}</td>
                      <td className="py-4 px-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400 text-base">
                        Bs. {grandTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Close action */}
          {!alreadyClosed && (
            <div className="glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-slate-900 dark:text-white">Realizar Cierre de Caja</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Al cerrar la caja, se guarda un registro inmutable del resumen financiero de hoy. Esta acción no elimina ni modifica las órdenes.
              </p>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Observaciones del cierre (opcional)…"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  disabled={closing || orders.length === 0}
                  className="flex items-center gap-2.5 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all duration-200 shadow-md shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {closing
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Cerrando caja…</>
                    : <><CheckCircle2 className="w-4 h-4" />Cerrar Caja del Día</>
                  }
                </button>
              </div>
              {orders.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">No hay ventas hoy. El cierre está disponible cuando haya al menos una venta completada.</p>
              )}
            </div>
          )}
        </>
      )}
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

// ─── Compute summary ───────────────────────────────────────────────────────────
function computeSummary(orders: Order[], exchangeRate: number): CashClosingSummaryItem[] {
  const map = new Map<PaymentMethodType, CashClosingSummaryItem>()

  for (const order of orders) {
    const breakdown = order.payment_breakdown ?? []
    for (const p of breakdown) {
      const method = p.method as PaymentMethodType
      const isVes = VES_METHODS.includes(method)
      const amtUsd = p.amount_usd
      const amtVes = isVes ? p.amount_ves : amtUsd * exchangeRate

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
  }

  return Array.from(map.values())
}

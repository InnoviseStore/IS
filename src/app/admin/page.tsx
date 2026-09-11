'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { TrendingUp, AlertTriangle, Clock, DollarSign, Vault, PieChart, Wallet, Trash2, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react'

function StatCard({
  title, subtitle, value, sub, icon: Icon, color,
}: {
  title: string; subtitle: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 border border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { tenant, exchangeRate } = useTenant()
  const [salesToday, setSalesToday] = useState(0)
  const [salesMonth, setSalesMonth] = useState(0)
  const [expensesMonth, setExpensesMonth] = useState(0)
  const [lowStock, setLowStock] = useState(0)
  const [pendingCredits, setPendingCredits] = useState(0)
  const [cashClosed, setCashClosed] = useState<boolean | null>(null)
  const [recentOrders, setRecentOrders] = useState<{ id: string; order_number: string; total_usd: number; status: string; created_at: string }[]>([])

  // Modal de anulación de orden con clave admin
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; order_number: string; total_usd: number; status: string } | null>(null)
  const [adminKey, setAdminKey] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!tenant) return
    const supabase = createClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const [
      { data: ordersRecent },
      { data: ordersTodayData },
      { data: ordersMonthData },
      { data: expensesMonthData },
      { count: lsCount },
      { count: creditCount },
      { data: closing }
    ] = await Promise.all([
      supabase.from('orders').select('total_usd, order_number, status, created_at, id')
        .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('orders').select('total_usd')
        .eq('tenant_id', tenant.id).gte('created_at', today),
      supabase.from('orders').select('total_usd')
        .eq('tenant_id', tenant.id).gte('created_at', firstDayOfMonth).eq('status', 'completed'),
      supabase.from('expenses').select('amount_usd')
        .eq('tenant_id', tenant.id).gte('expense_date', firstDayOfMonth),
      supabase.from('products').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).lt('stock', 5).eq('is_active', true),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('payment_condition', 'credit_7d').eq('status', 'credit'),
      supabase.from('cash_closings').select('id')
        .eq('tenant_id', tenant.id).eq('closing_date', today).eq('status', 'closed').maybeSingle(),
    ])

    const totalToday = (ordersTodayData ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0)
    const totalMonthSales = (ordersMonthData ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0)
    const totalMonthExp = (expensesMonthData ?? []).reduce((s, e) => s + (e.amount_usd ?? 0), 0)

    setSalesToday(totalToday)
    setSalesMonth(totalMonthSales)
    setExpensesMonth(totalMonthExp)
    setLowStock(lsCount ?? 0)
    setPendingCredits(creditCount ?? 0)
    setCashClosed(!!closing)
    setRecentOrders((ordersRecent ?? []) as typeof recentOrders)
  }, [tenant])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function confirmDeleteOrder() {
    if (!orderToDelete) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderToDelete.id,
          admin_key: adminKey.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar la orden.')
      }

      setOrderToDelete(null)
      setAdminKey('')
      setDeleteSuccessMsg(data.message || 'Venta anulada y eliminada con éxito.')
      setTimeout(() => setDeleteSuccessMsg(null), 5000)
      loadData()
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Error al anular la venta.')
    } finally {
      setDeleting(false)
    }
  }

  const statusLabel: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900' },
    pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900' },
    credit: { label: 'Crédito (7d)', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900' },
    cancelled: { label: 'Anulada', cls: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">Resumen del día — {tenant?.name}</p>
      </div>

      {deleteSuccessMsg && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm font-semibold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{deleteSuccessMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ventas de Hoy" subtitle="Monto total del día"
          value={`$${salesToday.toFixed(2)}`}
          sub={`Bs. ${(salesToday * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp} color="bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
        />
        <StatCard
          title="Stock Bajo" subtitle="Menos de 5 unidades"
          value={String(lowStock)}
          icon={AlertTriangle}
          color={lowStock > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'}
        />
        <StatCard
          title="Créditos Activos" subtitle="Cuentas por cobrar"
          value={String(pendingCredits)}
          icon={Clock} color="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
        />
        <StatCard
          title="Tasa del Día (BCV)" subtitle="Oficial"
          value={`Bs. ${exchangeRate.toFixed(2)}`}
          icon={DollarSign} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
        />
      </div>

      {/* Cierre de Caja Widget */}
      <Link
        href="/admin/cash-closing"
        className={`glass-card p-5 border transition-all flex items-center justify-between gap-4 block ${
          cashClosed
            ? 'border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
            : 'border-amber-300/80 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:border-amber-400'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            cashClosed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
          }`}>
            <Vault className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-75">Estado de Caja de Hoy</p>
            <p className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              {cashClosed ? '✓ Caja Cerrada Exitosamente' : '⏳ Caja Abierta — Pendiente por Cerrar al Final del Día'}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold opacity-60">Ver detalle →</span>
      </Link>

      {/* Recent orders */}
      <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Últimas Órdenes Registradas</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mostrando hasta 10 ventas recientes</span>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 font-medium">No hay órdenes registradas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Nro. Orden</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total USD</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total VES</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Estado</th>
                  <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentOrders.map((o) => {
                  const s = statusLabel[o.status] ?? { label: o.status, cls: '' }
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">{o.order_number}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">${o.total_usd.toFixed(2)}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">Bs. {(o.total_usd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => { setOrderToDelete(o); setAdminKey(''); setDeleteError(null) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition"
                          title="Anular venta por error"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Seguridad para Eliminar Venta */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => !deleting && setOrderToDelete(null)}
          />
          <div className="relative z-10 max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Anular y Eliminar Venta</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Orden: <strong className="font-mono text-slate-800 dark:text-slate-200">{orderToDelete.order_number}</strong> (${orderToDelete.total_usd.toFixed(2)} USD)
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">⚠️ Seguridad & Reversión Automática:</p>
              <p>• Los artículos de esta orden volverán a sumarse al inventario de productos.</p>
              <p>• Si fue una venta a crédito, se descontará de la deuda del cliente.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Clave de Seguridad Administrador
              </label>
              <input
                type="password"
                autoFocus
                placeholder="Ingresa clave admin…"
                value={adminKey}
                onChange={(e) => { setAdminKey(e.target.value); setDeleteError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && adminKey && confirmDeleteOrder()}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 font-semibold">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setOrderToDelete(null); setAdminKey(''); setDeleteError(null) }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting || !adminKey}
                onClick={confirmDeleteOrder}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
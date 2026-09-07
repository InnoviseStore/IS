'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { TrendingUp, AlertTriangle, Clock, DollarSign, Vault, PieChart, Wallet } from 'lucide-react'

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

  useEffect(() => {
    if (!tenant) return
    async function load() {
      const supabase = createClient()
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

      const [
        { data: ordersToday },
        { data: ordersMonthData },
        { data: expensesMonthData },
        { count: lsCount },
        { count: creditCount },
        { data: closing }
      ] = await Promise.all([
        supabase.from('orders').select('total_usd, order_number, status, created_at, id')
          .eq('tenant_id', tenant!.id).gte('created_at', today).limit(5),
        supabase.from('orders').select('total_usd')
          .eq('tenant_id', tenant!.id).gte('created_at', firstDayOfMonth).eq('status', 'completed'),
        supabase.from('expenses').select('amount_usd')
          .eq('tenant_id', tenant!.id).gte('expense_date', firstDayOfMonth),
        supabase.from('products').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id).lt('stock', 5).eq('is_active', true),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id).eq('payment_condition', 'credit_7d').eq('status', 'pending'),
        supabase.from('cash_closings').select('id')
          .eq('tenant_id', tenant!.id).eq('closing_date', today).eq('status', 'closed').maybeSingle(),
      ])

      const totalToday = (ordersToday ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0)
      const totalMonthSales = (ordersMonthData ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0)
      const totalMonthExp = (expensesMonthData ?? []).reduce((s, e) => s + (e.amount_usd ?? 0), 0)

      setSalesToday(totalToday)
      setSalesMonth(totalMonthSales)
      setExpensesMonth(totalMonthExp)
      setLowStock(lsCount ?? 0)
      setPendingCredits(creditCount ?? 0)
      setCashClosed(!!closing)
      setRecentOrders((ordersToday ?? []).slice(0, 5) as typeof recentOrders)
    }
    load()
  }, [tenant])

  const statusLabel: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900' },
    pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900' },
    credit: { label: 'Crédito', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900' },
    cancelled: { label: 'Anulada', cls: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">Resumen del día — {tenant?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ventas de Hoy" subtitle="Monto total del día"
          value={`$${salesToday.toFixed(2)}`}
          sub={`Bs. ${(salesToday * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp} color="bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
        />
        <StatCard
          title="Utilidad Neta (Mes)" subtitle="Ventas - Gastos"
          value={`$${(salesMonth - expensesMonth).toFixed(2)}`}
          sub={`Ingresos $${salesMonth.toFixed(0)} | Gastos $${expensesMonth.toFixed(0)}`}
          icon={PieChart} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
        />
        <StatCard
          title="Gastos del Mes" subtitle="Egresos operativos"
          value={`$${expensesMonth.toFixed(2)}`}
          sub={`Bs. ${(expensesMonth * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
          icon={Wallet} color="bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
        />
        <StatCard
          title="Stock Bajo" subtitle="Productos < 5 unidades"
          value={String(lowStock)}
          sub={lowStock > 0 ? 'Requieren reposición' : 'Inventario saludable'}
          icon={AlertTriangle} color="bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
        />
      </div>

      {/* Cash closing status banner */}
      <Link
        href="/admin/cash-closing"
        className={`flex items-center justify-between px-5 py-4 rounded-2xl border font-medium text-sm transition-all duration-200 hover:brightness-105 ${
          cashClosed === null
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            : cashClosed
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <Vault className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold">
              Cierre de Caja —{' '}
              {cashClosed === null ? 'Verificando…' : cashClosed ? '✅ Caja CERRADA' : '⚠️ Caja ABIERTA'}
            </p>
            <p className="text-xs font-medium opacity-75">
              {cashClosed ? 'El cierre del día ya fue registrado.' : 'Recuerda cerrar la caja al finalizar el día.'}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold opacity-60">Ver detalle →</span>
      </Link>

      {/* Recent orders */}
      <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80">
        <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Últimas Órdenes</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 font-medium">No hay órdenes hoy aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Nro. Orden</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total USD</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total VES</th>
                  <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Estado</th>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
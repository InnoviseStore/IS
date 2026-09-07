'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Expense } from '@/types/database'
import { ExpenseModal } from '@/components/admin/ExpenseModal'
import { Plus, Search, Filter, Trash2, Edit2, Loader2, ArrowUpRight, ReceiptText } from 'lucide-react'

export default function ExpensesPage() {
  const { tenant, exchangeRate } = useTenant()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  const loadExpenses = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('expense_date', { ascending: false })

    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [tenant])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  async function handleDelete(id: string) {
    if (!confirm('¿Deseas eliminar este registro de gasto?')) return
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  // Métricas calculadas
  const totalUsd = expenses.reduce((s, e) => s + e.amount_usd, 0)
  const totalVes = expenses.reduce((s, e) => s + e.amount_ves, 0)
  const recurringCount = expenses.filter((e) => e.is_recurring).length

  // Filtros
  const filtered = expenses.filter((e) => {
    const matchSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.supplier_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || e.category === categoryFilter
    return matchSearch && matchCategory
  })

  const categories = Array.from(new Set(expenses.map((e) => e.category)))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Gastos Operativos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Control de egresos, pagos fijos y preservación de margen neto
          </p>
        </div>

        <button
          onClick={() => { setSelectedExpense(null); setIsModalOpen(true) }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Gasto
        </button>
      </div>

      {/* Tarjetas de Resumen Minimalistas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Gastos (USD)</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{expenses.length} registros en total</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Gastos (VES)</p>
          <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Tasa BCV del día: Bs. {exchangeRate.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gastos Recurrentes</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{recurringCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Nómina, alquileres y servicios</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por concepto o proveedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Gastos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando gastos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <ReceiptText className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold">No hay gastos registrados que coincidan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Concepto</th>
                  <th className="py-2.5 px-4">Categoría</th>
                  <th className="py-2.5 px-4">Método</th>
                  <th className="py-2.5 px-4 text-right">Monto (USD)</th>
                  <th className="py-2.5 px-4 text-right">Monto (VES)</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {item.expense_date}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-semibold">
                      <div>{item.description}</div>
                      {item.supplier_name && (
                        <div className="text-[10px] text-slate-400 font-normal">Prov: {item.supplier_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        {item.category}
                      </span>
                      {item.is_recurring && (
                        <span className="ml-1 text-[10px] text-indigo-500 font-bold">↻ Recurrente</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 capitalize">
                      {item.payment_method.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      ${item.amount_usd.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      Bs. {item.amount_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {item.receipt_url && (
                          <a
                            href={item.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Ver comprobante"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => { setSelectedExpense(item); setIsModalOpen(true) }}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-500 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ExpenseModal
        isOpen={isModalOpen}
        expense={selectedExpense}
        onClose={() => { setIsModalOpen(false); setSelectedExpense(null) }}
        onSuccess={loadExpenses}
      />
    </div>
  )
}

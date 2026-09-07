'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Customer } from '@/types/database'
import { Search, Users, MessageCircle } from 'lucide-react'

export default function CustomersPage() {
  const { tenant } = useTenant()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('full_name')
    setCustomers(data ?? [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search) ||
      (c.id_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">{customers.length} clientes registrados</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o cédula/RIF…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
        />
      </div>

      <div className="glass-card overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">Cargando clientes…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No se encontraron clientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Nombre</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Cédula / RIF</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Teléfono</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Límite Crédito</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Deuda Actual</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Disponible</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Cobranza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => {
                  const available = c.credit_limit_usd - c.current_debt_usd
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{c.full_name}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{c.id_number ?? '—'}</td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-xs font-medium">{c.phone ?? '—'}</td>
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">${c.credit_limit_usd.toFixed(2)}</td>
                      <td className="px-4 py-3.5 font-extrabold text-amber-600 dark:text-amber-400">${c.current_debt_usd.toFixed(2)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`font-extrabold ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          ${available.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {c.current_debt_usd > 0 && c.phone ? (
                          <button
                            onClick={() => {
                              const cleanPhone = c.phone!.replace(/[^0-9]/g, '')
                              const msg = `Hola ${c.full_name}, te escribimos de *${tenant?.name ?? 'Innovise Store'}* para recordarte que tienes un saldo pendiente a crédito por *$${c.current_debt_usd.toFixed(2)} USD*. Agradecemos tu pronta confirmación para conciliar tu cuenta.`
                              window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 transition"
                            title="Enviar recordatorio de cobro por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Cobrar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Al día</span>
                        )}
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
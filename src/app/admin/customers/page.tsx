'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Customer } from '@/types/database'
import Link from 'next/link'
import {
  Search,
  Users,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { CustomerModal } from '@/components/admin/CustomerModal'
import { CreditCollectionModal } from '@/components/admin/CreditCollectionModal'
import { CustomerCredentialsModal } from '@/components/admin/CustomerCredentialsModal'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { parseCustomerAuth } from '@/lib/customerUtils'

type FilterTab = 'all' | 'with_account' | 'without_account' | 'with_debt'

export default function CustomersPage() {
  const { tenant } = useTenant()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [credentialsCustomer, setCredentialsCustomer] = useState<Customer | null>(null)
  const [collectionCustomer, setCollectionCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .neq('is_active', false)
      .order('full_name')
    setCustomers(data ?? [])
    setLoading(false)
  }, [tenant])

  async function handleDeleteCustomer() {
    if (!tenant || !customerToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/customers?id=${customerToDelete.id}&tenant_id=${tenant.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error al eliminar cliente')
      }
      setCustomerToDelete(null)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar el cliente')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => { load() }, [load])

  // Contadores para pestañas
  const counts = useMemo(() => {
    let withAccount = 0
    let withoutAccount = 0
    let withDebt = 0

    customers.forEach((c) => {
      const auth = parseCustomerAuth(c.notes)
      if (auth.hasAccount) withAccount++
      else withoutAccount++

      if (c.current_debt_usd > 0) withDebt++
    })

    return {
      all: customers.length,
      withAccount,
      withoutAccount,
      withDebt,
    }
  }, [customers])

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const auth = parseCustomerAuth(c.notes)

      // Filtro de pestaña
      if (activeTab === 'with_account' && !auth.hasAccount) return false
      if (activeTab === 'without_account' && auth.hasAccount) return false
      if (activeTab === 'with_debt' && c.current_debt_usd <= 0) return false

      // Búsqueda textual
      const q = search.toLowerCase()
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.id_number ?? '').toLowerCase().includes(q)
      )
    })
  }, [customers, activeTab, search])

  function openCreate() {
    setEditingCustomer(null)
    setModalOpen(true)
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c)
    setModalOpen(true)
  }

  function openCredentials(c: Customer) {
    setCredentialsCustomer(c)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
            {customers.length} clientes registrados en la tienda
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Cliente</span>
        </button>
      </div>

      {/* Barra de Búsqueda y Pestañas de Filtrado */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, correo o cédula/RIF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
          />
        </div>

        {/* Pestañas de Acceso Web */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Todos ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('with_account')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'with_account'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Con Cuenta Web ({counts.withAccount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('without_account')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'without_account'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sin Cuenta Web ({counts.withoutAccount})</span>
          </button>

          {counts.withDebt > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('with_debt')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'with_debt'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white/80 dark:bg-slate-800/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <span>Con Deuda Activa ({counts.withDebt})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="glass-card overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
            Cargando clientes…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No se encontraron clientes con el filtro seleccionado
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Nombre / Cliente
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cédula / RIF
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Teléfono & Correo
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Acceso Web
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Límite Crédito
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Deuda Actual
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => {
                  const available = c.credit_limit_usd - c.current_debt_usd
                  const authInfo = parseCustomerAuth(c.notes)

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{c.full_name}</div>
                        {c.address && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">
                            {c.address}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                        {c.id_number ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-xs">
                        <div className="font-medium">{c.phone ?? '—'}</div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                            {c.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {authInfo.hasAccount ? (
                          <button
                            type="button"
                            onClick={() => openCredentials(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                            title="Gestionar contraseña o reenviar por WhatsApp"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Activa</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCredentials(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition cursor-pointer"
                            title="Asignar contraseña y notificar por WhatsApp"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                            <span>Crear Clave</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">
                        ${c.credit_limit_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 font-extrabold text-amber-600 dark:text-amber-400">
                        ${c.current_debt_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón rápido de credenciales */}
                          <button
                            onClick={() => openCredentials(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                            title={authInfo.hasAccount ? 'Modificar clave / Reenviar WhatsApp' : 'Crear acceso web y notificar WhatsApp'}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar datos del cliente"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setCustomerToDelete(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Eliminar cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {c.current_debt_usd > 0 ? (
                            <div className="flex items-center gap-1.5 ml-1">
                              <button
                                onClick={() => setCollectionCustomer(c)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                                title="Gestionar cobro detallado por WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Cobrar
                              </button>
                              <Link
                                href={`/admin/orders?status=credit`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
                                title="Ver facturas y registrar abonos"
                              >
                                Abonar
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Crear / Editar Cliente */}
      {modalOpen && tenant && (
        <CustomerModal
          tenantId={tenant.id}
          customer={editingCustomer}
          onClose={() => {
            setModalOpen(false)
            setEditingCustomer(null)
          }}
          onSaved={() => {
            load()
          }}
        />
      )}

      {/* Modal de Credenciales Web y Notificación por WhatsApp */}
      {credentialsCustomer && tenant && (
        <CustomerCredentialsModal
          customer={credentialsCustomer}
          tenant={tenant}
          onClose={() => setCredentialsCustomer(null)}
          onSuccess={() => {
            load()
          }}
        />
      )}

      {/* Modal de Cobro de Crédito */}
      {collectionCustomer && (
        <CreditCollectionModal
          customer={collectionCustomer}
          onClose={() => setCollectionCustomer(null)}
        />
      )}

      {/* Modal de Confirmación para Eliminar Cliente */}
      <ConfirmModal
        isOpen={Boolean(customerToDelete)}
        title="¿Eliminar cliente?"
        message={`¿Estás seguro de que deseas eliminar al cliente "${customerToDelete?.full_name}"?`}
        warningText={
          customerToDelete?.current_debt_usd && customerToDelete.current_debt_usd > 0
            ? `Atención: Este cliente registra una deuda pendiente de $${customerToDelete.current_debt_usd.toFixed(2)} USD. Si lo eliminas, perderás el seguimiento activo de su cobro.`
            : null
        }
        confirmText="Sí, eliminar cliente"
        cancelText="Cancelar"
        isDestructive={true}
        isLoading={deleting}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  )
}

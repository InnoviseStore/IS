'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Tenant, Profile } from '@/types/database'
import { createPortal } from 'react-dom'
import { CreateTenantModal } from '@/components/admin/CreateTenantModal'
import { EditTenantBrandingModal } from '@/components/admin/EditTenantBrandingModal'
import {
  Crown,
  Store,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  KeyRound,
  Loader2,
  ArrowRight,
  Palette,
  Tag,
  Check
} from 'lucide-react'
import { formatDate, formatDateTime, getPlanLabel } from '@/lib/formatters'

export default function SuperAdminMasterPage() {
  const { profile, switchTenant, tenant: activeTenant } = useTenant()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Branding edit modal state
  const [selectedTenantForBranding, setSelectedTenantForBranding] = useState<Tenant | null>(null)
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset password modal state
  const [resetModalUser, setResetModalUser] = useState<Profile | null>(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Plan change modal state
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<Tenant | null>(null)
  const [selectedPlanValue, setSelectedPlanValue] = useState<'basic' | 'pro' | 'enterprise'>('pro')
  const [planLoading, setPlanLoading] = useState(false)
  const [planSuccess, setPlanSuccess] = useState(false)

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTenantForPlan) return
    setPlanLoading(true)

    try {
      const res = await fetch('/api/admin/tenants/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenantForPlan.id,
          plan: selectedPlanValue,
        }),
      })

      if (res.ok) {
        setPlanSuccess(true)
        setTenants((prev) =>
          prev.map((t) => {
            if (t.id !== selectedTenantForPlan.id) return t
            const prevSettings = (t.settings || {}) as Record<string, unknown>
            return {
              ...t,
              settings: { ...prevSettings, plan: selectedPlanValue },
            }
          })
        )
        if (activeTenant?.id === selectedTenantForPlan.id) {
          switchTenant({
            ...selectedTenantForPlan,
            settings: {
              ...((selectedTenantForPlan.settings || {}) as Record<string, unknown>),
              plan: selectedPlanValue,
            },
          })
        }
        setTimeout(() => {
          setPlanSuccess(false)
          setSelectedTenantForPlan(null)
          loadData()
        }, 1200)
      } else {
        const data = await res.json()
        alert(data.error || 'Error al actualizar el plan')
      }
    } catch (err) {
      alert('Error de conexión al actualizar el plan')
    } finally {
      setPlanLoading(false)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Intentar cargar desde la API del servidor (usa Service Role y no se bloquea por RLS)
      const res = await fetch('/api/admin/master')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.tenants)) {
          setTenants(data.tenants)
        }
        if (Array.isArray(data.profiles)) {
          setProfiles(data.profiles)
        }
      } else {
        // Fallback a cliente Supabase si la ruta falla
        const supabase = createClient()
        const [{ data: tenantsData }, { data: profilesData }] = await Promise.all([
          supabase.from('tenants').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*'),
        ])
        if (tenantsData) setTenants(tenantsData as Tenant[])
        if (profilesData) setProfiles(profilesData as Profile[])
      }
    } catch (err) {
      console.error('Error al cargar datos master:', err)
      // Fallback de emergencia
      try {
        const supabase = createClient()
        const { data: tenantsData } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
        if (tenantsData) setTenants(tenantsData as Tenant[])
      } catch (fallbackErr) {
        console.error('Error en fallback de tenants:', fallbackErr)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleToggleStatus(tenantId: string, currentStatus: boolean) {
    const next = !currentStatus
    const res = await fetch('/api/admin/tenants/toggle-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, isActive: next }),
    })
    if (res.ok) {
      setTenants((prev) =>
        prev.map((t) => {
          if (t.id !== tenantId) return t
          const prevSettings = (t.settings || {}) as Record<string, unknown>
          return {
            ...t,
            settings: { ...prevSettings, is_active: next },
          }
        })
      )
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetModalUser || newPasswordInput.length < 6) return
    setResetLoading(true)

    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: resetModalUser.id,
        newPassword: newPasswordInput,
      }),
    })

    if (res.ok) {
      setResetSuccess(true)
      setTimeout(() => {
        setResetSuccess(false)
        setResetModalUser(null)
        setNewPasswordInput('')
      }, 1500)
    }
    setResetLoading(false)
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-page-enter">
      {/* Header Superadmin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border border-amber-200/60 dark:border-amber-900/40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Panel Master Multi-Tienda
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white">
                SaaS Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
              Administración global de comercios clientes, credenciales y permisos
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Crear Nueva Tienda
        </button>
      </div>

      {/* Barra de Búsqueda y Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Comercios Registrados</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{tenants.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {tenants.filter((t) => {
              const s = (t.settings || {}) as Record<string, unknown>
              return s.is_active !== false && (t as unknown as { is_active?: boolean }).is_active !== false
            }).length} tiendas activas
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Usuarios Totales (Dueños/Cajeros)</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{profiles.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cuentas vinculadas a Supabase Auth</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tu Tienda Principal</p>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">Innovise Store</span>
            </div>
            <a
              href="/innovise"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Ver vitrina <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <button
            onClick={() => {
              const innoviseTenant = tenants.find((t) => t.slug === 'innovise') || tenants[0]
              if (innoviseTenant) {
                setSelectedTenantForBranding(innoviseTenant)
                setIsBrandingModalOpen(true)
              }
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            Editar Logos & Colores 🎨
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar comercio por nombre o slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 shadow-xs"
        />
      </div>

      {/* Tabla de Tiendas */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando directorio de tiendas...
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <Store className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold">No se encontraron tiendas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Comercio</th>
                  <th className="py-3 px-4">Slug / Vitrina</th>
                  <th className="py-3 px-4">Dueño & Usuarios</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredTenants.map((t) => {
                  const tenantUsers = profiles.filter((p) => p.tenant_id === t.id)
                  const owner = tenantUsers.find((p) => p.role === 'owner') || tenantUsers[0]
                  const tenantSettings = (t.settings || {}) as Record<string, unknown>
                  const isActive = tenantSettings.is_active !== false && (t as unknown as { is_active?: boolean }).is_active !== false
                  const tenantPlan = (tenantSettings.plan as string) || (t as unknown as { plan?: string }).plan || 'pro'

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTenantForPlan(t)
                              setSelectedPlanValue(((tenantSettings.plan as any) || (t as any).plan || 'pro'))
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                            title="Click para cambiar el plan SaaS de esta tienda"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {getPlanLabel(tenantPlan)}
                            <span className="text-[9px] text-blue-500 dark:text-blue-400 font-semibold underline ml-0.5">
                              Cambiar
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-400">
                            · {formatDate(t.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={`/${t.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          /{t.slug}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        {owner ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {owner.email}
                              <button
                                onClick={() => setResetModalUser(owner)}
                                className="p-0.5 rounded text-slate-400 hover:text-indigo-600 transition"
                                title="Cambiar contraseña de este usuario"
                              >
                                <KeyRound className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {tenantUsers.length} usuario{tenantUsers.length !== 1 ? 's' : ''} registrado(s)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin dueño asignado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {t.phone_whatsapp ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(t.id, isActive)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                          title="Click para alternar estado"
                        >
                          {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isActive ? 'Activo' : 'Suspendido'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Cambiar Plan SaaS */}
                          <button
                            onClick={() => {
                              setSelectedTenantForPlan(t)
                              setSelectedPlanValue(((tenantSettings.plan as any) || (t as any).plan || 'pro'))
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                            title="Cambiar plan de suscripción de esta tienda"
                          >
                            <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Plan
                          </button>

                          {/* Editar Marca, Logos & Colores */}
                          <button
                            onClick={() => {
                              setSelectedTenantForBranding(t)
                              setIsBrandingModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                            title="Editar logotipos, colores y datos de esta vitrina"
                          >
                            <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            Editar Marca
                          </button>

                          {/* Cambiar de tienda activa en 1 clic */}
                          <button
                            onClick={() => {
                              switchTenant(t)
                              alert(`Has cambiado a la tienda "${t.name}". Ahora el POS e Inventario mostrarán sus datos.`)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                            title="Inspeccionar esta tienda en el panel administrativo"
                          >
                            Entrar a Tienda <ArrowRight className="w-3 h-3" />
                          </button>
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

      {/* Modal para Crear Nueva Tienda */}
      <CreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Modal para Editar Marca (Logos, Colores, Redes) */}
      <EditTenantBrandingModal
        isOpen={isBrandingModalOpen}
        onClose={() => setIsBrandingModalOpen(false)}
        tenant={selectedTenantForBranding}
        onSuccess={loadData}
      />

      {/* Modal para Resetear Contraseña (usando Portal) */}
      {resetModalUser && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setResetModalUser(null)} />
          <div 
            style={{ width: '100%', maxWidth: '440px' }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 transition-all text-xs font-medium space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cambiar Contraseña</h2>
              <button 
                type="button"
                onClick={() => setResetModalUser(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resetSuccess ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-900 dark:text-white">¡Contraseña actualizada!</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <p className="text-slate-500">
                  Asignar nueva contraseña para <span className="font-bold text-slate-800 dark:text-slate-200">{resetModalUser.email}</span>:
                </p>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || newPasswordInput.length < 6}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {resetLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Cambiar Plan SaaS (Portal) */}
      {selectedTenantForPlan && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !planLoading && setSelectedTenantForPlan(null)} />
          <div 
            style={{ width: '100%', maxWidth: '560px' }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 transition-all text-xs font-medium space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Cambiar Plan SaaS
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Tienda: <strong className="text-slate-800 dark:text-slate-200">{selectedTenantForPlan.name}</strong> ({selectedTenantForPlan.slug})
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => !planLoading && setSelectedTenantForPlan(null)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {planSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="font-extrabold text-base text-slate-900 dark:text-white">¡Plan actualizado con éxito!</p>
                <p className="text-xs text-slate-500">
                  La tienda <strong className="text-slate-700 dark:text-slate-300">{selectedTenantForPlan.name}</strong> ahora cuenta con el {getPlanLabel(selectedPlanValue)}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSavePlan} className="space-y-4">
                <p className="text-slate-600 dark:text-slate-300 text-xs">
                  Selecciona el nuevo nivel de plan. Los límites, módulos y funciones se actualizarán al instante:
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Básico */}
                  <label
                    onClick={() => setSelectedPlanValue('basic')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition ${
                      selectedPlanValue === 'basic'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="planChoice"
                      value="basic"
                      checked={selectedPlanValue === 'basic'}
                      onChange={() => setSelectedPlanValue('basic')}
                      className="mt-1 text-emerald-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          🟢 Plan Básico <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">Emprendedor</span>
                        </span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$15 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        1 Sucursal POS · Catálogo WhatsApp · Hasta 150 productos · Soporte Estándar.
                      </p>
                    </div>
                  </label>

                  {/* Pro */}
                  <label
                    onClick={() => setSelectedPlanValue('pro')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition relative overflow-hidden ${
                      selectedPlanValue === 'pro'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg">
                      Recomendado
                    </div>
                    <input
                      type="radio"
                      name="planChoice"
                      value="pro"
                      checked={selectedPlanValue === 'pro'}
                      onChange={() => setSelectedPlanValue('pro')}
                      className="mt-1 text-blue-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          🔵 Plan Pro <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Comercio Activo</span>
                        </span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$35 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Multimoneda BCV en Vivo · Pagos Divididos (Zelle, Pago Móvil, Efectivo) · Créditos con WhatsApp · IA Edith · Productos Ilimitados.
                      </p>
                    </div>
                  </label>

                  {/* Enterprise */}
                  <label
                    onClick={() => setSelectedPlanValue('enterprise')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition ${
                      selectedPlanValue === 'enterprise'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="planChoice"
                      value="enterprise"
                      checked={selectedPlanValue === 'enterprise'}
                      onChange={() => setSelectedPlanValue('enterprise')}
                      className="mt-1 text-purple-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          🟣 Plan Enterprise <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">Cadenas & Franquicias</span>
                        </span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$79 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Todo de Pro + Cajas y Sucursales Ilimitadas · Dominio Propio · API & Webhooks · Reportes Financieros Avanzados · Soporte VIP 24/7.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Plan actual: <strong className="text-slate-700 dark:text-slate-300">{getPlanLabel(((selectedTenantForPlan.settings as any)?.plan || (selectedTenantForPlan as any).plan || 'pro'))}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={planLoading}
                      onClick={() => setSelectedTenantForPlan(null)}
                      className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={planLoading}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {planLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Guardar Plan</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

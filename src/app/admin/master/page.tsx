'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Tenant, Profile, BcvRateHistoryItem } from '@/types/database'
import { createPortal } from 'react-dom'
import { CreateTenantModal } from '@/components/admin/CreateTenantModal'
import { EditTenantBrandingModal } from '@/components/admin/EditTenantBrandingModal'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  Check,
  Settings,
  SlidersHorizontal,
  Building2,
  Mail,
  DollarSign,
  Calendar,
  RefreshCw,
  Trash2,
  Edit2,
  AlertCircle,
  Coins,
  FileSpreadsheet,
} from 'lucide-react'
import { formatDate, formatDateTime, getPlanLabel } from '@/lib/formatters'

export default function SuperAdminMasterPage() {
  const {
    profile,
    switchTenant,
    tenant: activeTenant,
    syncBcvRate,
    saveHistoryRate,
    deleteHistoryRate,
    updateStoreCurrency,
    bcvRatesHistory,
    bcvFechaValor,
    exchangeRate,
    bcvRateEur,
  } = useTenant()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [rateSearch, setRateSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'tenants' | 'bcv_history' | 'users'>('tenants')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Branding edit modal state
  const [selectedTenantForBranding, setSelectedTenantForBranding] = useState<Tenant | null>(null)
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [liveActiveUsers, setLiveActiveUsers] = useState<any[]>([])

  // Edit user email modal state
  const [editEmailUser, setEditEmailUser] = useState<Profile | null>(null)
  const [editEmailInput, setEditEmailInput] = useState('')
  const [editEmailLoading, setEditEmailLoading] = useState(false)
  const [editEmailSuccess, setEditEmailSuccess] = useState(false)

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

  // Store Currency ($ USD / € EUR & Custom Rate) Modal State
  const [selectedTenantForCurrency, setSelectedTenantForCurrency] = useState<Tenant | null>(null)
  const [selectedCurrencyType, setSelectedCurrencyType] = useState<'USD' | 'EUR'>('USD')
  const [selectedRateMode, setSelectedRateMode] = useState<'official' | 'custom'>('official')
  const [customRateInput, setCustomRateInput] = useState<string>('')
  const [currencyModalLoading, setCurrencyModalLoading] = useState(false)
  const [currencyModalSuccess, setCurrencyModalSuccess] = useState(false)

  // Add / Edit BCV Historical Rate Modal State
  const [isHistoryRateModalOpen, setIsHistoryRateModalOpen] = useState(false)
  const [editingHistoryRate, setEditingHistoryRate] = useState<BcvRateHistoryItem | null>(null)
  const [historyDateInput, setHistoryDateInput] = useState('')
  const [historyFechaValorInput, setHistoryFechaValorInput] = useState('')
  const [historyRateUsdInput, setHistoryRateUsdInput] = useState('')
  const [historyRateEurInput, setHistoryRateEurInput] = useState('')
  const [historySaving, setHistorySaving] = useState(false)
  const [historySyncLoading, setHistorySyncLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch('/api/admin/presence?all=true')
        const data = await res.json()
        if (data.success) {
          setLiveActiveUsers(data.users || [])
        }
      } catch {}
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
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

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!editEmailUser || !editEmailInput.includes('@')) return
    setEditEmailLoading(true)

    try {
      const res = await fetch('/api/admin/users/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editEmailUser.id,
          newEmail: editEmailInput.trim().toLowerCase(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setEditEmailSuccess(true)
        setProfiles((prev) =>
          prev.map((p) => (p.id === editEmailUser.id ? { ...p, email: data.email } : p))
        )
        setTimeout(() => {
          setEditEmailSuccess(false)
          setEditEmailUser(null)
          setEditEmailInput('')
          loadData()
        }, 1200)
      } else {
        alert(data.error || 'Error al actualizar el correo')
      }
    } catch (err: any) {
      alert('Error de conexión al actualizar correo: ' + err.message)
    } finally {
      setEditEmailLoading(false)
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
        setTimeout(() => {
          setPlanSuccess(false)
          setSelectedTenantForPlan(null)
          loadData()
        }, 1200)
      } else {
        const data = await res.json()
        alert(data.error || 'Error al actualizar el plan')
      }
    } catch {
      alert('Error de conexión al actualizar el plan')
    } finally {
      setPlanLoading(false)
    }
  }

  async function handleSaveStoreCurrency(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTenantForCurrency) return
    setCurrencyModalLoading(true)

    try {
      const parsedCustom = selectedRateMode === 'custom' ? parseFloat(customRateInput) : undefined
      const res = await updateStoreCurrency({
        tenantId: selectedTenantForCurrency.id,
        currency_type: selectedCurrencyType,
        rate_mode: selectedRateMode,
        custom_rate: parsedCustom,
      })

      if (res.success) {
        setCurrencyModalSuccess(true)
        await loadData()
        setTimeout(() => {
          setCurrencyModalSuccess(false)
          setSelectedTenantForCurrency(null)
        }, 1200)
      } else {
        alert(res.error || 'Error al guardar configuración de moneda')
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setCurrencyModalLoading(false)
    }
  }

  async function handleSyncBcvLive() {
    setHistorySyncLoading(true)
    try {
      const res = await syncBcvRate(activeTenant?.id)
      if (res.error) {
        alert(res.error)
      } else {
        await loadData()
      }
    } catch (err: any) {
      alert('Error al sincronizar con BCV: ' + err.message)
    } finally {
      setHistorySyncLoading(false)
    }
  }

  async function handleSaveHistoryEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!historyDateInput || !historyRateUsdInput) return
    setHistorySaving(true)

    try {
      const res = await saveHistoryRate({
        date: historyDateInput.trim(),
        rate_usd: parseFloat(historyRateUsdInput),
        rate_eur: historyRateEurInput.trim() ? parseFloat(historyRateEurInput) : undefined,
        fecha_valor: historyFechaValorInput.trim() || historyDateInput.trim(),
        label: historyFechaValorInput.trim() || historyDateInput.trim(),
        tenant_id: activeTenant?.id,
      })

      if (res.success) {
        setIsHistoryRateModalOpen(false)
        setEditingHistoryRate(null)
        setHistoryDateInput('')
        setHistoryFechaValorInput('')
        setHistoryRateUsdInput('')
        setHistoryRateEurInput('')
        await loadData()
      } else {
        alert(res.error || 'Error al guardar tasa histórica')
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setHistorySaving(false)
    }
  }

  async function handleDeleteHistoryEntry(date: string) {
    if (!confirm(`¿Eliminar la tasa registrada para la fecha ${date}?`)) return
    const res = await deleteHistoryRate(date, activeTenant?.id)
    if (res.success) {
      await loadData()
    } else {
      alert(res.error || 'Error al eliminar tasa')
    }
  }

  // Filtrado de tiendas
  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  )

  // Filtrado de usuarios
  const filteredProfiles = profiles.filter((p) => {
    const q = userSearch.toLowerCase()
    return (
      (p.full_name && p.full_name.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.role && p.role.toLowerCase().includes(q))
    )
  })

  // Obtener lista completa de tasas históricas
  const allHistoricalRates: BcvRateHistoryItem[] = (() => {
    const fromActive = Array.isArray(bcvRatesHistory) ? bcvRatesHistory : []
    const tenantSettings = (activeTenant?.settings || {}) as Record<string, unknown>
    const fromTenant = Array.isArray(tenantSettings.bcv_rates_history)
      ? (tenantSettings.bcv_rates_history as BcvRateHistoryItem[])
      : []
    const combined = fromActive.length > 0 ? fromActive : fromTenant
    if (!rateSearch.trim()) return combined
    return combined.filter(
      (r) =>
        r.date.includes(rateSearch) ||
        (r.fecha_valor && r.fecha_valor.toLowerCase().includes(rateSearch.toLowerCase()))
    )
  })()

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
              Administración global de comercios clientes, credenciales, multimoneda e historial BCV
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95"
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Configuración General
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear Nueva Tienda
          </button>
        </div>
      </div>

      {/* Tabs Principales de Superadmin */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'tenants'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Comercios & Tiendas ({tenants.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bcv_history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'bcv_history'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Historial Tasas BCV & Multimoneda</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-slate-900 font-black">
            SuperAdmin
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Directorio de Usuarios ({profiles.length})</span>
        </button>
      </div>

      {/* TAB 1: COMERCIOS & TIENDAS */}
      {activeTab === 'tenants' && (
        <div className="space-y-6">
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cuentas Vinculadas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{profiles.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Usuarios Dueños, Admins y Cajeros</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Sesiones En Vivo</p>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{liveActiveUsers.length}</p>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                {liveActiveUsers.length === 1 ? '1 dispositivo en red' : `${liveActiveUsers.length} dispositivos en red`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tienda Activa en POS</p>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {activeTenant?.name || 'Innovise Store'}
                  </span>
                </div>
                <Link
                  href="/admin"
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Abrir &rarr;
                </Link>
              </div>

              <button
                onClick={() => {
                  const current = activeTenant || tenants[0]
                  if (current) {
                    setSelectedTenantForBranding(current)
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
                      <th className="py-3 px-4">Moneda & Tasa</th>
                      <th className="py-3 px-4">Slug / Vitrina</th>
                      <th className="py-3 px-4">Dueño Afiliado</th>
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
                      const curType = ((tenantSettings.currency_type as string) || 'USD').toUpperCase() === 'EUR' ? 'EUR' : 'USD'
                      const rateMode = ((tenantSettings.rate_mode as string) || 'official').toLowerCase() === 'custom' ? 'custom' : 'official'
                      const customRate = typeof tenantSettings.custom_rate === 'number' ? tenantSettings.custom_rate : null

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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {getPlanLabel(tenantPlan)}
                              </button>
                              <span className="text-[10px] text-slate-400">· {formatDate(t.created_at)}</span>
                            </div>
                          </td>

                          {/* Moneda & Tasa */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  curType === 'EUR'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {curType === 'EUR' ? '€ Euros' : '$ Dólares'}
                              </span>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {rateMode === 'custom' && customRate
                                  ? `Bs. ${customRate} (Manual)`
                                  : `Bs. ${t.currency_rate_bcv || 0} (BCV)`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenantForCurrency(t)
                                setSelectedCurrencyType(curType)
                                setSelectedRateMode(rateMode)
                                setCustomRateInput(customRate ? customRate.toString() : '')
                              }}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block font-bold cursor-pointer"
                            >
                              Configurar Moneda/Tasa &rarr;
                            </button>
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

                          {/* Dueño & Correo editable */}
                          <td className="py-3 px-4">
                            {owner ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <span>{owner.email}</span>
                                  {/* Botón Editar Correo */}
                                  <button
                                    onClick={() => {
                                      setEditEmailUser(owner)
                                      setEditEmailInput(owner.email || '')
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                    title="Modificar correo electrónico afiliado a esta cuenta"
                                  >
                                    <Mail className="w-3 h-3 text-blue-500" />
                                  </button>
                                  {/* Botón Cambiar Contraseña */}
                                  <button
                                    onClick={() => setResetModalUser(owner)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
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
                              {/* Configurar Moneda & Tasa */}
                              <button
                                onClick={() => {
                                  setSelectedTenantForCurrency(t)
                                  setSelectedCurrencyType(curType)
                                  setSelectedRateMode(rateMode)
                                  setCustomRateInput(customRate ? customRate.toString() : '')
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                                title="Configurar moneda ($ USD o € EUR) y tasa para esta tienda"
                              >
                                <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                Moneda & Tasa
                              </button>

                              {/* Cambiar Plan SaaS */}
                              <button
                                onClick={() => {
                                  setSelectedTenantForPlan(t)
                                  setSelectedPlanValue(((tenantSettings.plan as any) || (t as any).plan || 'pro'))
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                                title="Cambiar plan de suscripción de esta tienda"
                              >
                                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                Plan
                              </button>

                              {/* Editar Marca */}
                              <button
                                onClick={() => {
                                  setSelectedTenantForBranding(t)
                                  setIsBrandingModalOpen(true)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                                title="Editar logotipos, colores y datos de esta vitrina"
                              >
                                <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                Marca
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
                                Entrar <ArrowRight className="w-3 h-3" />
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
        </div>
      )}

      {/* TAB 2: HISTORIAL TASAS BCV & MULTIMONEDA (SOLO SUPERADMIN) */}
      {activeTab === 'bcv_history' && (
        <div className="space-y-6">
          {/* Tarjeta de Control BCV en Vivo */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-slate-900/5 border border-amber-200 dark:border-amber-900/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Banco Central de Venezuela (bcv.org.ve)
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Control Central de Tasas Oficiales USD & EUR
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  El sistema guarda continuamente el histórico multi-anual de tasas para validar pagos y cierres de cualquier fecha.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncBcvLive}
                  disabled={historySyncLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${historySyncLoading ? 'animate-spin' : ''}`} />
                  <span>{historySyncLoading ? 'Sincronizando con BCV…' : 'Sincronizar BCV Hoy (USD & EUR)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingHistoryRate(null)
                    setHistoryDateInput(new Date().toISOString().split('T')[0])
                    setHistoryFechaValorInput(bcvFechaValor || '')
                    setHistoryRateUsdInput(exchangeRate ? exchangeRate.toString() : '')
                    setHistoryRateEurInput(bcvRateEur ? bcvRateEur.toString() : '')
                    setIsHistoryRateModalOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar / Editar Tasa Manual</span>
                </button>
              </div>
            </div>

            {/* Cajas de Tasas Actuales Detectadas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dólar Oficial (BCV USD)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  Bs. {exchangeRate?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Fecha Valor: {bcvFechaValor || 'Al día'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Euro Oficial (BCV EUR)</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                  {bcvRateEur ? `Bs. ${bcvRateEur.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : 'Sincronizar para ver'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Extraído del bloque oficial #euro</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registros Históricos Guardados</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{allHistoricalRates.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Retención anual de hasta 730 días (2 años)</p>
              </div>
            </div>
          </div>

          {/* Filtro y Buscador de Tasas */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por fecha (YYYY-MM-DD) o día…"
                value={rateSearch}
                onChange={(e) => setRateSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
            <span className="text-xs text-slate-400">
              Mostrando {allHistoricalRates.length} fecha{allHistoricalRates.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla de Tasas Históricas */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            {allHistoricalRates.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="font-semibold">No hay tasas en el historial aún.</p>
                <p className="text-[11px] mt-1">Haz clic en &quot;Sincronizar BCV Hoy&quot; para iniciar el registro histórico automático.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha (Día)</th>
                      <th className="py-3 px-4">Fecha Valor / Etiqueta Oficial</th>
                      <th className="py-3 px-4">Tasa Dólar ($ USD)</th>
                      <th className="py-3 px-4">Tasa Euro (€ EUR)</th>
                      <th className="py-3 px-4">Origen</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {allHistoricalRates.map((item) => (
                      <tr key={item.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {item.date}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {item.fecha_valor || item.label || '—'}
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                          Bs. {(item.rate_usd || item.rate)?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-3 px-4 font-black text-purple-600 dark:text-purple-400">
                          {item.rate_eur
                            ? `Bs. ${item.rate_eur.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.is_manual
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {item.is_manual ? 'Manual / Editada' : 'Oficial BCV'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHistoryRate(item)
                                setHistoryDateInput(item.date)
                                setHistoryFechaValorInput(item.fecha_valor || item.label || '')
                                setHistoryRateUsdInput((item.rate_usd || item.rate).toString())
                                setHistoryRateEurInput(item.rate_eur ? item.rate_eur.toString() : '')
                                setIsHistoryRateModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Editar valor de tasa para este día"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryEntry(item.date)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Eliminar este día del registro"
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
        </div>
      )}

      {/* TAB 3: DIRECTORIO DE USUARIOS & CUENTAS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuario por nombre, correo o rol…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>
            <span className="text-xs text-slate-400">
              Total: {filteredProfiles.length} cuenta{filteredProfiles.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Correo Afiliado (Editable)</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Tienda Asignada</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredProfiles.map((p) => {
                    const assignedTenant = tenants.find((t) => t.id === p.tenant_id)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {p.full_name || 'Sin nombre'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span>{p.email}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditEmailUser(p)
                                setEditEmailInput(p.email || '')
                              }}
                              className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Editar este correo electrónico"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {p.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {assignedTenant ? assignedTenant.name : 'Global / Sin Tienda'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditEmailUser(p)
                                setEditEmailInput(p.email || '')
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Editar Correo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetModalUser(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Clave</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal para Editar Correo de Usuario */}
      {editEmailUser && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !editEmailLoading && setEditEmailUser(null)} />
          <div
            style={{ width: '100%', maxWidth: '440px' }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 transition-all text-xs font-medium space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Modificar Correo de Cuenta</h2>
              </div>
              <button
                type="button"
                onClick={() => !editEmailLoading && setEditEmailUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editEmailSuccess ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-900 dark:text-white">¡Correo actualizado exitosamente!</p>
              </div>
            ) : (
              <form onSubmit={handleUpdateEmail} className="space-y-3">
                <p className="text-slate-500">
                  Modificar correo electrónico para <strong className="text-slate-800 dark:text-slate-200">{editEmailUser.full_name || 'Usuario'}</strong>:
                </p>
                <input
                  type="email"
                  required
                  value={editEmailInput}
                  onChange={(e) => setEditEmailInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-semibold"
                  placeholder="nuevo-correo@dominio.com"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={editEmailLoading}
                    onClick={() => setEditEmailUser(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editEmailLoading || !editEmailInput.includes('@')}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    {editEmailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar Correo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Configurar Moneda ($ USD / € EUR) & Modo de Tasa */}
      {selectedTenantForCurrency && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !currencyModalLoading && setSelectedTenantForCurrency(null)} />
          <div
            style={{ width: '100%', maxWidth: '480px' }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 transition-all text-xs font-medium space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Moneda & Tasa para {selectedTenantForCurrency.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !currencyModalLoading && setSelectedTenantForCurrency(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {currencyModalSuccess ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-900 dark:text-white">¡Configuración monetaria guardada!</p>
              </div>
            ) : (
              <form onSubmit={handleSaveStoreCurrency} className="space-y-4">
                {/* 1. Tipo de Moneda Base */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    1. Moneda Base de la Tienda:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCurrencyType('USD')}
                      className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition cursor-pointer ${
                        selectedCurrencyType === 'USD'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>$ Dólares (USD)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCurrencyType('EUR')}
                      className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition cursor-pointer ${
                        selectedCurrencyType === 'EUR'
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-4 h-4 text-purple-600" />
                      <span>€ Euros (EUR)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Modo de Tasa */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    2. Modalidad de Tasa de Cambio:
                  </label>
                  <div className="space-y-2">
                    <label
                      onClick={() => setSelectedRateMode('official')}
                      className={`flex items-start gap-2.5 p-3 rounded-2xl border-2 cursor-pointer transition ${
                        selectedRateMode === 'official'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 font-bold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rateMode"
                        checked={selectedRateMode === 'official'}
                        onChange={() => setSelectedRateMode('official')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <p className="text-xs">Tasa Oficial BCV en Vivo</p>
                        <p className="text-[11px] text-slate-400 font-normal">
                          Sincronización automática de {selectedCurrencyType === 'EUR' ? 'Euro BCV' : 'Dólar BCV'} con fecha valor.
                        </p>
                      </div>
                    </label>

                    <label
                      onClick={() => setSelectedRateMode('custom')}
                      className={`flex items-start gap-2.5 p-3 rounded-2xl border-2 cursor-pointer transition ${
                        selectedRateMode === 'custom'
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 font-bold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rateMode"
                        checked={selectedRateMode === 'custom'}
                        onChange={() => setSelectedRateMode('custom')}
                        className="mt-0.5 text-amber-600"
                      />
                      <div>
                        <p className="text-xs">Tasa Personalizada (No oficial / Manual)</p>
                        <p className="text-[11px] text-slate-400 font-normal">
                          Permite fijar un monto personalizado para la tienda.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Input si es tasa personalizada */}
                {selectedRateMode === 'custom' && (
                  <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                      Monto de la Tasa Personalizada (en Bs.):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customRateInput}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      placeholder="Ej. 900.00"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-black outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={currencyModalLoading}
                    onClick={() => setSelectedTenantForCurrency(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={currencyModalLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    {currencyModalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar Configuración
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Agregar / Editar Tasa de Otra Fecha en el Historial */}
      {isHistoryRateModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !historySaving && setIsHistoryRateModalOpen(false)} />
          <div
            style={{ width: '100%', maxWidth: '480px' }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 transition-all text-xs font-medium space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingHistoryRate ? 'Editar Tasa Histórica' : 'Agregar Tasa de Otra Fecha al Registro'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !historySaving && setIsHistoryRateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHistoryEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Fecha (Día del Pago / Registro) *
                </label>
                <input
                  type="date"
                  required
                  value={historyDateInput}
                  onChange={(e) => setHistoryDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Fecha Valor / Etiqueta Oficial
                </label>
                <input
                  type="text"
                  value={historyFechaValorInput}
                  onChange={(e) => setHistoryFechaValorInput(e.target.value)}
                  placeholder="Ej. Jueves, 24 Septiembre 2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Tasa Dólar (USD) en Bs. *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={historyRateUsdInput}
                    onChange={(e) => setHistoryRateUsdInput(e.target.value)}
                    placeholder="854.46"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Tasa Euro (EUR) en Bs.
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={historyRateEurInput}
                    onChange={(e) => setHistoryRateEurInput(e.target.value)}
                    placeholder="974.06 (Opcional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={historySaving}
                  onClick={() => setIsHistoryRateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={historySaving || !historyDateInput || !historyRateUsdInput}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {historySaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar en Historial
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Resetear Contraseña */}
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
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

      {/* Modal para Cambiar Plan SaaS */}
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
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Cambiar Plan SaaS</h2>
                  <p className="text-[11px] text-slate-500">
                    Tienda: <strong className="text-slate-800 dark:text-slate-200">{selectedTenantForPlan.name}</strong> ({selectedTenantForPlan.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !planLoading && setSelectedTenantForPlan(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {planSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="font-extrabold text-base text-slate-900 dark:text-white">¡Plan actualizado con éxito!</p>
              </div>
            ) : (
              <form onSubmit={handleSavePlan} className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5">
                  <label
                    onClick={() => setSelectedPlanValue('basic')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition ${
                      selectedPlanValue === 'basic'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
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
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">🟢 Plan Básico</span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$15 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">1 Sucursal POS · Catálogo WhatsApp · Hasta 150 productos.</p>
                    </div>
                  </label>

                  <label
                    onClick={() => setSelectedPlanValue('pro')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition relative overflow-hidden ${
                      selectedPlanValue === 'pro'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
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
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">🔵 Plan Pro</span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$35 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Multimoneda BCV en Vivo · Pagos Divididos · Créditos con WhatsApp · IA Edith · Productos Ilimitados.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setSelectedPlanValue('enterprise')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition ${
                      selectedPlanValue === 'enterprise'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
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
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">🟣 Plan Enterprise</span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">$79 / mes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Todo de Pro + Cajas y Sucursales Ilimitadas · Dominio Propio · API & Webhooks · Soporte VIP 24/7.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={() => setSelectedTenantForPlan(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={planLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    {planLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar Plan
                  </button>
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

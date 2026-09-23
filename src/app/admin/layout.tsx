'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Settings, LogOut, Moon, Sun, Store, Pencil, Check, X, Menu,
  RefreshCw, ExternalLink, Vault, Receipt, FileText, Crown, ClipboardList, Palette,
  UserCheck, ShieldCheck, Loader2, ChevronDown, Barcode, Download, Smartphone,
  PanelLeftClose, PanelLeftOpen, PanelLeft, TrendingUp, BarChart2
} from 'lucide-react'
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { createClient } from '@/lib/supabase/client'
import { EdithAssistantModal } from '@/components/admin/EdithAssistantModal'
import { getPlanLabel } from '@/lib/formatters'
import { useTheme } from '@/components/common/ThemeProvider'
import { getRoleLabel, type UserRole } from '@/types/database'
import { LiveOrderNotification } from '@/components/admin/LiveOrderNotification'
import { PwaInstallPrompt } from '@/components/admin/PwaInstallPrompt'
import { LivePresenceHeader } from '@/components/admin/LivePresenceHeader'

// Mapeo exhaustivo de módulos y permisos por rol (RBAC)
interface NavItemConfig {
  href: string
  label: string
  icon: any
  proBadge?: boolean
  scanBadge?: boolean
  roles: UserRole[]
}

const ALL_NAV_ITEMS: NavItemConfig[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin', 'owner', 'admin'] },
  { href: '/admin/master', label: 'Panel Master SaaS', icon: Crown, roles: ['superadmin'] },
  { href: '/admin/analytics', label: 'Analíticas Web', icon: BarChart2, roles: ['superadmin'] },
  { href: '/admin/orders', label: 'Pedidos Web', icon: ClipboardList, roles: ['superadmin', 'owner', 'admin', 'cajero', 'cashier', 'almacen', 'vendedor'] },
  { href: '/admin/pos', label: 'Facturación / POS', icon: ShoppingCart, roles: ['superadmin', 'owner', 'admin', 'cajero', 'cashier', 'vendedor'] },
  { href: '/admin/quotations', label: 'Cotizaciones', icon: FileText, roles: ['superadmin', 'owner', 'admin', 'vendedor'] },
  { href: '/admin/inventory', label: 'Inventario', icon: Package, roles: ['superadmin', 'owner', 'admin', 'almacen', 'vendedor'] },
  { href: '/admin/cash-closing', label: 'Cierre de Caja', icon: Vault, roles: ['superadmin', 'owner', 'admin', 'cajero', 'cashier'] },
  { href: '/admin/finances', label: 'Finanzas & Balance', icon: TrendingUp, roles: ['superadmin', 'owner', 'admin'] },
  { href: '/admin/expenses', label: 'Gastos', icon: Receipt, roles: ['superadmin', 'owner', 'admin'] },
  { href: '/admin/customers', label: 'Clientes', icon: Users, roles: ['superadmin', 'owner', 'admin', 'cajero', 'cashier', 'vendedor'] },
  { href: '/admin/storefront-builder', label: 'Catálogo Web', icon: Palette, proBadge: true, roles: ['superadmin', 'owner', 'admin'] },
  { href: '/admin/users', label: 'Equipo & Usuarios', icon: UserCheck, roles: ['superadmin', 'owner', 'admin'] },
  { href: '/admin/settings', label: 'Configuración', icon: Settings, roles: ['superadmin', 'owner', 'admin'] },
]

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, profile, exchangeRate, bcvFechaValor, isSyncingBcv, syncBcvRate, setExchangeRate, allTenants, switchTenantById, isLoading } = useTenant()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [storeSelectorOpen, setStoreSelectorOpen] = useState(false)

  // Cargar preferencia guardada de sidebar colapsado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('is_admin_sidebar_collapsed')
      if (saved === 'true') {
        setSidebarCollapsed(true)
      }
    }
  }, [])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('is_admin_sidebar_collapsed', String(next))
      }
      return next
    })
  }

  // Determinar rol sólo cuando profile ya cargó. NUNCA asumir 'admin' mientras carga para evitar parpadeo de menús.
  const userRole = (profile?.role || null) as UserRole | null
  const isSuperAdmin = userRole === 'superadmin'

  const currentPath = pathname || ''

  // Filtrar elementos de navegación según el rol verificado del usuario (vacío mientras carga)
  const navItems = useMemo(() => {
    if (!userRole) return []
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.href === '/admin/master') return isSuperAdmin
      return item.roles.includes(userRole)
    })
  }, [userRole, isSuperAdmin])

  const isCurrentAllowed = useMemo(() => {
    if (!userRole) return false
    const allowedHrefs = navItems.map((n) => n.href.split('?')[0])
    return allowedHrefs.some(
      (href) => currentPath === href || (href !== '/admin' && currentPath.startsWith(href))
    )
  }, [userRole, navItems, currentPath])

  // Page Guard: Redirigir de inmediato si el rol no tiene permiso para la ruta actual
  useEffect(() => {
    if (isLoading || !profile || !userRole) return
    if (!isCurrentAllowed && navItems.length > 0) {
      // Redirigir al primer módulo disponible para su rol (ej. POS para cajero, Inventario para almacén)
      router.replace(navItems[0].href)
    }
  }, [pathname, profile, userRole, isCurrentAllowed, navItems, router, isLoading])

  // Registro de Service Worker para PWA y notificaciones del sistema
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('PWA service worker registration notice:', err))
    }
  }, [])

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 750)),
      ])
    } catch (e) {
      console.warn('Logout notice:', e)
    } finally {
      window.location.href = '/login'
    }
  }

  function startEditRate() {
    setRateInput(exchangeRate.toFixed(2))
    setEditingRate(true)
  }

  function saveRate() {
    const r = parseFloat(rateInput)
    if (!isNaN(r) && r > 0) setExchangeRate(r)
    setEditingRate(false)
  }

  const Sidebar = (
    <aside className="flex flex-col h-full w-72 sm:w-64 bg-white/95 dark:bg-slate-900/95 md:bg-white/60 md:dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 md:border-white/40 md:dark:border-slate-700/40 px-4 py-5 gap-5 shadow-2xl md:shadow-none">
      {/* Logo & Store Selector */}
      <div className="relative px-2">
        <div className="flex items-center justify-between">
          {isSuperAdmin && allTenants.length > 0 ? (
            <button
              type="button"
              onClick={() => setStoreSelectorOpen(!storeSelectorOpen)}
              className="flex items-center gap-2.5 p-1.5 -m-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer group flex-1 min-w-0"
              title="Cambiar de tienda activa"
            >
              {tenant?.logo_url ? (
                <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 flex items-center justify-center p-1">
                  <Image
                    src={tenant.logo_url || '/logo.png'}
                    alt={tenant.name || 'Logo'}
                    width={36}
                    height={36}
                    unoptimized
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {tenant?.name ?? 'Innovise Store'}
                  </p>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${storeSelectorOpen ? 'rotate-180 text-blue-600' : ''}`} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    {getPlanLabel((tenant?.settings as Record<string, unknown>)?.plan as string || (tenant as unknown as { plan?: string })?.plan)}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">· Cambiar</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              {tenant?.logo_url ? (
                <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 flex items-center justify-center p-1">
                  <Image
                    src={tenant.logo_url || '/logo.png'}
                    alt={tenant.name || 'Logo'}
                    width={36}
                    height={36}
                    unoptimized
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight truncate">
                  {tenant?.name ?? 'Innovise Store'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    {getPlanLabel((tenant?.settings as Record<string, unknown>)?.plan as string || (tenant as unknown as { plan?: string })?.plan)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botón Cerrar en Móvil */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
            aria-label="Cerrar menú lateral"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Botón Ocultar en Computadora */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Ocultar menú lateral (Más espacio)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Dropdown flotante de cambio de tienda para SuperAdmin */}
        {isSuperAdmin && storeSelectorOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span>Cambiar de Tienda</span>
              <span className="text-amber-600 font-extrabold">Super Admin</span>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 pt-1">
              {allTenants.map((t) => {
                const isCurrent = t.id === tenant?.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      switchTenantById(t.id)
                      setStoreSelectorOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition ${
                      isCurrent
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate">
                      <p className="truncate leading-tight">{t.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">/{t.slug}</p>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <Link
                href="/admin/master"
                onClick={() => setStoreSelectorOpen(false)}
                className="w-full text-center py-1.5 px-2 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition flex items-center justify-center gap-1"
              >
                <Crown className="w-3 h-3" />
                <span>Gestionar Todas (Panel Master)</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Current logged-in user profile pill or skeleton */}
      {isLoading || !profile ? (
        <div className="px-3 py-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2.5 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-2 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-100 font-bold text-xs shadow-2xs flex-shrink-0">
              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                {profile.full_name || profile.email?.split('@')[0] || 'Usuario'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  userRole === 'superadmin' || userRole === 'owner' || userRole === 'admin'
                    ? 'text-purple-700 dark:text-purple-300 bg-purple-100/90 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/60'
                    : userRole === 'cajero' || userRole === 'cashier'
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60'
                    : userRole === 'almacen'
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/60'
                    : 'text-blue-700 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60'
                }`}>
                  {userRole ? getRoleLabel(userRole) : 'Usuario'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav o Skeleton Shimmer mientras se valida el rol */}
      {isLoading || !profile ? (
        <div className="flex-1 flex flex-col gap-2.5 pr-1 animate-pulse">
          <div className="h-3 w-20 rounded bg-slate-200/60 dark:bg-slate-800/60 mb-1 ml-2" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
          ))}
        </div>
      ) : (
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          {navItems.map(({ href, label, icon: Icon, proBadge, scanBadge }) => {
            const isRegister = href.includes('mode=register')
            const isMaster = href === '/admin/master'
            const active = isRegister
              ? currentPath === '/admin/inventory' && typeof window !== 'undefined' && window.location.search.includes('mode=register')
              : (currentPath === href || (href !== '/admin' && !href.includes('?') && currentPath.startsWith(href)))

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? isMaster
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                      : isRegister
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : isMaster
                    ? 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/70 dark:border-amber-800/60 font-bold hover:bg-amber-200 dark:hover:bg-amber-900/60'
                    : isRegister
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isMaster && !active ? 'text-amber-600 dark:text-amber-400' : isRegister && !active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <span>{label}</span>
                </div>
                {isMaster ? (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    active ? 'bg-white/25 text-white' : 'bg-amber-500 text-white shadow-xs'
                  }`}>
                    MASTER
                  </span>
                ) : isRegister || scanBadge ? (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/25 text-white' : 'bg-emerald-600 text-white shadow-xs'
                  }`}>
                    IA / SCAN
                  </span>
                ) : proBadge ? (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                  }`}>
                    PRO
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      )}

      {/* Botón Instalar App Móvil en Sidebar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setSidebarOpen(false)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-pwa-install'))
            }
          }}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition text-left cursor-pointer group"
          title="Instalar app oficial con el logo de tu empresa"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-tight truncate">Instalar App</p>
            <p className="text-[10px] text-blue-600/75 dark:text-blue-400/75 truncate">{tenant?.name || 'Tu tienda'}</p>
          </div>
          <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Logout */}
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 cursor-pointer disabled:opacity-50"
      >
        {isLoggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        ) : (
          <LogOut className="w-4 h-4" />
        )}
        <span>{isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
      </button>
    </aside>
  )

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Aurora */}
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      {/* Desktop Sidebar con transición fluida colapsable */}
      <div 
        className={`hidden md:flex relative z-10 flex-shrink-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-0 -translate-x-full opacity-0 pointer-events-none' : 'w-72 sm:w-64 translate-x-0 opacity-100'
        }`}
      >
        {Sidebar}
      </div>

      {/* Mobile Sidebar overlay with smooth slide-in */}
      <div 
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div 
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
        <div 
          className={`relative z-10 h-full transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {Sidebar}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-3 sm:px-6 h-16 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg flex-shrink-0 gap-2">
          {/* Botón Menú Móvil */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Botón Desktop para Ocultar / Mostrar Menú (Más Espacio de Trabajo) */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 ${
              sidebarCollapsed
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 hover:bg-blue-700'
                : 'border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
            title={sidebarCollapsed ? 'Mostrar menú lateral (Expandir)' : 'Ocultar menú lateral (Más espacio)'}
          >
            {sidebarCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4" />
                <span>Mostrar Menú</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Ocultar</span>
              </>
            )}
          </button>

          <div className="hidden md:block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {navItems.find((n) => currentPath === n.href || (n.href !== '/admin' && currentPath.startsWith(n.href)))?.label ?? 'Dashboard'}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Exchange rate chip with live BCV sync button */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              {editingRate ? (
                <>
                  <span>Bs.</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-14 sm:w-16 bg-transparent border-b border-blue-400 outline-none text-xs"
                    autoFocus
                    step="0.01"
                  />
                  <span className="hidden sm:inline">/USD</span>
                  <button onClick={saveRate} className="hover:text-emerald-600 p-0.5"><Check className="w-3.5 h-3.5 text-emerald-600" /></button>
                  <button onClick={() => setEditingRate(false)} className="hover:text-red-500 p-0.5"><X className="w-3.5 h-3.5 text-rose-500" /></button>
                </>
              ) : (
                <>
                  <span title="Tasa oficial BCV" className="whitespace-nowrap">
                    Bs. {exchangeRate.toFixed(2)}
                    <span className="hidden sm:inline">/USD</span>
                  </span>
                  {bcvFechaValor && (
                    <span className="hidden xl:inline text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      · {bcvFechaValor}
                    </span>
                  )}
                  <button
                    onClick={() => syncBcvRate()}
                    disabled={isSyncingBcv}
                    title="Sincronizar tasa oficial en vivo desde https://www.bcv.org.ve/"
                    className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition text-blue-600 dark:text-blue-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingBcv ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={startEditRate} title="Editar manualmente" className="hover:text-blue-900 dark:hover:text-blue-100 p-1">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <a
                    href="https://www.bcv.org.ve/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver página oficial del Banco Central de Venezuela"
                    className="hidden sm:inline-flex hover:text-blue-900 dark:hover:text-blue-100 p-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>

            {/* Botón Directo Instalar App Oficial */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('open-pwa-install'))
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              title="Descargar e instalar la app con el logo de tu empresa en tu teléfono o PC"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar App</span>
              <span className="sm:hidden text-[11px]">App</span>
            </button>

            {/* Ver Tienda Pública */}
            {tenant?.slug && (
              <a
                href={`/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition"
                title="Abrir vitrina virtual de la tienda"
              >
                <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Ver Tienda
              </a>
            )}

            {/* Acceso Directo Super Admin a Panel Master */}
            {isSuperAdmin && (
              <Link
                href="/admin/master"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 text-xs font-black transition shadow-xs"
                title="Ir al Panel Master (Crear tienda, cambiar de tienda, configuración general)"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-extrabold text-[11px]">Panel Master</span>
              </Link>
            )}

            {/* Monitoreo en Vivo de Usuarios Conectados */}
            <LivePresenceHeader />

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page content con protección contra parpadeo mientras valida el rol */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
          {isLoading || !profile ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-400 animate-in fade-in duration-300">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Verificando permisos y cargando tu panel...
              </p>
            </div>
          ) : !isCurrentAllowed && navItems.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-400 animate-in fade-in duration-300">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Accediendo a tu módulo de trabajo...
              </p>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Barra de Navegación Rápida Móvil con POS Centrado en el Medio */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1 flex items-center justify-between shadow-2xl safe-area-bottom">
          {isLoading || !profile ? (
            <div className="flex items-center justify-around w-full py-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-10 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
              ))}
            </div>
          ) : (
            (() => {
              const posItem = navItems.find((n) => n.href === '/admin/pos')
              const otherItems = navItems.filter((n) => n.href !== '/admin/pos')
              const left1 = otherItems[0] || null
              const left2 = otherItems[1] || null
              const right1 = otherItems[2] || null
              const isPosActive = currentPath.startsWith('/admin/pos')

              const Left1Icon = left1?.icon
              const Left2Icon = left2?.icon
              const Right1Icon = right1?.icon
              const PosIcon = posItem?.icon || ShoppingCart

              const isLeft1Active = left1 ? (currentPath === left1.href || (left1.href !== '/admin' && currentPath.startsWith(left1.href))) : false
              const isLeft2Active = left2 ? (currentPath === left2.href || (left2.href !== '/admin' && currentPath.startsWith(left2.href))) : false
              const isRight1Active = right1 ? (currentPath === right1.href || (right1.href !== '/admin' && currentPath.startsWith(right1.href))) : false

              return (
                <div className="w-full flex items-center justify-between">
                  {/* Slot 1: Primer elemento izquierdo */}
                  {left1 && Left1Icon ? (
                    <Link
                      href={left1.href}
                      className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
                        isLeft1Active
                          ? 'text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Left1Icon className="w-5 h-5" />
                      <span className="text-[10px] mt-0.5 max-w-[56px] truncate text-center font-medium">{left1.label}</span>
                    </Link>
                  ) : <div className="flex-1" />}

                  {/* Slot 2: Segundo elemento izquierdo */}
                  {left2 && Left2Icon ? (
                    <Link
                      href={left2.href}
                      className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
                        isLeft2Active
                          ? 'text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Left2Icon className="w-5 h-5" />
                      <span className="text-[10px] mt-0.5 max-w-[56px] truncate text-center font-medium">{left2.label}</span>
                    </Link>
                  ) : <div className="flex-1" />}

                  {/* Slot 3: CENTRO EXACTO -> POS ELEVADO */}
                  <div className="flex-1 flex items-center justify-center">
                    {posItem ? (
                      <Link
                        href={posItem.href}
                        className={`flex flex-col items-center justify-center -mt-5 p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white shadow-xl shadow-blue-500/40 active:scale-95 transition-transform ${
                          isPosActive ? 'ring-3 ring-blue-400/80 ring-offset-2 dark:ring-offset-slate-900 scale-105' : ''
                        }`}
                        title="Punto de Venta / Facturación"
                      >
                        <PosIcon className="w-5 h-5 stroke-[2.5]" />
                        <span className="text-[10px] font-black mt-0.5 tracking-tight">POS</span>
                      </Link>
                    ) : null}
                  </div>

                  {/* Slot 4: Primer elemento derecho */}
                  {right1 && Right1Icon ? (
                    <Link
                      href={right1.href}
                      className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
                        isRight1Active
                          ? 'text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Right1Icon className="w-5 h-5" />
                      <span className="text-[10px] mt-0.5 max-w-[56px] truncate text-center font-medium">{right1.label}</span>
                    </Link>
                  ) : <div className="flex-1" />}

                  {/* Slot 5: Menú Lateral Completo */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    <Menu className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-medium">Menú</span>
                  </button>
                </div>
              )
            })()
          )}
        </nav>

        {/* Asistente IA Edith */}
        <EdithAssistantModal />

        {/* Notificaciones Nativas y Alarmas de Pedidos, Cobranza y Cierre */}
        <LiveOrderNotification />

        {/* Prompt de Instalación PWA para Teléfonos y PC */}
        <PwaInstallPrompt />

        {/* Full-screen animated overlay on logout */}
        {isLoggingOut && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200 text-white">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-2xl shadow-blue-500/40 animate-pulse">
              <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
                <Store className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-100">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Cerrando sesión de forma segura...</span>
            </div>
            <p className="text-xs text-slate-400">Guardando sesión y redirigiendo...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AdminShell>{children}</AdminShell>
    </TenantProvider>
  )
}
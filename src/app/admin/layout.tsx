'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Settings, LogOut, Moon, Sun, Store, Pencil, Check, X, Menu,
  RefreshCw, ExternalLink, Vault, Receipt, FileText, Crown
} from 'lucide-react'
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { createClient } from '@/lib/supabase/client'
import { EdithAssistantModal } from '@/components/admin/EdithAssistantModal'

const baseNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/inventory', label: 'Inventario', icon: Package },
  { href: '/admin/pos', label: 'Facturación / POS', icon: ShoppingCart },
  { href: '/admin/quotations', label: 'Cotizaciones', icon: FileText },
  { href: '/admin/cash-closing', label: 'Cierre de Caja', icon: Vault },
  { href: '/admin/expenses', label: 'Gastos', icon: Receipt },
  { href: '/admin/customers', label: 'Clientes', icon: Users },
  { href: '/admin/settings', label: 'Configuración', icon: Settings },
]

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, profile, exchangeRate, bcvFechaValor, isSyncingBcv, syncBcvRate, setExchangeRate } = useTenant()
  const [isDark, setIsDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')

  const isSuperAdmin = profile?.role === 'superadmin' || !profile?.role // Accessible for superadmin and master setup
  const navItems = [
    ...baseNavItems,
    ...(isSuperAdmin
      ? [{ href: '/admin/master', label: 'Panel Master', icon: Crown }]
      : []),
  ]

  function toggleDark() {
    setIsDark((d) => {
      document.documentElement.classList.toggle('dark', !d)
      return !d
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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
    <aside className="flex flex-col h-full w-64 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-white/40 dark:border-slate-700/40 px-4 py-6 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Store className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
            {tenant?.name ?? 'Innovise Store'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile?.role ?? 'admin'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
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

      {/* Desktop Sidebar */}
      <div className="hidden md:flex relative z-10 flex-shrink-0">{Sidebar}</div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">{Sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 h-16 border-b border-white/40 dark:border-slate-700/40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg flex-shrink-0">
          <button
            className="md:hidden p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          <div className="hidden md:block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {navItems.find((n) => pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href)))?.label ?? 'Dashboard'}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Exchange rate chip with live BCV sync button */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              {editingRate ? (
                <>
                  <span>Bs.</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-16 bg-transparent border-b border-blue-400 outline-none text-xs"
                    autoFocus
                    step="0.01"
                  />
                  <span>/USD</span>
                  <button onClick={saveRate} className="hover:text-emerald-600"><Check className="w-3 h-3" /></button>
                  <button onClick={() => setEditingRate(false)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </>
              ) : (
                <>
                  <span title="Tasa oficial BCV">Bs. {exchangeRate.toFixed(2)}/USD</span>
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
                    className="hover:text-blue-900 dark:hover:text-blue-100 p-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>

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

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 transition"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

        {/* Asistente IA Edith */}
        <EdithAssistantModal />
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
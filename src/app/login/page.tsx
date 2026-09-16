'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getRoleLabel } from '@/types/database'
import type { UserRole } from '@/types/database'
import {
  Loader2,
  Eye,
  EyeOff,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  Lock,
  Mail,
  Store,
} from 'lucide-react'

interface WelcomeData {
  storeName: string
  userName: string
  logoUrl: string
  roleLabel: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [welcomeData, setWelcomeData] = useState<WelcomeData | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError || !authData.user) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      setLoading(false)
      return
    }

    // Cargar información de bienvenida del usuario y su tienda
    let storeName = 'IS System'
    let logoUrl = '/logo.png'
    let userName = 'Colaborador'
    let roleLabel = 'Usuario'

    try {
      const user = authData.user
      const meta = user.user_metadata || {}
      userName = meta.full_name || user.email?.split('@')[0] || 'Usuario'

      // Consultar perfil para obtener tenant_id y rol
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, tenant_id')
        .eq('id', user.id)
        .single()

      if (profile?.full_name) userName = profile.full_name
      const rawRole = (meta.role || profile?.role || 'cajero') as UserRole
      roleLabel = getRoleLabel(rawRole)

      const tenantId = profile?.tenant_id || meta.tenant_id
      if (tenantId) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, settings')
          .eq('id', tenantId)
          .single()

        if (tenant) {
          storeName = tenant.name || 'IS System'
          const s = (tenant.settings || {}) as Record<string, unknown>
          logoUrl =
            (s.logo_url as string) ||
            (s.imagotype_url as string) ||
            (s.isotype_url as string) ||
            '/logo.png'
        }
      }
    } catch (err) {
      console.warn('Error loading welcome profile:', err)
    }

    // Activar animación de bienvenida
    setWelcomeData({
      storeName,
      userName,
      logoUrl,
      roleLabel,
    })

    // Transición suave hacia el panel administrativo
    setTimeout(() => {
      window.location.href = '/admin'
    }, 1750)
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-8">
      {/* Aurora background */}
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-8 sm:p-10 shadow-2xl backdrop-blur-xl border border-white/70 dark:border-slate-800/80">
          {/* Header Branding */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5 shadow-xl shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center p-2.5 overflow-hidden">
                <img
                  src="/logo.png"
                  alt="IS System Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback visual si la imagen no carga
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                IS System
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Plataforma de Gestión Empresarial & POS
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || Boolean(welcomeData)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition text-sm disabled:opacity-60"
                  placeholder="usuario@innovise.ve"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || Boolean(welcomeData)}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition text-sm disabled:opacity-60"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

                {/* Minimalist eye toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || Boolean(welcomeData)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl px-3.5 py-2.5 animate-in fade-in">
                <span className="mt-0.5">⚠️</span>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || Boolean(welcomeData)}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-500/25 active:scale-[0.98] text-sm cursor-pointer"
            >
              {loading && !welcomeData ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando credenciales…</span>
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          {/* Contact Support & WhatsApp Information */}
          <div className="mt-7 pt-6 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-col items-center gap-2.5 text-center">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ¿Problemas para acceder o necesitas soporte?
            </span>
            <a
              href="https://wa.me/584245259193?text=Hola%20IS%20System,%20necesito%20asistencia%20con%20el%20acceso%20a%20la%20plataforma."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 transition-all shadow-2xs group"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>
                WhatsApp Soporte:{' '}
                <strong className="tracking-wide text-emerald-800 dark:text-emerald-200">
                  +58 424-5259193
                </strong>
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Pantalla Animada de Bienvenida al Iniciar Sesión */}
      {welcomeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative z-10 w-full max-w-sm rounded-3xl p-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-700/80 shadow-2xl shadow-black/40 text-center animate-in zoom-in-95 fade-in duration-300 ease-out">
            {/* Logo con Halo Pulsante */}
            <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-blue-500/25 animate-ping opacity-60 pointer-events-none" />
              <div className="relative w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 p-3 shadow-xl ring-4 ring-blue-500/20 flex items-center justify-center overflow-hidden">
                <img
                  src={welcomeData.logoUrl}
                  alt={welcomeData.storeName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png'
                  }}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            {/* Información de Bienvenida */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Acceso Concedido
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                ¡Bienvenido a {welcomeData.storeName}!
              </h2>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Hola, <strong className="text-slate-900 dark:text-white">{welcomeData.userName}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Rol: <span className="font-semibold text-slate-500 dark:text-slate-300">{welcomeData.roleLabel}</span>
              </p>
            </div>

            {/* Barra de Progreso Dinámica */}
            <div className="mt-6 space-y-2">
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-login-progress" />
              </div>
              <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-1">
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                Iniciando tu panel de control...
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

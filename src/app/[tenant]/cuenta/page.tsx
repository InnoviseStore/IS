'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CustomerProvider, useCustomer } from '@/contexts/CustomerContext'
import {
  User,
  ShoppingBag,
  CreditCard,
  Phone,
  MapPin,
  Lock,
  ArrowRight,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  Loader2,
  Sparkles,
  ShieldCheck,
  Building2,
  MessageCircle,
} from 'lucide-react'
import { formatDateTime, formatDate } from '@/lib/formatters'
import { generateOrderPdf } from '@/lib/pdfGenerator'
import { getTenantFeatures } from '@/lib/planLimits'

function CustomerPortalInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const tenantSlug = params.tenant as string
  const { customer, orders, isLoading, login, register, logout, refreshCustomer } = useCustomer()

  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false)

  // Register Form
  const [regFullName, setRegFullName] = useState('')
  const [regIdPrefix, setRegIdPrefix] = useState<'V-' | 'J-' | 'E-'>('V-')
  const [regIdNumber, setRegIdNumber] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regAddress, setRegAddress] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regError, setRegError] = useState<string | null>(null)
  const [isSubmittingReg, setIsSubmittingReg] = useState(false)

  // Tenant data (for rate, currency, store name)
  const [tenant, setTenant] = useState<any>(null)
  const [loadingTenant, setLoadingTenant] = useState(true)

  useEffect(() => {
    async function loadTenant() {
      const supabase = createClient()
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .single()
      setTenant(data)
      setLoadingTenant(false)
    }
    loadTenant()
  }, [tenantSlug])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setIsSubmittingLogin(true)
    const res = await login(loginIdentifier, loginPassword)
    setIsSubmittingLogin(false)
    if (!res.success) {
      setLoginError(res.error || 'Error al iniciar sesión')
    } else if (redirectTo) {
      router.push(redirectTo)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setIsSubmittingReg(true)

    const fullId = regIdNumber.trim() ? `${regIdPrefix}${regIdNumber.trim()}` : undefined

    const res = await register({
      full_name: regFullName,
      id_number: fullId,
      phone: regPhone,
      email: regEmail || undefined,
      address: regAddress || undefined,
      password: regPassword,
    })
    setIsSubmittingReg(false)
    if (!res.success) {
      setRegError(res.error || 'Error al registrarse')
    } else if (redirectTo) {
      router.push(redirectTo)
    }
  }

  const handleDownloadPdf = async (order: any) => {
    if (!tenant) return
    try {
      await generateOrderPdf({
        order: {
          ...order,
          exchange_rate_at_sale: order.exchange_rate_at_sale || tenant.currency_rate_bcv || 91.5,
          customer: {
            full_name: customer?.full_name,
            id_number: customer?.id_number,
            phone: customer?.phone,
            address: customer?.address,
          },
        },
        tenant,
        action: 'download',
      })
    } catch (e) {
      console.error('Error generating PDF:', e)
      alert('No se pudo generar la factura en PDF.')
    }
  }

  if (loadingTenant || isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Cargando tu cuenta...</p>
      </div>
    )
  }

  const features = tenant ? getTenantFeatures(tenant) : null
  const hasPortal = features?.hasCustomerPortal

  if (!hasPortal) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 glass-card text-center rounded-3xl border border-slate-200 dark:border-slate-800">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
          Compra Directa Activa
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          En esta tienda puedes realizar tus compras directamente sin necesidad de crear una cuenta previa.
        </p>
        <Link
          href={`/${tenantSlug}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
        >
          <span>Ir al Catálogo de Productos</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  // ─── PANTALLA NO AUTENTICADO: LOGIN / REGISTRO ─────────────────────────────
  if (!customer) {
    return (
      <div className="max-w-md mx-auto my-8 sm:my-14 px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Portal de Clientes • {tenant?.name || 'Tienda'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {authMode === 'login' ? 'Inicia Sesión' : 'Crea tu Cuenta'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {authMode === 'login'
              ? 'Accede para ver tus pedidos, créditos y autocompletar tus compras.'
              : 'Regístrate una sola vez y guarda tus datos de entrega para siempre.'}
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
          {/* Selector de modo Login / Registro */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Registrarme
            </button>
          </div>

          {/* FORMULARIO DE LOGIN */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cédula, Teléfono o Correo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Ej: 12345678, 04121234567 o email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Tu contraseña secreta"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLogin ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Entrar a Mi Cuenta</span>
              </button>
            </form>
          )}

          {/* FORMULARIO DE REGISTRO */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Ej: María Pérez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo
                  </label>
                  <select
                    value={regIdPrefix}
                    onChange={(e: any) => setRegIdPrefix(e.target.value)}
                    className="w-full px-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="V-">V-</option>
                    <option value="J-">J-</option>
                    <option value="E-">E-</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cédula / RIF *
                  </label>
                  <input
                    type="text"
                    required
                    value={regIdNumber}
                    onChange={(e) => setRegIdNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="04121234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección de Entrega Predeterminada
                </label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Calle, Sector, Edificio o Punto de Referencia"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Crea una Contraseña *
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingReg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Registrarme y Guardar Datos</span>
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              href={`/${tenantSlug}`}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Volver a la tienda sin iniciar sesión</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── PANTALLA AUTENTICADO: PERFIL DEL CLIENTE ──────────────────────────────
  const rate = Number(tenant?.currency_rate_bcv) || 91.5
  const currentDebt = Number(customer.current_debt_usd) || 0
  const debtVes = currentDebt * rate

  return (
    <div className="max-w-4xl mx-auto my-6 sm:my-10 px-4">
      {/* Header Perfil */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 mb-6 bg-gradient-to-br from-white via-white to-blue-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/25 shrink-0">
              {customer.full_name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  {customer.full_name}
                </h1>
                {customer.id_number && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {customer.id_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                {customer.phone && <span>📱 {customer.phone}</span>}
                {customer.email && <span>✉️ {customer.email}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              href={`/${tenantSlug}/checkout`}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ver Carrito</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        {/* KPIs de Cuenta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pedidos Realizados
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {orders.length}
            </p>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              currentDebt > 0.01
                ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
              {currentDebt > 0.01 ? 'Saldo Pendiente por Pagar' : 'Estado de Crédito'}
            </span>
            <p className="text-xl font-black mt-0.5">
              {currentDebt > 0.01 ? `$${currentDebt.toFixed(2)} USD` : 'Al Día (Sin Deuda) ✓'}
            </p>
            {currentDebt > 0.01 && (
              <span className="text-[10px] font-bold opacity-80">
                Aprox. Bs. {debtVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa BCV)
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Dirección Principal
            </span>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
              {customer.address || 'No registrada. Haz clic en "Mis Datos" para agregarla.'}
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Mis Pedidos & Compras</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Mis Datos Guardados</span>
        </button>
      </div>

      {/* CONTENIDO PESTAÑA: PEDIDOS */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-40 mb-3" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Aún no has realizado pedidos con tu cuenta
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Explora el catálogo y tus pedidos aparecerán aquí con seguimiento y facturas en PDF.
              </p>
              <Link
                href={`/${tenantSlug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                <span>Ver Catálogo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            orders.map((ord) => {
              const isCredit = ord.status === 'credit' || ord.payment_condition === 'credit_7d'
              return (
                <div
                  key={ord.id}
                  className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                        #{ord.order_number}
                      </span>

                      {ord.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" />
                          <span>Pendiente de Facturación</span>
                        </span>
                      )}

                      {ord.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Facturado / Pagado</span>
                        </span>
                      )}

                      {isCredit && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <CreditCard className="w-3 h-3" />
                          <span>A Crédito / En Cuotas</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Fecha: {formatDateTime(ord.created_at)}
                    </p>

                    {ord.order_items && ord.order_items.length > 0 && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {ord.order_items.map((i: any) => `${i.quantity}x ${i.product_name}`).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-sm font-black text-slate-900 dark:text-white block">
                        ${Number(ord.total_usd).toFixed(2)} USD
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                        Bs. {Number(ord.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {ord.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(ord)}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="Descargar Comprobante PDF"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA: MIS DATOS */}
      {activeTab === 'profile' && (
        <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 max-w-xl">
          <h2 className="text-base font-black text-slate-900 dark:text-white mb-4">
            Tus Datos Personales y de Envío
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre Completo</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {customer.full_name}
              </p>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Cédula / RIF</span>
              <p className="font-semibold font-mono text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {customer.id_number || 'No especificada'}
              </p>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Teléfono WhatsApp</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {customer.phone || 'No especificado'}
              </p>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Dirección de Entrega Guardada</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {customer.address || 'No especificada'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Estos datos se rellenarán solos cada vez que compres en la tienda.
            </span>
            <Link
              href={`/${tenantSlug}`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
            >
              Ir a Comprar
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CustomerPortalInner />
    </Suspense>
  )
}

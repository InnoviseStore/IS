'use client'

import { useState, useEffect } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { 
  Save, 
  ExternalLink, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Check, 
  Tag, 
  Building2, 
  Truck, 
  BadgePercent, 
  Headphones,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import { getTenantFeatures } from '@/lib/planLimits'
import Link from 'next/link'

export default function SettingsPage() {
  const { tenant, profile, exchangeRate, bcvFechaValor, isSyncingBcv, syncBcvRate, updateTenantSettings } = useTenant()
  const [rate, setRate] = useState(exchangeRate.toString())
  const [phone, setPhone] = useState(tenant?.phone_whatsapp ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [adminSecurityPin, setAdminSecurityPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'superadmin'

  // Estados para la página 'Nosotros'
  const [aboutTitle, setAboutTitle] = useState('')
  const [aboutDescription, setAboutDescription] = useState('')
  const [aboutShippingText, setAboutShippingText] = useState('ENVÍOS A TODO EL PAÍS')
  const [aboutShippingSubtext, setAboutShippingSubtext] = useState('')
  const [aboutPriceText, setAboutPriceText] = useState('EL MEJOR PRECIO DEL MERCADO')
  const [aboutPriceSubtext, setAboutPriceSubtext] = useState('')
  const [aboutSupportText, setAboutSupportText] = useState('SOPORTE POSVENTA')
  const [aboutSupportSubtext, setAboutSupportSubtext] = useState('')

  const features = getTenantFeatures(tenant)

  // Sincronizar inputs cuando cargue el tenant
  useEffect(() => {
    if (tenant) {
      if (tenant.phone_whatsapp) {
        setPhone(tenant.phone_whatsapp)
      }
      const settings = (tenant.settings || {}) as Record<string, unknown>
      const about = (settings.about || {}) as Record<string, string>
      setAdminSecurityPin((settings.admin_security_pin as string) || '1234')

      setAboutTitle(about.title || `Sobre ${tenant.name}`)
      setAboutDescription(
        about.description ||
          'Somos una tienda dedicada a brindar la mejor selección de productos con atención personalizada, entregas confiables y garantía de satisfacción.'
      )
      setAboutShippingText(about.shippingText || 'ENVÍOS A TODO EL PAÍS')
      setAboutShippingSubtext(
        about.shippingSubtext ||
          'Despachos rápidos y asegurados a nivel nacional a través de Zoom, Tealca, MRW y entregas directas.'
      )
      setAboutPriceText(about.priceText || 'EL MEJOR PRECIO DEL MERCADO')
      setAboutPriceSubtext(
        about.priceSubtext ||
          'Precios de oportunidad altamente competitivos y calculados a la tasa oficial del Banco Central de Venezuela.'
      )
      setAboutSupportText(about.supportText || 'SOPORTE POSVENTA')
      setAboutSupportSubtext(
        about.supportSubtext ||
          'Acompañamiento, garantía real y atención personalizada directa por WhatsApp antes y después de tu compra.'
      )
    }
  }, [tenant])

  useEffect(() => {
    setRate(exchangeRate.toString())
  }, [exchangeRate])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMessage(null)

    const r = parseFloat(rate)
    const payload: {
      phone_whatsapp?: string
      currency_rate_bcv?: number
      about?: Record<string, unknown>
      admin_security_pin?: string
    } = {
      phone_whatsapp: phone.trim(),
      about: {
        title: aboutTitle.trim(),
        description: aboutDescription.trim(),
        shippingText: aboutShippingText.trim(),
        shippingSubtext: aboutShippingSubtext.trim(),
        priceText: aboutPriceText.trim(),
        priceSubtext: aboutPriceSubtext.trim(),
        supportText: aboutSupportText.trim(),
        supportSubtext: aboutSupportSubtext.trim(),
      },
    }

    if (isOwnerOrAdmin && adminSecurityPin) {
      payload.admin_security_pin = adminSecurityPin.trim()
    }

    if (!isNaN(r) && r > 0) {
      payload.currency_rate_bcv = r
    }

    const res = await updateTenantSettings(payload)

    setSaving(false)
    if (res.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setErrorMessage(res.error || 'No se pudo guardar la configuración.')
    }
  }

  async function handleLiveSync() {
    const res = await syncBcvRate()
    if (res.rate) {
      setRate(res.rate.toString())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Configuración de Tienda</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
          Parámetros generales y contenido público de {tenant?.name}
        </p>
      </div>

      <div className="glass-card p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80">
        <form onSubmit={handleSave} className="space-y-6">
          {/* SECCIÓN 1: DATOS BÁSICOS */}
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>1. Identidad y Canales</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                Nombre de la Tienda
              </label>
              <input
                type="text"
                disabled
                value={tenant?.name ?? 'Innovise Store'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                Slug del Storefront (URL Pública)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  value={`/${tenant?.slug ?? 'innovise'}`}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-sm cursor-not-allowed font-mono font-semibold"
                />
                <Link
                  href={`/${tenant?.slug ?? 'innovise'}`}
                  target="_blank"
                  className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center justify-center border border-blue-200 dark:border-blue-800/60"
                  title="Abrir vitrina virtual"
                >
                  <ExternalLink className="w-5 h-5" />
                </Link>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                Teléfono WhatsApp (Pedidos Storefront)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="584121234567"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Formato internacional sin signos (ej. 584121234567).</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Tasa Oficial BCV (USD/VES)
                </label>
                <button
                  type="button"
                  onClick={handleLiveSync}
                  disabled={isSyncingBcv}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBcv ? 'animate-spin' : ''}`} />
                  Sincronizar ahora con bcv.org.ve
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">Bs.</span>
                <input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold"
                />
              </div>
              {bcvFechaValor && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Fecha Valor oficial registrada: <strong className="text-slate-800 dark:text-slate-200">{bcvFechaValor}</strong>
                </p>
              )}
            </div>
          </div>

          {/* SECCIÓN DE SEGURIDAD: CLAVE ADMIN (SOLO OWNER / ADMIN) */}
          {isOwnerOrAdmin && (
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>2. Clave de Administrador (Seguridad y Autorizaciones)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Clave exclusiva para autorizar la edición de facturas emitidas y operaciones sensibles de tu tienda.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Solo Admin</span>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Clave de la Tienda
                </label>
                <div className="relative max-w-sm">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={adminSecurityPin}
                    onChange={(e) => setAdminSecurityPin(e.target.value)}
                    placeholder="Mínimo 4 caracteres (ej. 1234)"
                    minLength={4}
                    className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                    title={showPin ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                  Esta clave es configurable por tienda y únicamente visible/editable por administradores y dueños.
                </p>
              </div>
            </div>
          )}

          {/* SECCIÓN 3: PÁGINA "NOSOTROS" EDITABLE */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📖 3. Página Pública &quot;Nosotros&quot;</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personaliza lo que ofrece tu comercio a los visitantes del catálogo.
                </p>
              </div>
              <Link
                href={`/${tenant?.slug ?? 'innovise'}/nosotros`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
              >
                <span>Ver Página Pública</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                Título Principal
              </label>
              <input
                type="text"
                value={aboutTitle}
                onChange={(e) => setAboutTitle(e.target.value)}
                placeholder="Ej. Sobre Innovise Store"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                ¿Qué ofrece tu tienda? (Descripción Detallada)
              </label>
              <textarea
                rows={3}
                value={aboutDescription}
                onChange={(e) => setAboutDescription(e.target.value)}
                placeholder="Explica tu propuesta, experiencia o rubro principal..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
              />
            </div>

            {/* Los 3 Pilares */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Los 3 Pilares y Beneficios Destacados:
              </h3>

              {/* Pilar 1: Envíos */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Truck className="w-4 h-4" />
                  <span>Pilar 1: Logística de Envíos</span>
                </div>
                <input
                  type="text"
                  value={aboutShippingText}
                  onChange={(e) => setAboutShippingText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="ENVÍOS A TODO EL PAÍS"
                />
                <textarea
                  rows={2}
                  value={aboutShippingSubtext}
                  onChange={(e) => setAboutShippingSubtext(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 resize-none"
                  placeholder="Detalle de agencias, zonas de entrega o delivery local..."
                />
              </div>

              {/* Pilar 2: Precios */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <BadgePercent className="w-4 h-4" />
                  <span>Pilar 2: Competitividad de Precios</span>
                </div>
                <input
                  type="text"
                  value={aboutPriceText}
                  onChange={(e) => setAboutPriceText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="EL MEJOR PRECIO DEL MERCADO"
                />
                <textarea
                  rows={2}
                  value={aboutPriceSubtext}
                  onChange={(e) => setAboutPriceSubtext(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 resize-none"
                  placeholder="Explicación de precios justos, ofertas o tasa BCV..."
                />
              </div>

              {/* Pilar 3: Soporte */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <Headphones className="w-4 h-4" />
                  <span>Pilar 3: Atención y Posventa</span>
                </div>
                <input
                  type="text"
                  value={aboutSupportText}
                  onChange={(e) => setAboutSupportText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="SOPORTE POSVENTA"
                />
                <textarea
                  rows={2}
                  value={aboutSupportSubtext}
                  onChange={(e) => setAboutSupportSubtext(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 resize-none"
                  placeholder="Garantía, atención por WhatsApp o cambios..."
                />
              </div>
            </div>
          </div>

          {/* Plan SaaS de la Tienda (Informativo) */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Plan SaaS de la Tienda
              </label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                {features.name}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Estado de Suscripción:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Activo (${features.priceUsd}/mes)
                </span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>Capacidad de Inventario: <strong>{features.maxProducts === Infinity ? 'Productos Ilimitados' : `Hasta ${features.maxProducts} productos`}</strong></li>
                <li>Copiloto IA Edith: <strong>{features.hasAIEdith ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                <li>Ventas a Crédito a 7 días: <strong>{features.hasCreditSales ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                <li>Pagos Divididos multimoneda: <strong>{features.hasSplitPayments ? 'Habilitado' : '1 método por venta en Básico'}</strong></li>
                <li>Importación masiva Excel: <strong>{features.hasBulkImport ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
              </ul>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 italic border-t border-slate-200/60 dark:border-slate-700/40">
                ℹ️ Los cambios de plan y activación de módulos adicionales son gestionados exclusivamente por el Administrador de la plataforma desde el Panel Master.
              </p>
            </div>
          </div>

          {/* Seguridad y Clave de Administrador para Edición de Facturas (Solo Owner / Admin) */}
          {isOwnerOrAdmin && (
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Clave de Administrador de la Tienda
                </label>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Exclusivo Administrador / Propietario
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Esta clave es obligatoria para <strong>editar facturas ya emitidas</strong> o autorizar operaciones restringidas. Los cajeros no tienen acceso a verla ni modificarla.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={adminSecurityPin}
                      onChange={(e) => setAdminSecurityPin(e.target.value)}
                      placeholder="Ej: 1234 o clave segura"
                      minLength={4}
                      className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white tracking-widest outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mínimo 4 dígitos o caracteres (predeterminada: <code>1234</code>). Recuerda presionar &quot;Guardar Configuración&quot;.
                  </span>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" /> Cambios guardados correctamente
              </span>
            ) : <span />}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

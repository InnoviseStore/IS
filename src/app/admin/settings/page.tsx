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
  CreditCard,
  Wallet,
  Smartphone,
  Landmark,
  QrCode,
  Plus,
  Trash2,
  Globe,
  ChevronDown,
  ChevronRight,
  Sliders,
  Layers,
  MessageSquare,
  Bot,
  Send,
} from 'lucide-react'
import { getTenantFeatures } from '@/lib/planLimits'
import Link from 'next/link'

type SectionKey = 'identity' | 'payments' | 'security' | 'about' | 'plan' | 'whatsapp'

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

  // Estados para secciones colapsables (botones desplegables)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    identity: true,
    payments: true,
    security: false,
    about: false,
    plan: false,
    whatsapp: false,
  })

  function toggleSection(key: SectionKey) {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  function setAllSections(open: boolean) {
    setOpenSections({
      identity: open,
      payments: open,
      security: open,
      about: open,
      plan: open,
      whatsapp: open,
    })
  }

  // Estados para la página 'Nosotros'
  const [aboutTitle, setAboutTitle] = useState('')
  const [aboutDescription, setAboutDescription] = useState('')
  const [aboutShippingText, setAboutShippingText] = useState('ENVÍOS A TODO EL PAÍS')
  const [aboutShippingSubtext, setAboutShippingSubtext] = useState('')
  const [aboutPriceText, setAboutPriceText] = useState('EL MEJOR PRECIO DEL MERCADO')
  const [aboutPriceSubtext, setAboutPriceSubtext] = useState('')
  const [aboutSupportText, setAboutSupportText] = useState('SOPORTE POSVENTA')
  const [aboutSupportSubtext, setAboutSupportSubtext] = useState('')

  // Estados de Métodos de Pago y Checkout del Catálogo
  const [checkoutMode, setCheckoutMode] = useState<'whatsapp_only' | 'direct_payment'>('direct_payment')
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])

  // Estados de WhatsApp Automático (Enterprise)
  const [waAutoEnabled, setWaAutoEnabled] = useState(true)
  const [waAutoInvoice, setWaAutoInvoice] = useState(true)
  const [waAutoAbono, setWaAutoAbono] = useState(true)
  const [waAutoWebOrder, setWaAutoWebOrder] = useState(true)
  const [waAutoCreditReminders, setWaAutoCreditReminders] = useState(true)
  const [waStatus, setWaStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected')
  const [waQrCode, setWaQrCode] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState<string | null>(null)

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

      if (settings.checkout_mode) {
        setCheckoutMode(settings.checkout_mode as 'whatsapp_only' | 'direct_payment')
      }

      if (Array.isArray(settings.payment_accounts) && settings.payment_accounts.length > 0) {
        setPaymentAccounts(settings.payment_accounts)
      } else {
        // Inicializar con métodos por defecto si no existen
        setPaymentAccounts([
          {
            id: 'pago_movil_1',
            method: 'pago_movil',
            enabled: true,
            label: 'Pago Móvil Provincial',
            bank_name: 'Banco Provincial (0108)',
            phone: '0426-2485369',
            id_number: 'V-27.250.266',
            instructions: 'Enviar comprobante o últimos 6 dígitos de la referencia.',
          },
          {
            id: 'transfer_1',
            method: 'transferencia',
            enabled: true,
            label: 'Transferencia Bancaria Provincial',
            bank_name: 'Banco Provincial',
            account_holder: 'Yiovanner Miguel Parra Ceballos',
            id_number: 'V-27.250.266',
            account_number: '01080119250100684672',
            instructions: 'Transferencias del mismo banco o interbancarias inmediatas.',
          },
          {
            id: 'binance_1',
            method: 'binance_pay',
            enabled: true,
            label: 'Binance Pay (USDT)',
            qr_image_url: 'https://lh3.googleusercontent.com/pw/AP1GczMGJg-gOgVpO57ohIPRF8YtHT-4eQSDOB_K6ggCifrqW794_xmHC4ztcuSQCix5TiNCOThVWJ11gXZ_oVdAnATlAJEvU9BJvPScxhQg2o6dQRHfIZfmb9iCPQ7oO1d4zNtbwaoLh3oBlJap13aSqJH4LA=w288-h340-s-no-gm',
            instructions: 'Escanea el código QR desde tu app de Binance y paga en USDT.',
          },
        ])
      }

      // Sincronizar configuración de WhatsApp Automático
      const wa = (settings.whatsapp_automation || {}) as Record<string, any>
      setWaAutoEnabled(wa.enabled !== undefined ? Boolean(wa.enabled) : true)
      setWaAutoInvoice(wa.auto_send_invoice !== undefined ? Boolean(wa.auto_send_invoice) : true)
      setWaAutoAbono(wa.auto_send_abono !== undefined ? Boolean(wa.auto_send_abono) : true)
      setWaAutoWebOrder(wa.auto_send_web_order !== undefined ? Boolean(wa.auto_send_web_order) : true)
      setWaAutoCreditReminders(wa.auto_send_credit_reminders !== undefined ? Boolean(wa.auto_send_credit_reminders) : true)
      setWaStatus(wa.status || (tenant.phone_whatsapp ? 'connected' : 'disconnected'))
      setTestPhone(tenant.phone_whatsapp || '')

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
      checkout_mode?: string
      payment_accounts?: any[]
      whatsapp_automation?: any
    } = {
      phone_whatsapp: phone.trim(),
      checkout_mode: checkoutMode,
      payment_accounts: paymentAccounts,
      whatsapp_automation: {
        enabled: waAutoEnabled,
        auto_send_invoice: waAutoInvoice,
        auto_send_abono: waAutoAbono,
        auto_send_web_order: waAutoWebOrder,
        auto_send_credit_reminders: waAutoCreditReminders,
        status: waStatus,
        connected_phone: phone.trim() || '584245259193',
        last_connected_at: new Date().toISOString(),
      },
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

  async function handleRefreshQr() {
    if (!tenant) return
    setWaLoading(true)
    try {
      const res = await fetch(`/api/admin/whatsapp/instance?tenant_id=${tenant.id}`)
      const data = await res.json()
      if (data.qrcode) {
        setWaQrCode(data.qrcode)
        setWaStatus('connecting')
      } else if (data.status === 'connected') {
        setWaStatus('connected')
        setWaQrCode(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setWaLoading(false)
    }
  }

  // Cargar estado real de WhatsApp al abrir la sección
  useEffect(() => {
    if (openSections.whatsapp && tenant) {
      handleRefreshQr()
    }
  }, [openSections.whatsapp, tenant?.id])

  // Sondeo automático cada 4 segundos mientras se esté esperando el escaneo del QR
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (openSections.whatsapp && waStatus === 'connecting' && tenant) {
      timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/whatsapp/instance?tenant_id=${tenant.id}`)
          const data = await res.json()
          if (data.status === 'connected') {
            setWaStatus('connected')
            setWaQrCode(null)
            setTestSuccess('¡WhatsApp vinculado exitosamente!')
            setTimeout(() => setTestSuccess(null), 5000)
          } else if (data.qrcode && data.qrcode !== waQrCode) {
            setWaQrCode(data.qrcode)
          }
        } catch (err) {
          console.warn('Error polling whatsapp status:', err)
        }
      }, 4000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [openSections.whatsapp, waStatus, tenant?.id, waQrCode])


  async function handleSendTestMessage() {
    if (!tenant || !testPhone.trim()) {
      alert('Por favor ingresa un número de teléfono de prueba.')
      return
    }
    setSendingTest(true)
    setTestSuccess(null)
    try {
      const res = await fetch('/api/admin/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          test_phone: testPhone.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestSuccess('¡Mensaje de prueba enviado con éxito!')
        setTimeout(() => setTestSuccess(null), 4000)
      } else {
        alert(data.error || 'No se pudo enviar el mensaje de prueba.')
      }
    } catch (e: any) {
      alert(e.message || 'Error de conexión.')
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Configuración de Tienda
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
            Parámetros operativos, pasarela de pagos y contenido público de {tenant?.name}
          </p>
        </div>

        {/* Botones de acción global para expandir/colapsar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAllSections(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Expandir Todo
          </button>
          <button
            type="button"
            onClick={() => setAllSections(false)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Colapsar Todo
          </button>
        </div>
      </div>

      {/* Botones rápidos de acceso a funciones */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('identity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            openSections.identity
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>1. Identidad</span>
        </button>

        <button
          type="button"
          onClick={() => toggleSection('payments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            openSections.payments
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>2. Pagos & Catálogo</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${openSections.payments ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
            {paymentAccounts.filter(a => a.enabled).length}
          </span>
        </button>

        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={() => toggleSection('security')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              openSections.security
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>3. Clave Admin</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleSection('about')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            openSections.about
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>4. Nosotros</span>
        </button>

        <button
          type="button"
          onClick={() => toggleSection('plan')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            openSections.plan
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>5. Plan SaaS</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 1: IDENTIDAD Y CANALES */}
        {/* ========================================================================= */}
        <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('identity')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>1. Identidad y Canales Oficiales</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Nombre de la tienda, enlace público, WhatsApp y sincronización oficial BCV
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-bold text-slate-500 dark:text-slate-400">
                {openSections.identity ? 'Ocultar' : 'Configurar'}
              </span>
              <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {openSections.identity ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {openSections.identity && (
            <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Teléfono WhatsApp Oficial (Pedidos Storefront)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="584121234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Formato internacional sin signos ni espacios (ej. 584121234567).</p>
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
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
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
          )}
        </div>

        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 2: MÓDULO DE PAGOS Y CHECKOUT DEL CATÁLOGO */}
        {/* ========================================================================= */}
        <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('payments')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>2. Módulo de Pagos y Checkout del Catálogo</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Elige entre Pago Directo en Catálogo o WhatsApp, y configura tus cuentas bancarias y Binance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {paymentAccounts.filter(a => a.enabled).length} cuentas activas
              </span>
              <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {openSections.payments ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {openSections.payments && (
            <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-5 animate-in fade-in duration-150">
              {/* Selector de Modo de Checkout */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-800/40 dark:to-indigo-950/20 border border-blue-200/60 dark:border-indigo-900/40 space-y-3">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Modo de Compra de la Vitrina:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setCheckoutMode('direct_payment')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      checkoutMode === 'direct_payment'
                        ? 'border-blue-600 bg-white dark:bg-slate-800 shadow-md shadow-blue-500/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" /> Pago Directo en Catálogo
                      </span>
                      {checkoutMode === 'direct_payment' && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      El cliente ve el botón <strong>&quot;Completar Compra&quot;</strong>, ingresa sus datos, elige entrega, ve tus cuentas bancarias y reporta su referencia de pago en la web.
                    </p>
                  </div>

                  <div
                    onClick={() => setCheckoutMode('whatsapp_only')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      checkoutMode === 'whatsapp_only'
                        ? 'border-emerald-600 bg-white dark:bg-slate-800 shadow-md shadow-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Globe className="w-4 h-4" /> Solo WhatsApp
                      </span>
                      {checkoutMode === 'whatsapp_only' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      El cliente arma su carrito y envía el pedido directamente por mensaje estructurado a tu WhatsApp oficial.
                    </p>
                  </div>
                </div>
              </div>

              {/* Listado de Cuentas Receptoras */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Cuentas Receptoras Configuradas ({paymentAccounts.filter(a => a.enabled).length} activas):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = 'acc_' + Date.now()
                      setPaymentAccounts([
                        ...paymentAccounts,
                        {
                          id: newId,
                          method: 'pago_movil',
                          enabled: true,
                          label: 'Nueva Cuenta / Pago Móvil',
                          bank_name: '',
                          phone: '',
                          id_number: '',
                          instructions: '',
                        },
                      ])
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Método
                  </button>
                </div>

                {paymentAccounts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No tienes métodos de pago configurados para el checkout. Haz clic en &quot;Agregar Método&quot; para añadir Pago Móvil, Transferencia, Zelle o Binance Pay.
                    </p>
                  </div>
                ) : (
                  paymentAccounts.map((account, index) => (
                    <div
                      key={account.id || index}
                      className={`p-4 rounded-2xl border transition-all ${
                        account.enabled
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-sm'
                          : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                            {account.method === 'pago_movil' && <Smartphone className="w-4 h-4" />}
                            {account.method === 'transferencia' && <Landmark className="w-4 h-4" />}
                            {account.method === 'binance_pay' && <QrCode className="w-4 h-4" />}
                            {account.method === 'zelle' && <Wallet className="w-4 h-4" />}
                          </span>
                          <input
                            type="text"
                            value={account.label || ''}
                            onChange={(e) => {
                              const updated = [...paymentAccounts]
                              updated[index].label = e.target.value
                              setPaymentAccounts(updated)
                            }}
                            placeholder="Etiqueta visible (ej. Pago Móvil Provincial)"
                            className="font-bold text-xs text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={account.enabled}
                              onChange={(e) => {
                                const updated = [...paymentAccounts]
                                updated[index].enabled = e.target.checked
                                setPaymentAccounts(updated)
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>{account.enabled ? 'Activo' : 'Pausado'}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentAccounts(paymentAccounts.filter((_, i) => i !== index))
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 transition cursor-pointer"
                            title="Eliminar método"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Tipo de Método
                          </label>
                          <select
                            value={account.method}
                            onChange={(e) => {
                              const updated = [...paymentAccounts]
                              updated[index].method = e.target.value
                              setPaymentAccounts(updated)
                            }}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="pago_movil">Pago Móvil (Bolívares)</option>
                            <option value="transferencia">Transferencia Bancaria (Bolívares)</option>
                            <option value="binance_pay">Binance Pay QR (USDT)</option>
                            <option value="zelle">Zelle (USD)</option>
                          </select>
                        </div>

                        {account.method !== 'binance_pay' && account.method !== 'zelle' && (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                              Banco
                            </label>
                            <input
                              type="text"
                              value={account.bank_name || ''}
                              onChange={(e) => {
                                const updated = [...paymentAccounts]
                                updated[index].bank_name = e.target.value
                                setPaymentAccounts(updated)
                              }}
                              placeholder="Ej. Banco Provincial (0108)"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                        )}

                        {account.method === 'pago_movil' && (
                          <>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Teléfono Afiliado
                              </label>
                              <input
                                type="text"
                                value={account.phone || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].phone = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="0426-2485369"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Cédula / RIF del Titular
                              </label>
                              <input
                                type="text"
                                value={account.id_number || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].id_number = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="V-27.250.266"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                          </>
                        )}

                        {account.method === 'transferencia' && (
                          <>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Número de Cuenta (20 dígitos)
                              </label>
                              <input
                                type="text"
                                value={account.account_number || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].account_number = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="01080119250100684672"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Titular de la Cuenta
                              </label>
                              <input
                                type="text"
                                value={account.account_holder || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].account_holder = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="Yiovanner Miguel Parra Ceballos"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Cédula / RIF
                              </label>
                              <input
                                type="text"
                                value={account.id_number || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].id_number = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="V-27.250.266"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                          </>
                        )}

                        {account.method === 'binance_pay' && (
                          <>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Enlace Directo de Pago Binance (Universal QR Link)
                              </label>
                              <input
                                type="url"
                                value={account.payment_url || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].payment_url = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="https://app.binance.com/uni-qr/..."
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">
                                Enlace oficial para que los clientes paguen con 1 clic directo desde su app de Binance en el celular sin tener que escanear.
                              </p>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                URL de Imagen del Código QR Binance
                              </label>
                              <input
                                type="text"
                                value={account.qr_image_url || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].qr_image_url = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="https://lh3.googleusercontent.com/... o enlace de tu QR"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                              />
                            </div>
                          </>
                        )}

                        {account.method === 'zelle' && (
                          <>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Correo Electrónico de Zelle
                              </label>
                              <input
                                type="email"
                                value={account.email || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].email = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="tu-correo-zelle@ejemplo.com"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Nombre del Titular Zelle
                              </label>
                              <input
                                type="text"
                                value={account.account_holder || ''}
                                onChange={(e) => {
                                  const updated = [...paymentAccounts]
                                  updated[index].account_holder = e.target.value
                                  setPaymentAccounts(updated)
                                }}
                                placeholder="Nombre y Apellido"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                          </>
                        )}

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Instrucciones adicionales para el comprador
                          </label>
                          <input
                            type="text"
                            value={account.instructions || ''}
                            onChange={(e) => {
                              const updated = [...paymentAccounts]
                              updated[index].instructions = e.target.value
                              setPaymentAccounts(updated)
                            }}
                            placeholder="Ej. Colocar en concepto número de orden. Enviar captura por WhatsApp."
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 3: SEGURIDAD Y CLAVE DE ADMINISTRADOR (ÚNICA SECCIÓN) */}
        {/* ========================================================================= */}
        {isOwnerOrAdmin && (
          <div className="border border-amber-200/80 dark:border-amber-900/60 rounded-2xl overflow-hidden bg-amber-50/20 dark:bg-amber-950/10 backdrop-blur-md shadow-sm transition-all">
            <button
              type="button"
              onClick={() => toggleSection('security')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>3. Clave de Administrador (Seguridad y Autorizaciones)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Clave exclusiva requerida para anular pedidos, editar facturas y autorizar operaciones sensibles
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Solo Admin</span>
                </span>
                <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60">
                  {openSections.security ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
            </button>

            {openSections.security && (
              <div className="p-5 sm:p-6 border-t border-amber-200/60 dark:border-amber-900/50 space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-slate-700 dark:text-slate-300">
                  Esta clave protege tu comercio evitando que cajeros o usuarios sin autorización modifiquen o anulen facturas registradas. Es confidencial y administrada únicamente por el dueño de la tienda.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                    PIN / Clave Maestra de la Tienda
                  </label>
                  <div className="relative max-w-sm">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={adminSecurityPin}
                      onChange={(e) => setAdminSecurityPin(e.target.value)}
                      placeholder="Mínimo 4 dígitos o caracteres"
                      minLength={4}
                      className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    (Valor predeterminado inicial: <code>1234</code>). Cámbialo por un código seguro y presiona &quot;Guardar Configuración&quot;.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 4: PÁGINA PÚBLICA "NOSOTROS" */}
        {/* ========================================================================= */}
        <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('about')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>4. Página Pública &quot;Nosotros&quot; y Pilares</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personaliza la presentación de tu negocio, logística, precios y atención para los clientes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${tenant?.slug ?? 'innovise'}/nosotros`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition"
              >
                <span>Ver En Vivo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {openSections.about ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {openSections.about && (
            <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Título Principal de la Sección
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
          )}
        </div>

        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 5: PLAN SAAS DE LA TIENDA */}
        {/* ========================================================================= */}
        <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('plan')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>5. Plan SaaS y Límites del Sistema</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Plan actual de tu tienda, límites de productos y módulos activados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                {features.name}
              </span>
              <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {openSections.plan ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {openSections.plan && (
            <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Estado de Suscripción:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Activo (${features.priceUsd}/mes)
                  </span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Capacidad de Inventario: <strong>{features.maxProducts === Infinity ? 'Productos Ilimitados' : `Hasta ${features.maxProducts} productos`}</strong></li>
                  <li>Copiloto IA Edith: <strong>{features.hasAIEdith ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                  <li>Ventas a Crédito a 7 días: <strong>{features.hasCreditSales ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                  <li>Pagos Divididos multimoneda: <strong>{features.hasSplitPayments ? 'Habilitado' : '1 método por venta en Básico'}</strong></li>
                  <li>Importación masiva Excel: <strong>{features.hasBulkImport ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                  <li>Checkout Directo en Catálogo: <strong>{features.hasDirectCheckout ? 'Habilitado' : 'Exclusivo Plan Pro / Enterprise'}</strong></li>
                  <li>WhatsApp Automático (Facturación & Cobranzas): <strong>{features.hasWhatsAppAutomation ? 'Habilitado' : 'Exclusivo Plan Enterprise'}</strong></li>
                </ul>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 italic border-t border-slate-200/60 dark:border-slate-700/40">
                  ℹ️ Los cambios de plan y activación de módulos adicionales son gestionados exclusivamente por el Administrador de la plataforma desde el Panel Master.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BOTÓN DESPLEGABLE 6: WHATSAPP AUTOMÁTICO (ENTERPRISE) */}
        {/* ========================================================================= */}
        <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('whatsapp')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>6. WhatsApp Automático (Gateway QR)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Enterprise
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Envío automático de facturas POS, comprobantes de abono, pedidos web y recordatorios de cobro
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                waStatus === 'connected' 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200' 
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {waStatus === 'connected' ? '🟢 Conectado' : '🔴 Desconectado'}
              </span>
              <div className="p-1 rounded-lg text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {openSections.whatsapp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {openSections.whatsapp && (
            <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-5 animate-in fade-in duration-150 text-xs">
              {!features.hasWhatsAppAutomation && profile?.role !== 'superadmin' ? (
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-purple-900 dark:text-purple-200">
                    <AlertCircle className="w-4 h-4 text-purple-600" />
                    <span>Módulo Exclusivo del Plan Enterprise</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    La automatización integral de WhatsApp permite que tu tienda envíe facturas y cobros en segundo plano mediante un Gateway con Código QR sin tocar un solo botón. Solicita la actualización al Plan Enterprise con el Administrador.
                  </p>
                </div>
              ) : (
                <>
                  {/* Estado de Conexión y Vinculación QR */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center gap-5 justify-between">
                    <div className="space-y-1.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                          Línea de WhatsApp Vinculada:
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-sm bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          +{phone || '584245259193'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                        {waStatus === 'connected'
                          ? 'Tu número de WhatsApp Business está sincronizado y listo para enviar notificaciones automáticas 24/7.'
                          : 'Escanea el código QR desde tu aplicación de WhatsApp en "Dispositivos vinculados" para activar la sincronización.'}
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRefreshQr}
                          disabled={waLoading}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {waLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-500" />}
                          <span>{waStatus === 'connected' ? 'Verificar Conexión' : 'Generar Código QR'}</span>
                        </button>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                      {waStatus === 'connected' ? (
                        <div className="w-36 h-36 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-center p-2">
                          <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-1" />
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            Sesión Activa
                          </span>
                          <span className="text-[10px] text-slate-400">WhatsApp Web Conectado</span>
                        </div>
                      ) : (
                        <div className="w-36 h-36 flex flex-col items-center justify-center">
                          {waQrCode ? (
                            <img src={waQrCode} alt="Código QR WhatsApp" className="w-32 h-32 rounded-lg" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                              <QrCode className="w-10 h-10 mb-1 opacity-50" />
                              <span className="text-[10px]">Pulsa en Generar QR</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interruptores de Automatización */}
                  <div className="space-y-3">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                      Eventos y Disparadores Automáticos:
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Facturación POS */}
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waAutoInvoice}
                          onChange={(e) => setWaAutoInvoice(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            Facturación POS Automática
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Envía el comprobante detallado con productos y tasa BCV al cliente registrado al cobrar.
                          </span>
                        </div>
                      </label>

                      {/* Abonos */}
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waAutoAbono}
                          onChange={(e) => setWaAutoAbono(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            Comprobante de Abonos
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Envía el recibo de pago y el nuevo saldo pendiente cuando se registre un abono.
                          </span>
                        </div>
                      </label>

                      {/* Pedidos Web */}
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waAutoWebOrder}
                          onChange={(e) => setWaAutoWebOrder(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            Pedidos del Catálogo Web
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Notifica confirmación al cliente y alerta al dueño de la tienda al registrarse un pedido.
                          </span>
                        </div>
                      </label>

                      {/* Cobranza de Créditos */}
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waAutoCreditReminders}
                          onChange={(e) => setWaAutoCreditReminders(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            Recordatorios de Cobro Automáticos
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Envía aviso preventivo (2 días antes), al vencer y en mora a clientes con saldo adeudado.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Prueba de Envío */}
                  <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2">
                    <label className="block font-bold text-blue-900 dark:text-blue-200 text-xs">
                      Probar Envío de Mensaje de Verificación:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="Ej. 04245259193 o 584245259193"
                        className="flex-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestMessage}
                        disabled={sendingTest}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Enviar Prueba</span>
                      </button>
                    </div>
                    {testSuccess && (
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {testSuccess}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mensaje de error general */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Barra flotante inferior de guardar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-900/5">
          <div>
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" /> Cambios guardados correctamente
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Recuerda guardar tras modificar cualquier sección
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
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
  )
}

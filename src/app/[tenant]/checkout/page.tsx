'use client'

import React, { useState, useEffect, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/hooks/useCart'
import { CustomerProvider, useCustomer } from '@/contexts/CustomerContext'
import { getTenantFeatures } from '@/lib/planLimits'
import { 
  User, MapPin, CreditCard, Truck, Store, Package, 
  ChevronLeft, ChevronRight, Check, Copy, Loader2, 
  ShoppingBag, AlertCircle, CheckCircle2, MessageCircle, 
  Phone, Hash, Building2, Wallet, QrCode, Globe, Navigation, ExternalLink, Sparkles
} from 'lucide-react'
import { COUNTRY_CODES, normalizeWhatsAppPhone } from '@/lib/whatsapp'

// Interfaces
interface StorefrontPaymentAccount {
  id: string
  method: 'pago_movil' | 'transferencia' | 'zelle' | 'binance_pay'
  enabled: boolean
  label: string
  bank_name?: string
  account_holder?: string
  id_number?: string
  phone?: string
  account_number?: string
  email?: string
  qr_image_url?: string
  payment_url?: string
  instructions?: string
}

interface TenantData {
  name: string
  phone_whatsapp: string
  currency_rate_bcv: number
  settings: {
    payment_accounts?: StorefrontPaymentAccount[]
    checkout_mode?: string
  }
}

interface CustomerData {
  full_name: string
  id_prefix: string
  id_number: string
  country_code: string
  phone: string
  address: string
  notes: string
}

interface DeliveryData {
  method: 'retiro_sitio' | 'envio_nacional' | 'delivery_local' | ''
  shipping_agency?: string
  agency_address?: string
  delivery_coords?: { lat: number; lng: number } | null
}

interface PaymentData {
  method: string
  reference: string
  account_name?: string
}

const STORAGE_KEY = 'is_checkout_customer'

function CheckoutInner() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params.tenant as string
  const supabase = createClient()
  const { items, totalUsd, totalVes, itemCount, clearCart } = useCart()
  const { customer: loggedCustomer, logout: logoutCustomer } = useCustomer()

  const [tenantData, setTenantData] = useState<TenantData | null>(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  
  const features = tenantData ? getTenantFeatures(tenantData as any) : null
  const checkoutMode = tenantData?.settings?.checkout_mode || 'optional'

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [confirmedTotalUsd, setConfirmedTotalUsd] = useState(0)
  const [autoWhatsAppSent, setAutoWhatsAppSent] = useState(false)

  // Form State
  const [customer, setCustomer] = useState<CustomerData>({
    full_name: '',
    id_prefix: 'V-',
    id_number: '',
    country_code: '58',
    phone: '',
    address: '',
    notes: ''
  })

  // Autocompletar datos si el cliente tiene sesión iniciada
  useEffect(() => {
    if (loggedCustomer) {
      let prefix = 'V-'
      let num = loggedCustomer.id_number || ''
      if (num.startsWith('V-') || num.startsWith('J-') || num.startsWith('E-') || num.startsWith('G-')) {
        prefix = num.slice(0, 2)
        num = num.slice(2)
      } else if (num.startsWith('V') || num.startsWith('J') || num.startsWith('E') || num.startsWith('G')) {
        prefix = num.slice(0, 1) + '-'
        num = num.slice(1)
      }

      let phone = loggedCustomer.phone || ''
      let countryCode = '58'
      if (phone.startsWith('58')) {
        phone = phone.slice(2)
      }

      setCustomer((prev) => ({
        ...prev,
        full_name: loggedCustomer.full_name || prev.full_name,
        id_prefix: prefix,
        id_number: num || prev.id_number,
        country_code: countryCode,
        phone: phone || prev.phone,
        address: loggedCustomer.address || prev.address,
      }))
    }
  }, [loggedCustomer])
  const [errorsCustomer, setErrorsCustomer] = useState<Record<string, string>>({})

  const [delivery, setDelivery] = useState<DeliveryData>({
    method: '',
    shipping_agency: 'MRW',
    agency_address: '',
    delivery_coords: null
  })
  const [errorsDelivery, setErrorsDelivery] = useState<Record<string, string>>({})
  const [isLocating, setIsLocating] = useState(false)
  const [locationSuccess, setLocationSuccess] = useState(false)

  // Geolocalización del usuario para Delivery Local con reintento y fallback
  const handleGetDeviceLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Tu navegador o dispositivo no soporta geolocalización.')
      return
    }
    setIsLocating(true)

    const onLocationSuccess = (position: GeolocationPosition) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      setDelivery(prev => ({ ...prev, delivery_coords: coords }))
      setLocationSuccess(true)
      setIsLocating(false)
    }

    const onLocationError = (error: GeolocationPositionError) => {
      if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(
          onLocationSuccess,
          (fallbackErr) => {
            setIsLocating(false)
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              alert('Permiso de ubicación denegado. Por favor permite el acceso en tu navegador o escribe tu dirección.')
            } else {
              alert('No se pudo acceder a tu ubicación GPS en este momento. Puedes ingresar tu dirección escrita.')
            }
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        )
        return
      }

      setIsLocating(false)
      if (error.code === error.PERMISSION_DENIED) {
        alert('Permiso de ubicación denegado. Por favor permite el acceso a tu ubicación en los ajustes de tu navegador o escribe tu dirección.')
      } else {
        alert('No se pudo acceder a tu ubicación GPS. Asegúrate de permitir el permiso de ubicación en tu navegador o escribe tu dirección.')
      }
    }

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      onLocationError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }

  const [payment, setPayment] = useState<PaymentData>({
    method: '',
    reference: '',
    account_name: ''
  })
  const [errorsPayment, setErrorsPayment] = useState<Record<string, string>>({})

  // Copy Feedback State
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    async function loadTenantData() {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('name, phone_whatsapp, currency_rate_bcv, settings')
          .eq('slug', tenantSlug)
          .single()

        if (error) throw error
        if (data) setTenantData(data as TenantData)
      } catch (err) {
        console.error('Error loading tenant:', err)
      } finally {
        setLoadingTenant(false)
      }
    }

    if (tenantSlug) {
      loadTenantData()
    }
    
    // Load saved customer
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCustomer(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        // ignore
      }
    }
  }, [tenantSlug, supabase])

  const effectiveExchangeRate = tenantData?.currency_rate_bcv || (totalUsd > 0 ? totalVes / totalUsd : 91.5)
  const effectiveTotalVes = totalUsd * effectiveExchangeRate

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const validateStep1 = () => {
    const errors: Record<string, string> = {}
    if (!customer.full_name.trim()) errors.full_name = 'El nombre es requerido'
    if (!customer.id_number.trim()) errors.id_number = 'La cédula/RIF es requerida'
    if (!customer.phone.trim()) errors.phone = 'El teléfono es requerido'
    setErrorsCustomer(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors: Record<string, string> = {}
    if (!delivery.method) {
      errors.method = 'Selecciona un método de entrega'
    } else {
      if (delivery.method === 'envio_nacional') {
        if (!delivery.agency_address?.trim()) errors.agency_address = 'Indica la sucursal o dirección destino'
      }
      if (delivery.method === 'delivery_local') {
        if (!customer.address.trim()) errors.address = 'La dirección de entrega es requerida'
      }
    }
    setErrorsDelivery(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep3 = () => {
    const errors: Record<string, string> = {}
    if (!payment.method) {
      errors.method = 'Selecciona un método de pago'
    } else {
      const selectedAccount = paymentAccounts.find(a => a.id === payment.method)
      if (selectedAccount?.method === 'pago_movil' || selectedAccount?.method === 'transferencia' || selectedAccount?.method === 'binance_pay') {
        if (!payment.reference.trim()) errors.reference = 'La referencia es requerida'
      } else if (selectedAccount?.method === 'zelle') {
        if (!payment.account_name?.trim()) errors.account_name = 'El nombre del titular es requerido'
        if (!payment.reference.trim()) errors.reference = 'La referencia es requerida'
      }
    }
    setErrorsPayment(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customer))
      setCurrentStep(2)
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const selectedAccount = paymentAccounts.find(a => a.id === payment.method)

      const payload = {
        tenantSlug: tenantSlug,
        tenant_slug: tenantSlug,
        items: items.map(i => ({
          product_id: i.product_id,
          name: i.name,
          sku: i.sku,
          unit_price_usd: i.unit_price_usd,
          quantity: i.quantity
        })),
        customer: {
          full_name: customer.full_name,
          id_number: `${customer.id_prefix}${customer.id_number}`,
          phone: normalizeWhatsAppPhone(customer.phone, customer.country_code || '58'),
          address: customer.address,
          notes: customer.notes,
          delivery_coords: delivery.delivery_coords || undefined,
          deliveryCoords: delivery.delivery_coords || undefined
        },
        delivery_method: delivery.method,
        delivery_coords: delivery.delivery_coords || undefined,
        deliveryCoords: delivery.delivery_coords || undefined,
        shipping_agency: delivery.shipping_agency,
        agency_address: delivery.agency_address,
        payment_method: selectedAccount?.method,
        payment_reference: payment.reference,
        total_usd: totalUsd,
        exchange_rate: effectiveExchangeRate
      }

      const res = await fetch('/api/storefront/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al procesar el pedido')
      }

      const data = await res.json()
      
      // Success: almacenar el total confirmado antes de vaciar el carrito reactivo
      const finalRecordedUsd = data.total_usd !== undefined ? Number(data.total_usd) : totalUsd
      setConfirmedTotalUsd(finalRecordedUsd)
      setOrderNumber(data.order_number || data.id?.substring(0, 8).toUpperCase() || 'ORD-0000')
      if (data.auto_whatsapp_sent) {
        setAutoWhatsAppSent(true)
      }
      clearCart()
      setOrderComplete(true)

    } catch (err: any) {
      setSubmitError(err.message || 'Error de conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (itemCount === 0 && !orderComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl rounded-3xl p-8 max-w-md w-full text-center">
          <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Tu carrito está vacío</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">Agrega algunos productos para poder realizar tu pedido.</p>
          <button 
            onClick={() => router.push(`/${tenantSlug}`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors w-full"
          >
            Volver a la Tienda
          </button>
        </div>
      </div>
    )
  }

  const paymentAccounts = tenantData?.settings?.payment_accounts?.filter(a => a.enabled) || []

  if (orderComplete) {
    const waLines = [
      '¡Hola! Acabo de realizar un pedido en la tienda.',
      '',
      `*N° Pedido:* #${orderNumber}`,
      `*Monto:* $${confirmedTotalUsd.toFixed(2)} USD`,
      payment.reference ? `*Referencia:* ${payment.reference}` : null,
      delivery.delivery_coords ? `📍 *Ubicación GPS:* https://maps.google.com/?q=${delivery.delivery_coords.lat},${delivery.delivery_coords.lng}` : null,
      customer.address ? `🏠 *Dirección:* ${customer.address}` : null
    ].filter(Boolean)
    const waMessage = waLines.join('\n')
    const waLink = `https://wa.me/${tenantData?.phone_whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-emerald-100 dark:border-emerald-900/50 shadow-xl rounded-3xl max-w-lg w-full overflow-hidden text-center">
          <div className="bg-emerald-500/10 dark:bg-emerald-500/5 p-8 flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-lg shadow-emerald-500/30">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">¡Pedido Confirmado!</h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg">Tu orden ha sido registrada con éxito</p>
          </div>
          
          <div className="p-8">
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 mb-6 inline-block w-full max-w-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">N° de Orden</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white font-mono mb-3">{orderNumber}</p>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total a Pagar:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-base">
                  ${confirmedTotalUsd.toFixed(2)} USD
                </span>
              </div>
            </div>

            {autoWhatsAppSent ? (
              <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 p-4 rounded-2xl text-left mb-8 border border-emerald-200 dark:border-emerald-800/50">
                <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm">
                  <strong>¡Confirmación enviada a tu WhatsApp!</strong> Hemos despachado automáticamente los detalles de tu orden a tu teléfono ({customer.phone}). El equipo de {tenantData?.name || 'la tienda'} ya está procesando tu solicitud.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-4 rounded-xl text-left mb-8">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">Tu pedido está <strong>Pendiente de Verificación</strong>. Será procesado una vez confirmado el pago por el equipo de {tenantData?.name || 'la tienda'}.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {autoWhatsAppSent ? (
                <>
                  <button 
                    onClick={() => router.push(`/${tenantSlug}`)}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    Volver a la Tienda
                  </button>
                  <a 
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold py-2 transition text-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Abrir chat de la tienda (Opcional)
                  </a>
                </>
              ) : (
                <>
                  <a 
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Enviar Comprobante por WhatsApp
                  </a>
                  <button 
                    onClick={() => router.push(`/${tenantSlug}`)}
                    className="flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-xl font-medium transition-all"
                  >
                    Volver a la Tienda
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => currentStep > 1 ? handleBack() : router.push(`/${tenantSlug}`)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">{currentStep > 1 ? 'Atrás' : 'Volver a la Tienda'}</span>
          </button>
          
          <div className="flex items-center gap-2 md:gap-4">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep === step 
                    ? 'bg-indigo-600 text-white' 
                    : currentStep > step 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {currentStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-4 md:w-12 h-1 mx-1 md:mx-2 rounded-full ${
                    currentStep > step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="w-[88px] text-right">
            <span className="font-bold text-slate-900 dark:text-white">${totalUsd.toFixed(2)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[1fr_320px] gap-8">
          
          {/* Main Form Area */}
          <div className="space-y-6">
            
            {/* STEP 1: Datos del Cliente */}
            {currentStep === 1 && (
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Datos del Cliente</h2>
                </div>

                {/* Banner de Portal de Clientes (Plan Pro / Enterprise) */}
                {features?.hasCustomerPortal && (
                  <>
                    {loggedCustomer ? (
                      <div className="p-3.5 mb-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Sesión iniciada como <strong>{loggedCustomer.full_name}</strong>. Tus datos han sido autocompletados.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/${tenantSlug}/cuenta`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                            Mi Cuenta
                          </Link>
                          <button
                            type="button"
                            onClick={logoutCustomer}
                            className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Salir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 mb-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
                          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            ¿Ya tienes cuenta en <strong>{tenantData?.name || 'la tienda'}</strong>? Inicia sesión para cargar tus datos en 1 clic.
                          </span>
                        </div>
                        <Link
                          href={`/${tenantSlug}/cuenta`}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition shrink-0"
                        >
                          Iniciar Sesión / Registrarme
                        </Link>
                      </div>
                    )}

                    {checkoutMode === 'customer_login_required' && !loggedCustomer && (
                      <div className="p-4 mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                        <p className="font-bold mb-1">Inicio de sesión obligatorio</p>
                        <p className="mb-3">Esta tienda requiere que inicies sesión o te registres para realizar compras.</p>
                        <Link
                          href={`/${tenantSlug}/cuenta`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                        >
                          <span>Iniciar Sesión / Registrarme</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      value={customer.full_name}
                      onChange={e => setCustomer({...customer, full_name: e.target.value})}
                      className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                        errorsCustomer.full_name ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                      placeholder="Ej. Juan Pérez"
                    />
                    {errorsCustomer.full_name && <p className="text-rose-500 text-sm mt-1">{errorsCustomer.full_name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cédula o RIF <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={customer.id_prefix}
                        onChange={e => setCustomer({...customer, id_prefix: e.target.value})}
                        className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="V-">V-</option>
                        <option value="E-">E-</option>
                        <option value="J-">J-</option>
                        <option value="G-">G-</option>
                      </select>
                      <input 
                        type="text" 
                        value={customer.id_number}
                        onChange={e => setCustomer({...customer, id_number: e.target.value.replace(/\D/g, '')})}
                        className={`flex-1 px-4 py-3 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                          errorsCustomer.id_number ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                        placeholder="12345678"
                      />
                    </div>
                    {errorsCustomer.id_number && <p className="text-rose-500 text-sm mt-1">{errorsCustomer.id_number}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono (WhatsApp) <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={customer.country_code || '58'}
                        onChange={e => setCustomer({...customer, country_code: e.target.value})}
                        className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm font-medium"
                        title="Código de país internacional"
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.flag} +{c.code}
                          </option>
                        ))}
                      </select>
                      <input 
                        type="tel" 
                        value={customer.phone}
                        onChange={e => setCustomer({...customer, phone: e.target.value})}
                        className={`flex-1 px-4 py-3 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                          errorsCustomer.phone ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                        placeholder="04141234567 o 4141234567"
                      />
                    </div>
                    {errorsCustomer.phone && <p className="text-rose-500 text-sm mt-1">{errorsCustomer.phone}</p>}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Elige el código de tu país para coordinar tu entrega y pago sin errores.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas u observaciones (Opcional)</label>
                    <textarea 
                      value={customer.notes}
                      onChange={e => setCustomer({...customer, notes: e.target.value})}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      placeholder="Alguna indicación especial..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Método de Entrega */}
            {currentStep === 2 && (
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <MapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Método de Entrega</h2>
                </div>

                {errorsDelivery.method && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium">
                    {errorsDelivery.method}
                  </div>
                )}

                <div className="grid gap-4 mb-6">
                  {/* Retiro */}
                  <label className={`relative flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    delivery.method === 'retiro_sitio' 
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}>
                    <input 
                      type="radio" 
                      name="delivery_method" 
                      value="retiro_sitio"
                      checked={delivery.method === 'retiro_sitio'}
                      onChange={() => setDelivery({...delivery, method: 'retiro_sitio'})}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      delivery.method === 'retiro_sitio' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {delivery.method === 'retiro_sitio' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Store className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        <span className="font-bold text-slate-900 dark:text-white">Retiro en Tienda</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Coordina el retiro directamente con el vendedor</p>
                    </div>
                  </label>

                  {/* Envío */}
                  <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    delivery.method === 'envio_nacional' 
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}>
                    <div className="flex items-start gap-4">
                      <input 
                        type="radio" 
                        name="delivery_method" 
                        value="envio_nacional"
                        checked={delivery.method === 'envio_nacional'}
                        onChange={() => setDelivery({...delivery, method: 'envio_nacional'})}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        delivery.method === 'envio_nacional' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {delivery.method === 'envio_nacional' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                          <span className="font-bold text-slate-900 dark:text-white">Envío Nacional</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Cobro a destino · Zoom · Tealca · MRW</p>
                      </div>
                    </div>

                    {delivery.method === 'envio_nacional' && (
                      <div className="ml-10 mt-4 space-y-4 animate-in slide-in-from-top-2">
                        <div>
                          <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Agencia</label>
                          <select 
                            value={delivery.shipping_agency}
                            onChange={e => setDelivery({...delivery, shipping_agency: e.target.value})}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="MRW">MRW</option>
                            <option value="Zoom">Zoom</option>
                            <option value="Tealca">Tealca</option>
                            <option value="Domesa">Domesa</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Sucursal o Dirección Destino <span className="text-rose-500">*</span></label>
                          <input 
                            type="text" 
                            value={delivery.agency_address}
                            onChange={e => setDelivery({...delivery, agency_address: e.target.value})}
                            className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none ${
                              errorsDelivery.agency_address ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                            }`}
                            placeholder="Ej. Oficina MRW Centro..."
                          />
                          {errorsDelivery.agency_address && <p className="text-rose-500 text-xs mt-1">{errorsDelivery.agency_address}</p>}
                        </div>
                      </div>
                    )}
                  </label>

                  {/* Delivery */}
                  <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    delivery.method === 'delivery_local' 
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}>
                    <div className="flex items-start gap-4">
                      <input 
                        type="radio" 
                        name="delivery_method" 
                        value="delivery_local"
                        checked={delivery.method === 'delivery_local'}
                        onChange={() => setDelivery({...delivery, method: 'delivery_local'})}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        delivery.method === 'delivery_local' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {delivery.method === 'delivery_local' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                          <span className="font-bold text-slate-900 dark:text-white">Delivery Local</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Entrega a domicilio en tu ciudad</p>
                      </div>
                    </div>

                    {delivery.method === 'delivery_local' && (
                      <div className="ml-10 mt-4 space-y-3 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Dirección de Entrega <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleGetDeviceLocation}
                            disabled={isLocating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                            title="Obtener coordenadas GPS del dispositivo"
                          >
                            {isLocating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Navigation className="w-3.5 h-3.5" />
                            )}
                            <span>{locationSuccess && delivery.delivery_coords ? 'Ubicación Fijada ✓' : '📍 Marcar mi ubicación (GPS)'}</span>
                          </button>
                        </div>

                        <textarea 
                          value={customer.address}
                          onChange={e => setCustomer({...customer, address: e.target.value})}
                          rows={3}
                          className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${
                            errorsDelivery.address ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                          }`}
                          placeholder="Urbanización, calle, casa/apto, punto de referencia..."
                        />
                        {errorsDelivery.address && <p className="text-rose-500 text-xs mt-1">{errorsDelivery.address}</p>}

                        {/* Coordenadas GPS y Enlace Directo a Google Maps */}
                        {delivery.delivery_coords && (
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                              <span className="font-mono text-indigo-900 dark:text-indigo-200 font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                GPS: {delivery.delivery_coords.lat.toFixed(6)}, {delivery.delivery_coords.lng.toFixed(6)}
                              </span>
                              <a
                                href={`https://maps.google.com/?q=${delivery.delivery_coords.lat},${delivery.delivery_coords.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-bold underline cursor-pointer"
                              >
                                <span>Ver en Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            
                            {/* Mapa Iframe Interactivo */}
                            <div className="rounded-lg overflow-hidden border border-indigo-200 dark:border-indigo-800 h-36">
                              <iframe
                                title="Mapa de Ubicación GPS"
                                src={`https://maps.google.com/maps?q=${delivery.delivery_coords.lat},${delivery.delivery_coords.lng}&z=16&output=embed`}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* STEP 3: Método de Pago */}
            {currentStep === 3 && (
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Método de Pago</h2>
                </div>

                {errorsPayment.method && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium">
                    {errorsPayment.method}
                  </div>
                )}
                
                {submitError && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {paymentAccounts.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl text-sm">
                    No hay métodos de pago configurados. Contacta al vendedor.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {paymentAccounts.map(account => {
                      const isSelected = payment.method === account.id
                      
                      const renderIcon = () => {
                        if (account.method === 'pago_movil') return <Phone className="w-5 h-5" />
                        if (account.method === 'transferencia') return <Building2 className="w-5 h-5" />
                        if (account.method === 'zelle') return <Wallet className="w-5 h-5" />
                        if (account.method === 'binance_pay') return <QrCode className="w-5 h-5" />
                        return <CreditCard className="w-5 h-5" />
                      }

                      return (
                        <div key={account.id} className={`rounded-2xl border-2 transition-all ${
                          isSelected 
                            ? 'border-indigo-600 bg-white dark:bg-slate-900' 
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer'
                        }`}>
                          <div 
                            className="p-4 flex items-center gap-4 cursor-pointer"
                            onClick={() => {
                              setPayment({ method: account.id, reference: '', account_name: '' })
                              setErrorsPayment({})
                            }}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 dark:text-slate-400">{renderIcon()}</span>
                              <span className="font-bold text-slate-900 dark:text-white">{account.label}</span>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                              
                              {/* Account Details Panel */}
                              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 mb-4 text-sm space-y-3">
                                
                                {account.method === 'pago_movil' && (
                                  <>
                                    <DetailRow label="Banco" value={account.bank_name || ''} id={`${account.id}-bank`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="Teléfono" value={account.phone || ''} id={`${account.id}-phone`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="Cédula/RIF" value={account.id_number || ''} id={`${account.id}-id`} onCopy={handleCopy} copied={copiedField} />
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                                      <DetailRow label="Monto a Pagar" value={`Bs. ${effectiveTotalVes.toFixed(2)}`} id={`${account.id}-ves`} onCopy={handleCopy} copied={copiedField} highlight />
                                    </div>
                                  </>
                                )}

                                {account.method === 'transferencia' && (
                                  <>
                                    <DetailRow label="Banco" value={account.bank_name || ''} id={`${account.id}-bank`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="N° Cuenta" value={account.account_number || ''} id={`${account.id}-acc`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="Titular" value={account.account_holder || ''} id={`${account.id}-holder`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="Cédula/RIF" value={account.id_number || ''} id={`${account.id}-id`} onCopy={handleCopy} copied={copiedField} />
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                                      <DetailRow label="Monto a Pagar" value={`Bs. ${effectiveTotalVes.toFixed(2)}`} id={`${account.id}-ves`} onCopy={handleCopy} copied={copiedField} highlight />
                                    </div>
                                  </>
                                )}

                                {account.method === 'zelle' && (
                                  <>
                                    <DetailRow label="Email Zelle" value={account.email || ''} id={`${account.id}-email`} onCopy={handleCopy} copied={copiedField} />
                                    <DetailRow label="Titular" value={account.account_holder || ''} id={`${account.id}-holder`} onCopy={handleCopy} copied={copiedField} />
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                                      <DetailRow label="Monto a Pagar" value={`$ ${totalUsd.toFixed(2)}`} id={`${account.id}-usd`} onCopy={handleCopy} copied={copiedField} highlight />
                                    </div>
                                  </>
                                )}

                                {account.method === 'binance_pay' && (
                                  <>
                                    {(account.payment_url || tenantSlug === 'innovise') && (
                                      <div className="mb-4">
                                        <a
                                          href={account.payment_url || 'https://app.binance.com/uni-qr/J1UsGBdp'}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all active:scale-95"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          <span>Pagar con 1 Clic en Binance App</span>
                                        </a>
                                        <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                                          ¿Estás desde tu teléfono? Toca el botón para abrir tu app de Binance y pagar sin escanear.
                                        </p>
                                      </div>
                                    )}
                                    {account.qr_image_url && (
                                      <div className="flex flex-col items-center justify-center mb-4">
                                        <img src={account.qr_image_url} alt="QR Binance" className="w-44 h-44 rounded-xl object-contain bg-white p-2 border border-slate-200 shadow-sm" />
                                        <span className="text-[11px] text-slate-400 mt-1">O escanea este código QR si estás desde una computadora</span>
                                      </div>
                                    )}
                                    <DetailRow label="Pay ID / Email" value={account.email || account.account_number || ''} id={`${account.id}-binance`} onCopy={handleCopy} copied={copiedField} />
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                                      <DetailRow label="Monto a Pagar" value={`${totalUsd.toFixed(2)} USDT`} id={`${account.id}-usd`} onCopy={handleCopy} copied={copiedField} highlight />
                                    </div>
                                  </>
                                )}

                                {account.instructions && (
                                  <p className="text-slate-500 dark:text-slate-400 italic text-xs mt-2">{account.instructions}</p>
                                )}
                              </div>

                              {/* Inputs */}
                              <div className="space-y-4">
                                {account.method === 'zelle' && (
                                  <div>
                                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Nombre del titular de la cuenta emisora <span className="text-rose-500">*</span></label>
                                    <input 
                                      type="text" 
                                      value={payment.account_name || ''}
                                      onChange={e => setPayment({...payment, account_name: e.target.value})}
                                      className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none ${
                                        errorsPayment.account_name ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                                      }`}
                                      placeholder="Ej. Maria Perez"
                                    />
                                    {errorsPayment.account_name && <p className="text-rose-500 text-xs mt-1">{errorsPayment.account_name}</p>}
                                  </div>
                                )}

                                <div>
                                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                                    {account.method === 'pago_movil' || account.method === 'transferencia' 
                                      ? 'Últimos 6 dígitos de la referencia' 
                                      : 'Referencia / ID de Transacción'} <span className="text-rose-500">*</span>
                                  </label>
                                  <input 
                                    type="text" 
                                    maxLength={account.method === 'pago_movil' || account.method === 'transferencia' ? 6 : undefined}
                                    value={payment.reference}
                                    onChange={e => {
                                      let val = e.target.value
                                      if (account.method === 'pago_movil' || account.method === 'transferencia') {
                                        val = val.replace(/\D/g, '') // only numbers
                                      }
                                      setPayment({...payment, reference: val})
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono ${
                                      errorsPayment.reference ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                                    }`}
                                    placeholder={account.method === 'pago_movil' ? '123456' : 'Referencia'}
                                  />
                                  {errorsPayment.reference && <p className="text-rose-500 text-xs mt-1">{errorsPayment.reference}</p>}
                                </div>
                              </div>

                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              {currentStep < 3 ? (
                <button 
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  Siguiente Paso <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Confirmar Pedido <CheckCircle2 className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

          </div>

          {/* Sidebar Summary */}
          <div className="hidden md:block">
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl rounded-3xl p-6 sticky top-24">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                Resumen del Pedido
              </h3>
              
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-white font-medium line-clamp-2">{item.name}</p>
                      <div className="flex justify-between mt-1 text-slate-500 dark:text-slate-400">
                        <span>{item.quantity} x ${item.unit_price_usd.toFixed(2)}</span>
                        <span className="font-medium text-slate-900 dark:text-white">${(item.quantity * item.unit_price_usd).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 text-sm">
                  <span>Subtotal ({itemCount} items)</span>
                  <span>${totalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-bold text-lg pt-2">
                  <span>Total USD</span>
                  <span>${totalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                  <span>Total Bs. (Tasa: {effectiveExchangeRate.toFixed(2)})</span>
                  <span>Bs. {effectiveTotalVes.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

function DetailRow({ label, value, id, onCopy, copied, highlight = false }: { label: string, value: string, id: string, onCopy: (v: string, id: string) => void, copied: string | null, highlight?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <div className="flex items-center gap-2 overflow-hidden">
        <span className={`truncate font-mono ${highlight ? 'font-bold text-lg text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
          {value}
        </span>
        <button 
          onClick={() => onCopy(value, id)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors shrink-0 relative"
          title="Copiar"
        >
          {copied === id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const params = useParams()
  const tenantSlug = (params?.tenant as string) || ''

  return (
    <CustomerProvider tenantSlug={tenantSlug}>
      <CheckoutInner />
    </CustomerProvider>
  )
}

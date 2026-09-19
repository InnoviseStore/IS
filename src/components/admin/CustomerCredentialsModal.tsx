'use client'

import { useState, useMemo } from 'react'
import type { Customer, Tenant } from '@/types/database'
import {
  X,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Send,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Smartphone,
  Monitor,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import {
  parseCustomerAuth,
  generateRandomCustomerPassword,
  normalizePhoneDigits,
} from '@/lib/customerUtils'
import { normalizeWhatsAppPhone, createWhatsAppWebUrl, createWhatsAppUrl } from '@/lib/whatsapp'
import { getTenantFeatures } from '@/lib/planLimits'

interface Props {
  customer: Customer
  tenant: Tenant
  onClose: () => void
  onSuccess: (updatedCustomer: Customer) => void
}

export function CustomerCredentialsModal({ customer, tenant, onClose, onSuccess }: Props) {
  const currentAuth = useMemo(() => parseCustomerAuth(customer.notes), [customer.notes])

  const [email, setEmail] = useState(customer.email || '')
  const [phone, setPhone] = useState(customer.phone || '')
  const [password, setPassword] = useState(() => generateRandomCustomerPassword())
  const [showPassword, setShowPassword] = useState(true)
  const [userNotes, setUserNotes] = useState(currentAuth.userNotes || '')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isEditingMessage, setIsEditingMessage] = useState(false)
  const [customMessage, setCustomMessage] = useState<string>('')

  const features = useMemo(() => getTenantFeatures(tenant), [tenant])

  // Normalización del teléfono para WhatsApp
  const cleanPhone = useMemo(() => normalizePhoneDigits(phone), [phone])
  const normalizedFullPhone = useMemo(() => normalizeWhatsAppPhone(cleanPhone), [cleanPhone])
  const hasValidPhone = normalizedFullPhone.length >= 10

  // Identificador sugerido (Cédula -> Email -> Teléfono)
  const loginIdentifier = useMemo(() => {
    return customer.id_number || email.trim() || phone.trim() || customer.full_name
  }, [customer.id_number, customer.full_name, email, phone])

  // URL del portal de clientes
  const portalUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${tenant.slug}/cuenta`
    }
    return `https://system-is.netlify.app/${tenant.slug}/cuenta`
  }, [tenant.slug])

  // Mensaje de WhatsApp predeterminado
  const defaultWhatsAppMessage = useMemo(() => {
    return [
      `👋 ¡Hola, *${customer.full_name}*!`,
      '',
      `Te damos la bienvenida a la tienda oficial de *${tenant.name}*. Hemos creado tu cuenta de cliente para que disfrutes de una experiencia de compra más rápida sin tener que rellenar tus datos en cada pedido.`,
      '',
      `🔐 *Tus datos de acceso:*`,
      `👤 *Usuario / Identificador:* ${loginIdentifier}`,
      `🔑 *Contraseña asignada:* ${password}`,
      '',
      `🌐 *Ingresa a tu cuenta aquí:*`,
      portalUrl,
      '',
      `💡 *Ventajas de tu cuenta:*`,
      `• Realiza pedidos en 1 solo clic con tus datos guardados.`,
      `• Consulta tu historial de compras y comprobantes.`,
      `• Revisa el saldo de tus compras a crédito y fechas de pago.`,
      '',
      `_Gracias por tu preferencia y confianza en ${tenant.name}._`,
    ].join('\n')
  }, [customer.full_name, tenant.name, loginIdentifier, password, portalUrl])

  const activeMessage = isEditingMessage ? customMessage : defaultWhatsAppMessage

  function handleGenerateNewPassword() {
    const newPass = generateRandomCustomerPassword()
    setPassword(newPass)
    if (!isEditingMessage) {
      setCustomMessage('')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  async function saveCredentials(sendDirect = false) {
    if (!password.trim() || password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.')
      return null
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch('/api/admin/customers/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          customer_id: customer.id,
          email: email.trim() || null,
          phone: phone.trim() || null,
          password: password.trim(),
          user_notes: userNotes,
          send_whatsapp_direct: sendDirect,
          custom_whatsapp_message: activeMessage,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar credenciales.')
      }

      setSuccessMsg('¡Credenciales guardadas con éxito!')
      onSuccess(data.customer)
      return data.customer
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud.')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveOnly() {
    const saved = await saveCredentials(false)
    if (saved) {
      setTimeout(() => onClose(), 1200)
    }
  }

  async function handleSaveAndSendWeb() {
    const saved = await saveCredentials(false)
    if (saved) {
      const url = createWhatsAppWebUrl(phone || customer.phone || '', activeMessage)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => onClose(), 1000)
    }
  }

  async function handleSaveAndSendMobile() {
    const saved = await saveCredentials(false)
    if (saved) {
      const url = createWhatsAppUrl(phone || customer.phone || '', activeMessage, false)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => onClose(), 1000)
    }
  }

  async function handleSaveAndSendDirect() {
    const saved = await saveCredentials(true)
    if (saved) {
      setTimeout(() => onClose(), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-4 transition-all text-xs font-medium space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Credenciales de Acceso Web
                {currentAuth.hasAccount ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                    Cuenta Activa
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold">
                    Sin Cuenta Web
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cliente: <span className="font-bold text-slate-800 dark:text-slate-200">{customer.full_name}</span>{' '}
                {customer.id_number && `(${customer.id_number})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario de Credenciales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 text-[11px]">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 text-[11px]">
              Teléfono WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="04141234567"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-500" />
                Contraseña de Acceso al Catálogo <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateNewPassword}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generar Otra Clave</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña (mínimo 4 caracteres)"
                className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              El cliente podrá iniciar sesión en el catálogo usando su Cédula, Correo o Teléfono con esta contraseña.
            </p>
          </div>
        </div>

        {/* Vista previa y personalización del mensaje de WhatsApp */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Notificación por WhatsApp:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isEditingMessage) setCustomMessage(defaultWhatsAppMessage)
                  setIsEditingMessage(!isEditingMessage)
                }}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition cursor-pointer"
              >
                {isEditingMessage ? 'Restablecer Formato' : 'Editar Texto'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1 transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {isEditingMessage ? (
            <textarea
              rows={7}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
            />
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 text-slate-800 dark:text-slate-200 text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
              {defaultWhatsAppMessage}
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition disabled:opacity-50 cursor-pointer"
            >
              Solo Guardar
            </button>

            {hasValidPhone && (
              <>
                <button
                  type="button"
                  onClick={handleSaveAndSendWeb}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Guardar y abrir en WhatsApp Web para PC"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>WhatsApp Web (PC)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndSendMobile}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Guardar y abrir en la App de WhatsApp Móvil"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>WhatsApp Móvil</span>
                </button>
              </>
            )}

            {features.hasWhatsAppAutomation && hasValidPhone && (
              <button
                type="button"
                onClick={handleSaveAndSendDirect}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                title="Envío directo e inmediato por WhatsApp Bot Enterprise"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Envío Directo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

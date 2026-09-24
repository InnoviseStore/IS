'use client'

import { useState, useMemo } from 'react'
import { X, MessageCircle, Copy, Check, ExternalLink, Monitor, Smartphone, AlertCircle, Zap, Loader2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { COUNTRY_CODES, normalizeWhatsAppPhone, createWhatsAppWebUrl, createWhatsAppUrl } from '@/lib/whatsapp'
import { extractDeliveryInfo } from '@/lib/delivery'

interface Props {
  isOpen: boolean
  onClose: () => void
  order: any
  tenantName: string
  exchangeRate: number
}

export function WhatsAppOrderContactModal({
  isOpen,
  onClose,
  order,
  tenantName,
  exchangeRate,
}: Props) {
  if (!isOpen || !order) return null

  // Extraer datos del cliente
  const customerName = order.customer?.full_name || 'Cliente'
  const rawPhone = order.customer?.phone || ''

  // Determinar código de país inicial y número local
  const initialCountry = useMemo(() => {
    const digits = rawPhone.replace(/\D/g, '')
    const matched = COUNTRY_CODES.find((c) => digits.startsWith(c.code))
    return matched ? matched.code : '58'
  }, [rawPhone])

  const [countryCode, setCountryCode] = useState(initialCountry)
  
  // Limpiar dígitos locales (eliminar prefijo de país si ya lo tenía, y eliminar el 0 inicial)
  const initialLocalNumber = useMemo(() => {
    let digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith(countryCode)) {
      digits = digits.slice(countryCode.length)
    }
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '')
    }
    return digits
  }, [rawPhone, countryCode])

  const [localNumber, setLocalNumber] = useState(initialLocalNumber)
  const [copied, setCopied] = useState(false)

  // Armar mensaje predeterminado
  const fullPhone = `${countryCode}${localNumber.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)

  const defaultMessage = useMemo(() => {
    const items = Array.isArray(order.order_items) ? order.order_items : []
    const lines: string[] = []

    const delivery = extractDeliveryInfo(order.notes, exchangeRate)
    const deliveryAddress = delivery.address || order.customer?.address

    lines.push(`🛒 *¡Hola ${customerName}!* Te escribimos de *${tenantName}* referente a tu solicitud de pedido *#${order.order_number}*.`)
    lines.push('')

    if (deliveryAddress && deliveryAddress.trim()) {
      lines.push(`📍 *Dirección de Entrega:* ${deliveryAddress.trim()}`)
      lines.push('')
    }

    if (items.length > 0) {
      lines.push('📦 *Detalle de tu pedido:*')
      items.forEach((it: any) => {
        lines.push(`• ${it.quantity}x ${it.product_name} — $${(Number(it.subtotal_usd) || 0).toFixed(2)} USD`)
      })
      lines.push('')
    }

    const totalUsd = Number(order.total_usd) || 0
    const totalVes = Number(order.total_ves) || totalUsd * exchangeRate

    if (delivery.hasDelivery && delivery.amountUsd > 0) {
      const prodSubtotal = (order.subtotal_usd !== undefined && Number(order.subtotal_usd) > 0)
        ? Number(order.subtotal_usd)
        : Math.max(0, totalUsd - delivery.amountUsd)
      lines.push(`• Subtotal Productos: $${prodSubtotal.toFixed(2)} USD`)
      lines.push(`• 🛵 Servicio de Delivery: +$${delivery.amountUsd.toFixed(2)} USD (Bs. ${delivery.amountVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
    }

    lines.push(`💰 *Total a pagar: $${totalUsd.toFixed(2)} USD* | Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    lines.push(`📊 Tasa BCV aplicada: Bs. ${exchangeRate.toFixed(2)}/USD`)
    lines.push('')
    lines.push('Por favor confírmanos tu método de pago o comprobante de transferencia para despachar tu pedido. ¡Muchas gracias!')

    return lines.join('\n')
  }, [customerName, tenantName, order, exchangeRate])

  const { tenant } = useTenant()
  const [message, setMessage] = useState(defaultMessage)
  const [sendingDirect, setSendingDirect] = useState(false)
  const [directSuccess, setDirectSuccess] = useState<string | null>(null)
  const [directError, setDirectError] = useState<string | null>(null)

  const handleSendDirect = async () => {
    if (!normalizedFullPhone || normalizedFullPhone.length < 10) {
      alert('Por favor ingresa un número de teléfono válido.')
      return
    }
    if (!tenant) return

    setSendingDirect(true)
    setDirectSuccess(null)
    setDirectError(null)

    try {
      const res = await fetch('/api/admin/whatsapp/direct-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          phone: normalizedFullPhone,
          type: 'text',
          message,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDirectSuccess('¡Mensaje enviado directamente al cliente por WhatsApp! ✓')
        setTimeout(() => setDirectSuccess(null), 5000)
      } else {
        setDirectError(data.error || 'No se pudo enviar directo. Puedes abrir WhatsApp Web.')
      }
    } catch (err: any) {
      setDirectError(err.message || 'Error de conexión.')
    } finally {
      setSendingDirect(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenWeb = () => {
    const url = createWhatsAppWebUrl(normalizedFullPhone, message)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenApp = () => {
    const url = createWhatsAppUrl(normalizedFullPhone, message)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-500 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Enviar WhatsApp al Cliente</h3>
              <p className="text-xs text-emerald-100">
                Pedido #{order.order_number} · {customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Selector de Código de País y Teléfono */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Teléfono de WhatsApp del Cliente
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} +{c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                placeholder="Ej. 4121234567"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Número internacional a contactar:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                +{normalizedFullPhone || '—'}
              </strong>
            </p>
          </div>

          {/* Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mensaje a Enviar (Personalizable)
              </label>
              <span className="text-[11px] text-slate-400">Emojis y saltos de línea listos</span>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Feedback de envío directo */}
          {directSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-xs font-bold animate-in fade-in duration-200">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{directSuccess}</span>
            </div>
          )}
          {directError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2 text-xs font-medium">
              <X className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{directError}</span>
            </div>
          )}

          {/* Tips para PC */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p className="leading-snug">
              <strong>Consejo:</strong> Puedes presionar <em>⚡ Enviar Directo</em> para despachar el mensaje de inmediato al cliente sin abrir WhatsApp Web ni copiar nada.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '¡Mensaje Copiado! ✓' : 'Copiar Mensaje'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSendDirect}
              disabled={sendingDirect}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Enviar directamente al cliente en segundo plano"
            >
              {sendingDirect ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
              <span>{sendingDirect ? 'Enviando...' : '⚡ Enviar Directo'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWeb}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Abrir en WhatsApp Web en una nueva pestaña de la PC"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <span>Web (PC)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenApp}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Abrir con la app de WhatsApp de escritorio o móvil"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

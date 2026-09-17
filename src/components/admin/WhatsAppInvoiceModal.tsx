'use client'

import { useState, useMemo } from 'react'
import { X, MessageCircle, Copy, Check, Monitor, Smartphone } from 'lucide-react'
import {
  COUNTRY_CODES,
  normalizeWhatsAppPhone,
  createWhatsAppWebUrl,
  createWhatsAppUrl,
} from '@/lib/whatsapp'

export interface WhatsAppInvoiceItem {
  name: string
  quantity: number
  unitPriceUsd: number
  subtotalUsd: number
}

export interface WhatsAppInvoicePayment {
  method: string
  amountUsd: number
  reference?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  orderNumber: string
  tenantName: string
  exchangeRate: number
  customerName: string
  customerPhone?: string | null
  customerIdNumber?: string | null
  items: WhatsAppInvoiceItem[]
  totalUsd: number
  totalVes: number
  igtfUsd?: number
  discountUsd?: number
  isCredit?: boolean
  creditDueDate?: string | null
  creditRemainingUsd?: number
  payments?: WhatsAppInvoicePayment[]
}

const METHOD_NAMES: Record<string, string> = {
  binance_pay: 'Binance Pay (USDT)',
  zelle: 'Zelle (USD)',
  pago_movil: 'Pago Móvil (VES)',
  cash_usd: 'Efectivo USD',
  cash_ves: 'Efectivo VES',
  transfer_ves: 'Transferencia Bancaria (VES)',
  debit_ves: 'Punto / Débito (VES)',
  credit_7d: 'Crédito',
}

export function WhatsAppInvoiceModal({
  isOpen,
  onClose,
  orderNumber,
  tenantName,
  exchangeRate,
  customerName,
  customerPhone,
  customerIdNumber,
  items,
  totalUsd,
  totalVes,
  igtfUsd = 0,
  discountUsd = 0,
  isCredit = false,
  creditDueDate,
  creditRemainingUsd = 0,
  payments = [],
}: Props) {
  if (!isOpen) return null

  const rawPhone = customerPhone || ''

  // Determinar código de país inicial y número local
  const initialCountry = useMemo(() => {
    const digits = rawPhone.replace(/\D/g, '')
    const matched = COUNTRY_CODES.find((c) => digits.startsWith(c.code))
    return matched ? matched.code : '58'
  }, [rawPhone])

  const [countryCode, setCountryCode] = useState(initialCountry)

  const initialLocalPhone = useMemo(() => {
    let digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith(countryCode)) {
      digits = digits.slice(countryCode.length)
    }
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '')
    }
    return digits
  }, [rawPhone, countryCode])

  const [localPhone, setLocalPhone] = useState(initialLocalPhone)
  const [copied, setCopied] = useState(false)

  const fullPhone = `${countryCode}${localPhone.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)
  const hasValidPhone = normalizedFullPhone.length >= 10

  // Generar mensaje estructurado de la factura realizada
  const defaultMessage = useMemo(() => {
    const lines: string[] = []

    lines.push(`🧾 *COMPROBANTE DE VENTA / FACTURA*`)
    lines.push(`🏪 *${tenantName}*`)
    lines.push(`📄 *Factura N°:* #${orderNumber}`)
    lines.push(`📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}`)
    lines.push('')
    lines.push(`👤 *Cliente:* ${customerName || 'Cliente'}`)
    if (customerIdNumber && customerIdNumber.trim()) {
      lines.push(`🆔 *C.I./RIF:* ${customerIdNumber.trim()}`)
    }
    lines.push('')

    if (items && items.length > 0) {
      lines.push(`📦 *Detalle de Productos:*`)
      items.forEach((it) => {
        lines.push(`• ${it.quantity}x ${it.name} — $${(it.subtotalUsd || it.quantity * it.unitPriceUsd).toFixed(2)} USD`)
      })
      lines.push('')
    }

    lines.push(`📊 *Resumen de Pago:*`)
    if (discountUsd > 0) {
      lines.push(`• 🎉 Descuento Especial: -$${discountUsd.toFixed(2)} USD`)
    }
    if (igtfUsd > 0) {
      lines.push(`• IGTF (3%): +$${igtfUsd.toFixed(2)} USD`)
    }
    lines.push(`• 💰 *Total Facturado: $${totalUsd.toFixed(2)} USD*`)
    lines.push(`• 🇻🇪 *Equivalente en Bs.:* Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    lines.push(`• 📈 *Tasa Oficial BCV:* Bs. ${exchangeRate.toFixed(2)}/USD`)

    if (payments && payments.length > 0) {
      lines.push('')
      lines.push(`💳 *Formas de Pago Aplicadas:*`)
      payments.forEach((p) => {
        const name = METHOD_NAMES[p.method] || p.method
        const refStr = p.reference ? ` (Ref: ${p.reference})` : ''
        lines.push(`• ${name}: $${p.amountUsd.toFixed(2)} USD${refStr}`)
      })
    }

    if (isCredit && creditRemainingUsd > 0.01) {
      lines.push('')
      lines.push(`⚠️ *Condición: VENTA A CRÉDITO*`)
      lines.push(`• ⏳ *Saldo Pendiente por Pagar:* $${creditRemainingUsd.toFixed(2)} USD (Bs. ${(creditRemainingUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
      if (creditDueDate) {
        lines.push(`• 📅 *Fecha Límite de Pago:* ${creditDueDate}`)
      }
      lines.push(`• 💡 *Nota:* Futuros abonos en Bolívares se calculan a la *tasa oficial del BCV del día* en que realices el pago.`)
    }

    lines.push('')
    lines.push(`✨ ¡Muchas gracias por tu compra y confianza!`)

    return lines.join('\n')
  }, [
    orderNumber,
    tenantName,
    exchangeRate,
    customerName,
    customerIdNumber,
    items,
    totalUsd,
    totalVes,
    igtfUsd,
    discountUsd,
    isCredit,
    creditDueDate,
    creditRemainingUsd,
    payments,
  ])

  const [message, setMessage] = useState(defaultMessage)

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
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Enviar Factura por WhatsApp</h3>
              <p className="text-xs text-emerald-100">
                Orden #{orderNumber} · {customerName || 'Consumidor Final'}
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
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Teléfono del Cliente */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Teléfono de WhatsApp del Cliente
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} +{c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="Ej. 4121234567"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Número a enviar:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                +{normalizedFullPhone || '—'}
              </strong>
            </p>
          </div>

          {/* Vista previa y edición del mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Detalle del Comprobante (Editable)
              </label>
              <span className="text-[11px] text-slate-400">Emojis listos para PC y Móvil</span>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed text-xs"
            />
          </div>

          {/* Consejo para PC */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
            <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p className="leading-snug">
              <strong>Consejo para PC:</strong> Haz clic en <em>WhatsApp Web (PC)</em> para que los emojis se abran sin distorsión. También puedes presionar <em>Copiar</em> y pegarlo directamente en el chat del cliente.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '¡Mensaje Copiado! ✓' : 'Copiar Mensaje'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenWeb}
              disabled={!hasValidPhone || !message.trim()}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
              title="Abrir en WhatsApp Web en una nueva pestaña"
            >
              <Monitor className="w-4 h-4" />
              <span>WhatsApp Web (PC)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenApp}
              disabled={!hasValidPhone || !message.trim()}
              className="px-3 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Abrir con la aplicación de WhatsApp"
            >
              <Smartphone className="w-4 h-4" />
              <span>App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
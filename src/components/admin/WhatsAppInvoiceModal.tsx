'use client'

import { useState, useMemo } from 'react'
import { X, MessageCircle, Copy, Check, Monitor, Smartphone, Zap, FileText, Loader2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { getOrderPdfBase64 } from '@/lib/pdfGenerator'
import type { InstallmentsPlan } from '@/types/database'
import {
  COUNTRY_CODES,
  normalizeWhatsAppPhone,
  createWhatsAppWebUrl,
  createWhatsAppUrl,
} from '@/lib/whatsapp'
import { formatDeliveryTag } from '@/lib/delivery'

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
  installmentsPlan?: InstallmentsPlan
  deliveryAmountUsd?: number
  deliveryAmountVes?: number
  deliveryAddress?: string
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
  installmentsPlan,
  deliveryAmountUsd = 0,
  deliveryAmountVes = 0,
  deliveryAddress = '',
}: Props) {
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
    if (deliveryAddress && deliveryAddress.trim()) {
      lines.push(`📍 *Dirección de Entrega:* ${deliveryAddress.trim()}`)
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
    if (deliveryAmountUsd > 0) {
      const dVes = deliveryAmountVes > 0 ? deliveryAmountVes : deliveryAmountUsd * exchangeRate
      lines.push(`• 🛵 *Servicio de Delivery:* +$${deliveryAmountUsd.toFixed(2)} USD (Bs. ${dVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
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

      if (installmentsPlan?.schedule && installmentsPlan.schedule.length > 0) {
        const freqLabel = installmentsPlan.frequency === 'semanal'
          ? 'Semanales'
          : installmentsPlan.frequency === 'quincenal'
          ? 'Quincenales'
          : installmentsPlan.frequency === 'mensual'
          ? 'Mensuales'
          : `cada ${installmentsPlan.frequency_days} días`

        lines.push('')
        lines.push(`🗓️ *Plan de Cobro Acordado (${installmentsPlan.total_installments} Cuotas ${freqLabel}):*`)
        installmentsPlan.schedule.forEach((inst) => {
          const stBadge = inst.status === 'paid' ? '✅ Cancelada' : '⏳ Pendiente'
          lines.push(`• Cuota #${inst.installment_number}: *$${Number(inst.amount_usd).toFixed(2)} USD* — Vence: ${inst.due_date} [${stBadge}]`)
        })
        lines.push(`📌 *(En Bolívares: Se calcula a la tasa oficial BCV del día en que realices el pago)*`)
      }

      lines.push('')
      lines.push(`• 💡 *Nota:* Pagos o abonos en Bolívares se calculan a la *tasa oficial del BCV del día* en que realices el pago.`)
      lines.push(`• 📲 *Autoservicio WhatsApp:* Escribe *SALDO* para consultar cuánto debes actualizado a la tasa del día, o escribe *PAGOS* para recibir los datos de Pago Móvil y cuentas bancarias.`)
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
    deliveryAddress,
    items,
    totalUsd,
    totalVes,
    igtfUsd,
    discountUsd,
    deliveryAmountUsd,
    deliveryAmountVes,
    isCredit,
    creditDueDate,
    creditRemainingUsd,
    payments,
    installmentsPlan,
  ])

  const { tenant } = useTenant()
  const [message, setMessage] = useState(defaultMessage)
  const [sendingDirectText, setSendingDirectText] = useState(false)
  const [sendingDirectPdf, setSendingDirectPdf] = useState(false)
  const [directSuccess, setDirectSuccess] = useState<string | null>(null)
  const [directError, setDirectError] = useState<string | null>(null)

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

  const handleSendDirectText = async () => {
    if (!hasValidPhone) {
      alert('Por favor ingresa un número de teléfono válido.')
      return
    }
    if (!tenant) return

    setSendingDirectText(true)
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
        setDirectSuccess('¡Recibo de factura enviado directamente por WhatsApp! ✓')
        setTimeout(() => setDirectSuccess(null), 5000)
      } else {
        setDirectError(data.error || 'No se pudo enviar directo. Puedes abrir WhatsApp Web.')
      }
    } catch (err: any) {
      setDirectError(err.message || 'Error de conexión.')
    } finally {
      setSendingDirectText(false)
    }
  }

  const handleSendDirectPdf = async () => {
    if (!hasValidPhone) {
      alert('Por favor ingresa un número de teléfono válido.')
      return
    }
    if (!tenant) return

    setSendingDirectPdf(true)
    setDirectSuccess(null)
    setDirectError(null)

    try {
      const orderPayload: any = {
        id: 'ord-' + Date.now(),
        order_number: orderNumber,
        exchange_rate_at_sale: exchangeRate,
        subtotal_usd: totalUsd - (igtfUsd || 0) + (discountUsd || 0),
        total_usd: totalUsd,
        total_ves: totalVes,
        payment_condition: isCredit ? 'credit_7d' : 'immediate',
        status: isCredit ? 'credit' : 'completed',
        due_date: creditDueDate || null,
        created_at: new Date().toISOString(),
        notes: (deliveryAmountUsd > 0 || deliveryAddress)
          ? formatDeliveryTag({
              hasDelivery: true,
              amountUsd: deliveryAmountUsd,
              amountVes: deliveryAmountVes > 0 ? deliveryAmountVes : deliveryAmountUsd * exchangeRate,
              address: deliveryAddress,
            })
          : null,
        customer: {
          full_name: customerName,
          id_number: customerIdNumber,
          phone: normalizedFullPhone,
          address: deliveryAddress || undefined,
        },
        order_items: (items || []).map((it) => ({
          product_name: it.name,
          quantity: it.quantity,
          unit_price_usd: it.unitPriceUsd,
          subtotal_usd: it.subtotalUsd,
        })),
        payment_breakdown: (payments || []).map((p) => ({
          method: p.method,
          amount_usd: p.amountUsd,
          reference: p.reference,
        })),
      }

      const { base64, fileName } = await getOrderPdfBase64({
        order: orderPayload,
        tenant,
      })

      const res = await fetch('/api/admin/whatsapp/direct-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          phone: normalizedFullPhone,
          type: 'document',
          media_base64: base64,
          file_name: fileName,
          message: `Adjunto envío tu Factura Digital #${orderNumber} de ${tenantName}. ¡Gracias por tu compra!`,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDirectSuccess('¡Factura PDF enviada exitosamente al WhatsApp del cliente! 📄✓')
        setTimeout(() => setDirectSuccess(null), 5000)
      } else {
        setDirectError(data.error || 'No se pudo enviar el PDF por WhatsApp.')
      }
    } catch (err: any) {
      setDirectError(err.message || 'Error al generar o enviar la factura PDF.')
    } finally {
      setSendingDirectPdf(false)
    }
  }

  if (!isOpen) return null

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

          {/* Consejo para PC */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
            <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p className="leading-snug">
              <strong>Consejo:</strong> Puedes usar <em>⚡ Enviar Directo</em> o <em>📄 Enviar Factura PDF</em> para que el mensaje o el documento salga sin que tengas que abrir WhatsApp Web ni copiar nada.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Botón: Enviar PDF oficial por WhatsApp */}
            <button
              type="button"
              onClick={handleSendDirectPdf}
              disabled={!hasValidPhone || sendingDirectPdf}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/25 disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Generar y enviar la factura en archivo PDF adjunto por WhatsApp"
            >
              {sendingDirectPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-blue-200" />
              )}
              <span>{sendingDirectPdf ? 'Generando PDF...' : '📄 Enviar Factura PDF'}</span>
            </button>

            {/* Botón: Enviar texto directo */}
            <button
              type="button"
              onClick={handleSendDirectText}
              disabled={!hasValidPhone || !message.trim() || sendingDirectText}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Enviar el resumen de texto directo por WhatsApp sin abrir pestañas"
            >
              {sendingDirectText ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{sendingDirectText ? 'Enviando...' : '⚡ Enviar Texto'}</span>
            </button>

            {/* Botón: WhatsApp Web */}
            <button
              type="button"
              onClick={handleOpenWeb}
              disabled={!hasValidPhone || !message.trim()}
              className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Abrir en WhatsApp Web en una nueva pestaña"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <span>Web (PC)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
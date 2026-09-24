'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, MessageCircle, Copy, Check, ExternalLink, Monitor, Smartphone, AlertCircle, Zap, Loader2, FileText } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { COUNTRY_CODES, normalizeWhatsAppPhone, createWhatsAppWebUrl, createWhatsAppUrl } from '@/lib/whatsapp'
import { formatDate } from '@/lib/formatters'
import { getQuotationPdfBase64 } from '@/lib/pdfGenerator'
import type { Quotation } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  quotation: Quotation | null
  tenantName: string
  exchangeRate: number
}

export function WhatsAppQuoteModal({
  isOpen,
  onClose,
  quotation,
  tenantName,
  exchangeRate,
}: Props) {
  if (!isOpen || !quotation) return null

  // Extraer datos del cliente
  const customerName = quotation.customer_name || 'Cliente'
  const rawPhone = quotation.customer_phone || ''

  // Opción de visualización de precios en Bs.
  const hasVesDisabledInNotes = Boolean(quotation.notes?.includes('SHOW_VES:false'))
  const [includeVes, setIncludeVes] = useState(!hasVesDisabledInNotes)

  // Determinar código de país inicial y número local
  const initialCountry = useMemo(() => {
    const digits = rawPhone.replace(/\D/g, '')
    const matched = COUNTRY_CODES.find((c) => digits.startsWith(c.code))
    return matched ? matched.code : '58'
  }, [rawPhone])

  const [countryCode, setCountryCode] = useState(initialCountry)

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

  const fullPhone = `${countryCode}${localNumber.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)

  const defaultMessage = useMemo(() => {
    const items = Array.isArray(quotation.items) ? quotation.items : []
    const lines: string[] = []

    lines.push(`📄 *¡Hola ${customerName}!*`)
    lines.push(`Te compartimos el presupuesto formal solicitado en *${tenantName}*:`)
    lines.push(`📋 *Cotización:* #${quotation.quotation_number}`)
    lines.push(`📅 *Válida hasta:* ${formatDate(quotation.valid_until)}`)
    lines.push('')

    if (items.length > 0) {
      lines.push('📦 *Detalle de Productos:*')
      items.forEach((it: any) => {
        const disc = it.discount_percent ? ` (${it.discount_percent}% desc)` : ''
        const descStr = it.description ? `\n   ↳ _${it.description}_` : ''
        const linePrice = it.subtotal_usd ?? (it.unit_price_usd * it.quantity)
        lines.push(`• ${it.quantity}x ${it.name} — $${Number(linePrice).toFixed(2)} USD${disc}${descStr}`)
      })
      lines.push('')
    }

    const totalUsd = Number(quotation.total_usd) || 0
    const totalVes = Number(quotation.total_ves) || totalUsd * exchangeRate

    if (includeVes) {
      lines.push(`💰 *Total Presupuesto: $${totalUsd.toFixed(2)} USD* | Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      lines.push(`📊 Tasa referencial aplicada: Bs. ${exchangeRate.toFixed(2)}/USD`)
      lines.push('')
      lines.push(`💡 *Condición de Pago:* Los pagos en Bolívares se calculan a la tasa oficial del BCV del día en que se efectúen.`)
    } else {
      lines.push(`💰 *Total Presupuesto: $${totalUsd.toFixed(2)} USD*`)
    }
    lines.push('')
    lines.push('Si deseas confirmar este pedido o requieres ajustes, respóndenos a este mensaje. ¡Estamos a tu orden! 🙌')

    return lines.join('\n')
  }, [customerName, tenantName, quotation, exchangeRate, includeVes])

  const { tenant } = useTenant()
  const [message, setMessage] = useState(defaultMessage)

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  const [sendingDirect, setSendingDirect] = useState(false)
  const [sendingDirectPdf, setSendingDirectPdf] = useState(false)
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
        setDirectSuccess('¡Cotización enviada directamente al cliente por WhatsApp! ✓')
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

  const handleSendDirectPdf = async () => {
    if (!normalizedFullPhone || normalizedFullPhone.length < 10) {
      alert('Por favor ingresa un número de teléfono válido.')
      return
    }
    if (!tenant) return

    setSendingDirectPdf(true)
    setDirectSuccess(null)
    setDirectError(null)

    try {
      const { base64, fileName } = await getQuotationPdfBase64({
        quotation,
        tenant,
        showVesPrices: includeVes,
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
          message: `Adjunto envío el Presupuesto Formal #${quotation.quotation_number || quotation.id?.slice(0, 8)} de ${tenantName}. ¡A tu orden!`,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDirectSuccess('¡Cotización PDF enviada exitosamente al WhatsApp del cliente! 📄✓')
        setTimeout(() => setDirectSuccess(null), 5000)
      } else {
        setDirectError(data.error || 'No se pudo enviar el PDF por WhatsApp.')
      }
    } catch (err: any) {
      setDirectError(err.message || 'Error al generar o enviar la cotización PDF.')
    } finally {
      setSendingDirectPdf(false)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Enviar Cotización por WhatsApp
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                #{quotation.quotation_number} — {customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Configuración de Teléfono */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Número de WhatsApp del Cliente
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
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
                onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="4121234567"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Destinatario: <span className="font-mono font-semibold text-emerald-600">+{normalizedFullPhone || '...'}</span>
            </p>
          </div>

          {/* Selector para Precios en Bs. */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Mostrar Precios en Bs. (BCV)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Incluir montos en Bolívares en el mensaje y en el PDF adjunto</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeVes}
                onChange={(e) => setIncludeVes(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mensaje de Cotización
              </label>
              <button
                onClick={handleCopy}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
            />
          </div>

          {/* Alertas */}
          {directSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{directSuccess}</span>
            </div>
          )}

          {directError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{directError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Enviar Cotización PDF Directo */}
            <button
              onClick={handleSendDirectPdf}
              disabled={sendingDirectPdf || !normalizedFullPhone}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              title="Generar y enviar presupuesto en PDF adjunto por WhatsApp"
            >
              {sendingDirectPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-blue-200" />
              )}
              <span>{sendingDirectPdf ? 'Generando PDF...' : '📄 Cotización PDF'}</span>
            </button>

            {/* Enviar Texto Directo */}
            <button
              onClick={handleSendDirect}
              disabled={sendingDirect || !normalizedFullPhone}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {sendingDirect ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>⚡ Enviar Texto</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleOpenWeb}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              title="Abrir en WhatsApp Web en la PC"
            >
              <Monitor className="w-3.5 h-3.5 text-slate-500" />
              <span>WhatsApp Web</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </button>

            <button
              onClick={handleOpenApp}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              title="Abrir en la aplicación móvil de WhatsApp"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>App</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

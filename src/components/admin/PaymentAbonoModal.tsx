'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Share2,
  Calendar,
  FileText,
  Monitor,
  Smartphone,
  Copy,
  Check
} from 'lucide-react'
import {
  COUNTRY_CODES,
  normalizeWhatsAppPhone,
  createWhatsAppWebUrl,
  createWhatsAppUrl
} from '@/lib/whatsapp'
import { useTenant } from '@/contexts/TenantContext'

export interface AbonoOrderTarget {
  id: string
  tenant_id?: string
  order_number: string
  status: string
  total_usd: number
  total_ves?: number
  payment_breakdown: any[]
  customer?: any
  customers?: any
  phone?: string | null
  notes?: string | null
}

interface PaymentAbonoModalProps {
  isOpen: boolean
  onClose: () => void
  order: AbonoOrderTarget
  exchangeRate: number
  onAbonoSuccess?: () => void
}

const PAYMENT_METHODS = [
  { id: 'pago_movil', label: 'Pago Móvil (VES)', currency: 'VES' },
  { id: 'binance_pay', label: 'Binance Pay (USDT)', currency: 'USD' },
  { id: 'zelle', label: 'Zelle (USD)', currency: 'USD' },
  { id: 'cash_usd', label: 'Efectivo Divisas (USD)', currency: 'USD' },
  { id: 'cash_ves', label: 'Efectivo Bolívares (VES)', currency: 'VES' },
  { id: 'transfer_ves', label: 'Transferencia Bancaria (VES)', currency: 'VES' },
  { id: 'debit_ves', label: 'Punto de Venta / Débito (VES)', currency: 'VES' },
]

export default function PaymentAbonoModal({
  isOpen,
  onClose,
  order,
  exchangeRate,
  onAbonoSuccess,
}: PaymentAbonoModalProps) {
  const { tenant, bcvRatesHistory } = useTenant()

  // Control de fecha y tasa para abonos retroactivos o transferencias de ayer
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [])

  const yesterdayRateEntry = useMemo(() => {
    return bcvRatesHistory?.find((h) => h.date === yesterdayStr)
  }, [bcvRatesHistory, yesterdayStr])

  const [paymentDate, setPaymentDate] = useState<string>(todayStr)
  const [rateMode, setRateMode] = useState<'today' | 'yesterday' | 'custom'>('today')
  const [appliedRate, setAppliedRate] = useState<number>(exchangeRate)
  const [customRateInput, setCustomRateInput] = useState<string>(String(exchangeRate))
  const [showRateSettings, setShowRateSettings] = useState<boolean>(false)

  // Sincronizar tasa si cambia la prop exchangeRate y estamos en modo 'today'
  useEffect(() => {
    if (rateMode === 'today') {
      setAppliedRate(exchangeRate)
      setCustomRateInput(String(exchangeRate))
    }
  }, [exchangeRate, rateMode])

  const handleSelectRateMode = (mode: 'today' | 'yesterday' | 'custom') => {
    setRateMode(mode)
    if (mode === 'today') {
      setPaymentDate(todayStr)
      setAppliedRate(exchangeRate)
      setCustomRateInput(String(exchangeRate))
      setShowRateSettings(false)
    } else if (mode === 'yesterday') {
      setPaymentDate(yesterdayStr)
      const yRate = yesterdayRateEntry?.rate || exchangeRate
      setAppliedRate(yRate)
      setCustomRateInput(String(yRate))
      setShowRateSettings(true)
    } else {
      setShowRateSettings(true)
    }
  }

  const handleCustomRateChange = (val: string) => {
    setCustomRateInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      setAppliedRate(num)
    }
  }

  const handlePaymentDateChange = (newDate: string) => {
    setPaymentDate(newDate)
    const found = bcvRatesHistory?.find((h) => h.date === newDate)
    if (found && found.rate > 0) {
      setAppliedRate(found.rate)
      setCustomRateInput(String(found.rate))
    }
  }

  // Calcular lo pagado acumulado hasta ahora
  const breakdown = Array.isArray(order.payment_breakdown) ? order.payment_breakdown : []
  const pagadoPrevioUsd = breakdown.reduce((acc: number, item: any) => {
    // Si es abono o pago original que NO sea el placeholder de credito pendiente
    if (item.method === 'credit_7d') return acc
    return acc + (Number(item.amount_usd) || 0)
  }, 0)

  const totalUsd = Number(order.total_usd) || 0
  const saldoPendienteUsd = Math.max(0, totalUsd - pagadoPrevioUsd)
  const saldoPendienteVes = saldoPendienteUsd * appliedRate

  const [method, setMethod] = useState('pago_movil')
  const [currencyInput, setCurrencyInput] = useState<'USD' | 'VES'>('VES')
  const [amountInput, setAmountInput] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{
    abonoUsd: number
    abonoVes: number
    nuevoSaldoUsd: number
    isCompleted: boolean
    orderNumber: string
  } | null>(null)

  if (!isOpen) return null

  // Calcular abono en USD y VES en base a lo que tipea el usuario
  const numericVal = parseFloat(amountInput) || 0
  const abonoUsdCalculado = currencyInput === 'USD' ? numericVal : (numericVal / appliedRate)
  const abonoVesCalculado = currencyInput === 'VES' ? numericVal : (numericVal * appliedRate)
  const restantePostAbono = Math.max(0, saldoPendienteUsd - abonoUsdCalculado)

  const handleMethodChange = (mId: string) => {
    setMethod(mId)
    const m = PAYMENT_METHODS.find((p) => p.id === mId)
    if (m) {
      setCurrencyInput(m.currency as 'USD' | 'VES')
    }
  }

  const handleSetTotalAbono = () => {
    if (currencyInput === 'USD') {
      setAmountInput(saldoPendienteUsd.toFixed(2))
    } else {
      setAmountInput((saldoPendienteUsd * appliedRate).toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (abonoUsdCalculado <= 0) {
      setError('Ingresa un monto válido para el abono.')
      return
    }

    if (abonoUsdCalculado > saldoPendienteUsd + 0.05) {
      setError(`El abono ($${abonoUsdCalculado.toFixed(2)}) supera el saldo pendiente ($${saldoPendienteUsd.toFixed(2)}).`)
      return
    }

    try {
      setLoading(true)
      const effectiveTenantId = order.tenant_id || tenant?.id

      const res = await fetch('/api/admin/orders/abono', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          order_id: order.id,
          amount_usd: abonoUsdCalculado,
          amount_ves: abonoVesCalculado,
          exchange_rate: appliedRate,
          payment_method: method,
          method,
          reference,
          notes,
          payment_date: paymentDate !== todayStr ? paymentDate : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el abono')
      }

      setSuccessResult({
        abonoUsd: abonoUsdCalculado,
        abonoVes: abonoVesCalculado,
        nuevoSaldoUsd: data.nuevoSaldoUsd,
        isCompleted: data.isCompleted,
        orderNumber: order.order_number,
      })

      if (onAbonoSuccess) {
        onAbonoSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al registrar el abono.')
    } finally {
      setLoading(false)
    }
  }

  const initialCustomerPhone = (order as any).customers?.phone || (order as any).phone || ''

  const initialCountry = useMemo(() => {
    const digits = initialCustomerPhone.replace(/\D/g, '')
    const matched = COUNTRY_CODES.find((c) => digits.startsWith(c.code))
    return matched ? matched.code : '58'
  }, [initialCustomerPhone])

  const [countryCode, setCountryCode] = useState(initialCountry)

  const initialLocalPhone = useMemo(() => {
    let digits = initialCustomerPhone.replace(/\D/g, '')
    if (digits.startsWith(countryCode)) {
      digits = digits.slice(countryCode.length)
    }
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '')
    }
    return digits
  }, [initialCustomerPhone, countryCode])

  const [localPhone, setLocalPhone] = useState(initialLocalPhone)
  const [copiedReceipt, setCopiedReceipt] = useState(false)

  const fullPhone = `${countryCode}${localPhone.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)

  const receiptMessage = useMemo(() => {
    if (!successResult) return ''
    let msg = `🧾 *COMPROBANTE DE ABONO RECIBIDO*\n`
    msg += `📄 *Factura:* #${order.order_number}\n`
    msg += `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n\n`
    msg += `💵 *Monto Abonado:* $${successResult.abonoUsd.toFixed(2)} USD\n`
    msg += `🇻🇪 *Equivalente en Bs.:* Bs. ${successResult.abonoVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`
    msg += `📊 *Tasa Oficial BCV del día:* Bs. ${exchangeRate.toFixed(2)}/USD\n`
    msg += `💳 *Método:* ${PAYMENT_METHODS.find((p) => p.id === method)?.label || method}\n`
    if (reference) msg += `🔢 *Referencia:* ${reference}\n`
    msg += `\n`

    if (successResult.isCompleted || successResult.nuevoSaldoUsd <= 0.01) {
      msg += `🎉 *¡FACTURA TOTALMENTE PAGADA!*\nSaldo pendiente: $0.00 USD\n`
    } else {
      msg += `⚠️ *Saldo Restante Pendiente:* $${successResult.nuevoSaldoUsd.toFixed(2)} USD (Bs. ${(successResult.nuevoSaldoUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n`
      msg += `💡 *Nota Importante:* Recuerda que futuros abonos en Bolívares se calculan a la *tasa oficial del BCV del día* en que efectúes el próximo abono.\n`
    }

    msg += `\n¡Gracias por tu pago y preferencia!`
    return msg
  }, [successResult, order.order_number, exchangeRate, method, reference])

  const handleCopyReceipt = () => {
    if (!receiptMessage) return
    navigator.clipboard.writeText(receiptMessage)
    setCopiedReceipt(true)
    setTimeout(() => setCopiedReceipt(false), 2000)
  }

  const sendWhatsAppReceipt = (preferWeb = false) => {
    if (!receiptMessage) return
    const url = preferWeb
      ? createWhatsAppWebUrl(normalizedFullPhone, receiptMessage)
      : createWhatsAppUrl(normalizedFullPhone, receiptMessage)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Registrar Abono a Factura
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Orden #{order.order_number} &bull; Cliente: {(order as any).customers?.full_name || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Estado de Éxito o Formulario */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successResult ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                ¡Abono Registrado con Éxito!
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Se registró el pago de <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">${successResult.abonoUsd.toFixed(2)} USD</strong> (Bs. {successResult.abonoVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}).
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Factura:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">${totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nuevo Saldo Pendiente:</span>
                  <span className={`font-bold ${successResult.nuevoSaldoUsd <= 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    ${successResult.nuevoSaldoUsd.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado Factura:</span>
                  <span className="font-semibold uppercase text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    {successResult.isCompleted ? 'COMPLETADA' : 'CRÉDITO / PENDIENTE'}
                  </span>
                </div>
              </div>

              {/* Teléfono y Envío por WhatsApp */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Teléfono WhatsApp del Cliente
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Número internacional: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">+{normalizedFullPhone || '—'}</strong>
                </p>
              </div>

              {/* Tips para PC */}
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300 text-left">
                <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <p className="leading-snug">
                  <strong>En PC:</strong> Usa <em>WhatsApp Web</em> para que los emojis (🧾, 💵, 🇻🇪, 📊) se muestren intactos, o pulsa <em>Copiar</em> y pégalo en el chat.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendWhatsAppReceipt(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                    title="Abrir en WhatsApp Web en una nueva pestaña"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>WhatsApp Web (PC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyReceipt}
                    className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Copiar comprobante de abono al portapapeles"
                  >
                    {copiedReceipt ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                    <span>{copiedReceipt ? '¡Copiado!' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendWhatsAppReceipt(false)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Abrir con app de WhatsApp"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>App</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tarjeta de Resumen de Deuda */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    Saldo Pendiente
                  </span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    ${saldoPendienteUsd.toFixed(2)} <span className="text-sm font-semibold">USD</span>
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300/80">
                    Equiv. Bs. {saldoPendienteVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Tasa BCV Aplicada</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block shadow-2xs">
                    Bs. {appliedRate.toFixed(2)}/USD
                  </span>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={handleSetTotalAbono}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Pagar Todo
                    </button>
                  </div>
                </div>
              </div>

              {/* Selector de Tasa y Fecha de Pago (Para abonos de transferencias de ayer o días previos) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Fecha & Tasa BCV de la Transferencia:</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {paymentDate === todayStr ? 'Hoy' : paymentDate === yesterdayStr ? 'Ayer' : paymentDate}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => handleSelectRateMode('today')}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      rateMode === 'today'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRateMode('yesterday')}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      rateMode === 'yesterday'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                    title={yesterdayRateEntry ? `Tasa de ayer: Bs. ${yesterdayRateEntry.rate}` : 'Transferencia enviada ayer'}
                  >
                    Ayer {yesterdayRateEntry ? `(${yesterdayRateEntry.rate.toFixed(1)})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRateMode('custom')}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      rateMode === 'custom'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Otra Fecha
                  </button>
                </div>

                {(rateMode === 'custom' || rateMode === 'yesterday' || showRateSettings) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Fecha en que el cliente transfirió:
                      </label>
                      <input
                        type="date"
                        max={todayStr}
                        value={paymentDate}
                        onChange={(e) => handlePaymentDateChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Tasa oficial BCV de ese día:
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={customRateInput}
                          onChange={(e) => handleCustomRateChange(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {paymentDate !== todayStr && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                        ℹ️ Liquidando abono según la tasa del <strong>{paymentDate}</strong> (Bs. {appliedRate.toFixed(2)}/USD) para que coincida con el monto transferido.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={method}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto del Abono */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Monto a Abonar
                  </label>
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyInput('VES')
                        if (amountInput && currencyInput === 'USD') {
                          setAmountInput((parseFloat(amountInput) * appliedRate).toFixed(2))
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${currencyInput === 'VES' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
                    >
                      En Bs. (VES)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyInput('USD')
                        if (amountInput && currencyInput === 'VES') {
                          setAmountInput((parseFloat(amountInput) / appliedRate).toFixed(2))
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${currencyInput === 'USD' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
                    >
                      En $ (USD)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-1 rounded shadow-2xs ${
                    currencyInput === 'USD'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200'
                  }`}>
                    {currencyInput === 'USD' ? '$ USD' : 'Bs. VES'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-22 pr-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-base sm:text-lg font-black tracking-tight focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                {numericVal > 0 && (
                  <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                    <span>
                      {currencyInput === 'USD'
                        ? `Equivalente en Bs.: Bs. ${abonoVesCalculado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `Equivalente en USD: $${abonoUsdCalculado.toFixed(2)} USD`}
                    </span>
                    <span className={restantePostAbono <= 0.01 ? 'text-emerald-600 font-bold' : 'text-slate-600'}>
                      Resta: ${restantePostAbono.toFixed(2)} USD
                    </span>
                  </div>
                )}
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Número de Referencia / Comprobante
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: 123456 (últimos 4 o 6 dígitos)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              {/* Notas del abono */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notas u Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Pago móvil enviado desde cuenta de Juan Pérez"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || numericVal <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Registrar Abono
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

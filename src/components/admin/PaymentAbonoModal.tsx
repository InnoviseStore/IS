'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Monitor,
  Smartphone,
  Copy,
  Check,
  History,
  Pencil,
  Trash2,
  ArrowLeft,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import {
  COUNTRY_CODES,
  normalizeWhatsAppPhone,
  createWhatsAppWebUrl,
  createWhatsAppUrl
} from '@/lib/whatsapp'
import { useTenant } from '@/contexts/TenantContext'
import { AdminAuthPinModal } from '@/components/admin/AdminAuthPinModal'

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
  const [appliedRate, setAppliedRate] = useState<number>(Number(exchangeRate) || 91.5)
  const [customRateInput, setCustomRateInput] = useState<string>(String(exchangeRate || 91.5))
  const [showRateSettings, setShowRateSettings] = useState<boolean>(false)

  // Sincronizar tasa si cambia la prop exchangeRate y estamos en modo 'today'
  useEffect(() => {
    if (rateMode === 'today') {
      const validRate = Number(exchangeRate) || 91.5
      setAppliedRate(validRate)
      setCustomRateInput(String(validRate))
    }
  }, [exchangeRate, rateMode])

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

  const [currentOrder, setCurrentOrder] = useState<AbonoOrderTarget>(order)
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')

  // Estados para Edición y Eliminación de Abono con Clave Admin
  const [editingAbono, setEditingAbono] = useState<any | null>(null)
  const [editAmountInput, setEditAmountInput] = useState('')
  const [editCurrency, setEditCurrency] = useState<'USD' | 'VES'>('USD')
  const [editMethod, setEditMethod] = useState('pago_movil')
  const [editReference, setEditReference] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editRate, setEditRate] = useState<number>(Number(exchangeRate) || 91.5)
  const [deletingAbono, setDeletingAbono] = useState<any | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinAction, setPinAction] = useState<'edit' | 'delete' | null>(null)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  const [countryCode, setCountryCode] = useState('58')
  const [localPhone, setLocalPhone] = useState('')
  const [copiedReceipt, setCopiedReceipt] = useState(false)

  // Sincronizar currentOrder si la prop order cambia
  useEffect(() => {
    if (order) {
      setCurrentOrder(order)
    }
  }, [order])

  // Inicializar o resetear estado al abrir o cambiar de orden
  useEffect(() => {
    if (isOpen && order) {
      setCurrentOrder(order)
      setSuccessResult(null)
      setError(null)
      setActionSuccessMsg(null)
      setEditingAbono(null)
      setDeletingAbono(null)
      setPinModalOpen(false)
      setPinAction(null)
      setAmountInput('')
      setReference('')
      setNotes('')
      setPaymentDate(todayStr)
      setRateMode('today')
      const initialRate = Number(exchangeRate) || 91.5
      setAppliedRate(initialRate)
      setCustomRateInput(String(initialRate))
      setShowRateSettings(false)

      const rawPhone = (order as any).customers?.phone || (order as any).phone || ''
      const digits = String(rawPhone).replace(/\D/g, '')
      const matched = COUNTRY_CODES.find((c) => digits.startsWith(c.code))
      const code = matched ? matched.code : '58'
      setCountryCode(code)

      let local = digits
      if (local.startsWith(code)) {
        local = local.slice(code.length)
      }
      local = local.replace(/^0+/, '')
      setLocalPhone(local)
    }
  }, [isOpen, order?.id, todayStr, exchangeRate])

  const fullPhone = `${countryCode}${localPhone.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)

  const handleSelectRateMode = (mode: 'today' | 'yesterday' | 'custom') => {
    setRateMode(mode)
    if (mode === 'today') {
      setPaymentDate(todayStr)
      const baseRate = Number(exchangeRate) || 91.5
      setAppliedRate(baseRate)
      setCustomRateInput(String(baseRate))
      setShowRateSettings(false)
    } else if (mode === 'yesterday') {
      setPaymentDate(yesterdayStr)
      const yRate = Number(yesterdayRateEntry?.rate) || Number(exchangeRate) || 91.5
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
  const breakdown = Array.isArray(currentOrder?.payment_breakdown) ? currentOrder.payment_breakdown : []
  const pagadoPrevioUsd = breakdown.reduce((acc: number, item: any) => {
    if (item.method === 'credit_7d') return acc
    return acc + (Number(item.amount_usd) || 0)
  }, 0)

  const totalUsd = Number(currentOrder?.total_usd) || 0
  const saldoPendienteUsd = Math.max(0, totalUsd - pagadoPrevioUsd)
  const safeAppliedRate = appliedRate > 0 ? appliedRate : (Number(exchangeRate) || 91.5)
  const saldoPendienteVes = saldoPendienteUsd * safeAppliedRate

  // Lista de abonos registrados en la orden
  const existingAbonos = useMemo(() => {
    return breakdown.filter((item: any) => item.is_abono)
  }, [breakdown])

  // Iniciar edición de un abono existente
  const handleStartEdit = (abono: any) => {
    setError(null)
    setActionSuccessMsg(null)
    setEditingAbono(abono)
    setEditAmountInput(abono.amount_usd ? String(abono.amount_usd) : '')
    setEditCurrency('USD')
    setEditMethod(abono.method || 'pago_movil')
    setEditReference(abono.reference || '')
    setEditNotes(abono.notes || '')
    setEditDate(abono.date ? abono.date.split('T')[0] : todayStr)
    setEditRate(Number(abono.exchange_rate_applied) || safeAppliedRate)
  }

  // Iniciar eliminación de un abono
  const handleStartDelete = (abono: any) => {
    setError(null)
    setActionSuccessMsg(null)
    setDeletingAbono(abono)
    setPinAction('delete')
    setPinModalOpen(true)
  }

  // Confirmar edición enviando a la API con PIN Admin
  const handleConfirmEdit = async (pin: string) => {
    if (!editingAbono || !currentOrder) return
    setError(null)
    setActionSuccessMsg(null)

    const numVal = parseFloat(editAmountInput) || 0
    if (numVal <= 0) {
      setError('El monto del abono debe ser mayor a 0.')
      return
    }

    const editAmountUsd = editCurrency === 'USD' ? numVal : numVal / editRate
    const editAmountVes = editCurrency === 'VES' ? numVal : numVal * editRate

    try {
      setLoading(true)
      const effectiveTenantId = currentOrder.tenant_id || tenant?.id

      const res = await fetch('/api/admin/orders/abono', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          order_id: currentOrder.id,
          abono_id: editingAbono.id,
          pin,
          amount_usd: editAmountUsd,
          amount_ves: editAmountVes,
          method: editMethod,
          payment_method: editMethod,
          reference: editReference,
          notes: editNotes,
          payment_date: editDate,
          exchange_rate: editRate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al modificar el abono.')
      }

      if (data.order) {
        setCurrentOrder(data.order)
      }
      setEditingAbono(null)
      setPinAction(null)
      setActionSuccessMsg('✓ Abono modificado exitosamente con clave admin.')
      if (onAbonoSuccess) {
        onAbonoSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Error al modificar el abono.')
    } finally {
      setLoading(false)
    }
  }

  // Confirmar eliminación enviando a la API con PIN Admin
  const handleConfirmDelete = async (pin: string) => {
    if (!deletingAbono || !currentOrder) return
    setError(null)
    setActionSuccessMsg(null)

    try {
      setLoading(true)
      const effectiveTenantId = currentOrder.tenant_id || tenant?.id

      const res = await fetch('/api/admin/orders/abono', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          order_id: currentOrder.id,
          abono_id: deletingAbono.id,
          pin,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el abono.')
      }

      if (data.order) {
        setCurrentOrder(data.order)
      }
      setDeletingAbono(null)
      setPinAction(null)
      setActionSuccessMsg('✓ Abono eliminado y saldo pendiente restaurado con éxito.')
      if (onAbonoSuccess) {
        onAbonoSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el abono.')
    } finally {
      setLoading(false)
    }
  }

  // Calcular abono en USD y VES en base a lo que tipea el usuario
  const numericVal = parseFloat(amountInput) || 0
  const abonoUsdCalculado = currencyInput === 'USD' ? numericVal : (numericVal / safeAppliedRate)
  const abonoVesCalculado = currencyInput === 'VES' ? numericVal : (numericVal * safeAppliedRate)
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
      setAmountInput((saldoPendienteUsd * safeAppliedRate).toFixed(2))
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
      const effectiveTenantId = order?.tenant_id || tenant?.id

      const res = await fetch('/api/admin/orders/abono', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          order_id: order?.id,
          amount_usd: abonoUsdCalculado,
          amount_ves: abonoVesCalculado,
          exchange_rate: safeAppliedRate,
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

      const nuevoSaldo = typeof data?.remainingUsd === 'number'
        ? data.remainingUsd
        : typeof data?.nuevoSaldoUsd === 'number'
          ? data.nuevoSaldoUsd
          : restantePostAbono

      const isCompleted = typeof data?.isFullyPaid === 'boolean'
        ? data.isFullyPaid
        : typeof data?.isCompleted === 'boolean'
          ? data.isCompleted
          : nuevoSaldo <= 0.01

      setSuccessResult({
        abonoUsd: Number(abonoUsdCalculado) || 0,
        abonoVes: Number(abonoVesCalculado) || 0,
        nuevoSaldoUsd: Number(nuevoSaldo) || 0,
        isCompleted: Boolean(isCompleted),
        orderNumber: order?.order_number || '',
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

  const receiptMessage = useMemo(() => {
    if (!successResult) return ''
    const abonoUsdSafe = Number(successResult.abonoUsd ?? 0)
    const abonoVesSafe = Number(successResult.abonoVes ?? 0)
    const nuevoSaldoUsdSafe = Number(successResult.nuevoSaldoUsd ?? 0)
    const rateToDisplay = Number(safeAppliedRate || exchangeRate || 1)

    let msg = `🧾 *COMPROBANTE DE ABONO RECIBIDO*\n`
    msg += `📄 *Factura:* #${order?.order_number || ''}\n`
    msg += `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n\n`
    msg += `💵 *Monto Abonado:* $${abonoUsdSafe.toFixed(2)} USD\n`
    msg += `🇻🇪 *Equivalente en Bs.:* Bs. ${abonoVesSafe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`
    msg += `📊 *Tasa Oficial BCV aplicada:* Bs. ${rateToDisplay.toFixed(2)}/USD\n`
    msg += `💳 *Método:* ${PAYMENT_METHODS.find((p) => p.id === method)?.label || method}\n`
    if (reference) msg += `🔢 *Referencia:* ${reference}\n`
    msg += `\n`

    if (successResult.isCompleted || nuevoSaldoUsdSafe <= 0.01) {
      msg += `🎉 *¡FACTURA TOTALMENTE PAGADA!*\nSaldo pendiente: $0.00 USD\n`
    } else {
      msg += `⚠️ *Saldo Restante Pendiente:* $${nuevoSaldoUsdSafe.toFixed(2)} USD (Bs. ${(nuevoSaldoUsdSafe * rateToDisplay).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n`
      msg += `💡 *Nota Importante:* Recuerda que futuros abonos en Bolívares se calculan a la *tasa oficial del BCV del día* en que efectúes el próximo abono.\n`
    }

    msg += `\n¡Gracias por tu pago y preferencia!`
    return msg
  }, [successResult, order?.order_number, safeAppliedRate, exchangeRate, method, reference])

  const handleCopyReceipt = async () => {
    if (!receiptMessage) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptMessage)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = receiptMessage
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedReceipt(true)
      setTimeout(() => setCopiedReceipt(false), 2000)
    } catch (e) {
      console.warn('Could not copy receipt:', e)
    }
  }

  const sendWhatsAppReceipt = (preferWeb = false) => {
    if (!receiptMessage) return
    const url = preferWeb
      ? createWhatsAppWebUrl(normalizedFullPhone, receiptMessage)
      : createWhatsAppUrl(normalizedFullPhone, receiptMessage)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Garantizar que todos los hooks se ejecutaron antes de evaluar isOpen
  if (!isOpen || !order) return null

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
                Gestión de Abonos a Factura
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Orden #{currentOrder?.order_number} &bull; Cliente: {(currentOrder as any)?.customers?.full_name || 'Cliente'}
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

        {/* Selector de Pestañas: Registrar Abono vs Historial */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setEditingAbono(null); setDeletingAbono(null); }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Registrar Abono</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('history'); }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial y Modificación ({existingAbonos.length})</span>
          </button>
        </div>

        {/* Contenido / Estado de Éxito o Formulario */}
        <div className="p-6 overflow-y-auto space-y-5">
          {actionSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccessMsg(null)}
                className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
              >
                Cerrar
              </button>
            </div>
          )}

          {activeTab === 'create' ? (
            successResult ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                ¡Abono Registrado con Éxito!
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Se registró el pago de <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">${Number(successResult.abonoUsd ?? 0).toFixed(2)} USD</strong> (Bs. {Number(successResult.abonoVes ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}).
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Factura:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">${totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nuevo Saldo Pendiente:</span>
                  <span className={`font-bold ${Number(successResult.nuevoSaldoUsd ?? 0) <= 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    ${Number(successResult.nuevoSaldoUsd ?? 0).toFixed(2)} USD
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
                    Bs. {safeAppliedRate.toFixed(2)}/USD
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
                        ℹ️ Liquidando abono según la tasa del <strong>{paymentDate}</strong> (Bs. {safeAppliedRate.toFixed(2)}/USD) para que coincida con el monto transferido.
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
                          setAmountInput((parseFloat(amountInput) * safeAppliedRate).toFixed(2))
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
                          setAmountInput((parseFloat(amountInput) / safeAppliedRate).toFixed(2))
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
          )
        ) : (
            /* ─── Pestaña: Historial y Modificación de Abonos ─── */
            <div className="space-y-4">
              {/* Vista 1: Modo Edición de Abono */}
              {editingAbono ? (
                <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <button
                      type="button"
                      onClick={() => setEditingAbono(null)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Volver al listado</span>
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
                      <Pencil className="w-3 h-3" />
                      Editando Abono
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* Monto y Moneda */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Monto Corregido
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            {editCurrency === 'USD' ? '$' : 'Bs.'}
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={editAmountInput}
                            onChange={(e) => setEditAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        <div className="flex rounded-xl p-1 bg-slate-200 dark:bg-slate-800 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setEditCurrency('USD')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${editCurrency === 'USD' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
                          >
                            USD ($)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditCurrency('VES')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${editCurrency === 'VES' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                          >
                            VES (Bs.)
                          </button>
                        </div>
                      </div>
                      {editAmountInput && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          {editCurrency === 'USD'
                            ? `Equivalente en Bs.: Bs. ${(parseFloat(editAmountInput) * editRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: Bs. ${editRate.toFixed(2)})`
                            : `Equivalente en USD: $${(parseFloat(editAmountInput) / editRate).toFixed(2)} USD (Tasa: Bs. ${editRate.toFixed(2)})`
                          }
                        </p>
                      )}
                    </div>

                    {/* Método de Pago */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Método de Pago
                      </label>
                      <select
                        value={editMethod}
                        onChange={(e) => setEditMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Referencia y Fecha */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          N° Referencia
                        </label>
                        <input
                          type="text"
                          value={editReference}
                          onChange={(e) => setEditReference(e.target.value)}
                          placeholder="Ej: 123456"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Fecha del Pago
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Observaciones / Notas
                      </label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Motivo de corrección o nota del abono…"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingAbono(null)}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const numVal = parseFloat(editAmountInput) || 0
                          if (numVal <= 0) {
                            setError('Ingresa un monto válido para guardar.')
                            return
                          }
                          setPinAction('edit')
                          setPinModalOpen(true)
                        }}
                        disabled={loading || !editAmountInput}
                        className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Guardar con Clave Admin</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Vista de Lista de Abonos */
                <div className="space-y-3">
                  {existingAbonos.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <History className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        No hay abonos registrados para esta factura.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Puedes registrar un nuevo abono desde la pestaña "Registrar Abono".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Abonos Realizados ({existingAbonos.length})
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Total abonado: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">${pagadoPrevioUsd.toFixed(2)} USD</strong>
                        </span>
                      </div>

                      {existingAbonos.map((abono: any, idx: number) => {
                        const methodObj = PAYMENT_METHODS.find((m) => m.id === abono.method)
                        const methodLabel = methodObj?.label || abono.method || 'Abono'
                        const abonoDateStr = abono.date ? new Date(abono.date).toLocaleDateString('es-VE') : 'Fecha n/d'

                        return (
                          <div
                            key={abono.id || idx}
                            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold uppercase">
                                    {methodLabel}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    {abonoDateStr}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-baseline gap-2">
                                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                                    ${Number(abono.amount_usd || 0).toFixed(2)} USD
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    (Bs. {Number(abono.amount_ves || (Number(abono.amount_usd || 0) * (Number(abono.exchange_rate_applied) || 1))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                  </span>
                                </div>
                                {abono.reference && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                    Ref: <span className="font-bold text-slate-700 dark:text-slate-300">{abono.reference}</span>
                                  </p>
                                )}
                                {abono.notes && (
                                  <p className="text-[11px] text-slate-400 italic mt-0.5">
                                    "{abono.notes}"
                                  </p>
                                )}
                              </div>

                              {/* Botones de Editar y Eliminar con PIN Admin */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(abono)}
                                  className="px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Modificar este abono por error (Requiere Clave Admin)"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartDelete(abono)}
                                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Eliminar este abono por error (Requiere Clave Admin)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal de Seguridad de Clave Admin para Autorizar Cambios */}
        <AdminAuthPinModal
          isOpen={pinModalOpen}
          onClose={() => {
            setPinModalOpen(false)
            setPinAction(null)
          }}
          onSuccess={(pin) => {
            if (pinAction === 'edit') handleConfirmEdit(pin)
            if (pinAction === 'delete') handleConfirmDelete(pin)
          }}
          title={pinAction === 'edit' ? 'Autorizar Edición de Abono' : 'Autorizar Eliminación de Abono'}
          description={
            pinAction === 'edit'
              ? 'Ingresa la Clave de Administrador de la tienda para guardar las modificaciones y recalcular la deuda.'
              : 'Ingresa la Clave de Administrador de la tienda para anular este abono y restaurar la deuda del cliente.'
          }
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Customer } from '@/types/database'
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  Loader2, 
  Send, 
  Calendar, 
  Edit3,
  Sparkles,
  Monitor,
  Smartphone,
  CheckCircle2,
  Share2
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { 
  COUNTRY_CODES, 
  normalizeWhatsAppPhone, 
  createWhatsAppWebUrl, 
  createWhatsAppUrl 
} from '@/lib/whatsapp'

export interface InitialCreditSaleInfo {
  orderNumber?: string
  totalUsd: number
  paidUsd: number
  creditAmountUsd: number
  dueDate: string
  discountAmountUsd?: number
  items: { name: string; quantity: number; unitPrice: number }[]
  payments: { method: string; amountUsd: number }[]
}

interface Props {
  customer: Customer
  onClose: () => void
  initialSaleInfo?: InitialCreditSaleInfo
}

export function CreditCollectionModal({ customer, onClose, initialSaleInfo }: Props) {
  const { tenant, exchangeRate } = useTenant()
  const [includeDetails, setIncludeDetails] = useState(true)
  const [loading, setLoading] = useState(!initialSaleInfo)
  const [copied, setCopied] = useState(false)
  
  // Datos recopilados para el mensaje
  const [saleDetails, setSaleDetails] = useState<{
    items: { name: string; quantity: number; unitPrice: number }[]
    payments: { method: string; amountUsd: number; date?: string }[]
    totalPurchaseUsd: number
    totalPaidUsd: number
    pendingDebtUsd: number
    dueDateStr: string
    discountAmountUsd: number
  }>({
    items: initialSaleInfo?.items ?? [],
    payments: initialSaleInfo?.payments ?? [],
    totalPurchaseUsd: initialSaleInfo?.totalUsd ?? customer.current_debt_usd,
    totalPaidUsd: initialSaleInfo?.paidUsd ?? 0,
    pendingDebtUsd: initialSaleInfo?.creditAmountUsd ?? customer.current_debt_usd,
    dueDateStr: initialSaleInfo?.dueDate ? formatDate(initialSaleInfo.dueDate) : formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    discountAmountUsd: initialSaleInfo?.discountAmountUsd ?? 0,
  })

  // Cargar órdenes a crédito históricas si no viene de una venta inmediata
  const loadCustomerCreditOrders = useCallback(async () => {
    if (initialSaleInfo || !tenant) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (orders && orders.length > 0) {
        // Recopilar items de las órdenes a crédito más recientes
        const creditOrders = orders.filter((o: any) => o.status === 'credit' || o.payment_condition === 'credit_7d')
        const activeOrder = creditOrders[0] || orders[0]

        const items = (activeOrder.order_items || []).map((it: any) => ({
          name: it.product_name,
          quantity: it.quantity,
          unitPrice: Number(it.unit_price_usd) || 0
        }))

        // Recopilar abonos/pagos realizados en la orden
        const paymentsList: { method: string; amountUsd: number; date?: string }[] = []
        if (Array.isArray(activeOrder.payment_breakdown)) {
          activeOrder.payment_breakdown.forEach((p: any) => {
            if (p.method !== 'credit_7d' && (Number(p.amount_usd) || 0) > 0) {
              paymentsList.push({
                method: p.method,
                amountUsd: Number(p.amount_usd),
                date: formatDateTime(activeOrder.created_at)
              })
            }
          })
        }

        const dueDateFormatted = activeOrder.due_date
          ? formatDate(activeOrder.due_date)
          : formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

        const totalPaid = paymentsList.reduce((s, p) => s + p.amountUsd, 0)
        const totalOrder = Number(activeOrder.total_usd) || (customer.current_debt_usd + totalPaid)

        setSaleDetails({
          items,
          payments: paymentsList,
          totalPurchaseUsd: totalOrder,
          totalPaidUsd: totalPaid,
          pendingDebtUsd: customer.current_debt_usd > 0 ? customer.current_debt_usd : Math.max(0, totalOrder - totalPaid),
          dueDateStr: dueDateFormatted,
          discountAmountUsd: Number(activeOrder.discount_total_usd) || 0,
        })
      }
    } catch (e) {
      console.warn('Error loading customer credit details:', e)
    } finally {
      setLoading(false)
    }
  }, [customer.id, customer.current_debt_usd, initialSaleInfo, tenant])

  useEffect(() => {
    loadCustomerCreditOrders()
  }, [loadCustomerCreditOrders])

  // Método legible
  const formatMethod = (m: string) => {
    switch (m) {
      case 'zelle': return 'Zelle (USD)'
      case 'pago_movil': return 'Pago Móvil (VES)'
      case 'cash_usd': return 'Efectivo USD'
      case 'cash_ves': return 'Efectivo VES'
      case 'transfer_ves': return 'Transferencia Bancaria'
      case 'debit_ves': return 'Punto de Venta Débito'
      default: return 'Abono Registrado'
    }
  }

  // Generación del texto base según el toggle de detalle
  const generatedText = useMemo(() => {
    const storeName = tenant?.name ?? 'Innovise Store'
    const pendingUsd = saleDetails.pendingDebtUsd
    const pendingVes = (pendingUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const formattedUsd = `$${pendingUsd.toFixed(2)} USD`

    const discountLine = saleDetails.discountAmountUsd > 0
      ? `🎉 Descuento especial: -$${saleDetails.discountAmountUsd.toFixed(2)} USD\n`
      : ''
    const bcvNotice = `💡 *Condición de Abono:* Todo abono o pago en Bolívares se liquida a la *tasa oficial del BCV del día* en que realices el pago.`

    if (!includeDetails) {
      // Formato Resumen
      return `👋 Hola *${customer.full_name}*, te saludamos cordialmente de *${storeName}*.

Te recordamos que mantienes un saldo pendiente a crédito en nuestro comercio por un total de:
💰 *${formattedUsd}* (Aprox. Bs. ${pendingVes} a tasa oficial BCV).
${discountLine}
📅 *Fecha límite de pago:* ${saleDetails.dueDateStr}

${bcvNotice}

Agradecemos tu confirmación para conciliar tu cuenta. Si ya realizaste el pago, por favor haznos llegar el comprobante. ¡Muchas gracias por tu confianza! 🙌`
    }

    // Formato Detallado con productos y abonos
    let itemsBlock = ''
    if (saleDetails.items.length > 0) {
      const itemsLines = saleDetails.items.map(
        (it) => `• ${it.quantity}x ${it.name} — $${(it.quantity * it.unitPrice).toFixed(2)} USD`
      ).join('\n')
      itemsBlock = `📦 *Productos Adquiridos:*\n${itemsLines}\n`
    }

    let paymentsBlock = ''
    if (saleDetails.payments.length > 0) {
      const paymentLines = saleDetails.payments.map(
        (p) => `• ${p.date ? `${p.date}: ` : ''}Abono de $${p.amountUsd.toFixed(2)} USD vía ${formatMethod(p.method)}`
      ).join('\n')
      paymentsBlock = `💵 *Abonos Realizados:*\n${paymentLines}\n`
    } else {
      paymentsBlock = `💵 *Abonos Realizados:*\n• Sin abonos previos registrados (Financiamiento 100%)\n`
    }

    return `👋 Hola *${customer.full_name}*, te saludamos de *${storeName}*.

Compartimos contigo el estado detallado de tu compra a crédito:

${itemsBlock ? `${itemsBlock}\n` : ''}${paymentsBlock}
📊 *Resumen de Cuenta:*
• Total Compra: $${saleDetails.totalPurchaseUsd.toFixed(2)} USD
${saleDetails.discountAmountUsd > 0 ? `• 🎉 Descuento Aplicado: -$${saleDetails.discountAmountUsd.toFixed(2)} USD\n` : ''}• Total Abonado: $${saleDetails.totalPaidUsd.toFixed(2)} USD
• 💰 *Saldo Pendiente por Pagar: ${formattedUsd}* (Bs. ${pendingVes})
• 📅 *Fecha Límite de Pago:* ${saleDetails.dueDateStr}

${bcvNotice}

Puedes realizar tu abono mediante Zelle, Pago Móvil o Efectivo. Agradecemos nos envíes el comprobante al completar tu transferencia. ¡Feliz día y gracias por preferirnos! ✨`
  }, [customer.full_name, tenant?.name, saleDetails, exchangeRate, includeDetails])

  // Estado editable del mensaje
  const [customMessage, setCustomMessage] = useState('')

  // Sincronizar mensaje cuando cambia el toggle de detalle o los datos
  useEffect(() => {
    setCustomMessage(generatedText)
  }, [generatedText])

  const rawPhone = customer.phone ?? ''

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

  const fullPhone = `${countryCode}${localNumber.replace(/^0+/, '')}`
  const normalizedFullPhone = normalizeWhatsAppPhone(fullPhone, countryCode)
  const hasValidPhone = normalizedFullPhone.length >= 10

  function handleSendWhatsApp(preferWeb = false) {
    if (!hasValidPhone) {
      alert('Por favor ingresa un número de teléfono válido para WhatsApp.')
      return
    }
    const url = preferWeb 
      ? createWhatsAppWebUrl(normalizedFullPhone, customMessage)
      : createWhatsAppUrl(normalizedFullPhone, customMessage)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleCopy() {
    navigator.clipboard.writeText(customMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-4 transition-all text-xs font-medium space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Recordatorio de Cobro a Crédito
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cliente: <span className="font-bold text-slate-800 dark:text-slate-200">{customer.full_name}</span> {customer.id_number && `(${customer.id_number})`}
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

        {/* Tarjeta de Resumen de Deuda */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Deuda Pendiente</span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
              ${saleDetails.pendingDebtUsd.toFixed(2)} USD
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Equivalente BCV</span>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
              Bs. {(saleDetails.pendingDebtUsd * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Límite</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3 text-blue-500" />
              {saleDetails.dueDateStr}
            </span>
          </div>
        </div>

        {/* Controles de Nivel de Detalle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Formato del Mensaje:
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setIncludeDetails(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  includeDetails
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Detallado (Productos & Abonos)
              </button>
              <button
                type="button"
                onClick={() => setIncludeDetails(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  !includeDetails
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Resumen Corto
              </button>
            </div>
          </div>
        </div>

        {/* Área de Mensaje Editable */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Edit3 className="w-3 h-3 text-slate-400" />
              Puedes modificar o añadir texto antes de enviar:
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1 transition cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Cargando detalles de cuenta...</span>
            </div>
          ) : (
            <textarea
              rows={9}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs leading-relaxed font-sans transition"
            />
          )}
        </div>

        {/* Selector de Código de País y Teléfono del Cliente */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Teléfono de WhatsApp del Cliente
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
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value)}
              placeholder="Ej. 4121234567"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Número internacional:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                +{normalizedFullPhone || '—'}
              </strong>
            </span>
            {!hasValidPhone && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Número incompleto</span>
            )}
          </div>
        </div>

        {/* Consejo para PC / Emojis */}
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p className="leading-snug">
            <strong>Consejo para PC:</strong> Al usar <em>WhatsApp Web</em> los emojis (💵, 📦, 📊, 📅) se cargan sin corromperse. También puedes pulsar <em>Copiar</em> y pegarlo directamente en el chat.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-bold transition cursor-pointer text-xs"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? '¡Copiado! ✓' : 'Copiar'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSendWhatsApp(true)}
              disabled={!hasValidPhone || !customMessage.trim()}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              title="Abrir en WhatsApp Web en una nueva pestaña de la PC"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>WhatsApp Web (PC)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendWhatsApp(false)}
              disabled={!hasValidPhone || !customMessage.trim()}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Abrir con app de WhatsApp móvil o de escritorio"
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

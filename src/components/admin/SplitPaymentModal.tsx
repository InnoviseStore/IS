'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { CartItem, Customer, PaymentMethodType } from '@/types/database'
import { X, Plus, Trash2, Loader2, CheckCircle, Info, UserPlus, MessageCircle } from 'lucide-react'
import { CustomerModal } from '@/components/admin/CustomerModal'
import { CreditCollectionModal, type InitialCreditSaleInfo } from '@/components/admin/CreditCollectionModal'
import { formatDate, formatDateTime } from '@/lib/formatters'

interface PaymentRow {
  id: string
  method: PaymentMethodType
  amount: string
  reference: string
}

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  zelle: '🏦 Zelle (USD)',
  pago_movil: '📱 Pago Móvil (VES)',
  cash_usd: '💵 Efectivo USD',
  cash_ves: '💴 Efectivo VES',
  transfer_ves: '🏛️ Transferencia (VES)',
  debit_ves: '💳 Punto / Débito (VES)',
  credit_7d: '⏳ Crédito',
}

const SELECTABLE_METHODS: PaymentMethodType[] = ['zelle', 'pago_movil', 'cash_usd', 'cash_ves', 'transfer_ves', 'debit_ves']

// Métodos que se ingresan en VES
const VES_METHODS: PaymentMethodType[] = ['pago_movil', 'cash_ves', 'transfer_ves', 'debit_ves']
// Métodos que generan IGTF (divisas)
const USD_METHODS: PaymentMethodType[] = ['zelle', 'cash_usd']

const IGTF_RATE = 0.03 // 3% — Impuesto a las Grandes Transacciones Financieras

interface Props {
  cartItems: CartItem[]
  totalUsd: number
  exchangeRate: number
  onClose: () => void
  onSuccess: () => void
}

export function SplitPaymentModal({ cartItems, totalUsd, exchangeRate, onClose, onSuccess }: Props) {
  const { tenant, profile } = useTenant()
  const [customerType, setCustomerType] = useState<'final' | 'registered'>('final')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isCredit, setIsCredit] = useState(false)
  const [creditDays, setCreditDays] = useState<number>(7)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [registeredSaleData, setRegisteredSaleData] = useState<InitialCreditSaleInfo | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([
    { id: '1', method: 'zelle', amount: '', reference: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Detect if this tenant is an IGTF agent (set in tenant settings)
  const isIgtfAgent = Boolean((tenant?.settings as Record<string, unknown>)?.is_igtf_agent ?? false)

  // Customer search with debounce (búsqueda por nombre o cédula/RIF)
  useEffect(() => {
    if (!tenant || customerType !== 'registered' || customerSearch.length < 2) {
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      const cleanSearch = customerSearch.trim()
      const supabase = createClient()
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .or(`full_name.ilike.%${cleanSearch}%,id_number.ilike.%${cleanSearch}%`)
        .limit(8)
      setCustomerResults(data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch, tenant, customerType])

  function addPaymentRow() {
    setPayments((p) => [...p, { id: Date.now().toString(), method: 'pago_movil', amount: '', reference: '' }])
  }

  function removeRow(id: string) {
    setPayments((p) => p.filter((r) => r.id !== id))
  }

  function updateRow(id: string, field: keyof PaymentRow, value: string) {
    setPayments((p) => p.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  // ─── Calculate totals ──────────────────────────────────────────────────────
  // 1. Amount paid in USD equivalent (all methods normalized)
  const paidUsd = payments.reduce((sum, row) => {
    const amount = parseFloat(row.amount) || 0
    const isVes = VES_METHODS.includes(row.method)
    return sum + (isVes ? amount / exchangeRate : amount)
  }, 0)

  // 2. IGTF: 3% on USD method payments when the tenant is IGTF agent
  const igtfTotal = isIgtfAgent
    ? payments.reduce((sum, row) => {
        const amount = parseFloat(row.amount) || 0
        const isUsd = USD_METHODS.includes(row.method)
        return sum + (isUsd ? amount * IGTF_RATE : 0)
      }, 0)
    : 0

  // 3. Grand total = subtotal + IGTF
  const grandTotalUsd = totalUsd + igtfTotal
  const grandTotalVes = grandTotalUsd * exchangeRate
  const remainingUsd = grandTotalUsd - paidUsd

  const dueDateObj = new Date(Date.now() + (creditDays || 7) * 24 * 60 * 60 * 1000)
  const dueDate = formatDate(dueDateObj)
  const availableCredit = selectedCustomer
    ? Number(selectedCustomer.credit_limit_usd) - Number(selectedCustomer.current_debt_usd)
    : 0

  const creditAmountUsd = isCredit ? Math.max(0, parseFloat((grandTotalUsd - paidUsd).toFixed(4))) : 0
  const exceedsLimit = isCredit && selectedCustomer && creditAmountUsd > (availableCredit + 0.01)
  const paidExceedsTotal = paidUsd > (grandTotalUsd + 0.01)

  const canConfirm = isCredit
    ? (selectedCustomer !== null && !exceedsLimit && !paidExceedsTotal && creditAmountUsd > 0)
    : Math.abs(remainingUsd) < 0.01

  async function handleConfirm() {
    if (!tenant || !profile) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const validPayments = payments.filter((row) => (parseFloat(row.amount) || 0) > 0)
    const paymentBreakdown = validPayments.map((row) => {
      const amount = parseFloat(row.amount) || 0
      const isVes = VES_METHODS.includes(row.method)
      const isUsd = USD_METHODS.includes(row.method)
      const rowIgtf = isIgtfAgent && isUsd ? parseFloat((amount * IGTF_RATE).toFixed(4)) : 0
      return {
        method: row.method,
        amount_usd: isVes ? parseFloat((amount / exchangeRate).toFixed(4)) : amount,
        amount_ves: isVes ? amount : parseFloat((amount * exchangeRate).toFixed(2)),
        reference: row.reference || undefined,
        igtf_amount: rowIgtf || undefined,
      }
    })

    if (isCredit && creditAmountUsd > 0) {
      paymentBreakdown.push({
        method: 'credit_7d' as const,
        amount_usd: parseFloat(creditAmountUsd.toFixed(4)),
        amount_ves: parseFloat((creditAmountUsd * exchangeRate).toFixed(2)),
        reference: `Crédito a ${creditDays} días (Vence: ${dueDate})`,
        igtf_amount: undefined,
      })
    }

    try {
      const payload = {
        tenant_id: tenant.id,
        customer_id: selectedCustomer?.id ?? null,
        status: isCredit ? 'credit' : 'completed',
        payment_condition: isCredit ? 'credit_7d' : 'immediate',
        exchange_rate_at_sale: exchangeRate,
        subtotal_usd: totalUsd,
        igtf_total: parseFloat(igtfTotal.toFixed(4)),
        total_usd: parseFloat(grandTotalUsd.toFixed(4)),
        total_ves: parseFloat(grandTotalVes.toFixed(2)),
        payment_breakdown: paymentBreakdown,
        created_by: profile.id,
        credit_amount_usd: isCredit ? creditAmountUsd : 0,
        due_date: isCredit ? dueDateObj.toISOString() : null,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          product_name: item.name,
          product_sku: item.sku ?? null,
          unit_price_usd: item.unit_price_usd,
          quantity: item.quantity,
        })),
        isCredit,
        customer: selectedCustomer
          ? {
              id: selectedCustomer.id,
              current_debt_usd: selectedCustomer.current_debt_usd,
            }
          : null,
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la venta')
      }

      const orderNumber = data.order?.order_number || 'IS-OK'
      if (isCredit && selectedCustomer) {
        setRegisteredSaleData({
          orderNumber,
          totalUsd: grandTotalUsd,
          paidUsd: paidUsd,
          creditAmountUsd: creditAmountUsd,
          dueDate: dueDate,
          items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price_usd })),
          payments: validPayments.map((p) => ({
            method: p.method,
            amountUsd: VES_METHODS.includes(p.method) ? (parseFloat(p.amount) || 0) / exchangeRate : (parseFloat(p.amount) || 0)
          }))
        })
      }

      setSuccess(orderNumber)
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al guardar la orden')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative z-10 glass-card p-6 sm:p-8 max-w-sm w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
            {isCredit ? '¡Venta a Crédito Registrada!' : '¡Venta Registrada!'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 font-medium">
            Orden: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{success}</span>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
            Subtotal: <span className="font-extrabold text-slate-900 dark:text-white">${totalUsd.toFixed(2)} USD</span>
          </p>
          {igtfTotal > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              IGTF (3%): <span className="font-extrabold">${igtfTotal.toFixed(2)} USD</span>
            </p>
          )}
          <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1 mb-4">
            Total: <span className="text-blue-600 dark:text-blue-400">${grandTotalUsd.toFixed(2)} USD</span>
          </p>

          {isCredit && selectedCustomer && (
            <button
              type="button"
              onClick={() => setShowCollectionModal(true)}
              className="w-full mb-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar Detalle / Cobro por WhatsApp</span>
            </button>
          )}

          <button onClick={onSuccess} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer">
            Nueva Venta
          </button>
        </div>

        {showCollectionModal && selectedCustomer && (
          <CreditCollectionModal
            customer={selectedCustomer}
            initialSaleInfo={registeredSaleData || undefined}
            onClose={() => setShowCollectionModal(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl glass-card p-6 sm:p-8 my-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Cobrar Venta</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: Customer */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">1. Cliente</h3>
            <div className="flex gap-2 mb-3">
              {(['final', 'registered'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setCustomerType(t); setSelectedCustomer(null); setIsCredit(false) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                    customerType === t
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'final' ? 'Consumidor Final' : 'Cliente Registrado'}
                </button>
              ))}
            </div>

            {customerType === 'registered' && (
              <div className="space-y-2">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text" placeholder="Buscar cliente por nombre o cédula / RIF…"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    />
                    {customerResults.length > 0 && !selectedCustomer && (
                      <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.full_name); setCustomerResults([]) }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-slate-900 dark:text-white">{c.full_name}</p>
                              {c.id_number && (
                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold">
                                  {c.id_number}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                              {c.phone ? `📱 ${c.phone}` : 'Sin tlf'} | Crédito disp.: ${(c.credit_limit_usd - c.current_debt_usd).toFixed(2)}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerModal(true)}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-200 dark:border-blue-900/60 transition shrink-0 cursor-pointer"
                    title="Registrar nuevo cliente en el acto"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo</span>
                  </button>
                </div>
              </div>
            )}

            {/* OPCIÓN GENERAL DE VENTA A CRÉDITO */}
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="credit"
                    checked={isCredit}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setIsCredit(checked)
                      if (checked && customerType === 'final') {
                        setCustomerType('registered')
                      }
                    }}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <label htmlFor="credit" className="text-sm text-slate-800 dark:text-slate-200 font-bold cursor-pointer flex items-center gap-2">
                    <span>Venta a Crédito / Financiamiento</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      Flexible
                    </span>
                  </label>
                </div>
              </div>

              {isCredit && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3.5 text-xs space-y-3 font-medium">
                  {/* Selector Dinámico de Días de Crédito */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300 font-bold">Plazo de Crédito (Días):</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black text-xs">
                        Vence: {dueDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[7, 15, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setCreditDays(days)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                            creditDays === days
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {days} días
                        </button>
                      ))}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1">
                        <span className="text-[11px] text-slate-500 font-medium">Personalizado:</span>
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={creditDays}
                          onChange={(e) => setCreditDays(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-12 text-center font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none text-xs"
                        />
                        <span className="text-[11px] text-slate-500">días</span>
                      </div>
                    </div>
                  </div>

                  {/* Advertencia si no se ha seleccionado cliente registrado */}
                  {!selectedCustomer ? (
                    <div className="flex items-start gap-2 bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 text-amber-900 dark:text-amber-200">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                      <div className="space-y-1">
                        <p className="text-xs">
                          Para otorgar crédito es indispensable asignar o registrar un cliente con cédula y teléfono para llevar el control y enviar los recordatorios de cobro.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerType('registered')
                            setShowNewCustomerModal(true)
                          }}
                          className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline text-xs cursor-pointer mt-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Registrar nuevo cliente en el acto</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-2 border-t border-amber-200/80 dark:border-amber-900/60">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Cliente titular:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedCustomer.full_name} {selectedCustomer.id_number && `(${selectedCustomer.id_number})`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Límite de crédito:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">${selectedCustomer.credit_limit_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Deuda actual:</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">${selectedCustomer.current_debt_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Disponible:</span>
                        <span className={`font-extrabold ${availableCredit >= creditAmountUsd ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          ${availableCredit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Payment Methods (Or Initial Downpayment when Credit) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isCredit ? '2. Abono Inicial / Pago Parcial (Opcional)' : '2. Métodos de Pago'}
              </h3>
              {isCredit && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                  Venta Financiada (FINA)
                </span>
              )}
            </div>

            {isCredit && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Si el cliente pagará el 100% a crédito, no es necesario registrar métodos de pago hoy. Si entrega un anticipo o abono inicial, ingrésalo aquí.
              </p>
            )}

            {/* IGTF Notice */}
            {isIgtfAgent && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Este comercio es <strong>Agente IGTF</strong>. Se aplicará automáticamente el <strong>3% de IGTF</strong> sobre los montos pagados en divisas (Zelle y Efectivo USD).</span>
              </div>
            )}

            <div className="space-y-2.5">
              {payments.map((row) => {
                const isVes = VES_METHODS.includes(row.method)
                const isUsd = USD_METHODS.includes(row.method)
                const rowAmount = parseFloat(row.amount) || 0
                const rowIgtf = isIgtfAgent && isUsd ? rowAmount * IGTF_RATE : 0
                return (
                  <div key={row.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => updateRow(row.id, 'method', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold"
                      >
                        {SELECTABLE_METHODS.map((k) => (
                          <option key={k} value={k} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{METHOD_LABELS[k]}</option>
                        ))}
                      </select>

                      {/* Monto en pantallas grandes (>= sm) */}
                      <div className="hidden sm:block w-36 relative">
                        <input
                          type="number" min="0" step="0.01"
                          placeholder={isVes ? 'Monto Bs.' : 'Monto USD'}
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold"
                        />
                      </div>

                      {/* Referencia en pantallas grandes (>= sm) */}
                      <input
                        type="text" placeholder="Referencia (opcional)"
                        value={row.reference}
                        onChange={(e) => updateRow(row.id, 'reference', e.target.value)}
                        className="hidden sm:block flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                      />

                      <button onClick={() => removeRow(row.id)} disabled={!isCredit && payments.length === 1}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 disabled:opacity-30 transition cursor-pointer flex-shrink-0"
                        title="Eliminar método"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Fila inferior exclusiva para móvil (< sm): Monto y Referencia */}
                    <div className="flex sm:hidden items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="number" min="0" step="0.01"
                          placeholder={isVes ? 'Monto en Bs.' : 'Monto en USD'}
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text" placeholder="Nro. Referencia"
                          value={row.reference}
                          onChange={(e) => updateRow(row.id, 'reference', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        />
                      </div>
                    </div>

                    {/* IGTF per-row indicator */}
                    {isIgtfAgent && isUsd && rowAmount > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold pl-1">
                        + IGTF 3%: <span className="font-extrabold">${rowIgtf.toFixed(2)} USD</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={addPaymentRow}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              <Plus className="w-3.5 h-3.5" />
              {isCredit ? 'Agregar abono inicial' : 'Agregar método de pago'}
            </button>
          </div>

          {/* SECTION 3: Balance */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-2 font-medium">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Subtotal (productos):</span>
              <span className="font-extrabold text-slate-900 dark:text-white">${totalUsd.toFixed(2)} USD</span>
            </div>

            {/* IGTF line — solo si es agente y hay monto */}
            {isIgtfAgent && igtfTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">IGTF (3% divisas):</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400">+${igtfTotal.toFixed(2)} USD</span>
              </div>
            )}

            {/* Grand total */}
            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">Total a cobrar:</span>
              <div className="text-right">
                <p className="font-extrabold text-slate-900 dark:text-white">${grandTotalUsd.toFixed(2)} USD</p>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Bs. {grandTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Payment status */}
            {!isCredit ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Total cubierto:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${paidUsd.toFixed(2)} USD</span>
                </div>
                <div className={`flex justify-between text-sm font-extrabold border-t border-slate-200 dark:border-slate-700 pt-2 ${Math.abs(remainingUsd) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  <span>Restante por cobrar:</span>
                  <span>{Math.abs(remainingUsd) < 0.01 ? '✓ Cubierto' : `$${remainingUsd.toFixed(2)} USD`}</span>
                </div>
              </>
            ) : (
              <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2">
                {paidUsd > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Abono inicial recibido hoy:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${paidUsd.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700 dark:text-amber-400 font-bold">Monto financiado a crédito ({creditDays} días):</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">${creditAmountUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Crédito restante tras la venta:</span>
                  <span className={`font-bold ${availableCredit >= creditAmountUsd ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    ${(availableCredit - creditAmountUsd).toFixed(2)} USD
                  </span>
                </div>
                {exceedsLimit && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                    ⚠️ El monto a crédito (${creditAmountUsd.toFixed(2)}) excede el límite disponible del cliente (${availableCredit.toFixed(2)}).
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-4 py-2.5 font-medium">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!canConfirm || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.98]">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Registrando…</>
              ) : isCredit ? (
                paidUsd > 0
                  ? `Confirmar: Abono $${paidUsd.toFixed(2)} + Crédito $${creditAmountUsd.toFixed(2)}`
                  : `Confirmar Venta a Crédito ($${creditAmountUsd.toFixed(2)})`
              ) : (
                `Confirmar — $${grandTotalUsd.toFixed(2)}`
              )}
            </button>
          </div>
        </div>
      </div>

      {showNewCustomerModal && tenant && (
        <CustomerModal
          tenantId={tenant.id}
          onClose={() => setShowNewCustomerModal(false)}
          onSaved={(newCust) => {
            setSelectedCustomer(newCust)
            setCustomerSearch(newCust.full_name)
            setCustomerResults([])
          }}
        />
      )}
    </div>
  )
}
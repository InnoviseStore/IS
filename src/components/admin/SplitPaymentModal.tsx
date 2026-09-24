'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { CartItem, Customer, PaymentMethodType, CreditPlanFrequency, InstallmentsPlan, InstallmentScheduleItem } from '@/types/database'
import { 
  X, Plus, Trash2, Loader2, CheckCircle, Info, UserPlus, MessageCircle, Lock, 
  FileDown, Printer, Pencil, ShoppingCart, Calendar, Clock, CalendarDays, Calculator,
  Truck, MapPin
} from 'lucide-react'
import { CustomerModal } from '@/components/admin/CustomerModal'
import { CreditCollectionModal, type InitialCreditSaleInfo } from '@/components/admin/CreditCollectionModal'
import { WhatsAppInvoiceModal } from '@/components/admin/WhatsAppInvoiceModal'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { getTenantFeatures } from '@/lib/planLimits'
import { generateOrderPdf } from '@/lib/pdfGenerator'
import { PdfLoadingModal } from '@/components/common/PdfLoadingModal'
import { type DeliveryInfo, formatDeliveryTag, extractDeliveryInfo } from '@/lib/delivery'

interface PaymentRow {
  id: string
  method: PaymentMethodType
  amountUsd: string
  amountVes: string
  reference: string
  lastEdited?: 'usd' | 'ves'
}

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  binance_pay: '🟡 Binance Pay (USDT / USD)',
  zelle: '🏦 Zelle (USD)',
  pago_movil: '📱 Pago Móvil (VES)',
  cash_usd: '💵 Efectivo USD',
  cash_ves: '💴 Efectivo VES',
  transfer_ves: '🏛️ Transferencia (VES)',
  debit_ves: '💳 Punto / Débito (VES)',
  credit_7d: '⏳ Crédito',
}

const SELECTABLE_METHODS: PaymentMethodType[] = ['binance_pay', 'zelle', 'pago_movil', 'cash_usd', 'cash_ves', 'transfer_ves', 'debit_ves']

// Métodos que se ingresan en VES
const VES_METHODS: PaymentMethodType[] = ['pago_movil', 'cash_ves', 'transfer_ves', 'debit_ves']
// Métodos que generan IGTF (divisas tradicionales en efectivo o Zelle; Binance Pay en crypto)
const USD_METHODS: PaymentMethodType[] = ['zelle', 'cash_usd', 'binance_pay']

const IGTF_RATE = 0.03 // 3% — Impuesto a las Grandes Transacciones Financieras

interface Props {
  cartItems: CartItem[]
  totalUsd: number
  rawSubtotalUsd?: number
  discountAmountUsd?: number
  exchangeRate: number
  existingOrderId?: string | null
  initialCustomer?: Customer | null
  isEditMode?: boolean
  adminPin?: string
  initialPayments?: any[]
  initialCreditDays?: number
  initialCreditAmount?: number
  initialDeliveryInfo?: DeliveryInfo | null
  onClose: () => void
  onSuccess: () => void
}

export function SplitPaymentModal({
  cartItems,
  totalUsd,
  rawSubtotalUsd,
  discountAmountUsd = 0,
  exchangeRate,
  existingOrderId,
  initialCustomer,
  isEditMode,
  adminPin,
  initialPayments,
  initialCreditDays,
  initialCreditAmount,
  initialDeliveryInfo,
  onClose,
  onSuccess,
}: Props) {
  const { tenant, profile, bcvRatesHistory } = useTenant()

  // Control de fecha de operación y tasa BCV (permite ventas de ayer o tasas históricas)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [])

  const yesterdayRateEntry = useMemo(() => {
    return bcvRatesHistory?.find((h) => h.date === yesterdayStr)
  }, [bcvRatesHistory, yesterdayStr])

  const [operationDate, setOperationDate] = useState<string>(todayStr)
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
      setOperationDate(todayStr)
      setAppliedRate(exchangeRate)
      setCustomRateInput(String(exchangeRate))
      setShowRateSettings(false)
    } else if (mode === 'yesterday') {
      setOperationDate(yesterdayStr)
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

  const handleOperationDateChange = (newDate: string) => {
    setOperationDate(newDate)
    const found = bcvRatesHistory?.find((h) => h.date === newDate)
    if (found && found.rate > 0) {
      setAppliedRate(found.rate)
      setCustomRateInput(String(found.rate))
    }
  }

  const [customerType, setCustomerType] = useState<'final' | 'registered'>('final')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Si se pasa un cliente inicial desde el pedido web o modo edición
  useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomer(initialCustomer)
      setCustomerType('registered')
    }
  }, [initialCustomer])
  const [isCredit, setIsCredit] = useState(false)
  const [creditDays, setCreditDays] = useState<number>(initialCreditDays || 7)

  // Modalidades de crédito: 'single_due' (vencimiento único) vs 'installments' (plan de cobro en cuotas)
  const [creditPlanMode, setCreditPlanMode] = useState<'single_due' | 'installments'>('single_due')
  const [installmentFrequency, setInstallmentFrequency] = useState<CreditPlanFrequency>('quincenal')
  const [customFrequencyDays, setCustomFrequencyDays] = useState<number>(15)
  const [installmentsCount, setInstallmentsCount] = useState<number>(2)

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [registeredSaleData, setRegisteredSaleData] = useState<InitialCreditSaleInfo | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([
    { id: '1', method: 'pago_movil', amountUsd: '', amountVes: '', reference: '', lastEdited: 'usd' }
  ])

  // Precargar pagos previos y estado de crédito si viene en modo edición
  useEffect(() => {
    if (initialCreditDays) {
      setCreditDays(initialCreditDays)
    }
    if (initialPayments && Array.isArray(initialPayments) && initialPayments.length > 0) {
      const hasCredit = initialPayments.some((p: any) => p.method === 'credit_7d')
      if (hasCredit) {
        setIsCredit(true)
      }
      const realRows: PaymentRow[] = initialPayments
        .filter((p: any) => p.method !== 'credit_7d')
        .map((p: any, idx: number) => {
          const hasUsd = p.amount_usd !== undefined && p.amount_usd !== null && p.amount_usd !== ''
          const hasVes = p.amount_ves !== undefined && p.amount_ves !== null && p.amount_ves !== ''
          const usdVal = hasUsd
            ? String(p.amount_usd)
            : hasVes && exchangeRate > 0 ? (Number(p.amount_ves) / exchangeRate).toFixed(2) : ''
          const vesVal = hasVes
            ? String(p.amount_ves)
            : hasUsd ? (Number(p.amount_usd) * exchangeRate).toFixed(2) : ''

          return {
            id: String(idx + 1),
            method: p.method,
            amountUsd: usdVal,
            amountVes: vesVal,
            reference: p.reference || '',
            lastEdited: hasVes && !hasUsd ? 'ves' : 'usd',
          }
        })
      if (realRows.length > 0) {
        setPayments(realRows)
      }
    }
  }, [initialPayments, initialCreditDays, exchangeRate])

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [showInvoiceWhatsAppModal, setShowInvoiceWhatsAppModal] = useState(false)

  // Estado de Servicio de Delivery
  const [hasDelivery, setHasDelivery] = useState<boolean>(Boolean(initialDeliveryInfo?.hasDelivery))
  const [deliveryAmountUsdInput, setDeliveryAmountUsdInput] = useState<string>(
    initialDeliveryInfo?.amountUsd ? String(initialDeliveryInfo.amountUsd) : ''
  )
  const [deliveryAmountVesInput, setDeliveryAmountVesInput] = useState<string>(
    initialDeliveryInfo?.amountVes ? String(initialDeliveryInfo.amountVes) : ''
  )
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    initialDeliveryInfo?.address || initialCustomer?.address || ''
  )

  // Sincronizar dirección de entrega si el cliente seleccionado tiene dirección registrada
  useEffect(() => {
    if (selectedCustomer?.address && !deliveryAddress) {
      setDeliveryAddress(selectedCustomer.address)
    }
  }, [selectedCustomer])

  const handleDeliveryUsdChange = (val: string) => {
    setDeliveryAmountUsdInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      setDeliveryAmountVesInput((num * appliedRate).toFixed(2))
    } else {
      setDeliveryAmountVesInput('')
    }
  }

  const handleDeliveryVesChange = (val: string) => {
    setDeliveryAmountVesInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0 && appliedRate > 0) {
      setDeliveryAmountUsdInput((num / appliedRate).toFixed(2))
    } else {
      setDeliveryAmountUsdInput('')
    }
  }

  const deliveryUsd = hasDelivery ? (parseFloat(deliveryAmountUsdInput) || 0) : 0
  const deliveryVes = hasDelivery ? (parseFloat(deliveryAmountVesInput) || (deliveryUsd * appliedRate)) : 0

  const features = getTenantFeatures(tenant)

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
    setPayments((p) => [
      ...p,
      {
        id: Date.now().toString(),
        method: 'pago_movil',
        amountUsd: '',
        amountVes: '',
        reference: '',
        lastEdited: 'usd',
      }
    ])
  }

  function removeRow(id: string) {
    setPayments((p) => p.filter((r) => r.id !== id))
  }

  function updateRowField(id: string, field: 'method' | 'reference', value: string) {
    setPayments((p) => p.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  function updateRowAmountUsd(id: string, value: string) {
    setPayments((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const num = parseFloat(value)
        const newVes = !isNaN(num) && num > 0 ? (num * appliedRate).toFixed(2) : ''
        return {
          ...row,
          amountUsd: value,
          amountVes: newVes,
          lastEdited: 'usd',
        }
      })
    )
  }

  function updateRowAmountVes(id: string, value: string) {
    setPayments((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const num = parseFloat(value)
        const newUsd = !isNaN(num) && num > 0 && appliedRate > 0 ? (num / appliedRate).toFixed(2) : ''
        return {
          ...row,
          amountVes: value,
          amountUsd: newUsd,
          lastEdited: 'ves',
        }
      })
    )
  }

  function fillRemainingForPayment(id: string) {
    const otherRowsPaidUsd = payments.reduce((sum, r) => {
      if (r.id === id) return sum
      const u = parseFloat(r.amountUsd) || (parseFloat(r.amountVes) || 0) / appliedRate
      return sum + (u > 0 ? u : 0)
    }, 0)
    const neededUsd = Math.max(0, grandTotalUsd - otherRowsPaidUsd)
    const neededVes = neededUsd * appliedRate

    setPayments((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return {
          ...r,
          amountUsd: neededUsd > 0 ? neededUsd.toFixed(2) : '',
          amountVes: neededVes > 0 ? neededVes.toFixed(2) : '',
          lastEdited: 'usd',
        }
      })
    )
  }

  // Sincronizar montos calculados si cambia la tasa aplicada (tasa de hoy, ayer o personalizada)
  useEffect(() => {
    if (!appliedRate || appliedRate <= 0) return
    setPayments((prev) =>
      prev.map((row) => {
        if (row.lastEdited === 'ves' && row.amountVes) {
          const numVes = parseFloat(row.amountVes)
          if (!isNaN(numVes) && numVes > 0) {
            return {
              ...row,
              amountUsd: (numVes / appliedRate).toFixed(2),
            }
          }
        } else if (row.amountUsd) {
          const numUsd = parseFloat(row.amountUsd)
          if (!isNaN(numUsd) && numUsd > 0) {
            return {
              ...row,
              amountVes: (numUsd * appliedRate).toFixed(2),
            }
          }
        }
        return row
      })
    )
  }, [appliedRate])

  // ─── Calculate totals ──────────────────────────────────────────────────────
  // 1. Amount paid in USD equivalent (all methods normalized)
  const paidUsd = payments.reduce((sum, row) => {
    const usd = parseFloat(row.amountUsd) || (parseFloat(row.amountVes) || 0) / appliedRate
    return sum + (usd > 0 ? usd : 0)
  }, 0)

  // 2. IGTF: 3% on USD method payments when the tenant is IGTF agent
  const igtfTotal = isIgtfAgent
    ? payments.reduce((sum, row) => {
        const usd = parseFloat(row.amountUsd) || (parseFloat(row.amountVes) || 0) / appliedRate
        const isUsd = USD_METHODS.includes(row.method)
        return sum + (isUsd && usd > 0 ? usd * IGTF_RATE : 0)
      }, 0)
    : 0

  // 3. Grand total = subtotal + IGTF + deliveryUsd
  const grandTotalUsd = totalUsd + igtfTotal + deliveryUsd
  const grandTotalVes = grandTotalUsd * appliedRate
  const remainingUsd = grandTotalUsd - paidUsd

  const creditAmountUsd = isCredit ? Math.max(0, parseFloat((grandTotalUsd - paidUsd).toFixed(4))) : 0

  const maxInstallments = useMemo(() => {
    if (installmentFrequency === 'semanal') return 20
    if (installmentFrequency === 'quincenal') return 15
    if (installmentFrequency === 'mensual') return 6
    return 20
  }, [installmentFrequency])

  const effectiveFrequencyDays = useMemo(() => {
    if (installmentFrequency === 'semanal') return 7
    if (installmentFrequency === 'quincenal') return 15
    if (installmentFrequency === 'mensual') return 30
    return 7
  }, [installmentFrequency])

  const installmentsSchedule = useMemo(() => {
    if (creditPlanMode !== 'installments' || creditAmountUsd <= 0) return []
    const count = Math.max(1, Math.min(maxInstallments, installmentsCount || 2))
    const baseUsd = Math.floor((creditAmountUsd / count) * 100) / 100
    const items: InstallmentScheduleItem[] = []
    let acc = 0
    const now = Date.now()

    for (let i = 1; i <= count; i++) {
      const isLast = i === count
      const instUsd = isLast ? parseFloat((creditAmountUsd - acc).toFixed(2)) : baseUsd
      acc += instUsd
      const instVes = parseFloat((instUsd * appliedRate).toFixed(2))
      const dueTime = now + (i * effectiveFrequencyDays * 24 * 60 * 60 * 1000)
      const dueDateStr = new Date(dueTime).toISOString().split('T')[0]
      items.push({
        installment_number: i,
        due_date: dueDateStr,
        amount_usd: instUsd,
        amount_ves: instVes,
        status: 'pending'
      })
    }
    return items
  }, [creditPlanMode, creditAmountUsd, installmentsCount, maxInstallments, effectiveFrequencyDays, appliedRate])

  const dueDateObj = useMemo(() => {
    if (creditPlanMode === 'installments' && installmentsSchedule.length > 0) {
      return new Date(`${installmentsSchedule[0].due_date}T23:59:59`)
    }
    return new Date(Date.now() + (creditDays || 7) * 24 * 60 * 60 * 1000)
  }, [creditPlanMode, installmentsSchedule, creditDays])

  const dueDate = formatDate(dueDateObj)

  const currentInstallmentsPlan = useMemo<InstallmentsPlan | undefined>(() => {
    if (!isCredit || creditPlanMode !== 'installments' || installmentsSchedule.length === 0) return undefined
    return {
      mode: 'installments',
      frequency: installmentFrequency,
      frequency_days: effectiveFrequencyDays,
      total_installments: installmentsSchedule.length,
      down_payment_usd: paidUsd > 0 ? parseFloat(paidUsd.toFixed(2)) : 0,
      financed_amount_usd: parseFloat(creditAmountUsd.toFixed(2)),
      installment_amount_usd: installmentsSchedule[0]?.amount_usd || 0,
      schedule: installmentsSchedule,
    }
  }, [isCredit, creditPlanMode, installmentsSchedule, installmentFrequency, effectiveFrequencyDays, paidUsd, creditAmountUsd])

  // En modo edición de la misma factura, la deuda previa a crédito de ESTA factura
  // se deduce porque el backend la revierte automáticamente antes de aplicar la nueva.
  const previousCredit = useMemo(() => {
    if (!isEditMode) return 0
    if (initialCreditAmount !== undefined && initialCreditAmount > 0) {
      return initialCreditAmount
    }
    if (Array.isArray(initialPayments)) {
      const cr = initialPayments.find((p: any) => p.method === 'credit_7d')
      if (cr) return Number(cr.amount_usd) || 0
    }
    return 0
  }, [isEditMode, initialCreditAmount, initialPayments])

  const effectiveCurrentDebt = selectedCustomer
    ? Math.max(0, Number(selectedCustomer.current_debt_usd) - previousCredit)
    : 0

  const availableCredit = selectedCustomer
    ? Math.max(0, Number(selectedCustomer.credit_limit_usd) - effectiveCurrentDebt)
    : 0

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

    const validPayments = payments.filter((row) => (parseFloat(row.amountUsd) || 0) > 0 || (parseFloat(row.amountVes) || 0) > 0)
    const paymentBreakdown: any[] = validPayments.map((row) => {
      const usdVal = parseFloat(row.amountUsd) || (parseFloat(row.amountVes) || 0) / appliedRate
      const vesVal = parseFloat(row.amountVes) || usdVal * appliedRate
      const isUsd = USD_METHODS.includes(row.method)
      const rowIgtf = isIgtfAgent && isUsd ? parseFloat((usdVal * IGTF_RATE).toFixed(4)) : 0
      return {
        method: row.method,
        amount_usd: parseFloat(usdVal.toFixed(4)),
        amount_ves: parseFloat(vesVal.toFixed(2)),
        reference: row.reference || undefined,
        igtf_amount: rowIgtf || undefined,
      }
    })

    const installmentsPlanData = currentInstallmentsPlan

    if (isCredit && creditAmountUsd > 0) {
      paymentBreakdown.push({
        method: 'credit_7d' as const,
        amount_usd: parseFloat(creditAmountUsd.toFixed(4)),
        amount_ves: parseFloat((creditAmountUsd * appliedRate).toFixed(2)),
        reference: creditPlanMode === 'installments'
          ? `Plan de ${installmentsSchedule.length} cuotas (${installmentFrequency}, cada ${effectiveFrequencyDays}d)`
          : `Crédito a ${creditDays} días (Vence: ${dueDate})`,
        igtf_amount: undefined,
        installments_plan: installmentsPlanData,
      })
    }

    try {
      const deliveryTag = formatDeliveryTag({
        hasDelivery,
        amountUsd: deliveryUsd,
        amountVes: deliveryVes,
        address: deliveryAddress.trim(),
      })

        const baseNotes = (operationDate !== todayStr || Math.abs(appliedRate - exchangeRate) > 0.001)
          ? `[Venta registrada con fecha ${operationDate} | Tasa BCV: Bs. ${appliedRate.toFixed(2)}]`
          : ''
        const deliveryCleanText = (hasDelivery && (deliveryUsd > 0 || deliveryAddress.trim()))
          ? `🛵 Delivery: $${deliveryUsd.toFixed(2)} USD (Bs. ${deliveryVes.toFixed(2)})${deliveryAddress.trim() ? ` | Dir: ${deliveryAddress.trim()}` : ''}`
          : ''

        const finalNotes = [baseNotes, deliveryCleanText, deliveryTag].filter(Boolean).join('\n') || undefined

        const payload = {
          tenant_id: tenant.id,
          customer_id: selectedCustomer?.id ?? null,
          status: isCredit ? 'credit' : 'completed',
          payment_condition: isCredit ? 'credit_7d' : 'immediate',
          exchange_rate_at_sale: appliedRate,
          subtotal_usd: rawSubtotalUsd || totalUsd,
          discount_total_usd: discountAmountUsd,
          igtf_total: parseFloat(igtfTotal.toFixed(4)),
          total_usd: parseFloat(grandTotalUsd.toFixed(4)),
          total_ves: parseFloat(grandTotalVes.toFixed(2)),
          payment_breakdown: paymentBreakdown,
          created_by: profile.id,
          credit_amount_usd: isCredit ? creditAmountUsd : 0,
          due_date: isCredit ? dueDateObj.toISOString() : null,
          created_at: operationDate !== todayStr ? new Date(operationDate + 'T12:00:00').toISOString() : undefined,
          sale_date: operationDate !== todayStr ? operationDate : undefined,
          notes: finalNotes,
          delivery_amount_usd: deliveryUsd,
          delivery_amount_ves: deliveryVes,
          delivery_address: deliveryAddress.trim() || undefined,
        items: cartItems.map((item) => {
          const lineOriginal = item.unit_price_usd * item.quantity
          let itemDisc = 0
          if (item.discount_usd !== undefined && item.discount_usd > 0) {
            itemDisc = Math.min(lineOriginal, item.discount_usd)
          } else if (item.discount_percent !== undefined && item.discount_percent > 0) {
            itemDisc = Math.min(lineOriginal, (lineOriginal * item.discount_percent) / 100)
          }
          const netSubtotal = Math.max(0, lineOriginal - itemDisc)
          const netUnitPrice = item.quantity > 0 ? netSubtotal / item.quantity : item.unit_price_usd

          return {
            product_id: item.product_id,
            product_name: item.name,
            product_sku: item.sku ?? null,
            unit_price_usd: netUnitPrice,
            original_unit_price_usd: item.unit_price_usd,
            discount_usd: itemDisc,
            subtotal_usd: netSubtotal,
            quantity: item.quantity,
          }
        }),
        isCredit,
        credit_days: isCredit ? creditDays : undefined,
        existing_order_id: existingOrderId || undefined,
        is_edit: Boolean(isEditMode),
        admin_pin: adminPin || undefined,
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
          discountAmountUsd: discountAmountUsd,
          items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price_usd })),
          payments: validPayments.map((p) => ({
            method: p.method,
            amountUsd: parseFloat(p.amountUsd) || (parseFloat(p.amountVes) || 0) / appliedRate,
          })),
          installmentsPlan: installmentsPlanData,
        })
      }

      setSuccess(orderNumber)
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al guardar la orden')
    }

    setLoading(false)
  }

  async function handleDownloadPdf(action: 'download' | 'print' = 'download') {
    if (!tenant || !success) return
    setGeneratingPdf(true)
    try {
      await generateOrderPdf({
        tenant,
        action,
        order: {
          id: existingOrderId || 'temp-id',
          order_number: success,
          tenant_id: tenant.id,
          customer_id: selectedCustomer?.id || null,
          status: 'completed',
          payment_condition: isCredit ? 'credit_7d' : 'immediate',
          exchange_rate_at_sale: exchangeRate,
          subtotal_usd: totalUsd,
          total_usd: grandTotalUsd,
          total_ves: grandTotalVes,
          notes: (hasDelivery && (deliveryUsd > 0 || deliveryAddress.trim()))
            ? formatDeliveryTag({
                hasDelivery: true,
                amountUsd: deliveryUsd,
                amountVes: deliveryVes,
                address: deliveryAddress.trim(),
              })
            : null,
          payment_breakdown: payments.map((p) => {
            const usdVal = parseFloat(p.amountUsd) || (parseFloat(p.amountVes) || 0) / appliedRate
            const vesVal = parseFloat(p.amountVes) || usdVal * appliedRate
            return {
              method: p.method,
              amount_usd: parseFloat(usdVal.toFixed(2)),
              amount_ves: parseFloat(vesVal.toFixed(2)),
              reference: p.reference,
            }
          }),
          created_at: new Date().toISOString(),
          customer: selectedCustomer
            ? {
                ...selectedCustomer,
                address: deliveryAddress.trim() || selectedCustomer.address,
              }
            : (deliveryAddress.trim() ? { full_name: 'Consumidor Final', address: deliveryAddress.trim() } : null),
          order_items: cartItems.map((i) => {
            const lineOriginal = i.unit_price_usd * i.quantity
            let itemDisc = 0
            if (i.discount_usd !== undefined && i.discount_usd > 0) {
              itemDisc = Math.min(lineOriginal, i.discount_usd)
            } else if (i.discount_percent !== undefined && i.discount_percent > 0) {
              itemDisc = Math.min(lineOriginal, (lineOriginal * i.discount_percent) / 100)
            }
            const netSubtotal = Math.max(0, lineOriginal - itemDisc)
            const netUnitPrice = i.quantity > 0 ? netSubtotal / i.quantity : i.unit_price_usd

            return {
              product_name: itemDisc > 0 ? `${i.name} (Desc: -$${itemDisc.toFixed(2)})` : i.name,
              product_sku: i.sku || null,
              quantity: i.quantity,
              unit_price_usd: netUnitPrice,
              subtotal_usd: netSubtotal,
            }
          }),
        } as any,
      })
    } catch (e) {
      console.error('Error generating PDF:', e)
    } finally {
      setGeneratingPdf(false)
    }
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
            {isEditMode
              ? '¡Factura Actualizada con Éxito!'
              : (isCredit ? '¡Venta a Crédito Registrada!' : '¡Venta Registrada!')}
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

          {/* Botones de Factura PDF e Impresión */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleDownloadPdf('download')}
              disabled={generatingPdf}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              title="Descargar Factura en formato PDF"
            >
              {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              <span>Factura PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf('print')}
              disabled={generatingPdf}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              title="Imprimir Factura / Ticket"
            >
              <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Imprimir</span>
            </button>
          </div>

          {/* Botón Universal para Enviar Factura por WhatsApp (Contado o Crédito) */}
          <button
            type="button"
            onClick={() => setShowInvoiceWhatsAppModal(true)}
            className="w-full mb-2.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            title="Enviar comprobante de venta al WhatsApp del cliente"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar Factura por WhatsApp</span>
          </button>

          {isCredit && selectedCustomer && (
            <button
              type="button"
              onClick={() => setShowCollectionModal(true)}
              className="w-full mb-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Recordatorio de Cobro a Crédito</span>
            </button>
          )}

          <button onClick={onSuccess} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer">
            {isEditMode ? 'Listo, Volver a Facturas' : 'Nueva Venta'}
          </button>
        </div>

        {/* Modal de Envío de Factura por WhatsApp con soporte para PC y Web */}
        {showInvoiceWhatsAppModal && (
          <WhatsAppInvoiceModal
            isOpen={showInvoiceWhatsAppModal}
            onClose={() => setShowInvoiceWhatsAppModal(false)}
            orderNumber={success}
            tenantName={tenant?.name || 'Innovise Store'}
            exchangeRate={exchangeRate}
            customerName={selectedCustomer?.full_name || 'Consumidor Final'}
            customerPhone={selectedCustomer?.phone || null}
            customerIdNumber={selectedCustomer?.id_number || null}
            items={cartItems.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unitPriceUsd: i.unit_price_usd,
              subtotalUsd: i.quantity * i.unit_price_usd,
            }))}
            totalUsd={grandTotalUsd}
            totalVes={grandTotalVes}
            igtfUsd={igtfTotal}
            discountUsd={discountAmountUsd}
            deliveryAmountUsd={deliveryUsd}
            deliveryAmountVes={deliveryVes}
            deliveryAddress={deliveryAddress.trim()}
            isCredit={isCredit}
            creditDueDate={dueDate}
            creditRemainingUsd={isCredit ? creditAmountUsd : 0}
            installmentsPlan={currentInstallmentsPlan}
            payments={payments
              .filter((p) => (parseFloat(p.amountUsd) || 0) > 0 || (parseFloat(p.amountVes) || 0) > 0)
              .map((p) => {
                const usdVal = parseFloat(p.amountUsd) || (parseFloat(p.amountVes) || 0) / appliedRate
                return {
                  method: p.method,
                  amountUsd: usdVal,
                  reference: p.reference,
                }
              })}
          />
        )}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER FIJO */}
        <div className="flex-shrink-0 px-5 sm:px-7 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isEditMode
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80'
            }`}>
              {isEditMode ? <Pencil className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isEditMode ? 'Modificar Factura Emitida' : 'Cobrar Venta'}
                </h2>
                {isEditMode && (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Modo Edición
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditMode
                  ? 'Reajusta productos, clientes y pagos con autorización administrativa'
                  : 'Desglose multimoneda, pagos divididos y financiamiento a crédito'
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY SCROLLABLE CON 2 COLUMNAS EN DESKTOP */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA (7 cols): Cliente y Métodos de Pago */}
            <div className="lg:col-span-7 space-y-6">
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
              selectedCustomer ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs animate-in fade-in duration-150">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">
                        {selectedCustomer.full_name}
                      </strong>
                      {selectedCustomer.id_number && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                          {selectedCustomer.id_number}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] truncate">
                      {selectedCustomer.phone ? `📱 ${selectedCustomer.phone}` : 'Sin teléfono'}
                      {selectedCustomer.address ? ` · 📍 ${selectedCustomer.address}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCustomerToEdit(selectedCustomer)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 px-2.5 py-1 rounded-lg bg-amber-100/70 hover:bg-amber-100 dark:bg-amber-950/70 dark:hover:bg-amber-900/60 transition cursor-pointer border border-amber-300/80 dark:border-amber-800 shadow-2xs"
                      title="Editar información del cliente (nombre, cédula, teléfono, dirección, límite de crédito)"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setCustomerSearch('')
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
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
              )
            )}

            {/* OPCIÓN GENERAL DE VENTA A CRÉDITO */}
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="credit"
                    disabled={!features.hasCreditSales}
                    checked={features.hasCreditSales && isCredit}
                    onChange={(e) => {
                      if (!features.hasCreditSales) return
                      const checked = e.target.checked
                      setIsCredit(checked)
                      if (checked && customerType === 'final') {
                        setCustomerType('registered')
                      }
                    }}
                    className="w-4 h-4 rounded accent-blue-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <label htmlFor="credit" className="text-sm text-slate-800 dark:text-slate-200 font-bold flex items-center gap-2">
                    <span>Venta a Crédito / Financiamiento</span>
                    {!features.hasCreditSales ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Plan Pro
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Flexible
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {isCredit && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3.5 text-xs space-y-3 font-medium">
                  {/* Selector de Modalidad: Plazo Único vs Plan de Cobro en Cuotas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-700 dark:text-slate-300 font-bold">Modalidad de Crédito:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black text-xs">
                        {creditPlanMode === 'installments' ? `1ª Cuota: ${dueDate}` : `Vence: ${dueDate}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreditPlanMode('single_due')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                          creditPlanMode === 'single_due'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Vencimiento Único</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCreditPlanMode('installments')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                          creditPlanMode === 'installments'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Plan en Cuotas</span>
                      </button>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN MODALIDAD 1: VENCIMIENTO ÚNICO */}
                  {creditPlanMode === 'single_due' && (
                    <div className="pt-2 border-t border-amber-200/70 dark:border-amber-900/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-700 dark:text-slate-300 font-bold">Días de Crédito:</span>
                        <span className="text-[11px] text-slate-500">Pago total al vencimiento</span>
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
                  )}

                  {/* CONFIGURACIÓN MODALIDAD 2: PLAN DE COBRO EN CUOTAS */}
                  {creditPlanMode === 'installments' && (
                    <div className="pt-2 border-t border-amber-200/70 dark:border-amber-900/40 space-y-3">
                      {/* Frecuencia de cobro */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300 font-bold">Frecuencia de Pago:</span>
                          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
                            Cada {effectiveFrequencyDays} días
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { key: 'semanal', label: 'Semanal (7d)' },
                            { key: 'quincenal', label: 'Quincenal (15d)' },
                            { key: 'mensual', label: 'Mensual (30d)' },
                          ].map((f) => (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => {
                                const newFreq = f.key as CreditPlanFrequency
                                setInstallmentFrequency(newFreq)
                                const max = newFreq === 'semanal' ? 20 : newFreq === 'quincenal' ? 15 : 6
                                if (installmentsCount > max) {
                                  setInstallmentsCount(max)
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                                installmentFrequency === f.key
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cantidad de cuotas */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300 font-bold">Número de Cuotas:</span>
                          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
                            {installmentsCount} cuotas (Máx: {maxInstallments} {installmentFrequency === 'semanal' ? 'semanas' : installmentFrequency === 'quincenal' ? 'quincenas' : 'meses'})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(
                            installmentFrequency === 'semanal'
                              ? [2, 4, 8, 12, 16, 20]
                              : installmentFrequency === 'quincenal'
                              ? [2, 4, 6, 10, 15]
                              : [2, 3, 4, 6]
                          ).map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setInstallmentsCount(num)}
                              className={`w-10 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                                installmentsCount === num
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1">
                            <span className="text-[11px] text-slate-500 font-medium">Otras:</span>
                            <input
                              type="number"
                              min="1"
                              max={maxInstallments}
                              value={installmentsCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1
                                setInstallmentsCount(Math.max(1, Math.min(maxInstallments, val)))
                              }}
                              className="w-10 text-center font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none text-xs"
                            />
                            <span className="text-[11px] text-slate-500">cuotas</span>
                          </div>
                        </div>
                      </div>

                      {/* Resumen del plan y saldo financiado */}
                      <div className="bg-white/90 dark:bg-slate-900/90 border border-purple-200 dark:border-purple-900/60 rounded-xl p-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Total Factura:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">${grandTotalUsd.toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Abono Inicial Hoy:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {paidUsd > 0 ? `-$${paidUsd.toFixed(2)} USD` : '$0.00 (Sin inicial)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-purple-100 dark:border-purple-900/50 font-bold">
                          <span className="text-purple-700 dark:text-purple-300">Saldo a Financiar:</span>
                          <span className="text-purple-700 dark:text-purple-300">${creditAmountUsd.toFixed(2)} USD</span>
                        </div>
                      </div>

                      {/* Cronograma de Cuotas Preview */}
                      {installmentsSchedule.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5 text-slate-700 dark:text-slate-300 font-bold">
                            <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                            <span>Cronograma de Cuotas ({installmentsSchedule.length}):</span>
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                            {installmentsSchedule.map((inst) => (
                              <div
                                key={inst.installment_number}
                                className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[11px]"
                              >
                                <span className="font-bold text-purple-700 dark:text-purple-400">
                                  Cuota #{inst.installment_number}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-mono">
                                  {formatDate(inst.due_date)}
                                </span>
                                <div className="text-right">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    ${inst.amount_usd.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Bs. {inst.amount_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 flex items-center gap-1">
                            <span>⚡</span>
                            <span>Sincronizado con cobranza y recordatorios automáticos de WhatsApp en cada fecha.</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                        <span className="text-slate-600 dark:text-slate-400">Deuda actual registrada:</span>
                        <div className="text-right">
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            ${Number(selectedCustomer.current_debt_usd).toFixed(2)}
                          </span>
                          {isEditMode && previousCredit > 0 && (
                            <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              (Incluye ${previousCredit.toFixed(2)} de esta nota que se reajustarán)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          {isEditMode && previousCredit > 0 ? 'Disponible para esta factura:' : 'Disponible:'}
                        </span>
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

          {/* SECTION 1.5: Servicio de Delivery (Opcional) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasDelivery}
                  onChange={(e) => {
                    setHasDelivery(e.target.checked)
                    if (e.target.checked && selectedCustomer?.address && !deliveryAddress) {
                      setDeliveryAddress(selectedCustomer.address)
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Servicio de Delivery / Flete</span>
                </span>
              </label>
              {hasDelivery && (
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Activo
                </span>
              )}
            </div>

            {hasDelivery && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Costo en Dólares ($ USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={deliveryAmountUsdInput}
                        onChange={(e) => handleDeliveryUsdChange(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Costo en Bolívares (Bs. BCV)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={deliveryAmountVesInput}
                        onChange={(e) => handleDeliveryVesChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Dirección de Entrega
                    </label>
                    {selectedCustomer?.address && selectedCustomer.address !== deliveryAddress && (
                      <button
                        type="button"
                        onClick={() => setDeliveryAddress(selectedCustomer.address || '')}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Usar dirección del cliente
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Calle, carrera, punto de referencia o sector..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2 text-[11px] text-blue-800 dark:text-blue-300">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Este monto se incluye en la factura para el cliente y repartidor, pero <strong>no computa como depósito ni ingreso de la tienda</strong> en caja ni finanzas.
                  </span>
                </div>
              </div>
            )}
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

            <div className="space-y-3">
              {payments.map((row) => {
                const usdVal = parseFloat(row.amountUsd) || (parseFloat(row.amountVes) || 0) / appliedRate
                const isUsd = USD_METHODS.includes(row.method)
                const rowIgtf = isIgtfAgent && isUsd && usdVal > 0 ? usdVal * IGTF_RATE : 0

                // Calcular cuánto saldo queda por cubrir para sugerir "Pagar restante"
                const otherRowsPaidUsd = payments.reduce((sum, r) => {
                  if (r.id === row.id) return sum
                  const u = parseFloat(r.amountUsd) || (parseFloat(r.amountVes) || 0) / appliedRate
                  return sum + (u > 0 ? u : 0)
                }, 0)
                const remainingForThisRow = Math.max(0, grandTotalUsd - otherRowsPaidUsd)
                const canFillRemaining = remainingForThisRow > 0.01 && Math.abs(usdVal - remainingForThisRow) > 0.01

                return (
                  <div
                    key={row.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-3 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700/60 transition"
                  >
                    {/* Fila 1: Selección de Método + Referencia + Eliminar */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <select
                        value={row.method}
                        onChange={(e) => updateRowField(row.id, 'method', e.target.value as PaymentMethodType)}
                        className="flex-1 sm:w-1/2 min-w-[150px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold"
                      >
                        {SELECTABLE_METHODS.map((k) => (
                          <option key={k} value={k} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                            {METHOD_LABELS[k]}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Nro. Referencia (opcional)"
                        value={row.reference}
                        onChange={(e) => updateRowField(row.id, 'reference', e.target.value)}
                        className="flex-1 min-w-[130px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                      />

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={!isCredit && payments.length === 1}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-30 transition cursor-pointer shrink-0"
                        title="Eliminar método"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Fila 2: Montos Sincronizados ($ USD <---> Bs. VES al cambio automático) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      {/* Entrada en Dólares ($ USD) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span>Monto en Dólares ($ USD)</span>
                          </label>
                          {canFillRemaining && (
                            <button
                              type="button"
                              onClick={() => fillRemainingForPayment(row.id)}
                              className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              title="Llenar con el saldo restante a pagar"
                            >
                              Pagar restante (${remainingForThisRow.toFixed(2)})
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00 USD"
                            value={row.amountUsd}
                            onChange={(e) => updateRowAmountUsd(row.id, e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-black tracking-tight"
                          />
                        </div>
                      </div>

                      {/* Entrada en Bolívares (Bs. BCV) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span>Monto en Bolívares (Bs. BCV)</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            Tasa: {appliedRate.toFixed(2)}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
                            Bs.
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00 Bs."
                            value={row.amountVes}
                            onChange={(e) => updateRowAmountVes(row.id, e.target.value)}
                            className="w-full pl-11 pr-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-black tracking-tight"
                          />
                        </div>
                      </div>
                    </div>

                    {/* IGTF indicador por fila */}
                    {isIgtfAgent && isUsd && usdVal > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold pl-1">
                        + IGTF 3%: <span className="font-extrabold">${rowIgtf.toFixed(2)} USD</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {features.hasSplitPayments ? (
              <button
                type="button"
                onClick={addPaymentRow}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isCredit ? 'Agregar abono inicial' : 'Agregar método de pago'}
              </button>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Pagos divididos multimoneda disponible a partir de <strong>Plan Pro</strong>.</span>
              </p>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: RESUMEN DE COBRO, BALANCE Y BOTONES DE CONFIRMACIÓN */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-0">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Resumen de Cobro
              </h3>
              <span className="text-[11px] font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                Tasa: Bs. {appliedRate.toFixed(2)}
              </span>
            </div>

            {/* Selector de Tasa y Fecha de Operación (Ventas de ayer / pagos retroactivos) */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-700/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Fecha & Tasa BCV de Pago:</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {operationDate === todayStr ? 'Hoy' : operationDate === yesterdayStr ? 'Ayer' : operationDate}
                </span>
              </div>

              {/* Selector de 3 pestañas */}
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSelectRateMode('today')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    rateMode === 'today'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={yesterdayRateEntry ? `Tasa de ayer: Bs. ${yesterdayRateEntry.rate}` : 'Pago recibido ayer'}
                >
                  Ayer {yesterdayRateEntry ? `(${yesterdayRateEntry.rate.toFixed(1)})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectRateMode('custom')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    rateMode === 'custom'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Otra Fecha
                </button>
              </div>

              {/* Formulario desplegable si es Ayer o Fecha Personalizada */}
              {(rateMode === 'custom' || rateMode === 'yesterday' || showRateSettings) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fecha en que transfirió el cliente:
                    </label>
                    <input
                      type="date"
                      max={todayStr}
                      value={operationDate}
                      onChange={(e) => handleOperationDateChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tasa BCV del día de la transferencia:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={customRateInput}
                        onChange={(e) => handleCustomRateChange(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {operationDate !== todayStr && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      ℹ️ Registrando con fecha <strong className="font-bold">{operationDate}</strong> a tasa <strong className="font-bold">Bs. {appliedRate.toFixed(2)}</strong>.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Subtotal base:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">${(rawSubtotalUsd || totalUsd).toFixed(2)} USD</span>
            </div>

            {/* Descuento si aplica */}
            {discountAmountUsd > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1">
                  <span>🎉 Descuento aplicado:</span>
                </span>
                <span>-${discountAmountUsd.toFixed(2)} USD</span>
              </div>
            )}

            {/* Subtotal neto después de descuento */}
            {discountAmountUsd > 0 && (
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Subtotal con descuento:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">${totalUsd.toFixed(2)} USD</span>
              </div>
            )}

            {/* IGTF line — solo si es agente y hay monto */}
            {isIgtfAgent && igtfTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">IGTF (3% divisas):</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400">+${igtfTotal.toFixed(2)} USD</span>
              </div>
            )}

            {/* Servicio de Delivery si aplica */}
            {hasDelivery && deliveryUsd > 0 && (
              <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Servicio de Delivery:</span>
                </span>
                <span>+${deliveryUsd.toFixed(2)} USD</span>
              </div>
            )}

            {/* Grand total */}
            <div className="flex justify-between items-baseline text-sm border-t border-slate-200 dark:border-slate-700 pt-2.5">
              <span className="font-extrabold text-slate-800 dark:text-slate-200">Total a cobrar:</span>
              <div className="text-right">
                <p className="text-xl font-black text-slate-900 dark:text-white">${grandTotalUsd.toFixed(2)} USD</p>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  Bs. {grandTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Payment status / Balance */}
            {!isCredit ? (
              <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Total cubierto:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${paidUsd.toFixed(2)} USD</span>
                </div>
                <div className={`flex justify-between text-sm font-extrabold border-t border-slate-200/60 dark:border-slate-700/60 pt-2 ${Math.abs(remainingUsd) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  <span>Restante por cobrar:</span>
                  <span>{Math.abs(remainingUsd) < 0.01 ? '✓ Cubierto' : `$${remainingUsd.toFixed(2)} USD`}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2.5">
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
                  <span>Disponible tras venta:</span>
                  <span className={`font-bold ${availableCredit >= creditAmountUsd ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    ${(availableCredit - creditAmountUsd).toFixed(2)} USD
                  </span>
                </div>
                {exceedsLimit && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    ⚠️ El monto a crédito (${creditAmountUsd.toFixed(2)}) excede el límite disponible del cliente (${availableCredit.toFixed(2)}).
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-2.5 font-medium">
                {error}
              </p>
            )}

            {/* Botones de Acción */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-col gap-2">
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
                ) : isCredit ? (
                  paidUsd > 0
                    ? `Confirmar: Abono $${paidUsd.toFixed(2)} + Crédito $${creditAmountUsd.toFixed(2)}`
                    : `Confirmar Venta a Crédito ($${creditAmountUsd.toFixed(2)})`
                ) : (
                  `Confirmar Cobro — $${grandTotalUsd.toFixed(2)}`
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

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

      {customerToEdit && tenant && (
        <CustomerModal
          tenantId={tenant.id}
          customer={customerToEdit}
          onClose={() => setCustomerToEdit(null)}
          onSaved={(savedCust) => {
            setSelectedCustomer(savedCust)
            setCustomerToEdit(null)
          }}
        />
      )}

      {/* Ventana de carga de PDF en facturación */}
      <PdfLoadingModal
        isOpen={generatingPdf}
        title="Generando Factura en PDF"
        message="Construyendo factura fiscal con logotipo, datos del cliente y desglose en USD y Bs. oficiales..."
      />
    </div>
  )
}
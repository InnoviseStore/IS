'use client'

import { useReducer, useState, useEffect, useCallback, useMemo, useDeferredValue, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { SplitPaymentModal } from '@/components/admin/SplitPaymentModal'
import type { Product, CartItem, Customer } from '@/types/database'
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, ArrowRight, Globe, X, Percent, Tag, Pencil, FileText } from 'lucide-react'

// ─── Cart Reducer ─────────────────────────────────────────────────────────────
type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'INC'; id: string }
  | { type: 'DEC'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'SET_CART'; items: CartItem[] }
  | { type: 'SET_DISCOUNT'; id: string; discount_percent?: number; discount_usd?: number }

function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const existing = items.find((i) => i.product_id === action.product.id)
      if (existing) return items.map((i) => i.product_id === action.product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...items, { product_id: action.product.id, name: action.product.name, sku: action.product.sku, unit_price_usd: action.product.base_price_usd, quantity: 1, image_url: action.product.image_url }]
    }
    case 'INC': return items.map((i) => i.product_id === action.id ? { ...i, quantity: i.quantity + 1 } : i)
    case 'DEC': return items.map((i) => i.product_id === action.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)
    case 'REMOVE': return items.filter((i) => i.product_id !== action.id)
    case 'CLEAR': return []
    case 'SET_CART': return action.items
    case 'SET_DISCOUNT': return items.map((i) => {
      if (i.product_id !== action.id) return i
      return {
        ...i,
        discount_percent: action.discount_percent,
        discount_usd: action.discount_usd,
      }
    })
    default: return items
  }
}

interface WebOrderInfo {
  orderId: string
  orderNumber: string
  customerName: string
  customer: Customer | null
  isEditMode?: boolean
  isQuotation?: boolean
  authPin?: string
  paymentBreakdown?: any[]
  dueDate?: string | null
  creditDays?: number
  initialCreditAmount?: number
}

function POSContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromOrderId = searchParams.get('fromOrder')
  const editOrderId = searchParams.get('editOrder')
  const fromQuotationId = searchParams.get('fromQuotation')
  const authPin = searchParams.get('authPin')
  const targetOrderId = editOrderId || fromOrderId
  const isEditMode = Boolean(editOrderId)

  const { tenant, exchangeRate } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [cart, dispatch] = useReducer(cartReducer, [])
  const [showPayment, setShowPayment] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [mobileTab, setMobileTab] = useState<'catalog' | 'ticket'>('catalog')
  const [webOrderInfo, setWebOrderInfo] = useState<WebOrderInfo | null>(null)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoadingProducts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name')
    setProducts(data ?? [])
    setLoadingProducts(false)
  }, [tenant])

  useEffect(() => { load() }, [load])

  // Cargar orden (web o para edición de factura existente)
  useEffect(() => {
    if (!targetOrderId || !tenant) return

    async function loadTargetOrder() {
      try {
        const supabase = createClient()
        const { data: order, error } = await supabase
          .from('orders')
          .select('*, customer:customers(*), order_items(*)')
          .eq('id', targetOrderId)
          .single()

        if (error || !order) {
          console.warn('No se pudo cargar la orden:', error)
          return
        }

        if (Array.isArray(order.order_items) && order.order_items.length > 0) {
          const loadedItems: CartItem[] = order.order_items.map((i: any) => ({
            product_id: i.product_id || i.id,
            name: i.product_name,
            sku: i.product_sku || '',
            unit_price_usd: Number(i.unit_price_usd) || 0,
            quantity: i.quantity || 1,
            image_url: null,
          }))

          dispatch({ type: 'SET_CART', items: loadedItems })
          setMobileTab('ticket')

          let custName = isEditMode ? 'Cliente' : 'Cliente Web'
          let resolvedCustomer = order.customer || null

          // Si la orden no tiene el objeto customer enlazado directamente, buscar coincidencia por CI/RIF o Teléfono en notes
          if (!resolvedCustomer && order.notes) {
            const parts = order.notes.split('|').map((p: string) => p.trim())
            let ciRif = ''
            let phone = ''
            parts.forEach((p: string) => {
              if (p.toLowerCase().startsWith('cliente:')) custName = p.replace(/cliente:/i, '').trim()
              if (p.toLowerCase().startsWith('ci/rif:')) ciRif = p.replace(/ci\/rif:/i, '').trim()
              if (p.toLowerCase().startsWith('whatsapp:')) phone = p.replace(/whatsapp:/i, '').trim()
            })

            if (ciRif || phone) {
              const currentTenantId = order.tenant_id || tenant?.id
              let query = supabase.from('customers').select('*').eq('tenant_id', currentTenantId)
              if (ciRif) {
                query = query.ilike('id_number', ciRif)
              } else if (phone) {
                const cleanPhone = phone.replace(/\D/g, '')
                query = query.or(`phone.eq.${cleanPhone},phone.eq.${phone}`)
              }
              const { data: matchedCust } = await query.limit(1).maybeSingle()
              if (matchedCust) {
                resolvedCustomer = matchedCust
                custName = matchedCust.full_name
              }
            }
          } else if (order.customer?.full_name) {
            custName = order.customer.full_name
          }

          let days = 7
          if (order.due_date && order.created_at) {
            const diffMs = new Date(order.due_date).getTime() - new Date(order.created_at).getTime()
            days = Math.max(1, Math.round(diffMs / 86400000))
          }

          let prevCredit = 0
          if (Array.isArray(order.payment_breakdown)) {
            const cr = order.payment_breakdown.find((p: any) => p.method === 'credit_7d')
            if (cr) prevCredit = Number(cr.amount_usd) || 0
          }
          if (prevCredit === 0 && (order.status === 'credit' || order.payment_condition === 'credit_7d')) {
            const nonCreditPaid = Array.isArray(order.payment_breakdown)
              ? order.payment_breakdown.reduce((s: number, p: any) => p.method !== 'credit_7d' ? s + (Number(p.amount_usd) || 0) : s, 0)
              : 0
            prevCredit = Math.max(0, (Number(order.total_usd) || 0) - nonCreditPaid)
          }

          setWebOrderInfo({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: custName,
            customer: resolvedCustomer,
            isEditMode,
            authPin: authPin || undefined,
            paymentBreakdown: order.payment_breakdown,
            dueDate: order.due_date,
            creditDays: days,
            initialCreditAmount: prevCredit,
          })
        }
      } catch (err) {
        console.error('Error al cargar orden en POS:', err)
      }
    }

    loadTargetOrder()
  }, [targetOrderId, tenant, isEditMode, authPin])

  // Cargar productos de cotización importada
  useEffect(() => {
    if (!fromQuotationId || !tenant) return

    async function loadQuotationIntoPos() {
      try {
        let quoteData: any = null
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem('pos_quote_import')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (parsed.id === fromQuotationId) quoteData = parsed
            } catch {}
          }
        }

        if (!quoteData) {
          const supabase = createClient()
          const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', fromQuotationId)
            .single()
          if (!error && data) quoteData = data
        }

        if (quoteData && Array.isArray(quoteData.items) && quoteData.items.length > 0) {
          const loadedItems: CartItem[] = quoteData.items.map((i: any) => ({
            product_id: i.product_id || crypto.randomUUID(),
            name: i.name,
            sku: i.sku || '',
            unit_price_usd: Number(i.unit_price_usd) || 0,
            quantity: Number(i.quantity) || 1,
            discount_percent: i.discount_percent ? Number(i.discount_percent) : 0,
            discount_usd: i.discount_percent
              ? parseFloat(((Number(i.unit_price_usd) * Number(i.quantity) * Number(i.discount_percent)) / 100).toFixed(2))
              : 0,
            image_url: null,
          }))

          dispatch({ type: 'SET_CART', items: loadedItems })
          setMobileTab('ticket')

          let resolvedCustomer: Customer | null = null
          if (quoteData.customer_id) {
            const supabase = createClient()
            const { data: cust } = await supabase.from('customers').select('*').eq('id', quoteData.customer_id).single()
            if (cust) resolvedCustomer = cust
          }

          setWebOrderInfo({
            orderId: '',
            orderNumber: quoteData.quotation_number || 'Cotización',
            customerName: resolvedCustomer?.full_name || quoteData.customer_name || 'Cliente Cotización',
            customer: resolvedCustomer,
            isQuotation: true,
          })

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pos_quote_import')
          }
        }
      } catch (err) {
        console.error('Error al cargar cotización en POS:', err)
      }
    }

    loadQuotationIntoPos()
  }, [fromQuotationId, tenant])

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    )
  }, [products, deferredSearch])

  // Descuento global sobre el total de la orden
  const [orderDiscountType, setOrderDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0)
  const [showOrderDiscountInput, setShowOrderDiscountInput] = useState(false)
  const [editingItemDiscountId, setEditingItemDiscountId] = useState<string | null>(null)

  const totalQuantity = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])

  // Subtotal base sumando precio original de cada ítem
  const rawSubtotalUsd = useMemo(() => cart.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0), [cart])

  // Descuento acumulado de productos individuales
  const itemsDiscountUsd = useMemo(() => {
    return cart.reduce((s, i) => {
      const lineOriginal = i.unit_price_usd * i.quantity
      let disc = 0
      if (i.discount_usd !== undefined && i.discount_usd > 0) {
        disc = i.discount_usd
      } else if (i.discount_percent !== undefined && i.discount_percent > 0) {
        disc = lineOriginal * (i.discount_percent / 100)
      }
      return s + Math.min(lineOriginal, Math.max(0, disc))
    }, 0)
  }, [cart])

  const subtotalAfterItemsDiscount = Math.max(0, rawSubtotalUsd - itemsDiscountUsd)

  // Descuento global sobre el total
  const orderDiscountUsd = useMemo(() => {
    if (orderDiscountValue <= 0) return 0
    if (orderDiscountType === 'percent') {
      return (subtotalAfterItemsDiscount * Math.min(100, orderDiscountValue)) / 100
    }
    return Math.min(subtotalAfterItemsDiscount, orderDiscountValue)
  }, [subtotalAfterItemsDiscount, orderDiscountType, orderDiscountValue])

  const totalDiscountUsd = itemsDiscountUsd + orderDiscountUsd
  const totalUsd = Math.max(0, subtotalAfterItemsDiscount - orderDiscountUsd)
  const totalVes = useMemo(() => totalUsd * exchangeRate, [totalUsd, exchangeRate])

  return (
    <div className="h-full flex flex-col gap-4 pb-16 md:pb-0">
      {/* Header y Selector de pestañas para móvil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Punto de Venta</h1>
            {webOrderInfo && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Pedido #{webOrderInfo.orderNumber}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
            Facturación rápida de mostrador y pedidos web
          </p>
        </div>

        {/* Selector de pestañas visible solo en teléfonos (<md) */}
        <div className="flex md:hidden bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setMobileTab('catalog')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mobileTab === 'catalog'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Catálogo ({filtered.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('ticket')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mobileTab === 'ticket'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Ticket Actual</span>
            {totalQuantity > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black">
                {totalQuantity}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 min-h-0">
        {/* PANEL IZQUIERDO: Catálogo de Productos */}
        <div className={`md:col-span-7 lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-h-0 ${mobileTab === 'catalog' ? 'flex' : 'hidden md:flex'}`}>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" 
              placeholder="Buscar por nombre o código SKU…"
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12 font-medium">Cargando catálogo…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No se encontraron productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                {filtered.map((p) => {
                  const inCart = cart.find((i) => i.product_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => dispatch({ type: 'ADD', product: p })}
                      className="glass-card p-3 sm:p-4 text-left hover:scale-[1.02] transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.97] flex flex-col justify-between cursor-pointer border border-slate-200/80 dark:border-slate-800/80"
                    >
                      <div>
                        <div className="w-full aspect-square max-h-24 sm:max-h-28 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex items-center justify-center mb-2.5 flex-shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400 stroke-1" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1">
                          {p.name}
                        </p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-black text-blue-600 dark:text-blue-400">${p.base_price_usd.toFixed(2)}</p>
                          <span className="text-[10px] text-slate-400 font-medium">Stock: {p.stock}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                            Bs. {(p.base_price_usd * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                          </span>
                          {inCart && (
                            <span className="font-extrabold text-white bg-blue-600 px-1.5 py-0.5 rounded-md text-[10px]">
                              ×{inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Cart/Ticket */}
        <div className={`md:col-span-5 lg:col-span-5 xl:col-span-4 glass-card flex flex-col p-4 sm:p-5 gap-3.5 min-h-0 border border-slate-200/80 dark:border-slate-800/80 ${mobileTab === 'ticket' ? 'flex' : 'hidden md:flex'}`}>
          {/* Banner de Pedido Web, Modo Edición o Cotización */}
          {webOrderInfo && (
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 flex-shrink-0 animate-in fade-in duration-200 ${
              webOrderInfo.isEditMode
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                : webOrderInfo.isQuotation
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800'
                : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
                  webOrderInfo.isEditMode
                    ? 'bg-amber-600'
                    : webOrderInfo.isQuotation
                    ? 'bg-emerald-600'
                    : 'bg-blue-600'
                }`}>
                  {webOrderInfo.isEditMode ? <Pencil className="w-4 h-4" /> : webOrderInfo.isQuotation ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black truncate ${
                    webOrderInfo.isEditMode
                      ? 'text-amber-800 dark:text-amber-200'
                      : webOrderInfo.isQuotation
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    {webOrderInfo.isEditMode
                      ? `Modo Edición: Factura #${webOrderInfo.orderNumber}`
                      : webOrderInfo.isQuotation
                      ? `Cotización Cargada #${webOrderInfo.orderNumber}`
                      : `Pedido Web #${webOrderInfo.orderNumber}`}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    Cliente: <strong>{webOrderInfo.customerName}</strong>
                    {webOrderInfo.isEditMode && ' • Clave autorizada'}
                    {webOrderInfo.isQuotation && ' • Precios y descuentos aplicados'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWebOrderInfo(null)
                  dispatch({ type: 'CLEAR' })
                  router.replace('/admin/pos')
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                title={webOrderInfo.isEditMode ? "Cancelar edición y volver a ticket limpio" : webOrderInfo.isQuotation ? "Quitar cotización y limpiar ticket" : "Desvincular orden web y empezar ticket limpio"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0">
            <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Ticket de Venta {totalQuantity > 0 && `(${totalQuantity})`}
            </h2>
            {cart.length > 0 && (
              <button 
                onClick={() => {
                  dispatch({ type: 'CLEAR' })
                  if (webOrderInfo) {
                    setWebOrderInfo(null)
                    router.replace('/admin/pos')
                  }
                }} 
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer p-1"
              >
                Vaciar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 py-8">
              <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-600 stroke-1" />
              <p className="text-xs sm:text-sm font-medium">Agrega productos tocando el catálogo</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {cart.map((item) => {
                  const lineOriginal = item.unit_price_usd * item.quantity
                  let itemDisc = 0
                  if (item.discount_usd !== undefined && item.discount_usd > 0) {
                    itemDisc = Math.min(lineOriginal, item.discount_usd)
                  } else if (item.discount_percent !== undefined && item.discount_percent > 0) {
                    itemDisc = Math.min(lineOriginal, (lineOriginal * item.discount_percent) / 100)
                  }
                  const lineFinal = Math.max(0, lineOriginal - itemDisc)
                  const isEditingThisDiscount = editingItemDiscountId === item.product_id

                  return (
                    <div key={item.product_id} className="p-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">${item.unit_price_usd.toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => dispatch({ type: 'DEC', id: item.product_id })} 
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold active:scale-95 cursor-pointer"
                            aria-label="Restar unidad"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold text-slate-900 dark:text-white">{item.quantity}</span>
                          <button 
                            onClick={() => dispatch({ type: 'INC', id: item.product_id })} 
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold active:scale-95 cursor-pointer"
                            aria-label="Sumar unidad"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="w-16 sm:w-20 text-right">
                          {itemDisc > 0 ? (
                            <>
                              <p className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                                ${lineFinal.toFixed(2)}
                              </p>
                              <p className="text-[10px] line-through text-slate-400">
                                ${lineOriginal.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                              ${lineOriginal.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => dispatch({ type: 'REMOVE', id: item.product_id })} 
                          className="text-slate-400 hover:text-rose-500 transition p-1 cursor-pointer"
                          title="Quitar ítem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Fila de descuento por producto */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                        {itemDisc > 0 && !isEditingThisDiscount ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                            <Tag className="w-3 h-3" />
                            <span>
                              {item.discount_percent !== undefined && item.discount_percent > 0
                                ? `${item.discount_percent}% desc.`
                                : `$${(item.discount_usd || 0).toFixed(2)} desc.`} (-${itemDisc.toFixed(2)})
                            </span>
                            <button
                              type="button"
                              onClick={() => dispatch({ type: 'SET_DISCOUNT', id: item.product_id, discount_percent: undefined, discount_usd: undefined })}
                              className="text-slate-400 hover:text-rose-500 ml-1"
                              title="Quitar descuento"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingItemDiscountId(isEditingThisDiscount ? null : item.product_id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-auto"
                        >
                          <Percent className="w-3 h-3" />
                          <span>{itemDisc > 0 ? 'Editar desc.' : '+ Descuento ítem'}</span>
                        </button>
                      </div>

                      {/* Panel de edición de descuento individual */}
                      {isEditingThisDiscount && (
                        <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-2 animate-in fade-in duration-150">
                          <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">Tipo:</span>
                          <div className="flex bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-blue-200 dark:border-blue-800">
                            <button
                              type="button"
                              onClick={() => {
                                const val = item.discount_percent || (item.discount_usd ? Math.round((item.discount_usd / lineOriginal) * 100) : 5)
                                dispatch({ type: 'SET_DISCOUNT', id: item.product_id, discount_percent: val, discount_usd: undefined })
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                item.discount_usd === undefined
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              % Porcentaje
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const val = item.discount_usd || (item.discount_percent ? (lineOriginal * item.discount_percent) / 100 : 1)
                                dispatch({ type: 'SET_DISCOUNT', id: item.product_id, discount_percent: undefined, discount_usd: val })
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                item.discount_usd !== undefined
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              $ Fijo
                            </button>
                          </div>

                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              min="0"
                              max={item.discount_usd !== undefined ? lineOriginal : 100}
                              step={item.discount_usd !== undefined ? '0.5' : '1'}
                              placeholder="0"
                              value={item.discount_usd !== undefined ? (item.discount_usd || '') : (item.discount_percent || '')}
                              onChange={(e) => {
                                const num = Math.max(0, parseFloat(e.target.value) || 0)
                                if (item.discount_usd !== undefined) {
                                  dispatch({ type: 'SET_DISCOUNT', id: item.product_id, discount_usd: Math.min(lineOriginal, num), discount_percent: undefined })
                                } else {
                                  dispatch({ type: 'SET_DISCOUNT', id: item.product_id, discount_percent: Math.min(100, num), discount_usd: undefined })
                                }
                              }}
                              className="w-16 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold text-center outline-none"
                            />
                            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                              {item.discount_usd !== undefined ? 'USD' : '%'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingItemDiscountId(null)}
                            className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Listo
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 flex-shrink-0">
                {/* Desglose de Subtotal y Descuentos */}
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Subtotal base</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">${rawSubtotalUsd.toFixed(2)} USD</span>
                </div>

                {itemsDiscountUsd > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>Descuentos en productos</span>
                    </span>
                    <span>-${itemsDiscountUsd.toFixed(2)} USD</span>
                  </div>
                )}

                {/* Botón o formulario de Descuento General de Factura */}
                <div className="pt-1">
                  {!showOrderDiscountInput && orderDiscountValue <= 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowOrderDiscountInput(true)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100/50 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5" />
                        <span>+ Agregar Descuento General de Factura</span>
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60">
                        Total
                      </span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                          <Percent className="w-3.5 h-3.5" />
                          <span>Descuento al Total de la Factura:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderDiscountValue(0)
                            setShowOrderDiscountInput(false)
                          }}
                          className="text-slate-400 hover:text-rose-500 p-0.5"
                          title="Eliminar descuento general"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-emerald-300 dark:border-emerald-700">
                          <button
                            type="button"
                            onClick={() => setOrderDiscountType('percent')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                              orderDiscountType === 'percent'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            % Porc.
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderDiscountType('fixed')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                              orderDiscountType === 'fixed'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            $ Monto
                          </button>
                        </div>

                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            max={orderDiscountType === 'percent' ? 100 : subtotalAfterItemsDiscount}
                            step={orderDiscountType === 'percent' ? '1' : '0.5'}
                            value={orderDiscountValue || ''}
                            onChange={(e) => {
                              const num = Math.max(0, parseFloat(e.target.value) || 0)
                              setOrderDiscountValue(orderDiscountType === 'percent' ? Math.min(100, num) : Math.min(subtotalAfterItemsDiscount, num))
                            }}
                            placeholder={orderDiscountType === 'percent' ? 'Ej: 10%' : 'Ej: $5.00'}
                            className="w-full px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold outline-none"
                          />
                        </div>

                        {orderDiscountUsd > 0 && (
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            -${orderDiscountUsd.toFixed(2)} USD
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Total Final */}
                <div className="flex justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">Total a Cobrar</span>
                  <span className="font-extrabold text-base text-blue-600 dark:text-blue-400">${totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Equivalente BCV</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {totalDiscountUsd > 0 && (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-right">
                    🎉 Ahorro total cliente: ${totalDiscountUsd.toFixed(2)} USD (Bs. {(totalDiscountUsd * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })})
                  </p>
                )}

                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all duration-200 shadow-md shadow-blue-500/20 active:scale-[0.98] mt-1 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Cobrar ${totalUsd.toFixed(2)} USD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Action Bar para Celulares (<md) */}
      {cart.length > 0 && mobileTab === 'catalog' && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={() => setMobileTab('ticket')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 active:scale-[0.98] transition cursor-pointer font-bold"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-black">
                {totalQuantity}
              </span>
              <span className="text-sm">Ver Ticket</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold">${totalUsd.toFixed(2)} USD</span>
              <span className="text-[10px] text-blue-100 block font-normal">
                Bs. {totalVes.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </button>
        </div>
      )}

      {showPayment && (
        <SplitPaymentModal
          cartItems={cart}
          totalUsd={totalUsd}
          rawSubtotalUsd={rawSubtotalUsd}
          discountAmountUsd={totalDiscountUsd}
          exchangeRate={exchangeRate}
          existingOrderId={webOrderInfo?.orderId}
          initialCustomer={webOrderInfo?.customer}
          isEditMode={webOrderInfo?.isEditMode}
          adminPin={webOrderInfo?.authPin}
          initialPayments={webOrderInfo?.paymentBreakdown}
          initialCreditDays={webOrderInfo?.creditDays}
          initialCreditAmount={webOrderInfo?.initialCreditAmount}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            dispatch({ type: 'CLEAR' })
            const wasEditing = webOrderInfo?.isEditMode
            setWebOrderInfo(null)
            if (wasEditing) {
              router.replace('/admin/orders')
            } else {
              router.replace('/admin/pos')
              setMobileTab('catalog')
              load()
            }
          }}
        />
      )}
    </div>
  )
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando Punto de Venta...</div>}>
      <POSContent />
    </Suspense>
  )
}

'use client'

import { useReducer, useState, useEffect, useCallback, useMemo, useDeferredValue, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { SplitPaymentModal } from '@/components/admin/SplitPaymentModal'
import type { Product, CartItem, Customer } from '@/types/database'
import { getProductBarcode } from '@/lib/barcodeUtils'
import {
  parseApparelAttributes,
  formatVariantSuffix,
  extractVariantFromProductName,
} from '@/lib/apparelAttributes'
import { parseColorVariants } from '@/lib/colorVariants'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  ArrowRight,
  Globe,
  X,
  Percent,
  Tag,
  Pencil,
  FileText,
  Footprints,
  Palette,
  Check,
} from 'lucide-react'
import { type DeliveryInfo, extractDeliveryInfo } from '@/lib/delivery'

function getCartItemKey(item: {
  cart_key?: string
  product_id: string
  selected_size?: string
  selected_color?: string
}): string {
  if (item.cart_key) return item.cart_key
  return `${item.product_id}::${item.selected_size || ''}::${item.selected_color || ''}`
}

// ─── Cart Reducer ─────────────────────────────────────────────────────────────
type CartAction =
  | {
      type: 'ADD'
      product: Product
      selectedSize?: string
      selectedColor?: string
      quantity?: number
      maxStock?: number
      variantImageUrl?: string | null
    }
  | { type: 'INC'; key: string }
  | { type: 'DEC'; key: string }
  | { type: 'REMOVE'; key: string }
  | { type: 'CLEAR' }
  | { type: 'SET_CART'; items: CartItem[] }
  | { type: 'SET_DISCOUNT'; key: string; discount_percent?: number; discount_usd?: number }

function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const size = action.selectedSize?.trim() || undefined
      const color = action.selectedColor?.trim() || undefined
      const cartKey = `${action.product.id}::${size || ''}::${color || ''}`
      const qtyToAdd = Math.max(1, action.quantity || 1)
      const maxStock = action.maxStock !== undefined ? action.maxStock : action.product.stock
      const suffix = formatVariantSuffix(size, color)
      const displayName = `${action.product.name}${suffix}`

      const existing = items.find((i) => getCartItemKey(i) === cartKey)
      if (existing) {
        return items.map((i) =>
          getCartItemKey(i) === cartKey
            ? {
                ...i,
                quantity: maxStock > 0 ? Math.min(maxStock, i.quantity + qtyToAdd) : i.quantity + qtyToAdd,
                max_stock: maxStock,
              }
            : i
        )
      }
      return [
        ...items,
        {
          cart_key: cartKey,
          product_id: action.product.id,
          name: displayName,
          sku: action.product.sku,
          unit_price_usd: action.product.base_price_usd,
          quantity: maxStock > 0 ? Math.min(maxStock, qtyToAdd) : qtyToAdd,
          image_url: action.variantImageUrl || action.product.image_url,
          selected_size: size,
          selected_color: color,
          max_stock: maxStock,
        },
      ]
    }
    case 'INC':
      return items.map((i) => {
        if (getCartItemKey(i) !== action.key) return i
        if (i.max_stock !== undefined && i.max_stock > 0 && i.quantity >= i.max_stock) {
          return i
        }
        return { ...i, quantity: i.quantity + 1 }
      })
    case 'DEC':
      return items.map((i) =>
        getCartItemKey(i) === action.key ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
      )
    case 'REMOVE':
      return items.filter((i) => getCartItemKey(i) !== action.key)
    case 'CLEAR':
      return []
    case 'SET_CART':
      return action.items
    case 'SET_DISCOUNT':
      return items.map((i) => {
        if (getCartItemKey(i) !== action.key) return i
        return {
          ...i,
          discount_percent: action.discount_percent,
          discount_usd: action.discount_usd,
        }
      })
    default:
      return items
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
  deliveryInfo?: DeliveryInfo
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

  // Modal de Selección de Talla y Color en Facturación
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null)
  const [pickerSize, setPickerSize] = useState<string>('')
  const [pickerColor, setPickerColor] = useState<string>('')
  const [pickerQty, setPickerQty] = useState<number>(1)
  const [justAddedToast, setJustAddedToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/admin/products?tenant_id=${tenant.id}&active_only=true&in_stock_only=true`)
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.products)) {
          const sorted = [...json.products].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          setProducts(sorted)
          setLoadingProducts(false)
          return
        }
      }
    } catch {
      // Fallback
    }
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

  useEffect(() => {
    load()
  }, [load])

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
          const loadedItems: CartItem[] = order.order_items.map((i: any) => {
            const prodId = i.product_id || i.id
            const { size, color } = extractVariantFromProductName(i.product_name)
            const cartKey = `${prodId}::${size || ''}::${color || ''}`
            return {
              cart_key: cartKey,
              product_id: prodId,
              name: i.product_name,
              sku: i.product_sku || '',
              unit_price_usd: Number(i.unit_price_usd) || 0,
              quantity: i.quantity || 1,
              image_url: null,
              selected_size: size,
              selected_color: color,
            }
          })

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
              ? order.payment_breakdown.reduce(
                  (s: number, p: any) => (p.method !== 'credit_7d' ? s + (Number(p.amount_usd) || 0) : s),
                  0
                )
              : 0
            prevCredit = Math.max(0, (Number(order.total_usd) || 0) - nonCreditPaid)
          }

          const delInfo = extractDeliveryInfo(order.notes, Number(order.exchange_rate_at_sale) || exchangeRate)

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
            deliveryInfo: delInfo.hasDelivery ? delInfo : undefined,
          })
        }
      } catch (err) {
        console.error('Error al cargar orden en POS:', err)
      }
    }

    loadTargetOrder()
  }, [targetOrderId, tenant, isEditMode, authPin, exchangeRate])

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
          const loadedItems: CartItem[] = quoteData.items.map((i: any) => {
            const prodId = i.product_id || crypto.randomUUID()
            const { size, color } = extractVariantFromProductName(i.name)
            const cartKey = `${prodId}::${size || ''}::${color || ''}`
            return {
              cart_key: cartKey,
              product_id: prodId,
              name: i.name,
              sku: i.sku || '',
              unit_price_usd: Number(i.unit_price_usd) || 0,
              quantity: Number(i.quantity) || 1,
              discount_percent: i.discount_percent ? Number(i.discount_percent) : 0,
              discount_usd: i.discount_percent
                ? parseFloat(
                    ((Number(i.unit_price_usd) * Number(i.quantity) * Number(i.discount_percent)) / 100).toFixed(2)
                  )
                : 0,
              image_url: null,
              selected_size: size,
              selected_color: color,
            }
          })

          dispatch({ type: 'SET_CART', items: loadedItems })
          setMobileTab('ticket')

          let resolvedCustomer: Customer | null = null
          if (quoteData.customer_id) {
            const supabase = createClient()
            const { data: cust } = await supabase
              .from('customers')
              .select('*')
              .eq('id', quoteData.customer_id)
              .single()
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
    return products.filter((p) => {
      const bCode = (getProductBarcode(p) || '').toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        bCode.includes(q)
      )
    })
  }, [products, deferredSearch])

  // Abrir selector de talla/color o agregar directo si no tiene variantes
  const handleProductClick = (p: Product) => {
    const { apparel } = parseApparelAttributes(p.description)
    const { colors } = parseColorVariants(p.description)
    const hasSizes =
      (apparel.sizeStock && apparel.sizeStock.length > 0) || (apparel.sizes && apparel.sizes.length > 0)
    const hasColors = colors.length > 0

    if (!hasSizes && !hasColors) {
      const inCartQty = cart.filter((i) => i.product_id === p.id).reduce((s, i) => s + i.quantity, 0)
      if (inCartQty >= p.stock) return
      dispatch({ type: 'ADD', product: p, maxStock: p.stock })
      return
    }

    // Preparar valores iniciales del modal de variantes
    let initialSize = ''
    if (apparel.sizeStock && apparel.sizeStock.length > 0) {
      const firstAvailable = apparel.sizeStock.find((sz) => {
        const inCartForSize = cart
          .filter((i) => i.product_id === p.id && i.selected_size === sz.size)
          .reduce((s, i) => s + i.quantity, 0)
        return (Number(sz.stock) || 0) - inCartForSize > 0
      })
      initialSize = firstAvailable ? firstAvailable.size : apparel.sizeStock[0].size
    } else if (apparel.sizes && apparel.sizes.length > 0) {
      initialSize = apparel.sizes[0]
    }

    let initialColor = ''
    if (colors.length > 0) {
      const firstAvailColor = colors.find((c) => typeof c.stock !== 'number' || c.stock > 0)
      initialColor = firstAvailColor ? firstAvailColor.name : colors[0].name
    }

    setPickerSize(initialSize)
    setPickerColor(initialColor)
    setPickerQty(1)
    setJustAddedToast(null)
    setVariantModalProduct(p)
  }

  // Datos calculados del modal de variantes activo
  const activeModalVariants = useMemo(() => {
    if (!variantModalProduct) return null
    const { apparel } = parseApparelAttributes(variantModalProduct.description)
    const { colors } = parseColorVariants(variantModalProduct.description)
    const hasTrackedSizeStock = Boolean(apparel.sizeStock && apparel.sizeStock.length > 0)

    const sizeOptions = hasTrackedSizeStock
      ? apparel.sizeStock!.map((sz) => {
          const inCart = cart
            .filter(
              (i) =>
                i.product_id === variantModalProduct.id &&
                i.selected_size?.toLowerCase() === sz.size.toLowerCase()
            )
            .reduce((s, i) => s + i.quantity, 0)
          const totalForSize = Number(sz.stock) || 0
          return {
            size: sz.size,
            totalStock: totalForSize,
            inCart,
            available: Math.max(0, totalForSize - inCart),
            tracked: true,
          }
        })
      : (apparel.sizes || []).map((sz) => {
          const inCartTotal = cart
            .filter((i) => i.product_id === variantModalProduct.id)
            .reduce((s, i) => s + i.quantity, 0)
          return {
            size: sz,
            totalStock: variantModalProduct.stock,
            inCart: inCartTotal,
            available: Math.max(0, variantModalProduct.stock - inCartTotal),
            tracked: false,
          }
        })

    const colorOptions = colors.map((c) => {
      const tracked = typeof c.stock === 'number' && c.stock > 0
      const inCart = cart
        .filter(
          (i) =>
            i.product_id === variantModalProduct.id &&
            i.selected_color?.toLowerCase() === c.name.toLowerCase()
        )
        .reduce((s, i) => s + i.quantity, 0)
      const avail = tracked ? Math.max(0, (c.stock || 0) - inCart) : variantModalProduct.stock
      return {
        ...c,
        inCart,
        available: avail,
        tracked,
      }
    })

    const selectedSizeObj = sizeOptions.find((s) => s.size === pickerSize)
    const selectedColorObj = colorOptions.find((c) => c.name === pickerColor)

    let maxAvailable = variantModalProduct.stock
    if (selectedSizeObj) {
      maxAvailable = selectedSizeObj.available
    }
    if (selectedColorObj && selectedColorObj.tracked) {
      maxAvailable = Math.min(maxAvailable, selectedColorObj.available)
    }

    // Límite absoluto para este cart_key (incluyendo lo que ya está en el carrito)
    const existingInCartForKey = cart
      .filter(
        (i) =>
          i.product_id === variantModalProduct.id &&
          (i.selected_size || '') === (pickerSize || '') &&
          (i.selected_color || '') === (pickerColor || '')
      )
      .reduce((s, i) => s + i.quantity, 0)

    const maxTotalForCartLine = existingInCartForKey + maxAvailable

    return {
      apparel,
      sizeOptions,
      colorOptions,
      selectedSizeObj,
      selectedColorObj,
      maxAvailable,
      maxTotalForCartLine,
    }
  }, [variantModalProduct, cart, pickerSize, pickerColor])

  const handleConfirmVariantAdd = (keepOpen = false) => {
    if (!variantModalProduct || !activeModalVariants) return
    if (activeModalVariants.sizeOptions.length > 0 && !pickerSize) return
    if (activeModalVariants.maxAvailable <= 0) return

    const safeQty = Math.min(activeModalVariants.maxAvailable, Math.max(1, pickerQty))
    const colorImg = activeModalVariants.selectedColorObj?.image_url || variantModalProduct.image_url

    dispatch({
      type: 'ADD',
      product: variantModalProduct,
      selectedSize: pickerSize || undefined,
      selectedColor: pickerColor || undefined,
      quantity: safeQty,
      maxStock: activeModalVariants.maxTotalForCartLine,
      variantImageUrl: colorImg,
    })

    if (keepOpen) {
      setPickerQty(1)
      setJustAddedToast(
        `Agregado: ${safeQty}x ${pickerSize ? `Talla ${pickerSize}` : ''} ${pickerColor || ''}`.trim()
      )
      setTimeout(() => setJustAddedToast(null), 2200)
    } else {
      setVariantModalProduct(null)
    }
  }

  // Descuento global sobre el total de la orden
  const [orderDiscountType, setOrderDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0)
  const [showOrderDiscountInput, setShowOrderDiscountInput] = useState(false)
  const [editingItemDiscountKey, setEditingItemDiscountKey] = useState<string | null>(null)

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
            Facturación rápida de mostrador, selección por tallas y pedidos web
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
        <div
          className={`md:col-span-7 lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-h-0 ${
            mobileTab === 'catalog' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código SKU o escanear código de barras…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12 font-medium">
                Cargando catálogo…
              </p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No se encontraron productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                {filtered.map((p) => {
                  const inCartQty = cart
                    .filter((i) => i.product_id === p.id)
                    .reduce((sum, i) => sum + i.quantity, 0)
                  const { apparel } = parseApparelAttributes(p.description)
                  const { colors } = parseColorVariants(p.description)
                  const sizeList =
                    apparel.sizeStock && apparel.sizeStock.length > 0
                      ? apparel.sizeStock.filter((s) => (Number(s.stock) || 0) > 0).map((s) => s.size)
                      : apparel.sizes || []

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProductClick(p)}
                      className="glass-card p-3 sm:p-3.5 text-left hover:scale-[1.02] transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.97] flex flex-col justify-between cursor-pointer border border-slate-200/80 dark:border-slate-800/80"
                    >
                      <div>
                        <div className="relative w-full aspect-square max-h-24 sm:max-h-28 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex items-center justify-center mb-2 flex-shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400 stroke-1" />
                          )}

                          {/* Indicador de selección de tallas sobre la imagen */}
                          {sizeList.length > 0 && (
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white text-[9px] font-extrabold backdrop-blur-xs flex items-center gap-1">
                              <Footprints className="w-2.5 h-2.5 text-blue-400" />
                              <span>{sizeList.length} tallas</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1">
                          {p.name}
                        </p>

                        {/* Chips compactos de tallas disponibles */}
                        {sizeList.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {sizeList.slice(0, 4).map((sz) => (
                              <span
                                key={sz}
                                className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60"
                              >
                                {sz}
                              </span>
                            ))}
                            {sizeList.length > 4 && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold text-slate-400">
                                +{sizeList.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                            ${p.base_price_usd.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-1">
                            {colors.length > 0 && (
                              <div className="flex items-center -space-x-1">
                                {colors.slice(0, 3).map((c, idx) => (
                                  <span
                                    key={idx}
                                    className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800"
                                    style={{ backgroundColor: c.hex || '#64748B' }}
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium">Stock: {p.stock}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                            Bs. {(p.base_price_usd * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                          </span>
                          {inCartQty > 0 && (
                            <span className="font-extrabold text-white bg-blue-600 px-1.5 py-0.5 rounded-md text-[10px]">
                              ×{inCartQty}
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
        <div
          className={`md:col-span-5 lg:col-span-5 xl:col-span-4 glass-card flex flex-col p-4 sm:p-5 gap-3.5 min-h-0 border border-slate-200/80 dark:border-slate-800/80 ${
            mobileTab === 'ticket' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Banner de Pedido Web, Modo Edición o Cotización */}
          {webOrderInfo && (
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 flex-shrink-0 animate-in fade-in duration-200 ${
                webOrderInfo.isEditMode
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                  : webOrderInfo.isQuotation
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800'
                  : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
                    webOrderInfo.isEditMode
                      ? 'bg-amber-600'
                      : webOrderInfo.isQuotation
                      ? 'bg-emerald-600'
                      : 'bg-blue-600'
                  }`}
                >
                  {webOrderInfo.isEditMode ? (
                    <Pencil className="w-4 h-4" />
                  ) : webOrderInfo.isQuotation ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-black truncate ${
                      webOrderInfo.isEditMode
                        ? 'text-amber-800 dark:text-amber-200'
                        : webOrderInfo.isQuotation
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-blue-800 dark:text-blue-200'
                    }`}
                  >
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
                title={
                  webOrderInfo.isEditMode
                    ? 'Cancelar edición y volver a ticket limpio'
                    : webOrderInfo.isQuotation
                    ? 'Quitar cotización y limpiar ticket'
                    : 'Desvincular orden web y empezar ticket limpio'
                }
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header del Ticket con botón para volver a catálogo en móvil */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('catalog')}
                className="md:hidden inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-xl transition cursor-pointer"
                title="Volver al catálogo"
              >
                ← Catálogo
              </button>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Ticket {totalQuantity > 0 && `(${totalQuantity})`}</span>
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => {
                  dispatch({ type: 'CLEAR' })
                  if (webOrderInfo) {
                    setWebOrderInfo(null)
                    router.replace('/admin/pos')
                  }
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Vaciar ticket
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
                  const itemKey = getCartItemKey(item)
                  const lineOriginal = item.unit_price_usd * item.quantity
                  let itemDisc = 0
                  if (item.discount_usd !== undefined && item.discount_usd > 0) {
                    itemDisc = Math.min(lineOriginal, item.discount_usd)
                  } else if (item.discount_percent !== undefined && item.discount_percent > 0) {
                    itemDisc = Math.min(lineOriginal, (lineOriginal * item.discount_percent) / 100)
                  }
                  const lineFinal = Math.max(0, lineOriginal - itemDisc)
                  const isEditingThisDiscount = editingItemDiscountKey === itemKey
                  const { baseName, size: parsedSize, color: parsedColor } = extractVariantFromProductName(item.name)
                  const displaySize = item.selected_size || parsedSize
                  const displayColor = item.selected_color || parsedColor

                  return (
                    <div
                      key={itemKey}
                      className="p-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {baseName || item.name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              ${item.unit_price_usd.toFixed(2)} c/u
                            </span>
                            {displaySize && (
                              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Talla: {displaySize}
                              </span>
                            )}
                            {displayColor && (
                              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {displayColor}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => dispatch({ type: 'DEC', key: itemKey })}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold active:scale-95 cursor-pointer"
                            aria-label="Restar unidad"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => dispatch({ type: 'INC', key: itemKey })}
                            disabled={item.max_stock !== undefined && item.max_stock > 0 && item.quantity >= item.max_stock}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Sumar unidad"
                            title={
                              item.max_stock !== undefined && item.quantity >= item.max_stock
                                ? `Máximo disponible en esta talla (${item.max_stock})`
                                : 'Sumar unidad'
                            }
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
                          onClick={() => dispatch({ type: 'REMOVE', key: itemKey })}
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
                                : `$${(item.discount_usd || 0).toFixed(2)} desc.`}{' '}
                              (-${itemDisc.toFixed(2)})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: 'SET_DISCOUNT',
                                  key: itemKey,
                                  discount_percent: undefined,
                                  discount_usd: undefined,
                                })
                              }
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
                          onClick={() => setEditingItemDiscountKey(isEditingThisDiscount ? null : itemKey)}
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
                                const val =
                                  item.discount_percent ||
                                  (item.discount_usd ? Math.round((item.discount_usd / lineOriginal) * 100) : 5)
                                dispatch({
                                  type: 'SET_DISCOUNT',
                                  key: itemKey,
                                  discount_percent: val,
                                  discount_usd: undefined,
                                })
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
                                const val =
                                  item.discount_usd ||
                                  (item.discount_percent ? (lineOriginal * item.discount_percent) / 100 : 1)
                                dispatch({
                                  type: 'SET_DISCOUNT',
                                  key: itemKey,
                                  discount_percent: undefined,
                                  discount_usd: val,
                                })
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
                              value={
                                item.discount_usd !== undefined
                                  ? item.discount_usd || ''
                                  : item.discount_percent || ''
                              }
                              onChange={(e) => {
                                const num = Math.max(0, parseFloat(e.target.value) || 0)
                                if (item.discount_usd !== undefined) {
                                  dispatch({
                                    type: 'SET_DISCOUNT',
                                    key: itemKey,
                                    discount_usd: Math.min(lineOriginal, num),
                                    discount_percent: undefined,
                                  })
                                } else {
                                  dispatch({
                                    type: 'SET_DISCOUNT',
                                    key: itemKey,
                                    discount_percent: Math.min(100, num),
                                    discount_usd: undefined,
                                  })
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
                            onClick={() => setEditingItemDiscountKey(null)}
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
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    ${rawSubtotalUsd.toFixed(2)} USD
                  </span>
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
                              setOrderDiscountValue(
                                orderDiscountType === 'percent'
                                  ? Math.min(100, num)
                                  : Math.min(subtotalAfterItemsDiscount, num)
                              )
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
                  <span className="font-extrabold text-base text-blue-600 dark:text-blue-400">
                    ${totalUsd.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Equivalente BCV</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Bs.{' '}
                    {totalVes.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {totalDiscountUsd > 0 && (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-right">
                    🎉 Ahorro total cliente: ${totalDiscountUsd.toFixed(2)} USD (Bs.{' '}
                    {(totalDiscountUsd * exchangeRate).toLocaleString('es-VE', {
                      maximumFractionDigits: 0,
                    })}
                    )
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
        <div className="md:hidden fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-30 animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={() => setMobileTab('ticket')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xl shadow-blue-600/40 active:scale-[0.98] transition cursor-pointer font-bold border border-white/20"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-white/25 px-2 py-0.5 rounded-xl text-xs font-black shadow-xs">
                {totalQuantity} {totalQuantity === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="text-sm tracking-tight">Ver Ticket</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black">${totalUsd.toFixed(2)} USD</span>
              <span className="text-[10px] text-blue-100 block font-medium">
                Bs. {totalVes.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE SELECCIÓN DE TALLA Y COLOR EN EL PUNTO DE VENTA (FACTURACIÓN)     */}
      {/* ========================================================================= */}
      {variantModalProduct && activeModalVariants && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setVariantModalProduct(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Selector */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                  {activeModalVariants.selectedColorObj?.image_url || variantModalProduct.image_url ? (
                    <img
                      src={activeModalVariants.selectedColorObj?.image_url || variantModalProduct.image_url!}
                      alt={variantModalProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Seleccionar para Facturar
                    </span>
                    {variantModalProduct.sku && (
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        #{variantModalProduct.sku}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate mt-0.5">
                    {variantModalProduct.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                      ${variantModalProduct.base_price_usd.toFixed(2)} USD
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Bs.{' '}
                      {(variantModalProduct.base_price_usd * exchangeRate).toLocaleString('es-VE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
              {justAddedToast && (
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  <span>{justAddedToast}</span>
                </div>
              )}

              {/* 1. Selección de Talla */}
              {activeModalVariants.sizeOptions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Footprints className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>1. Escoge la Talla a Vender:</span>
                    </label>
                    <span className="text-[11px] font-bold text-slate-400">
                      Se descontará de su stock
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {activeModalVariants.sizeOptions.map((sz) => {
                      const isSelected = pickerSize === sz.size
                      const isOut = sz.available <= 0
                      return (
                        <button
                          key={sz.size}
                          type="button"
                          disabled={isOut}
                          onClick={() => {
                            setPickerSize(sz.size)
                            setPickerQty(1)
                          }}
                          className={`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                            isOut
                              ? 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 opacity-55 cursor-not-allowed'
                              : isSelected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/25 cursor-pointer scale-[1.02]'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-blue-400 cursor-pointer'
                          }`}
                        >
                          <span className="text-sm font-mono font-black">Talla {sz.size}</span>
                          <span
                            className={`text-[10px] font-bold ${
                              isOut
                                ? 'text-rose-500'
                                : isSelected
                                ? 'text-blue-100'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isOut ? 'Agotado' : `${sz.available} disp.`}
                          </span>
                          {sz.inCart > 0 && (
                            <span
                              className={`text-[9px] font-extrabold px-1.5 rounded-full mt-0.5 ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              En ticket: {sz.inCart}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. Selección de Color */}
              {activeModalVariants.colorOptions.length > 0 && (
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>
                      {activeModalVariants.sizeOptions.length > 0 ? '2. Escoge el Color:' : '1. Escoge el Color:'}
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {activeModalVariants.colorOptions.map((col) => {
                      const isSelected = pickerColor === col.name
                      const isOut = col.tracked && col.available <= 0
                      return (
                        <button
                          key={col.name}
                          type="button"
                          disabled={isOut}
                          onClick={() => {
                            setPickerColor(col.name)
                            setPickerQty(1)
                          }}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 text-xs font-bold transition ${
                            isOut
                              ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-400 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 shadow-xs cursor-pointer'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-purple-400 cursor-pointer'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
                            style={{ backgroundColor: col.hex || '#64748B' }}
                          />
                          <span>{col.name}</span>
                          {col.tracked && (
                            <span className="text-[10px] opacity-75">
                              ({isOut ? 'Agotado' : `${col.available}`})
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. Selector de Cantidad */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-white block">
                    Cantidad a Facturar
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Disponible en selección:{' '}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {activeModalVariants.maxAvailable} unds
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerQty((q) => Math.max(1, q - 1))}
                    disabled={pickerQty <= 1}
                    className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-black text-slate-800 dark:text-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-mono text-base font-black text-slate-900 dark:text-white">
                    {pickerQty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPickerQty((q) => Math.min(activeModalVariants.maxAvailable, q + 1))
                    }
                    disabled={pickerQty >= activeModalVariants.maxAvailable}
                    className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-black text-slate-800 dark:text-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Pie del Modal con botones de acción */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleConfirmVariantAdd(true)}
                disabled={activeModalVariants.maxAvailable <= 0}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold hover:bg-blue-100 transition cursor-pointer disabled:opacity-40"
              >
                + Agregar y elegir otra talla
              </button>

              <button
                type="button"
                onClick={() => handleConfirmVariantAdd(false)}
                disabled={activeModalVariants.maxAvailable <= 0}
                className="w-full sm:flex-1 py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 active:scale-95 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>
                  Agregar al Ticket ($
                  {(variantModalProduct.base_price_usd * pickerQty).toFixed(2)} USD)
                </span>
              </button>
            </div>
          </div>
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
          initialDeliveryInfo={webOrderInfo?.deliveryInfo}
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

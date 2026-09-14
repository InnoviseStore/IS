'use client'

import { useReducer, useState, useEffect, useCallback, useMemo, useDeferredValue, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { SplitPaymentModal } from '@/components/admin/SplitPaymentModal'
import type { Product, CartItem, Customer } from '@/types/database'
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, ArrowRight, Globe, X } from 'lucide-react'

// ─── Cart Reducer ─────────────────────────────────────────────────────────────
type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'INC'; id: string }
  | { type: 'DEC'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'SET_CART'; items: CartItem[] }

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
    default: return items
  }
}

interface WebOrderInfo {
  orderId: string
  orderNumber: string
  customerName: string
  customer: Customer | null
}

function POSContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromOrderId = searchParams.get('fromOrder')

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

  // Cargar orden web si viene el parámetro fromOrder
  useEffect(() => {
    if (!fromOrderId || !tenant) return

    async function loadWebOrder() {
      try {
        const supabase = createClient()
        const { data: order, error } = await supabase
          .from('orders')
          .select('*, customer:customers(*), order_items(*)')
          .eq('id', fromOrderId)
          .single()

        if (error || !order) {
          console.warn('No se pudo cargar la orden web:', error)
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

          let custName = 'Cliente Web'
          if (order.customer?.full_name) {
            custName = order.customer.full_name
          } else if (order.notes) {
            const m = order.notes.match(/Cliente:\s*([^|]+)/i)
            if (m && m[1]) custName = m[1].trim()
          }

          setWebOrderInfo({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: custName,
            customer: order.customer || null,
          })
        }
      } catch (err) {
        console.error('Error al cargar orden web en POS:', err)
      }
    }

    loadWebOrder()
  }, [fromOrderId, tenant])

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    )
  }, [products, deferredSearch])

  const totalQuantity = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])
  const totalUsd = useMemo(() => cart.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0), [cart])
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
          {/* Banner de Pedido Web */}
          {webOrderInfo && (
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2 flex-shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-blue-800 dark:text-blue-200 truncate">
                    Pedido Web #{webOrderInfo.orderNumber}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    Cliente: <strong>{webOrderInfo.customerName}</strong>
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
                title="Desvincular orden web y empezar ticket limpio"
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
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60">
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
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white w-14 sm:w-16 text-right">
                      ${(item.unit_price_usd * item.quantity).toFixed(2)}
                    </p>
                    <button 
                      onClick={() => dispatch({ type: 'REMOVE', id: item.product_id })} 
                      className="text-slate-400 hover:text-rose-500 transition p-1 cursor-pointer"
                      title="Quitar ítem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 flex-shrink-0">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">${totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total en Bolívares</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
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
          exchangeRate={exchangeRate}
          existingOrderId={webOrderInfo?.orderId}
          initialCustomer={webOrderInfo?.customer}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            dispatch({ type: 'CLEAR' })
            setWebOrderInfo(null)
            router.replace('/admin/pos')
            setMobileTab('catalog')
            load()
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

'use client'

import { useReducer, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { SplitPaymentModal } from '@/components/admin/SplitPaymentModal'
import type { Product, CartItem } from '@/types/database'
import { Search, Plus, Minus, Trash2, ShoppingCart, Package } from 'lucide-react'

// ─── Cart Reducer ─────────────────────────────────────────────────────────────
type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'INC'; id: string }
  | { type: 'DEC'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }

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
    default: return items
  }
}

export default function POSPage() {
  const { tenant, exchangeRate } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, dispatch] = useReducer(cartReducer, [])
  const [showPayment, setShowPayment] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)

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

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalUsd = cart.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0)
  const totalVes = totalUsd * exchangeRate

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Punto de Venta</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">Facturación rápida de mostrador</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">
        {/* LEFT: Products */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="Buscar producto o SKU…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingProducts ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12 font-medium">Cargando catálogo…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {filtered.map((p) => {
                  const inCart = cart.find((i) => i.product_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => dispatch({ type: 'ADD', product: p })}
                      className="glass-card p-4 text-left hover:scale-[1.02] transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.98] flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center mb-3">
                          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mb-1">{p.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">${p.base_price_usd.toFixed(2)}</p>
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Stock: {p.stock}</span>
                          {inCart && <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-md">×{inCart.quantity}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart/Ticket */}
        <div className="lg:col-span-2 glass-card flex flex-col p-5 gap-4 min-h-0 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Ticket Actual
            </h2>
            {cart.length > 0 && (
              <button onClick={() => dispatch({ type: 'CLEAR' })} className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition">
                Limpiar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
              <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">Agrega productos al ticket</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">${item.unit_price_usd.toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => dispatch({ type: 'DEC', id: item.product_id })} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-extrabold text-slate-900 dark:text-white">{item.quantity}</span>
                      <button onClick={() => dispatch({ type: 'INC', id: item.product_id })} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-800 dark:text-slate-100 font-bold">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white w-16 text-right">
                      ${(item.unit_price_usd * item.quantity).toFixed(2)}
                    </p>
                    <button onClick={() => dispatch({ type: 'REMOVE', id: item.product_id })} className="text-slate-400 hover:text-rose-500 transition p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">${totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Equivalente en Bs.</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all duration-200 shadow-md shadow-blue-500/20 active:scale-[0.98] mt-2"
                >
                  Cobrar ${totalUsd.toFixed(2)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPayment && (
        <SplitPaymentModal
          cartItems={cart}
          totalUsd={totalUsd}
          exchangeRate={exchangeRate}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            dispatch({ type: 'CLEAR' })
            load()
          }}
        />
      )}
    </div>
  )
}
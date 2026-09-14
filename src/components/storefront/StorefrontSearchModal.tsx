'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Search, X, Package, ShoppingCart, ArrowRight } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'

export interface SearchProductItem {
  id: string
  name: string
  description?: string | null
  base_price_usd: number
  image_url?: string | null
  sku?: string | null
}

interface StorefrontSearchModalProps {
  isOpen: boolean
  onClose: () => void
  tenantSlug: string
  products: SearchProductItem[]
  exchangeRate: number
}

export default function StorefrontSearchModal({
  isOpen,
  onClose,
  tenantSlug,
  products,
  exchangeRate,
}: StorefrontSearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { addItem, openCart } = useCart()

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(trimmed) ||
          (p.description && p.description.toLowerCase().includes(trimmed)) ||
          (p.sku && p.sku.toLowerCase().includes(trimmed))
      )
    : products.slice(0, 8)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-20 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos por nombre, descripción o código..."
            className="flex-1 bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 text-base sm:text-lg focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cerrar modal de búsqueda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {trimmed ? `Resultados (${filtered.length})` : 'Productos recomendados'}
            </span>
            <span className="text-[11px] text-slate-400">
              Tasa: Bs. {exchangeRate.toFixed(2)}
            </span>
          </div>

          {filtered.length > 0 ? (
            filtered.map((product) => {
              const priceVes = (product.base_price_usd * exchangeRate).toLocaleString('es-VE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })

              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-100 dark:border-slate-800 transition group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {product.name}
                      </h4>
                      {product.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm sm:max-w-md">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                          ${product.base_price_usd.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          (Bs. {priceVes})
                        </span>
                        {product.sku && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-mono">
                            {product.sku}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        id: product.id,
                        product_id: product.id,
                        name: product.name,
                        sku: product.sku || '',
                        unit_price_usd: product.base_price_usd,
                        quantity: 1,
                        image_url: product.image_url || undefined,
                      })
                      onClose()
                      openCart()
                    }}
                    className="ml-3 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 transition shrink-0"
                    title="Agregar al carrito"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agregar</span>
                  </button>
                </div>
              )
            })
          ) : (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No se encontraron productos para "{query}"
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Prueba con otro término de búsqueda o revisa las categorías del menú.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Pulsa ESC para cerrar</span>
          <span>Búsqueda instantánea en catálogo</span>
        </div>
      </div>
    </div>
  )
}

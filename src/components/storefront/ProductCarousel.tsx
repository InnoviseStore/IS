'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Sparkles, Package, ShoppingCart } from 'lucide-react'
import type { Product } from '@/components/storefront/ProductGrid'
import { useCart } from '@/contexts/CartContext'

interface Props {
  products: Product[]
  exchangeRate: number
  tenantSlug: string
}

export function ProductCarousel({ products, exchangeRate, tenantSlug }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()

  // Solo mostrar productos con stock
  const inStockProducts = products.filter((p) => p.stock_quantity == null || p.stock_quantity > 0)

  if (inStockProducts.length === 0) return null

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    const offset = direction === 'left' ? -320 : 320
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <section className="relative py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Productos Destacados & Novedades
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Disponibilidad inmediata para entrega en Caracas
            </p>
          </div>
        </div>

        {/* Flechas de navegación */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-xs"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-xs"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenedor del Carrusel con scroll suave */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {inStockProducts.map((p) => {
          const priceVes = p.unit_price_usd * exchangeRate
          const productSlug = encodeURIComponent(p.sku || p.id)
          const productHref = `/${tenantSlug}/p/${productSlug}`
          return (
            <div
              key={p.id}
              className="w-64 sm:w-72 flex-shrink-0 snap-start rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden flex flex-col group"
            >
              {/* Imagen vinculada a la página de producto */}
              <Link href={productHref} prefetch={true} className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden block">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 70vw, 300px"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                    <Package className="w-8 h-8" />
                    <span className="text-[11px]">Sin imagen</span>
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                  Disponible
                </div>
              </Link>

              {/* Contenido */}
              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                <div>
                  <Link href={productHref} prefetch={true}>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {p.name}
                    </h3>
                  </Link>
                  {p.sku && (
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {p.sku}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 leading-none">
                      ${p.unit_price_usd.toFixed(2)}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">USD</span>
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                      Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      addItem({
                        id: p.id,
                        product_id: p.id,
                        name: p.name,
                        sku: p.sku,
                        unit_price_usd: p.unit_price_usd,
                        image_url: p.image_url,
                        quantity: 1,
                      })
                    }
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-90 transition-all cursor-pointer"
                    title="Añadir al carrito"
                    aria-label="Añadir al carrito"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

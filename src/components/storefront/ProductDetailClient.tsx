'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  ShieldCheck,
  Truck,
  MessageCircle,
  Package,
  Share2,
  ZoomIn
} from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import type { Product } from '@/components/storefront/ProductGrid'

interface Props {
  product: Product
  tenantSlug: string
  tenantName: string
  tenantPhone: string
  exchangeRate: number
  relatedProducts: Product[]
}

export function ProductDetailClient({
  product,
  tenantSlug,
  tenantName,
  tenantPhone,
  exchangeRate,
  relatedProducts,
}: Props) {
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const [zoomCoords, setZoomCoords] = useState<{ x: number; y: number } | null>(null)
  const { addItem, openCart } = useCart()

  const priceVes = product.unit_price_usd * exchangeRate
  const outOfStock = product.stock_quantity === 0
  const maxStock = product.stock_quantity ?? 99

  const imagesList = (product.images && product.images.length > 0)
    ? product.images
    : (product.image_url ? [product.image_url] : [])
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const currentImage = imagesList[activeImageIndex] || product.image_url

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - left) / width) * 100
    const y = ((e.clientY - top) / height) * 100
    setZoomCoords({ x, y })
  }

  function handleMouseLeave() {
    setZoomCoords(null)
  }

  function handleAddToCart() {
    addItem({
      id: product.id,
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      unit_price_usd: product.unit_price_usd,
      image_url: currentImage || product.image_url,
      quantity,
    })
    setJustAdded(true)
    setTimeout(() => {
      setJustAdded(false)
      openCart()
    }, 600)
  }

  function handleAskWhatsApp() {
    const text = `Hola *${tenantName}*, tengo una consulta sobre este producto de su catálogo:\n\n` +
      `📦 *${product.name}*\n` +
      `💵 Precio: $${product.unit_price_usd.toFixed(2)} USD (Bs. ${priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })})\n` +
      (product.sku ? `🔖 SKU: ${product.sku}\n\n` : '\n') +
      `¿Tienen disponibilidad para entrega o retiro inmediato?`

    const cleanPhone = (tenantPhone || '584121234567').replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter space-y-12">
      {/* Breadcrumb minimalista */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <Link href={`/${tenantSlug}`} className="hover:text-blue-600 transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Catálogo
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[240px]">
          {product.name}
        </span>
      </nav>

      {/* Grid de Detalle del Producto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Lado Izquierdo: Galería de Imágenes interactiva con Zoom */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="zoom-container relative aspect-square sm:aspect-4/3 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-md flex items-center justify-center select-none"
          >
            {currentImage ? (
              <Image
                src={currentImage}
                alt={product.name}
                fill
                priority
                className="zoom-image object-contain p-4"
                style={
                  zoomCoords
                    ? {
                        transformOrigin: `${zoomCoords.x}% ${zoomCoords.y}%`,
                        transform: 'scale(1.85)',
                      }
                    : undefined
                }
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                <Package className="w-16 h-16 stroke-1" />
                <span className="text-sm font-medium">Sin imagen oficial</span>
              </div>
            )}

            {/* Badge de Zoom */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 text-[11px] font-semibold text-slate-600 dark:text-slate-300 backdrop-blur-xs pointer-events-none shadow-xs">
              <ZoomIn className="w-3.5 h-3.5" />
              Pasa el cursor para hacer zoom
            </div>

            {/* Estado de stock */}
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 shadow-xs border border-slate-100 dark:border-slate-800">
              {outOfStock ? '🔴 Agotado' : `🟢 Disponible (${product.stock_quantity ?? 'Stock activo'})`}
            </div>
          </div>

          {/* Selector de Miniaturas (si hay más de 1 imagen) */}
          {imagesList.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
              {imagesList.map((imgSrc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 transition-all cursor-pointer border-2 ${
                    activeImageIndex === idx
                      ? 'border-blue-600 shadow-md shadow-blue-500/20 scale-102 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100 hover:border-slate-400'
                  }`}
                >
                  <img
                    src={imgSrc}
                    alt={`${product.name} foto ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lado Derecho: Ficha y Acciones */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Garantía & Disponibilidad Oficial
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 leading-tight">
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-xs font-mono text-slate-400 mt-1">Código SKU: {product.sku}</p>
            )}
          </div>

          {/* Bloque de Precios en Alto Contraste */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Precio Oficial:</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                ${product.unit_price_usd.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-slate-500">USD</span>
            </div>
            <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 pt-1">
              Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400">
              Calculado según tasa oficial del Banco Central de Venezuela (Bs. {exchangeRate.toFixed(2)}/USD).
            </p>
          </div>

          {/* Descripción */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Descripción del Producto
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Selector de Cantidad y Botones de Compra */}
          <div className="space-y-3 pt-2">
            {!outOfStock && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cantidad:</span>
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-xs font-extrabold text-slate-900 dark:text-white">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                    disabled={quantity >= maxStock}
                    className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleAddToCart}
                disabled={outOfStock}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md active:scale-98 cursor-pointer ${
                  outOfStock
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : justAdded
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Agregado al Carrito!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>{outOfStock ? 'Producto Agotado' : `Añadir al Carrito — $${(product.unit_price_usd * quantity).toFixed(2)}`}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAskWhatsApp}
                className="w-full py-3 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs active:scale-98 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                Consultar por WhatsApp
              </button>
            </div>
          </div>

          {/* Garantías y Beneficios */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>Garantía de originalidad</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span>Envíos y retiros en tienda</span>
            </div>
          </div>
        </div>
      </div>

      {/* Productos Relacionados */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-slate-200/70 dark:border-slate-800/70 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              También te podría interesar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Otros clientes de {tenantName} agregaron estos artículos
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((rel) => (
              <Link
                key={rel.id}
                href={`/${tenantSlug}/p/${rel.id}`}
                className="group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 flex flex-col gap-2 hover:shadow-lg hover:border-blue-400 transition-all"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {rel.image_url ? (
                    <Image
                      src={rel.image_url}
                      alt={rel.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {rel.name}
                </h4>
                <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-auto">
                  ${rel.unit_price_usd.toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

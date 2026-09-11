'use client'

import { useState, useRef } from 'react'
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
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  FileText,
  Palette
} from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import type { Product } from '@/components/storefront/ProductGrid'

export interface ColorVariant {
  name: string
  hex?: string
  image_url?: string
}

export function parseColorVariants(description?: string | null): { cleanDescription: string; colors: ColorVariant[] } {
  if (!description) return { cleanDescription: '', colors: [] }
  const match = description.match(/<!--COLOR_VARIANTS:(.*?)-->/)
  if (!match) return { cleanDescription: description, colors: [] }
  try {
    const colors = JSON.parse(match[1]) as ColorVariant[]
    const cleanDescription = description.replace(/<!--COLOR_VARIANTS:(.*?)-->/, '').trim()
    return { cleanDescription, colors: Array.isArray(colors) ? colors : [] }
  } catch {
    return { cleanDescription: description, colors: [] }
  }
}

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
  const thumbnailsRef = useRef<HTMLDivElement>(null)
  const { addItem, openCart } = useCart()

  const { cleanDescription, colors } = parseColorVariants(product.description)
  const [selectedColor, setSelectedColor] = useState<string>(colors[0]?.name || '')

  const priceVes = product.unit_price_usd * exchangeRate
  const outOfStock = product.stock_quantity === 0
  const maxStock = product.stock_quantity ?? 99

  // Consolidar fotos del producto y de las variantes
  const baseImages = (product.images && product.images.length > 0)
    ? product.images
    : (product.image_url ? [product.image_url] : [])

  // Añadir fotos de colores que no estén en la lista base
  const allImages = [...baseImages]
  colors.forEach((c) => {
    if (c.image_url && !allImages.includes(c.image_url)) {
      allImages.push(c.image_url)
    }
  })

  const imagesList = allImages.length > 0 ? allImages : []
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const currentImage = imagesList[activeImageIndex] || product.image_url

  function scrollThumbnails(direction: 'left' | 'right') {
    if (!thumbnailsRef.current) return
    const offset = direction === 'left' ? -200 : 200
    thumbnailsRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  function handleSelectColor(color: ColorVariant) {
    setSelectedColor(color.name)
    if (color.image_url) {
      const idx = imagesList.indexOf(color.image_url)
      if (idx !== -1) {
        setActiveImageIndex(idx)
      } else {
        imagesList.push(color.image_url)
        setActiveImageIndex(imagesList.length - 1)
      }
    }
  }

  function handlePrevImage() {
    if (imagesList.length <= 1) return
    setActiveImageIndex((prev) => (prev === 0 ? imagesList.length - 1 : prev - 1))
  }

  function handleNextImage() {
    if (imagesList.length <= 1) return
    setActiveImageIndex((prev) => (prev === imagesList.length - 1 ? 0 : prev + 1))
  }

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
    const itemName = selectedColor ? `${product.name} (${selectedColor})` : product.name
    addItem({
      id: product.id,
      product_id: product.id,
      name: itemName,
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
    const colorText = selectedColor ? `🎨 Color: ${selectedColor}\n` : ''
    const text = `Hola *${tenantName}*, tengo una consulta sobre este producto de su catálogo:\n\n` +
      `📦 *${product.name}*\n` +
      colorText +
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
        <Link href={`/${tenantSlug}`} prefetch={true} className="hover:text-blue-600 transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Catálogo
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[240px]">
          {product.name}
        </span>
      </nav>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Lado Izquierdo: Galería interactiva + Descripción debajo */}
        <div className="lg:col-span-7 space-y-6">
          {/* Contenedor de Imagen Principal */}
          <div className="relative group">
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
                  className="zoom-image object-contain p-4 transition-transform duration-200"
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

              {/* Botones de navegación prev/next sobre la imagen principal */}
              {imagesList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 shadow-md backdrop-blur-xs transition active:scale-90"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 shadow-md backdrop-blur-xs transition active:scale-90"
                    aria-label="Siguiente foto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Contador de fotos */}
                  <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold backdrop-blur-xs">
                    {activeImageIndex + 1} / {imagesList.length}
                  </div>
                </>
              )}

              {/* Badge de Zoom */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 text-[11px] font-semibold text-slate-600 dark:text-slate-300 backdrop-blur-xs pointer-events-none shadow-xs">
                <ZoomIn className="w-3.5 h-3.5" />
                Pasa el cursor para zoom
              </div>

              {/* Estado de stock */}
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 shadow-xs border border-slate-100 dark:border-slate-800">
                {outOfStock ? '🔴 Agotado' : `🟢 Disponible (${product.stock_quantity ?? 'Stock activo'})`}
              </div>
            </div>
          </div>

          {/* Carrusel / Scroll Horizontal de Miniaturas para PC y Móvil */}
          {imagesList.length > 1 && (
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => scrollThumbnails('left')}
                className="hidden sm:flex p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs mr-2 flex-shrink-0"
                aria-label="Desplazar a la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={thumbnailsRef}
                className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-none w-full"
                style={{ scrollbarWidth: 'thin' }}
              >
                {imagesList.map((imgSrc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 snap-start transition-all cursor-pointer border-2 ${
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

              <button
                type="button"
                onClick={() => scrollThumbnails('right')}
                className="hidden sm:flex p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs ml-2 flex-shrink-0"
                aria-label="Desplazar a la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* DESCRIPCIÓN DEL PRODUCTO COLOCADA ABAJO DE LAS IMÁGENES */}
          {cleanDescription && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Descripción y Detalles del Producto
                </h2>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                  {cleanDescription}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lado Derecho: Ficha Comercial y Acciones */}
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

          {/* Selector de Color (si el producto tiene variantes de color) */}
          {colors.length > 0 && (
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                  Color:
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {colors.map((c) => {
                  const isSelected = selectedColor === c.name
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleSelectColor(c)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 ring-2 ring-blue-400/40'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {c.hex && (
                        <span
                          className="w-3 h-3 rounded-full border border-black/20"
                          style={{ backgroundColor: c.hex }}
                        />
                      )}
                      <span>{c.name}</span>
                    </button>
                  )
                })}
              </div>
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

      {/* Productos Relacionados con enlaces SKU */}
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
            {relatedProducts.map((rel) => {
              const relSlug = encodeURIComponent(rel.sku || rel.id)
              return (
                <Link
                  key={rel.id}
                  href={`/${tenantSlug}/p/${relSlug}`}
                  prefetch={true}
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
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import type { Product } from '@/types/database'
import { 
  X, 
  Loader2, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Link as LinkIcon, 
  Star, 
  Plus, 
  AlertCircle,
  Sparkles,
  Palette,
  AlertTriangle
} from 'lucide-react'

interface ColorVariantItem {
  name: string
  hex?: string
  image_url?: string
}

export interface ApparelAttributes {
  garmentType?: string
  gender?: string
  sizes: string[]
}

function parseApparelAttributes(desc?: string | null): { cleanDescription: string; apparel: ApparelAttributes } {
  if (!desc) return { cleanDescription: '', apparel: { sizes: [] } }
  const match = desc.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/)
  if (!match) {
    return { cleanDescription: desc, apparel: { sizes: [] } }
  }
  try {
    const apparel = JSON.parse(match[1]) as ApparelAttributes
    const cleanDescription = desc
      .replace(/<!--APPAREL_ATTRIBUTES:(.*?)-->/, '')
      .replace(/^🏷️[^\n]+\n\n?/, '')
      .trim()
    return {
      cleanDescription,
      apparel: {
        garmentType: apparel.garmentType || '',
        gender: apparel.gender || '',
        sizes: Array.isArray(apparel.sizes) ? apparel.sizes : [],
      },
    }
  } catch {
    return { cleanDescription: desc, apparel: { sizes: [] } }
  }
}

function parseColorVariants(desc?: string | null): { baseDescription: string; colors: ColorVariantItem[] } {
  if (!desc) return { baseDescription: '', colors: [] }
  const match = desc.match(/<!--COLOR_VARIANTS:(.*?)-->/)
  if (!match) return { baseDescription: desc, colors: [] }
  try {
    const colors = JSON.parse(match[1]) as ColorVariantItem[]
    const baseDescription = desc.replace(/<!--COLOR_VARIANTS:(.*?)-->/, '').trim()
    return { baseDescription, colors: Array.isArray(colors) ? colors : [] }
  } catch {
    return { baseDescription: desc, colors: [] }
  }
}

interface Props {
  product: Product | null
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 900
        const MAX_HEIGHT = 900
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width))
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height))
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        resolve(dataUrl)
      }
      img.onerror = () => resolve(e.target?.result as string)
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ProductModal({ product, onClose, onSaved, onDeleted }: Props) {
  const { tenant, exchangeRate } = useTenant()
  const isEditing = product !== null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorFileInputRef = useRef<HTMLInputElement>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)
  const [modalDeleteError, setModalDeleteError] = useState<string | null>(null)

  async function handleDeleteFromModal() {
    if (!product?.id) return
    setDeletingProduct(true)
    setModalDeleteError(null)
    try {
      const res = await fetch(`/api/admin/products?id=${product.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al eliminar el producto')
      }
      setShowDeleteConfirm(false)
      if (onDeleted) onDeleted()
      else onClose()
    } catch (e: unknown) {
      setModalDeleteError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setDeletingProduct(false)
    }
  }

  const parsedInitial = parseColorVariants(product?.description)
  const parsedApparel = parseApparelAttributes(parsedInitial.baseDescription)

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(parsedApparel.cleanDescription)
  const [sku, setSku] = useState(product?.sku ?? '')
  const [priceUsd, setPriceUsd] = useState(product?.base_price_usd?.toString() ?? '')
  const [costUsd, setCostUsd] = useState(product?.cost_usd?.toString() ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [isActive, setIsActive] = useState(product?.is_active ?? true)

  // Rubro Ropa / Calzado (Especializado)
  const isFashionRubro =
    (tenant?.settings as Record<string, unknown>)?.rubro === 'moda' ||
    tenant?.slug === 'emeve-vzla'

  const [showApparelSection, setShowApparelSection] = useState(
    Boolean(isFashionRubro || parsedApparel.apparel.garmentType || parsedApparel.apparel.sizes.length > 0)
  )
  const [apparelGarmentType, setApparelGarmentType] = useState(parsedApparel.apparel.garmentType || '')
  const [apparelGender, setApparelGender] = useState(parsedApparel.apparel.gender || '')
  const [apparelSizes, setApparelSizes] = useState<string[]>(parsedApparel.apparel.sizes || [])
  const [customSizeInput, setCustomSizeInput] = useState('')

  // Variantes de color
  const [colors, setColors] = useState<ColorVariantItem[]>(parsedInitial.colors)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [targetColorIndexForUpload, setTargetColorIndexForUpload] = useState<number | null>(null)

  // Múltiples fotos
  const initialImages: string[] = (() => {
    if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images as string[]
    }
    if (product?.image_url) {
      return [product.image_url]
    }
    return []
  })()

  const [images, setImages] = useState<string[]>(initialImages)
  const [urlInput, setUrlInput] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // IA Categorización & Código
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string
    suggestedSku: string
  } | null>(null)

  // Confirmación al salir para no perder datos
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const price = parseFloat(priceUsd) || 0
  const cost = parseFloat(costUsd) || 0
  const priceVes = price * exchangeRate
  const margin = price > 0 && cost > 0 ? (((price - cost) / price) * 100).toFixed(1) : null

  // Verificar si hay datos modificados (dirty state)
  const isDirty = !isEditing
    ? Boolean(name.trim() || description.trim() || sku.trim() || priceUsd || costUsd || images.length > 0 || colors.length > 0)
    : Boolean(
        name !== product.name ||
        description !== parsedInitial.baseDescription ||
        sku !== (product.sku || '') ||
        priceUsd !== (product.base_price_usd?.toString() || '') ||
        images.length !== initialImages.length ||
        colors.length !== parsedInitial.colors.length
      )

  function handleRequestClose() {
    if (isDirty) {
      setShowExitConfirm(true)
    } else {
      onClose()
    }
  }

  async function handleAskAiCategorize() {
    if (!name.trim()) {
      setError('Escribe primero el nombre del producto para que la IA lo categorice.')
      return
    }
    setAiSuggesting(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          tenantId: tenant?.id,
          tenantSlug: tenant?.slug,
        }),
      })

      const data = await res.json()
      if (data.success && data.suggestedSku) {
        setAiSuggestion({
          category: data.category,
          suggestedSku: data.suggestedSku,
        })
      } else {
        setError(data.error || 'No se pudo sugerir código.')
      }
    } catch {
      setError('Error al conectar con el servicio de IA.')
    } finally {
      setAiSuggesting(false)
    }
  }

  function handleApplyAiSuggestion() {
    if (!aiSuggestion) return
    setSku(aiSuggestion.suggestedSku)
    setAiSuggestion(null)
  }

  async function handleFilesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    setError(null)

    try {
      const newImages: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        const compressed = await compressImage(file)
        newImages.push(compressed)
      }

      setImages((prev) => [...prev, ...newImages])
    } catch {
      setError('Error al procesar una o más imágenes.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleAddUrl() {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    setImages((prev) => [...prev, trimmed])
    setUrlInput('')
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSetPrimary(index: number) {
    setImages((prev) => {
      const copy = [...prev]
      const [selected] = copy.splice(index, 1)
      return [selected, ...copy]
    })
  }

  // Métodos para colores
  function handleAddColor(colorName?: string, hex?: string) {
    const nameToAdd = (colorName || newColorName).trim()
    if (!nameToAdd) return
    if (colors.some((c) => c.name.toLowerCase() === nameToAdd.toLowerCase())) return

    setColors((prev) => [
      ...prev,
      {
        name: nameToAdd,
        hex: hex || newColorHex,
        image_url: undefined,
      },
    ])
    setNewColorName('')
  }

  function handleRemoveColor(index: number) {
    setColors((prev) => prev.filter((_, i) => i !== index))
  }

  function handleAssignColorImage(colorIndex: number, imageUrl: string) {
    setColors((prev) => {
      const updated = [...prev]
      updated[colorIndex] = { ...updated[colorIndex], image_url: imageUrl }
      return updated
    })
  }

  async function handleColorFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || targetColorIndexForUpload === null) return
    try {
      const compressed = await compressImage(files[0])
      setImages((prev) => (prev.includes(compressed) ? prev : [...prev, compressed]))
      handleAssignColorImage(targetColorIndexForUpload, compressed)
    } catch {
      setError('Error al procesar la foto para el color.')
    } finally {
      setTargetColorIndexForUpload(null)
      if (colorFileInputRef.current) colorFileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) {
      setError('No hay una tienda activa seleccionada.')
      return
    }
    setLoading(true)
    setError(null)

    // Combinar imágenes de variantes y fotos generales
    const allImages = [...images]
    colors.forEach((c) => {
      if (c.image_url && !allImages.includes(c.image_url)) {
        allImages.push(c.image_url)
      }
    })

    const primaryImage = allImages[0] || null

    // Serializar atributos de moda y variantes de color dentro de description
    let baseDesc = description
      .replace(/<!--COLOR_VARIANTS:(.*?)-->/, '')
      .replace(/<!--APPAREL_ATTRIBUTES:(.*?)-->/, '')
      .replace(/^🏷️[^\n]+\n\n?/, '')
      .trim()

    // Si tiene atributos de ropa/calzado, generar la etiqueta estructurada y la insignia legible
    if (apparelGarmentType || apparelGender || apparelSizes.length > 0) {
      const apparelData: ApparelAttributes = {
        garmentType: apparelGarmentType || undefined,
        gender: apparelGender || undefined,
        sizes: apparelSizes,
      }
      const badgeParts = []
      if (apparelGarmentType) badgeParts.push(apparelGarmentType)
      if (apparelGender) badgeParts.push(apparelGender)
      if (apparelSizes.length > 0) badgeParts.push(`Tallas: ${apparelSizes.join(', ')}`)

      const badgeLine = badgeParts.length > 0 ? `🏷️ ${badgeParts.join(' | ')}\n\n` : ''
      baseDesc = `<!--APPAREL_ATTRIBUTES:${JSON.stringify(apparelData)}-->\n${badgeLine}${baseDesc}`
    }

    const finalDescription = colors.length > 0
      ? `${baseDesc}\n\n<!--COLOR_VARIANTS:${JSON.stringify(colors)}-->`
      : baseDesc

    const payload = {
      tenant_id: tenant.id,
      name: name.trim(),
      description: finalDescription || null,
      sku: sku.trim() || null,
      base_price_usd: price,
      cost_usd: cost || null,
      stock: parseInt(stock) || 0,
      is_active: isActive,
      image_url: primaryImage,
      images: allImages,
    }

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          id: isEditing ? product!.id : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || 'Error al guardar el producto.')
        setLoading(false)
        return
      }

      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de red o conexión'
      setError(`Error inesperado: ${msg}`)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop con confirmación si está dirty */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={handleRequestClose} />

      {/* Modal de confirmación al salir sin guardar */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Descartar cambios?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hay información ingresada que se perderá si sales ahora.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false)
                  onClose()
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
              >
                Descartar y salir
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        style={{ width: '100%', maxWidth: '720px', maxHeight: '92vh' }}
        className="relative z-10 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-all my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tienda: <span className="font-semibold text-blue-600 dark:text-blue-400">{tenant?.name}</span>
            </p>
          </div>
          <button 
            type="button"
            onClick={handleRequestClose} 
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs font-medium">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">{error}</div>
              </div>
            )}

            {/* SECCIÓN 1: NOMBRE & CATEGORIZACIÓN IA */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Nombre del Producto *
                  </label>
                  <button
                    type="button"
                    onClick={handleAskAiCategorize}
                    disabled={aiSuggesting || !name.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                    title="Analizar nombre con IA para sugerir categoría y código automático"
                  >
                    {aiSuggesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>Sugerir Código con IA</span>
                  </button>
                </div>
                <input 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if (!sku && name.trim().length >= 4 && !aiSuggestion) {
                      handleAskAiCategorize()
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  placeholder="Ej. Altavoz Sony Extra Bass Bluetooth" 
                />
              </div>

              {/* Banner de sugerencia IA si está disponible */}
              {aiSuggestion && (
                <div className="col-span-2 flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-blue-600 text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Categoría: <strong className="text-blue-700 dark:text-blue-300">{aiSuggestion.category}</strong>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Código automático asignado: <strong className="font-mono text-indigo-700 dark:text-indigo-300 text-xs">{aiSuggestion.suggestedSku}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleApplyAiSuggestion}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition active:scale-95 shadow-xs cursor-pointer"
                    >
                      Aplicar Código
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSuggestion(null)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Descripción
                </label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Detalles, especificaciones o compatibilidad…" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  SKU / Código de Producto
                </label>
                <input 
                  value={sku} 
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono font-bold"
                  placeholder="Ej. ALT-001" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Stock Disponible
                </label>
                <input 
                  type="number" 
                  min="0" 
                  value={stock} 
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Precio Base (USD) *
                </label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={priceUsd} 
                  onChange={(e) => setPriceUsd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  placeholder="0.00" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Costo (USD)
                </label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={costUsd} 
                  onChange={(e) => setCostUsd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="0.00" 
                />
              </div>
            </div>

            {/* SECCIÓN ESPECIALIZADA: RUBRO ROPA & CALZADO */}
            {(isFashionRubro || showApparelSection) && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/30 dark:from-slate-800/90 dark:to-slate-800/50 border border-pink-200/80 dark:border-slate-700 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-sm shadow-xs">
                      👗
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Rubro Ropa & Calzado (Especializado)
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Categorización por tipo de prenda, género y tallas para tu tienda
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300 border border-pink-200 dark:border-pink-900">
                    Moda & Calzado
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* 1. Tipo de Prenda o Calzado */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tipo de Prenda / Calzado:
                    </label>
                    <select
                      value={apparelGarmentType}
                      onChange={(e) => setApparelGarmentType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="">-- Seleccionar Categoría --</option>
                      <optgroup label="Prendas de Vestir">
                        <option value="Franelas & Camisetas">👕 Franelas & Camisetas</option>
                        <option value="Camisas & Blusas">👔 Camisas & Blusas</option>
                        <option value="Pantalones & Jeans">👖 Pantalones & Jeans</option>
                        <option value="Shorts & Bermudas">🩳 Shorts & Bermudas</option>
                        <option value="Vestidos & Faldas">👗 Vestidos & Faldas</option>
                        <option value="Chaquetas & Sweaters">🧥 Chaquetas & Sweaters</option>
                        <option value="Ropa Deportiva / Fitness">🏃 Ropa Deportiva / Fitness</option>
                        <option value="Ropa Interior & Pijamas">🩲 Ropa Interior & Pijamas</option>
                      </optgroup>
                      <optgroup label="Calzado">
                        <option value="Calzado Deportivo / Sneakers">👟 Sneakers / Zapatillas Deportivas</option>
                        <option value="Calzado Casual & Zapatos">👞 Calzado Casual / Zapatos</option>
                        <option value="Sandalias & Pantuflas">👡 Sandalias & Pantuflas</option>
                        <option value="Botas & Botines">👢 Botas & Botines</option>
                        <option value="Tacones">👠 Tacones & Plataformas</option>
                      </optgroup>
                      <optgroup label="Accesorios de Moda">
                        <option value="Carteras & Bolsos">👜 Carteras, Bolsos & Mochilas</option>
                        <option value="Gorras & Sombreros">🧢 Gorras & Sombreros</option>
                        <option value="Cinturones & Billeteras">👛 Cinturones & Billeteras</option>
                        <option value="Joyería & Relojes">💍 Joyería & Relojes</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* 2. Público / Género */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Público / Género:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {['Hombre', 'Mujer', 'Unisex', 'Niño', 'Niña'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setApparelGender(apparelGender === g ? '' : g)}
                          className={`py-1.5 px-2 rounded-xl text-center text-xs font-bold transition cursor-pointer ${
                            apparelGender === g
                              ? 'bg-pink-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {g === 'Hombre' && '👨 Hombre'}
                          {g === 'Mujer' && '👩 Mujer'}
                          {g === 'Unisex' && '⚧️ Unisex'}
                          {g === 'Niño' && '👦 Niño'}
                          {g === 'Niña' && '👧 Niña'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Tallas Disponibles (Multi-selección) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Tallas Disponibles ({apparelSizes.length} seleccionadas):
                    </label>
                    {apparelSizes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setApparelSizes([])}
                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Limpiar tallas
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Selector de Tallas Ropa */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-400 mr-1">Ropa:</span>
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => {
                        const isSelected = apparelSizes.includes(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setApparelSizes((prev) =>
                                isSelected ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }}
                            className={`min-w-8 h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>

                    {/* Selector de Tallas Calzado */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 mr-1">Calzado:</span>
                      {['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'].map((sz) => {
                        const isSelected = apparelSizes.includes(sz)
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => {
                              setApparelSizes((prev) =>
                                isSelected ? prev.filter((x) => x !== sz) : [...prev, sz]
                              )
                            }}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {sz}
                          </button>
                        )
                      })}
                    </div>

                    {/* Entrada personalizada de talla */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Otra talla personalizada (ej. Talla única, 32x34, 6 meses)…"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (customSizeInput.trim() && !apparelSizes.includes(customSizeInput.trim())) {
                              setApparelSizes((p) => [...p, customSizeInput.trim()])
                              setCustomSizeInput('')
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customSizeInput.trim() && !apparelSizes.includes(customSizeInput.trim())) {
                            setApparelSizes((p) => [...p, customSizeInput.trim()])
                            setCustomSizeInput('')
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition cursor-pointer"
                      >
                        + Añadir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 2: VARIANTES DE COLOR Y FOTOS POR COLOR */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Colores y Fotos por Color ({colors.length})
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Opcional: configura los colores disponibles y asigna la foto correspondiente a cada color.
                  </p>
                </div>
              </div>

              {/* Botones de sugerencia rápida de colores */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-semibold mr-1">Rápido:</span>
                {[
                  { name: 'Negro', hex: '#000000' },
                  { name: 'Blanco', hex: '#FFFFFF' },
                  { name: 'Azul', hex: '#2563EB' },
                  { name: 'Rojo', hex: '#DC2626' },
                  { name: 'Gris', hex: '#64748B' },
                  { name: 'Plateado', hex: '#94A3B8' },
                  { name: 'Dorado', hex: '#EAB308' },
                  { name: 'Verde', hex: '#16A34A' },
                ].map((pre) => (
                  <button
                    key={pre.name}
                    type="button"
                    onClick={() => handleAddColor(pre.name, pre.hex)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] hover:border-blue-400 transition"
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: pre.hex }} />
                    <span>+ {pre.name}</span>
                  </button>
                ))}
              </div>

              {/* Input personalizado de color */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                  title="Seleccionar tono de color"
                />
                <input
                  type="text"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Otro color (ej. Morado Neón)…"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleAddColor()}
                  disabled={!newColorName.trim()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Agregar Color
                </button>
              </div>

              {/* Lista de colores configurados */}
              {colors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {colors.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {c.hex && (
                            <span
                              className="w-4 h-4 rounded-full border border-black/20 flex-shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                          )}
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {c.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Miniatura de foto asignada */}
                          {c.image_url ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetColorIndexForUpload(idx)
                                colorFileInputRef.current?.click()
                              }}
                              className="px-2 py-1 rounded-lg border border-dashed border-blue-400 text-blue-600 dark:text-blue-400 text-[10px] font-semibold hover:bg-blue-50 transition"
                            >
                              + Foto
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveColor(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition"
                            title="Eliminar color"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input oculto para subir foto por color */}
              <input
                ref={colorFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleColorFileUpload}
                className="hidden"
              />
            </div>

            {/* SECCIÓN 3: FOTOGRAFÍAS MÚLTIPLES */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Fotos del Producto ({images.length})
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Puedes subir varias fotos. La primera será la portada principal del catálogo.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      imageInputMode === 'upload'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Subir Fotos
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      imageInputMode === 'url'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Por URL
                  </button>
                </div>
              </div>

              {imageInputMode === 'upload' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFilesUpload}
                    className="hidden"
                    id="product-images-input"
                  />
                  <label
                    htmlFor="product-images-input"
                    className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                      uploadingImage
                        ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        <span className="text-xs font-semibold text-blue-600">Optimizando y procesando imágenes…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400" />
                        <div className="text-center">
                          <span className="font-bold text-xs text-blue-600 dark:text-blue-400">Haz clic para seleccionar fotos</span>
                          <span className="text-slate-400 text-xs"> o arrastra archivos aquí</span>
                        </div>
                        <span className="text-[10px] text-slate-400">PNG, JPG, WEBP — Se comprimen automáticamente</span>
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/foto-producto.jpg"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 text-xs font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir
                  </button>
                </div>
              )}

              {/* Tira / Galería de fotos añadidas */}
              {images.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {images.map((imgSrc, index) => (
                      <div 
                        key={index}
                        className="group relative aspect-square rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                      >
                        <img 
                          src={imgSrc} 
                          alt={`Foto ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Badge Principal */}
                        {index === 0 && (
                          <div className="absolute top-1 left-1 flex items-center gap-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            Principal
                          </div>
                        )}

                        {/* Overlay de acciones */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          {index !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(index)}
                              title="Hacer foto principal"
                              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            title="Eliminar foto"
                            className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live preview de precios */}
            {price > 0 && (
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-4 py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Precio en Bolívares (Tasa BCV)</p>
                  <p className="font-extrabold text-blue-700 dark:text-blue-400 text-base">
                    Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {margin !== null && (
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Margen Comercial</p>
                    <p className={`font-extrabold text-base ${parseFloat(margin) >= 20 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {margin}%
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <input 
                type="checkbox" 
                id="active" 
                checked={isActive} 
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer" 
              />
              <label htmlFor="active" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                Producto activo (visible en el catálogo de la tienda)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
                title="Eliminar este producto permanentemente"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Producto</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button 
                type="button" 
                onClick={handleRequestClose}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading || uploadingImage}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all duration-200 disabled:opacity-60 shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando en base de datos…
                  </>
                ) : (
                  isEditing ? 'Guardar Cambios' : 'Crear Producto'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de confirmación para eliminar producto desde el modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Eliminar producto?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Se eliminará permanentemente &quot;{product?.name}&quot; del inventario y del catálogo.
                </p>
              </div>
            </div>

            {modalDeleteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 text-rose-700 text-xs font-semibold">
                {modalDeleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingProduct}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingProduct}
                onClick={handleDeleteFromModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
              >
                {deletingProduct ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando…</span>
                  </>
                ) : (
                  <span>Sí, Eliminar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
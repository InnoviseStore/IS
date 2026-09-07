'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  AlertCircle 
} from 'lucide-react'

interface Props {
  product: Product | null
  onClose: () => void
  onSaved: () => void
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

export function ProductModal({ product, onClose, onSaved }: Props) {
  const { tenant, exchangeRate } = useTenant()
  const isEditing = product !== null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [priceUsd, setPriceUsd] = useState(product?.base_price_usd?.toString() ?? '')
  const [costUsd, setCostUsd] = useState(product?.cost_usd?.toString() ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [isActive, setIsActive] = useState(product?.is_active ?? true)

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

  const price = parseFloat(priceUsd) || 0
  const cost = parseFloat(costUsd) || 0
  const priceVes = price * exchangeRate
  const margin = price > 0 && cost > 0 ? (((price - cost) / price) * 100).toFixed(1) : null

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) {
      setError('No hay una tienda activa seleccionada.')
      return
    }
    setLoading(true)
    setError(null)

    const primaryImage = images[0] || null
    const payload = {
      tenant_id: tenant.id,
      name: name.trim(),
      description: description.trim() || null,
      sku: sku.trim() || null,
      base_price_usd: price,
      cost_usd: cost || null,
      stock: parseInt(stock) || 0,
      is_active: isActive,
      image_url: primaryImage,
      images: images,
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
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div 
        style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh' }}
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
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-medium">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">{error}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Nombre del Producto *
                </label>
                <input 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  placeholder="Ej. Protector de Pantalla Cerámica iPhone 15" 
                />
              </div>

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
                  SKU / Código
                </label>
                <input 
                  value={sku} 
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                  placeholder="IS-001" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
                  Stock Inicial
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

            {/* SECCIÓN FOTOGRAFÍAS MÚLTIPLES */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Fotos del Producto ({images.length})
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Puedes subir varias fotos. La primera será la portada principal.
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
                    Enlace URL
                  </button>
                </div>
              </div>

              {/* Controles para agregar imágenes */}
              {imageInputMode === 'upload' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFilesUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer transition bg-white/60 dark:bg-slate-900/60 group"
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-1.5 py-1 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-[11px] font-semibold">Procesando y optimizando fotos…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        <Upload className="w-6 h-6 mb-0.5" />
                        <span className="font-bold text-xs">Haz clic para seleccionar 1 o varias fotos</span>
                        <span className="text-[10px] text-slate-400">JPG, PNG, WEBP — Se comprimen automáticamente</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/imagen.jpg"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddUrl()
                        }
                      }}
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
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Precio en Bolívares</p>
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
                Producto activo (visible en la vitrina pública)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
            <button 
              type="button" 
              onClick={onClose}
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
        </form>
      </div>
    </div>
  )
}
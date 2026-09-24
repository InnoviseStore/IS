'use client'

import { useState, useRef } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { getTenantFeatures } from '@/lib/planLimits'
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
  AlertTriangle,
  Tag,
  Barcode,
  Camera,
  Check,
  Layers,
} from 'lucide-react'
import {
  detectCategory,
  extractCategory,
  extractSubcategory,
  cleanCategoryName,
  cleanSubcategoryName,
  cleanProductDescription,
  getRubroCategories,
  extractBrand,
  injectBrandIntoDescription,
} from '@/lib/categories'
import { getProductBarcode, injectBarcodeIntoDescription } from '@/lib/barcodeUtils'

import { parseColorVariants, type ColorVariantItem } from '@/lib/colorVariants'

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

interface Props {
  product: Product | null
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
  currentProductCount?: number
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

export function ProductModal({ product, onClose, onSaved, onDeleted, currentProductCount }: Props) {
  const { tenant, exchangeRate } = useTenant()
  const isEditing = product !== null
  const features = getTenantFeatures(tenant)
  const isOverProductLimit = !isEditing && features.maxProducts !== Infinity && (currentProductCount ?? 0) >= features.maxProducts
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

  const rubro = ((tenant?.settings as Record<string, unknown>)?.rubro as string) || 'tecnologia'
  const isFashionRubro = rubro === 'moda' || tenant?.slug === 'emeve-vzla'

  const parsedInitial = parseColorVariants(product?.description)
  const parsedApparel = parseApparelAttributes(parsedInitial.baseDescription)

  const initialCategory = product
    ? (extractCategory(product.description) || detectCategory(product.name, product.description))
    : ''
  const initialSubcategory = product ? extractSubcategory(product.description) || '' : ''

  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(cleanCategoryName(initialCategory === 'General' ? '' : initialCategory))
  const [subcategory, setSubcategory] = useState(cleanSubcategoryName(initialSubcategory))
  const [description, setDescription] = useState(cleanProductDescription(parsedApparel.cleanDescription))
  const [sku, setSku] = useState(product?.sku ?? '')
  const [brand, setBrand] = useState(extractBrand(product?.description) || '')
  const initialBarcode = getProductBarcode(product) || ''
  const [barcode, setBarcode] = useState(initialBarcode)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [scannerStatus, setScannerStatus] = useState<string | null>(null)
  const barcodeScannerRef = useRef<any>(null)
  const [priceUsd, setPriceUsd] = useState(product?.base_price_usd?.toString() ?? '')
  const [costUsd, setCostUsd] = useState(product?.cost_usd?.toString() ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [isActive, setIsActive] = useState(product?.is_active ?? true)

  // Rubro Ropa / Calzado (Especializado) - Exclusivo para tiendas de moda
  const showApparelSection = isFashionRubro
  const [apparelGarmentType, setApparelGarmentType] = useState(isFashionRubro ? (parsedApparel.apparel.garmentType || '') : '')
  const [apparelGender, setApparelGender] = useState(isFashionRubro ? (parsedApparel.apparel.gender || '') : '')
  const [apparelSizes, setApparelSizes] = useState<string[]>(isFashionRubro ? (parsedApparel.apparel.sizes || []) : [])
  const [customSizeInput, setCustomSizeInput] = useState('')

  // Variantes de color
  const [colors, setColors] = useState<ColorVariantItem[]>(parsedInitial.colors)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [newColorStock, setNewColorStock] = useState('')
  const [newColorImageUrl, setNewColorImageUrl] = useState('')
  const [showNewColorUrlInput, setShowNewColorUrlInput] = useState(false)
  const [targetColorIndexForUpload, setTargetColorIndexForUpload] = useState<number | null>(null)
  const [colorPhotoModal, setColorPhotoModal] = useState<{
    index: number
    name: string
    currentUrl?: string
  } | null>(null)
  const [colorUrlInput, setColorUrlInput] = useState('')

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

  // IA Categorización & Código & Descripción
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string
    suggestedSku: string
  } | null>(null)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  // Confirmación al salir para no perder datos
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const price = parseFloat(priceUsd) || 0
  const cost = parseFloat(costUsd) || 0
  const priceVes = price * exchangeRate
  const margin = price > 0 && cost > 0 ? (((price - cost) / price) * 100).toFixed(1) : null

  // Sonido y háptico
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 980
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch {}
  }

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 20, 40])
      }
    } catch {}
  }

  const stopBarcodeScanner = async () => {
    if (barcodeScannerRef.current) {
      try {
        await barcodeScannerRef.current.stop()
        await barcodeScannerRef.current.clear()
      } catch (e) {
        console.warn('Error closing barcode scanner:', e)
      } finally {
        barcodeScannerRef.current = null
      }
    }
    setShowBarcodeScanner(false)
    setScannerStatus(null)
  }

  const startBarcodeScanner = async () => {
    setShowBarcodeScanner(true)
    setScannerStatus('Iniciando cámara...')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      setTimeout(async () => {
        const elementId = 'product-modal-barcode-viewport'
        const el = document.getElementById(elementId)
        if (!el) return

        if (!barcodeScannerRef.current) {
          barcodeScannerRef.current = new Html5Qrcode(elementId)
        }
        const qr = barcodeScannerRef.current
        if (qr.isScanning) return

        await qr.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 250, height: 160 },
            aspectRatio: 1.33,
          },
          (decodedText: string) => {
            const clean = decodedText.trim()
            if (clean) {
              playBeep()
              triggerHaptic()
              setBarcode(clean)
              setScannerStatus(`¡Código capturado: ${clean}!`)
              setTimeout(() => {
                stopBarcodeScanner()
              }, 400)
            }
          },
          () => {}
        )
        setScannerStatus('Apunta la cámara al código de barras del producto...')
      }, 150)
    } catch (err: any) {
      setScannerStatus('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
    }
  }

  // Verificar si hay datos modificados (dirty state)
  const isDirty = !isEditing
    ? Boolean(name.trim() || description.trim() || sku.trim() || barcode.trim() || priceUsd || costUsd || images.length > 0 || colors.length > 0)
    : Boolean(
        name !== product.name ||
        description !== parsedInitial.baseDescription ||
        sku !== (product.sku || '') ||
        barcode !== initialBarcode ||
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
          rubro,
        }),
      })

      const data = await res.json()
      if (data.success && data.suggestedSku) {
        const cleanCat = cleanCategoryName(data.category)
        if (cleanCat && !category.trim()) {
          setCategory(cleanCat)
        }
        if (data.subcategory && !subcategory.trim()) {
          setSubcategory(cleanSubcategoryName(data.subcategory))
        }
        setAiSuggestion({
          category: cleanCat,
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
    if (aiSuggestion.category) {
      setCategory(cleanCategoryName(aiSuggestion.category))
    }
    setAiSuggestion(null)
  }

  async function handleGenerateAiDescription() {
    if (!name.trim()) {
      setError('Escribe primero el nombre del producto para generar su descripción con IA.')
      return
    }
    setGeneratingDescription(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: cleanCategoryName(category.trim()) || aiSuggestion?.category || (isFashionRubro ? apparelGarmentType : undefined),
          subcategory: cleanSubcategoryName(subcategory.trim()) || undefined,
          barcode: barcode.trim() || undefined,
          sku: sku.trim() || undefined,
          priceUsd: priceUsd ? parseFloat(priceUsd) : undefined,
          apparelAttributes: isFashionRubro ? {
            garmentType: apparelGarmentType,
            gender: apparelGender,
            sizes: apparelSizes,
          } : undefined,
          colors: colors.map((c) => ({ name: c.name, hex: c.hex })),
          tenantId: tenant?.id,
          tenantSlug: tenant?.slug,
          rubro,
        }),
      })

      const data = await res.json()
      if (data.success && data.description) {
        setDescription(cleanProductDescription(data.description))
      } else {
        setError(data.error || 'No se pudo generar la descripción con IA.')
      }
    } catch {
      setError('Error al conectar con el generador de descripciones IA.')
    } finally {
      setGeneratingDescription(false)
    }
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
  function handleAddColor(colorName?: string, hex?: string, initialStock?: number, initialImageUrl?: string) {
    const nameToAdd = (colorName || newColorName).trim()
    if (!nameToAdd) return
    if (colors.some((c) => c.name.toLowerCase() === nameToAdd.toLowerCase())) return

    let stockVal: number | undefined = undefined
    if (initialStock !== undefined) {
      stockVal = initialStock
    } else if (newColorStock.trim() !== '') {
      const parsed = parseInt(newColorStock.trim(), 10)
      if (!isNaN(parsed) && parsed >= 0) stockVal = parsed
    }

    const imgToAssign = initialImageUrl || newColorImageUrl.trim() || undefined

    setColors((prev) => [
      ...prev,
      {
        name: nameToAdd,
        hex: hex || newColorHex,
        stock: stockVal,
        image_url: imgToAssign,
      },
    ])

    if (imgToAssign && !images.includes(imgToAssign)) {
      setImages((prev) => [...prev, imgToAssign])
    }

    setNewColorName('')
    setNewColorStock('')
    setNewColorImageUrl('')
    setShowNewColorUrlInput(false)
  }

  function handleUpdateColorStock(index: number, val: string) {
    setColors((prev) => {
      const copy = [...prev]
      if (val.trim() === '') {
        copy[index] = { ...copy[index], stock: undefined }
      } else {
        const parsed = parseInt(val, 10)
        copy[index] = { ...copy[index], stock: isNaN(parsed) ? undefined : Math.max(0, parsed) }
      }
      return copy
    })
  }

  const totalColorStock = colors.reduce((acc, c) => acc + (typeof c.stock === 'number' ? c.stock : 0), 0)
  const hasAnyColorStock = colors.some((c) => typeof c.stock === 'number')

  function handleSyncTotalStockFromColors() {
    setStock(totalColorStock.toString())
  }

  function handleRemoveColor(index: number) {
    setColors((prev) => prev.filter((_, i) => i !== index))
  }

  function handleAssignColorImage(colorIndex: number, imageUrl: string) {
    setColors((prev) => {
      const updated = [...prev]
      updated[colorIndex] = { ...updated[colorIndex], image_url: imageUrl || undefined }
      return updated
    })
  }

  function openColorPhotoModal(index: number) {
    const item = colors[index]
    if (!item) return
    setColorPhotoModal({
      index,
      name: item.name,
      currentUrl: item.image_url,
    })
    setColorUrlInput(item.image_url || '')
  }

  function handleSaveColorUrl() {
    if (!colorPhotoModal) return
    const trimmed = colorUrlInput.trim()
    handleAssignColorImage(colorPhotoModal.index, trimmed)
    if (trimmed && !images.includes(trimmed)) {
      setImages((prev) => [...prev, trimmed])
    }
    setColorPhotoModal(null)
    setColorUrlInput('')
  }

  function handleRemoveColorImage(index: number) {
    handleAssignColorImage(index, '')
    if (colorPhotoModal && colorPhotoModal.index === index) {
      setColorPhotoModal((prev) => prev ? { ...prev, currentUrl: undefined } : null)
      setColorUrlInput('')
    }
  }

  async function handleColorFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    const targetIdx = targetColorIndexForUpload ?? colorPhotoModal?.index ?? null
    if (!files || files.length === 0 || targetIdx === null) return
    try {
      const compressed = await compressImage(files[0])
      setImages((prev) => (prev.includes(compressed) ? prev : [...prev, compressed]))
      handleAssignColorImage(targetIdx, compressed)
      if (colorPhotoModal) {
        setColorPhotoModal((prev) => prev ? { ...prev, currentUrl: compressed } : null)
      }
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

    const features = getTenantFeatures(tenant)
    if (!product && features.maxProducts !== Infinity) {
      // Validar si el tenant ya tiene 150 productos
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
        if ((count ?? 0) >= features.maxProducts) {
          setError(`Has alcanzado el límite de ${features.maxProducts} productos del ${features.name}. Para agregar más productos solicita la actualización a Plan Pro al administrador.`)
          return
        }
      } catch (err) {
        console.warn('Could not check product limit:', err)
      }
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

    // Serializar categoría, subcategoría, atributos de moda y variantes dentro de description
    let baseDesc = cleanProductDescription(description)

    // Si tiene marca asignada
    if (brand.trim()) {
      baseDesc = injectBrandIntoDescription(baseDesc, brand.trim())
    }

    // Si tiene subcategoría explícita asignada
    if (subcategory.trim()) {
      baseDesc = `<!--SUBCATEGORY:${cleanSubcategoryName(subcategory)}-->\n${baseDesc}`
    }

    // Si tiene categoría explícita asignada
    if (category.trim()) {
      baseDesc = `<!--CATEGORY:${cleanCategoryName(category)}-->\n${baseDesc}`
    }

    // Si tiene atributos de ropa/calzado y la tienda es del rubro moda
    if (isFashionRubro && (apparelGarmentType || apparelGender || apparelSizes.length > 0)) {
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

    const finalDescriptionWithBarcode = injectBarcodeIntoDescription(finalDescription, barcode)

    const payload = {
      tenant_id: tenant.id,
      name: name.trim(),
      description: finalDescriptionWithBarcode || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
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

            {isOverProductLimit && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs">Límite de {features.maxProducts} productos alcanzado</p>
                  <p className="text-[11px] leading-relaxed">
                    Tu tienda se encuentra en el <strong>{features.name}</strong>, el cual permite hasta {features.maxProducts} productos activos. Para seguir agregando productos ilimitados, solicita la actualización a <strong>Plan Pro</strong> al Administrador.
                  </p>
                </div>
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

              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Descripción del Producto
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAiDescription}
                    disabled={generatingDescription || !name.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 font-bold text-xs transition disabled:opacity-50 cursor-pointer border border-purple-200/80 dark:border-purple-800/60 shadow-xs"
                    title="Generar una descripción comercial y atractiva con IA basada en el producto"
                  >
                    {generatingDescription ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                        <span>Generando con IA…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Generar Descripción con IA ✨</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm resize-y leading-relaxed font-normal"
                  placeholder="Detalles, especificaciones o redacta con IA…" 
                />
              </div>

              {/* CATEGORÍA Y SUBCATEGORÍA DEL PRODUCTO ADAPTADAS AL RUBRO */}
              {(() => {
                const rubroCats = getRubroCategories(rubro)
                const currentCatConfig = rubroCats.find(
                  (c) => c.name.toLowerCase() === category.toLowerCase().trim()
                )
                const activeSubcategories = currentCatConfig ? currentCatConfig.subcategories : []

                return (
                  <div className="col-span-2 space-y-3 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                    {/* Campo Categoría */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          <Tag className="w-3.5 h-3.5 text-blue-500" />
                          Categoría Principal
                        </label>
                        {category && (
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                            {cleanCategoryName(category)}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list="product-categories-list"
                          value={category}
                          onChange={(e) => setCategory(cleanCategoryName(e.target.value))}
                          placeholder="Ej. Audio & Sonido, Cargadores, Frenos, Franelas..."
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                        />
                        <datalist id="product-categories-list">
                          {rubroCats.map((rc) => (
                            <option key={rc.name} value={rc.name} />
                          ))}
                        </datalist>
                      </div>
                      {/* Sugerencias de categorías del rubro */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sugerencias:</span>
                        {rubroCats.slice(0, 6).map((rc) => (
                          <button
                            key={rc.name}
                            type="button"
                            onClick={() => {
                              setCategory(rc.name)
                              if (rc.subcategories.length > 0 && !subcategory) {
                                setSubcategory(rc.subcategories[0])
                              }
                            }}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border transition cursor-pointer ${
                              category.toLowerCase() === rc.name.toLowerCase()
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                            }`}
                          >
                            {rc.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Campo Subcategoría */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          Subcategoría (Opcional para organizar mejor)
                        </label>
                        {subcategory && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                            {cleanSubcategoryName(subcategory)}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list="product-subcategories-list"
                          value={subcategory}
                          onChange={(e) => setSubcategory(cleanSubcategoryName(e.target.value))}
                          placeholder={activeSubcategories[0] ? `Ej. ${activeSubcategories[0]}` : "Especifica una subcategoría..."}
                          className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-semibold"
                        />
                        <datalist id="product-subcategories-list">
                          {activeSubcategories.map((sub) => (
                            <option key={sub} value={sub} />
                          ))}
                        </datalist>
                      </div>
                      {/* Sugerencias de subcategorías */}
                      {activeSubcategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Subcategorías:</span>
                          {activeSubcategories.map((subName) => (
                            <button
                              key={subName}
                              type="button"
                              onClick={() => setSubcategory(subName)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                subcategory.toLowerCase() === subName.toLowerCase()
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              {subName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Identificadores: SKU, Marca y Código de Barras */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Código / SKU
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Interno</span>
                  </div>
                  <input 
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono font-bold"
                    placeholder="Ej. AUD-001" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Marca</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Opcional</span>
                  </div>
                  <input 
                    value={brand} 
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                    placeholder="Ej. SKF, Apple, Toyota..." 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Código de Barras</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Opcional</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input 
                        value={barcode} 
                        onChange={(e) => setBarcode(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono font-bold"
                        placeholder="7591234567890" 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={startBarcodeScanner}
                      className="px-2.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                      title="Escanear con cámara"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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

            {/* SECCIÓN ESPECIALIZADA: RUBRO ROPA & CALZADO (Sólo para tiendas de Moda & Calzado) */}
            {isFashionRubro && (
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
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800 shrink-0"
                  title="Seleccionar tono de color"
                />
                <input
                  type="text"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Nombre de color (ej. Morado Neón)…"
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    value={newColorStock}
                    onChange={(e) => setNewColorStock(e.target.value)}
                    placeholder="Stock (opcional)"
                    className="w-24 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-center"
                    title="Cantidad disponible para este color"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewColorUrlInput(!showNewColorUrlInput)}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      showNewColorUrlInput || newColorImageUrl.trim()
                        ? 'bg-blue-50 border-blue-400 text-blue-600 dark:bg-blue-950/60 dark:border-blue-700'
                        : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                    }`}
                    title="Asignar foto por URL a este color"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Foto URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddColor()}
                    disabled={!newColorName.trim()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* Input opcional de URL para el nuevo color */}
              {showNewColorUrlInput && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-in fade-in duration-150">
                  <LinkIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <input
                    type="url"
                    value={newColorImageUrl}
                    onChange={(e) => setNewColorImageUrl(e.target.value)}
                    placeholder="URL de foto para este color (ej. https://ejemplo.com/foto-color.jpg)…"
                    className="flex-1 px-2.5 py-1 text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-200 font-medium"
                  />
                  {newColorImageUrl.trim() && (
                    <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 shrink-0">
                      <img
                        src={newColorImageUrl.trim()}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Lista de colores configurados */}
              {colors.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {colors.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
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

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Input de Stock por Color */}
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Stock:</span>
                            <input
                              type="number"
                              min="0"
                              value={c.stock ?? ''}
                              onChange={(e) => handleUpdateColorStock(idx, e.target.value)}
                              placeholder="0"
                              className="w-12 text-center text-xs font-black text-slate-900 dark:text-white bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded"
                              title={`Cantidad en stock de ${c.name}`}
                            />
                          </div>

                          {/* Miniatura de foto asignada o botón para asignar por URL/archivo */}
                          {c.image_url ? (
                            <div
                              onClick={() => openColorPhotoModal(idx)}
                              className="relative group/cimg w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-2xs"
                              title="Clic para cambiar foto, editar URL o quitar"
                            >
                              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cimg:opacity-100 flex items-center justify-center text-white transition text-[9px]">
                                <Camera className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openColorPhotoModal(idx)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-blue-400 text-blue-600 dark:text-blue-400 text-[10px] font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                              title="Asignar foto por URL o archivo"
                            >
                              <LinkIcon className="w-2.5 h-2.5" />
                              <span>+ Foto</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveColor(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                            title="Eliminar color"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de cantidades y botón sincronizar stock general */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40">
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <span>Total unidades en colores: </span>
                      <strong className="text-blue-700 dark:text-blue-300 font-black">{totalColorStock}</strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                        ({colors.length} {colors.length === 1 ? 'color' : 'colores'})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSyncTotalStockFromColors}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer self-start sm:self-auto"
                      title="Actualizar el campo 'Stock Disponible' del producto con la suma de las cantidades por color"
                    >
                      <span>Sincronizar Stock General ({totalColorStock})</span>
                    </button>
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
                disabled={loading || uploadingImage || isOverProductLimit}
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

      {/* Modal flotante de Escaneo de Código de Barras con Cámara */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Escanear Código de Barras
                </h4>
              </div>
              <button
                type="button"
                onClick={stopBarcodeScanner}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <div id="product-modal-barcode-viewport" className="w-full h-full" />
              {/* Mira visual */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-28 border-2 border-emerald-400/80 rounded-xl shadow-lg relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-500/70 animate-pulse" />
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              {scannerStatus || 'Apunta la cámara del dispositivo al código de barras del producto.'}
            </p>

            <button
              type="button"
              onClick={stopBarcodeScanner}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition"
            >
              Cancelar Escaneo
            </button>
          </div>
        </div>
      )}

      {/* Modal flotante de Asignación de Foto a Color (Por URL, archivo o galería) */}
      {colorPhotoModal && (
        <div 
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setColorPhotoModal(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full border border-black/20 shrink-0" 
                  style={{ backgroundColor: colors[colorPhotoModal.index]?.hex || '#000000' }} 
                />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Foto para color: <span className="text-blue-600 dark:text-blue-400">{colorPhotoModal.name}</span>
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setColorPhotoModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opción 1: Pegar URL */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Pegar enlace o URL de imagen:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={colorUrlInput}
                  onChange={(e) => setColorUrlInput(e.target.value)}
                  placeholder="https://ejemplo.com/foto-de-este-color.jpg"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
                <button
                  type="button"
                  onClick={handleSaveColorUrl}
                  disabled={!colorUrlInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  Guardar
                </button>
              </div>

              {/* Vista previa de URL */}
              {colorUrlInput.trim() && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shrink-0">
                    <img 
                      src={colorUrlInput.trim()} 
                      alt="Vista previa" 
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Vista previa de enlace</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">{colorUrlInput.trim()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span>Otras opciones</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Opción 2: Subir archivo */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Subir foto desde el dispositivo / cámara</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetColorIndexForUpload(colorPhotoModal.index)
                  colorFileInputRef.current?.click()
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
              >
                Elegir Archivo
              </button>
            </div>

            {/* Opción 3: Elegir de la galería principal del producto */}
            {images.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                  Elegir de las fotos del producto ({images.length}):
                </span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        handleAssignColorImage(colorPhotoModal.index, img)
                        setColorPhotoModal(null)
                        setColorUrlInput('')
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer hover:scale-105 ${
                        colors[colorPhotoModal.index]?.image_url === img
                          ? 'border-blue-600 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      title="Usar esta foto para este color"
                    >
                      <img src={img} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pie de modal con opción de quitar foto */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              {colors[colorPhotoModal.index]?.image_url ? (
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveColorImage(colorPhotoModal.index)
                    setColorPhotoModal(null)
                  }}
                  className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar foto actual</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400">Sin foto asignada</span>
              )}
              <button
                type="button"
                onClick={() => setColorPhotoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
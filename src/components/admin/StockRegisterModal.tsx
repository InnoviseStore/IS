'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { Product } from '@/types/database'
import {
  X,
  Camera,
  Barcode,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  Save,
  Package,
  History,
  Tag,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Volume2,
  HelpCircle
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  exchangeRate: number
  allProducts: Product[]
  onStockUpdated: (updatedProduct: Product) => void
}

interface SessionAdjustment {
  id: string
  productName: string
  sku: string | null
  previousStock: number
  newStock: number
  difference: number
  reason: string
  time: string
}

export function StockRegisterModal({
  isOpen,
  onClose,
  tenantId,
  exchangeRate,
  allProducts,
  onStockUpdated,
}: Props) {
  // Pestañas principales
  const [activeTab, setActiveTab] = useState<'barcode' | 'ai' | 'search'>('barcode')

  // Producto actualmente seleccionado para verificar y ajustar
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Estado del conteo y ajuste
  const [countMode, setCountMode] = useState<'set' | 'delta'>('set')
  const [targetStockInput, setTargetStockInput] = useState<string>('')
  const [deltaValue, setDeltaValue] = useState<number>(0)
  const [adjustmentReason, setAdjustmentReason] = useState<string>('audit')
  const [notesInput, setNotesInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null)

  // Historial de la sesión de conteo
  const [sessionLogs, setSessionLogs] = useState<SessionAdjustment[]>([])
  const [showSessionLogs, setShowSessionLogs] = useState<boolean>(false)

  // ─── Pestaña 1: Escáner de Código de Barras (Cámara) ───
  const [isScannerRunning, setIsScannerRunning] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [manualBarcodeInput, setManualBarcodeInput] = useState('')
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const html5QrCodeRef = useRef<any>(null)

  // ─── Pestaña 2: IA por Foto ───
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null)
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [aiDetectedInfo, setAiDetectedInfo] = useState<{
    brand?: string | null
    model?: string | null
    code?: string | null
    description?: string | null
    keywords?: string[]
  } | null>(null)
  const [aiMatches, setAiMatches] = useState<{
    product: Product
    score: number
    match_reason: string
  }[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Pestaña 3: Búsqueda Manual ───
  const [manualSearch, setManualSearch] = useState('')

  // Efecto de sonido (Beep) mediante Web Audio API
  const playBeep = useCallback((freq = 880, duration = 0.12) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Ignorar si el navegador bloquea audio antes de interacción
    }
  }, [])

  // Vibración háptica móvil
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 20, 40])
      }
    } catch {
      // Ignorar si no está disponible
    }
  }, [])

  // Iniciar o detener la cámara según la pestaña activa
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current && isScannerRunning) {
      try {
        await html5QrCodeRef.current.stop()
        await html5QrCodeRef.current.clear()
      } catch (e) {
        console.warn('Error al detener escáner:', e)
      } finally {
        setIsScannerRunning(false)
      }
    }
  }, [isScannerRunning])

  const startCamera = useCallback(async () => {
    setScannerError(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const elementId = 'stock-barcode-scanner-viewport'
      const el = document.getElementById(elementId)
      if (!el) return

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(elementId)
      }

      const qr = html5QrCodeRef.current
      if (qr.isScanning) {
        return
      }

      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.33,
        },
        (decodedText: string) => {
          handleBarcodeScanned(decodedText)
        },
        () => {
          // Frame sin lectura, normal en scanning
        }
      )
      setIsScannerRunning(true)
    } catch (err: any) {
      console.warn('Error al iniciar cámara de código de barras:', err)
      setScannerError(
        err?.message?.includes('Permission')
          ? 'Permiso de cámara denegado. Permite el acceso a la cámara en los ajustes de tu navegador.'
          : 'No se pudo activar la cámara. Puedes escribir el código manualmente o buscar por nombre.'
      )
      setIsScannerRunning(false)
    }
  }, [])

  // Gestionar inicio y apagado de cámara
  useEffect(() => {
    if (isOpen && activeTab === 'barcode' && !selectedProduct) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, activeTab, selectedProduct])

  // Cuando se detecta un código de barras
  const handleBarcodeScanned = useCallback(
    (code: string) => {
      const cleanCode = code.trim()
      if (!cleanCode) return
      setLastScannedCode(cleanCode)
      playBeep(980, 0.15)
      triggerHaptic()

      // Buscar coincidencia en productos de la tienda por SKU o ID
      const normCode = cleanCode.toLowerCase()
      const found = allProducts.find(
        (p) =>
          (p.sku && p.sku.toLowerCase() === normCode) ||
          p.id.toLowerCase() === normCode ||
          p.name.toLowerCase().includes(normCode)
      )

      if (found) {
        selectProductForAudit(found)
      } else {
        setScannerError(`Código "${cleanCode}" leído, pero no coincide con ningún SKU registrado. Puedes asignarlo o buscarlo manualmente.`)
      }
    },
    [allProducts, playBeep, triggerHaptic]
  )

  // Seleccionar producto para auditar y ajustar
  function selectProductForAudit(product: Product) {
    setSelectedProduct(product)
    setTargetStockInput(String(product.stock))
    setDeltaValue(0)
    setAdjustmentReason('audit')
    setNotesInput('')
    setSaveSuccessMsg(null)
    setSaveErrorMsg(null)
  }

  // Procesar imagen con IA
  async function handleImageCapture(file: File) {
    setIsAiAnalyzing(true)
    setAiError(null)
    setAiMatches([])
    setAiDetectedInfo(null)

    // Generar vista previa
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Url = e.target?.result as string
      setAiImagePreview(base64Url)

      try {
        // 1. Intentar escanear código de barras directamente de la foto en el cliente
        try {
          const { Html5Qrcode } = await import('html5-qrcode')
          const qrScanner = new Html5Qrcode('ai-dummy-scanner')
          const barcodeResult = await qrScanner.scanFile(file, true)
          if (barcodeResult) {
            console.log('Código detectado en foto:', barcodeResult)
            const matched = allProducts.find(
              (p) => p.sku && p.sku.toLowerCase() === barcodeResult.toLowerCase().trim()
            )
            if (matched) {
              playBeep(1040, 0.2)
              triggerHaptic()
              selectProductForAudit(matched)
              setIsAiAnalyzing(false)
              return
            }
          }
        } catch {
          // Continuar con IA si no hay código de barras legible en la foto
        }

        // 2. Invocar endpoint inteligente de visión e inventario
        const res = await fetch('/api/ai/product-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Url,
            tenantId,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo analizar la fotografía.')
        }

        setAiDetectedInfo(data.detected || null)
        const matches = (data.matches || []) as {
          product: Product
          score: number
          match_reason: string
        }[]
        setAiMatches(matches)

        if (matches.length === 0) {
          setAiError('No se encontraron coincidencias directas en tu inventario. Intenta una foto más clara de la etiqueta o busca por texto.')
        } else if (matches.length === 1 && matches[0].score >= 90) {
          playBeep(880, 0.15)
          triggerHaptic()
        }
      } catch (err: any) {
        setAiError(err.message || 'Error al procesar la imagen con IA.')
      } finally {
        setIsAiAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Guardar ajuste de stock
  async function handleSaveAdjustment() {
    if (!selectedProduct) return
    setIsSaving(true)
    setSaveErrorMsg(null)
    setSaveSuccessMsg(null)

    try {
      const payload: any = {
        product_id: selectedProduct.id,
        tenant_id: tenantId,
        adjustment_type: countMode,
        reason: adjustmentReason,
        notes: notesInput.trim(),
      }

      if (countMode === 'set') {
        const targetNum = parseInt(targetStockInput, 10)
        if (isNaN(targetNum) || targetNum < 0) {
          throw new Error('Por favor ingresa un conteo físico válido (0 o mayor).')
        }
        payload.new_stock = targetNum
      } else {
        if (deltaValue === 0) {
          throw new Error('El valor a sumar o restar no puede ser 0.')
        }
        payload.delta = deltaValue
      }

      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al guardar el ajuste de stock.')
      }

      playBeep(1200, 0.2)
      triggerHaptic()

      const updatedProd = data.product as Product
      onStockUpdated(updatedProd)

      // Agregar al historial de la sesión
      const newLog: SessionAdjustment = {
        id: Math.random().toString(),
        productName: updatedProd.name,
        sku: updatedProd.sku,
        previousStock: data.previous_stock,
        newStock: data.new_stock,
        difference: data.difference,
        reason: adjustmentReason,
        time: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }
      setSessionLogs((prev) => [newLog, ...prev])

      setSaveSuccessMsg(
        `✓ "${updatedProd.name}" ajustado: de ${data.previous_stock} a ${data.new_stock} unid. (${data.difference >= 0 ? '+' : ''}${data.difference})`
      )

      // Regresar al modo escaneo después de 1.2s para auditar el siguiente producto
      setTimeout(() => {
        setSelectedProduct(null)
        setSaveSuccessMsg(null)
      }, 1200)
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Error al guardar el ajuste.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtrar productos para búsqueda manual
  const filteredManualProducts = allProducts.filter((p) => {
    if (!manualSearch.trim()) return true
    const q = manualSearch.toLowerCase().trim()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    )
  })

  if (!isOpen) return null

  // Calcular diferencia en vivo para el modo 'set'
  const currentStock = selectedProduct ? selectedProduct.stock : 0
  const parsedTarget = parseInt(targetStockInput, 10)
  const diffInSet = isNaN(parsedTarget) ? 0 : parsedTarget - currentStock
  const computedFinalStock = countMode === 'set' ? (isNaN(parsedTarget) ? currentStock : parsedTarget) : currentStock + deltaValue

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Contenedor del Modal: Pantalla completa en móviles, tarjeta flotante amplia en tablets/PC */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 dark:border-slate-800">
        
        {/* Cabecera Móvil/Desktop */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  Registrar Inventario
                </h2>
                <span className="hidden xs:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  Toma & Ajuste
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Auditoría rápida por código de barras, foto con IA o búsqueda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación de éxito global */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 animate-in fade-in shadow-inner">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Pestañas de Métodos de Entrada (Visibles cuando no se está editando un producto) */}
        {!selectedProduct && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 p-1.5 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('barcode')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'barcode'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Código Barras</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'ai'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Foto con IA</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'search'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Búsqueda</span>
            </button>
          </div>
        )}

        {/* Cuerpo con Scroll para Contenido Móvil */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* ════════════════════════════════════════════════════════════════════
              VISTA 1: FORMULARIO DE VERIFICACIÓN Y AJUSTE DE STOCK
              ════════════════════════════════════════════════════════════════════ */}
          {selectedProduct ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Tarjeta del Producto Seleccionado */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-slate-50/80 dark:from-slate-800/80 dark:via-indigo-950/20 dark:to-slate-900/80 border border-blue-200 dark:border-blue-900/60 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                      {selectedProduct.image_url ? (
                        <Image
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          width={56}
                          height={56}
                          unoptimized
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                        {selectedProduct.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selectedProduct.sku && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                            SKU: {selectedProduct.sku}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          ${selectedProduct.base_price_usd.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition"
                    title="Cambiar producto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Stock Actual en Sistema */}
                <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Stock en Sistema:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {selectedProduct.stock}
                    </span>
                    <span className="text-xs font-bold text-slate-500">unidades</span>
                  </div>
                </div>
              </div>

              {/* Selector de Modo de Ajuste */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setCountMode('set')}
                  className={`py-2 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer text-center ${
                    countMode === 'set'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Fijar Conteo Físico Real
                </button>
                <button
                  type="button"
                  onClick={() => setCountMode('delta')}
                  className={`py-2 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer text-center ${
                    countMode === 'delta'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Sumar / Restar (+ / -)
                </button>
              </div>

              {/* Controles de Conteo según Modo */}
              {countMode === 'set' ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ¿Cuántas unidades físicas hay en el anaquel o depósito?
                  </label>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={targetStockInput}
                      onChange={(e) => setTargetStockInput(e.target.value)}
                      placeholder="0"
                      autoFocus
                      className="w-full text-center text-3xl font-black py-3 px-4 rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    />
                  </div>

                  {/* Botones táctiles de conteo rápido para celular */}
                  <div className="flex items-center gap-1.5 justify-center flex-wrap pt-1">
                    {[0, 1, 2, 5, 10, 15, 20, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTargetStockInput(String(preset))}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs font-bold text-slate-700 dark:text-slate-300 transition active:scale-95"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Cálculo en vivo del Descuadre */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <span className="text-slate-500">Diferencia calculada:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-black ${
                        diffInSet > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          : diffInSet < 0
                          ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {diffInSet > 0 ? `+${diffInSet} unid. (Sobrante)` : diffInSet < 0 ? `${diffInSet} unid. (Faltante)` : 'Exacto (Sin cambios)'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Ajuste relativo (+ para agregar, - para restar):
                  </label>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setDeltaValue((prev) => prev - 1)}
                      className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black text-xl flex items-center justify-center active:scale-90 transition cursor-pointer"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="text-center min-w-[100px]">
                      <span className={`text-3xl font-black ${deltaValue > 0 ? 'text-emerald-600' : deltaValue < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
                        {deltaValue > 0 ? `+${deltaValue}` : deltaValue}
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">unidades</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeltaValue((prev) => prev + 1)}
                      className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-xl flex items-center justify-center active:scale-90 transition cursor-pointer"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Presets de suma y resta táctil */}
                  <div className="grid grid-cols-6 gap-1.5 pt-1">
                    {[-10, -5, -1, 1, 5, 10].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDeltaValue((prev) => prev + d)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition active:scale-95 border ${
                          d < 0
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                        }`}
                      >
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <span className="text-slate-500">Nuevo stock resultante:</span>
                    <span className="text-slate-900 dark:text-white font-black text-sm">
                      {Math.max(0, currentStock + deltaValue)} unidades
                    </span>
                  </div>
                </div>
              )}

              {/* Motivo y Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Motivo del Ajuste:
                  </label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="audit">Toma física de inventario (Auditoría)</option>
                    <option value="purchase">Recepción / Entrada de mercancía</option>
                    <option value="damage">Avería / Producto dañado / Merma</option>
                    <option value="correction">Corrección de descuadre</option>
                    <option value="manual">Ajuste manual de stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notas (Opcional):
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Ej. Anaquel 2, revisión nocturna..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {saveErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  disabled={isSaving || (countMode === 'delta' && deltaValue === 0)}
                  className="flex-[2] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando Ajuste...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Ajuste de Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════════════════
               VISTA 2: SELECCIÓN POR ESCÁNER, FOTO CON IA O BÚSQUEDA
               ════════════════════════════════════════════════════════════════════ */
            <>
              {/* TAB 1: CÓDIGO DE BARRAS POR CÁMARA */}
              {activeTab === 'barcode' && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-[4/3] max-h-[300px] flex items-center justify-center">
                    {/* Viewport de html5-qrcode */}
                    <div id="stock-barcode-scanner-viewport" className="w-full h-full" />

                    {/* Guía visual / retícula de escaneo */}
                    {isScannerRunning && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-44 border-2 border-emerald-400/90 rounded-2xl relative shadow-lg">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                          <div className="w-full h-0.5 bg-emerald-400/70 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-sm" />
                        </div>
                      </div>
                    )}

                    {!isScannerRunning && !scannerError && (
                      <div className="p-6 text-center text-slate-400 text-xs font-medium space-y-2">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                        <p>Iniciando cámara trasera para código de barras...</p>
                      </div>
                    )}

                    {scannerError && (
                      <div className="p-4 text-center text-rose-300 text-xs font-medium space-y-2 bg-black/80 max-w-sm">
                        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                        <p>{scannerError}</p>
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
                        >
                          Reintentar Cámara
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Input manual para pistolas láser USB/Bluetooth o tipeo rápido */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (manualBarcodeInput.trim()) {
                        handleBarcodeScanned(manualBarcodeInput.trim())
                        setManualBarcodeInput('')
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={manualBarcodeInput}
                        onChange={(e) => setManualBarcodeInput(e.target.value)}
                        placeholder="O ingresa código SKU / pistola lectora…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      Buscar
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: LECTURA CON IA POR FOTO */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  {/* Elemento oculto para escaneo por archivo */}
                  <div id="ai-dummy-scanner" className="hidden" />

                  {/* Botón táctil para tomar foto */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageCapture(file)
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAiAnalyzing}
                      className="p-6 rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer active:scale-98"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Tomar Foto al Producto o Caja
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          La IA detectará marca, modelo, código y descripción
                        </p>
                      </div>
                    </button>

                    {/* Previsualización de la foto */}
                    {aiImagePreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video sm:aspect-auto flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={aiImagePreview}
                          alt="Foto capturada"
                          width={200}
                          height={140}
                          unoptimized
                          className="object-contain w-full h-full max-h-40"
                        />
                        {isAiAnalyzing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-3 text-center">
                            <Loader2 className="w-7 h-7 animate-spin text-purple-400 mb-1.5" />
                            <p className="text-xs font-bold">Analizando imagen con IA...</p>
                            <p className="text-[10px] text-purple-200">Contrastando contra tu inventario</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                        <Sparkles className="w-8 h-8 text-amber-500 mb-2 opacity-80" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          Lectura Inteligente Multimodal
                        </p>
                        <p className="text-[11px] mt-1 text-slate-500">
                          Toma una foto clara a la etiqueta, empaque o producto para ver coincidencias.
                        </p>
                      </div>
                    )}
                  </div>

                  {aiError && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Datos Detectados por la IA */}
                  {aiDetectedInfo && (
                    <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-500 text-[11px] uppercase">Detectado:</span>
                      {aiDetectedInfo.brand && (
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 font-bold border border-slate-200 dark:border-slate-600 text-[11px]">
                          Marca: {aiDetectedInfo.brand}
                        </span>
                      )}
                      {aiDetectedInfo.code && (
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-bold border border-slate-200 dark:border-slate-600 text-[11px]">
                          Código: {aiDetectedInfo.code}
                        </span>
                      )}
                      {aiDetectedInfo.model && (
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px] truncate max-w-xs">
                          {aiDetectedInfo.model}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Coincidencias de Productos Encontradas */}
                  {aiMatches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Coincidencias en tu inventario ({aiMatches.length}):
                        </p>
                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                          Toca el producto para auditar stock
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aiMatches.map(({ product: p, score, match_reason }) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProductForAudit(p)}
                            className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:shadow-md transition text-left flex items-center gap-3 cursor-pointer group active:scale-98"
                          >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                              {p.image_url ? (
                                <Image
                                  src={p.image_url}
                                  alt={p.name}
                                  width={48}
                                  height={48}
                                  unoptimized
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                  {p.name}
                                </h4>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                                  score >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                }`}>
                                  {score}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-[11px]">
                                <span className="text-slate-500 font-mono">SKU: {p.sku || 'S/N'}</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                  Stock: {p.stock}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BÚSQUEDA MANUAL */}
              {activeTab === 'search' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Buscar por nombre, SKU o marca…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {filteredManualProducts.slice(0, 30).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProductForAudit(p)}
                        className="w-full p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 transition flex items-center justify-between gap-3 text-left cursor-pointer group active:scale-98"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                width={40}
                                height={40}
                                unoptimized
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              SKU: {p.sku || 'S/N'} · ${p.base_price_usd.toFixed(2)} USD
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${
                            p.stock < 3 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300' : p.stock < 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                          }`}>
                            {p.stock} unid.
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              HISTORIAL DE AJUSTES DE LA SESIÓN ACTUAL
              ════════════════════════════════════════════════════════════════════ */}
          {sessionLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSessionLogs(!showSessionLogs)}
                className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Historial de esta sesión ({sessionLogs.length} ajustes)</span>
                </div>
                {showSessionLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showSessionLogs && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1 animate-in fade-in">
                  {sessionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {log.productName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {log.time} · {log.previousStock} → <strong>{log.newStock} unid.</strong>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-[11px] shrink-0 ${
                          log.difference > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : log.difference < 0
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {log.difference > 0 ? `+${log.difference}` : log.difference}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Pie de modal con botón de cerrar */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Auditoría en vivo</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Finalizar Toma
          </button>
        </div>

      </div>
    </div>
  )
}

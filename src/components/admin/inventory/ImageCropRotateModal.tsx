'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Check,
  RefreshCw,
  Loader2,
  Maximize2,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  AlertCircle,
} from 'lucide-react'

interface ImageCropRotateModalProps {
  isOpen: boolean
  imageSrc: string
  title?: string
  onClose: () => void
  onApply: (editedDataUrl: string) => Promise<void> | void
}

type AspectPreset = 'free' | '1:1' | '4:5' | '4:3' | 'full'

interface CropRect {
  x: number // percentage 0..100
  y: number // percentage 0..100
  w: number // percentage 5..100
  h: number // percentage 5..100
}

export function ImageCropRotateModal({
  isOpen,
  imageSrc,
  title = 'Recortar y Girar Imagen',
  onClose,
  onApply,
}: ImageCropRotateModalProps) {
  const [loadingSource, setLoadingSource] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  // Imagen base segura en formato DataURL (libre de CORS)
  const [safeSourceUrl, setSafeSourceUrl] = useState<string | null>(null)
  // Imagen con rotación y volteo aplicados lista para recortar
  const [transformedUrl, setTransformedUrl] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 800, h: 800 })

  // Transformaciones de giro y volteo
  const [rotation90, setRotation90] = useState<number>(0) // 0, 90, 180, 270
  const [fineAngle, setFineAngle] = useState<number>(0) // -45 a 45
  const [flipH, setFlipH] = useState<boolean>(false)
  const [flipV, setFlipV] = useState<boolean>(false)

  // Recorte en coordenadas porcentuales (0 a 100) respecto a la imagen renderizada
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free')
  const [crop, setCrop] = useState<CropRect>({ x: 5, y: 5, w: 90, h: 90 })

  const imgContainerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null
    startX: number
    startY: number
    startCrop: CropRect
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startCrop: { x: 5, y: 5, w: 90, h: 90 },
  })

  // 1. Cargar imagen origen convirtiéndola a DataURL seguro para Canvas
  useEffect(() => {
    if (!isOpen || !imageSrc) return
    let cancelled = false

    async function loadSafeImage() {
      setLoadingSource(true)
      setLoadError(null)
      setRotation90(0)
      setFineAngle(0)
      setFlipH(false)
      setFlipV(false)
      setAspectPreset('free')
      setCrop({ x: 0, y: 0, w: 100, h: 100 })

      try {
        if (imageSrc.startsWith('data:image/')) {
          if (!cancelled) setSafeSourceUrl(imageSrc)
          return
        }

        // Intentar carga directa por fetch en navegador
        try {
          const resp = await fetch(imageSrc, { mode: 'cors' })
          if (resp.ok) {
            const blob = await resp.blob()
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            if (!cancelled) {
              setSafeSourceUrl(dataUrl)
              return
            }
          }
        } catch {
          // Si falla por CORS de servidor externo, usar proxy interno
        }

        const proxyRes = await fetch(`/api/admin/products/image-proxy?url=${encodeURIComponent(imageSrc)}`)
        const proxyJson = await proxyRes.json()
        if (!proxyRes.ok || !proxyJson.dataUrl) {
          throw new Error(proxyJson.error || 'No se pudo cargar la imagen para edición.')
        }
        if (!cancelled) {
          setSafeSourceUrl(proxyJson.dataUrl)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Error al cargar la imagen.')
        }
      } finally {
        if (!cancelled) setLoadingSource(false)
      }
    }

    loadSafeImage()
    return () => {
      cancelled = true
    }
  }, [isOpen, imageSrc])

  // 2. Recalcular la imagen transformada (giro 90° + ángulo fino + volteo) cada vez que cambian los controles
  useEffect(() => {
    if (!safeSourceUrl) return
    let cancelled = false

    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      const totalAngleDeg = rotation90 + fineAngle
      const rad = (totalAngleDeg * Math.PI) / 180

      const sin = Math.abs(Math.sin(rad))
      const cos = Math.abs(Math.cos(rad))

      // Dimensiones del bounding box rotado
      const srcW = img.naturalWidth || img.width || 800
      const srcH = img.naturalHeight || img.height || 800
      const MAX_WORK_DIM = 1100
      const scale = Math.min(1, MAX_WORK_DIM / Math.max(srcW, srcH))
      const w = Math.round(srcW * scale)
      const h = Math.round(srcH * scale)

      const outW = Math.round(w * cos + h * sin)
      const outH = Math.round(w * sin + h * cos)

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, outW, outH)

      ctx.save()
      ctx.translate(outW / 2, outH / 2)
      ctx.rotate(rad)
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.restore()

      const outDataUrl = canvas.toDataURL('image/jpeg', 0.9)
      if (!cancelled) {
        setNaturalSize({ w: outW, h: outH })
        setTransformedUrl(outDataUrl)
      }
    }
    img.src = safeSourceUrl

    return () => {
      cancelled = true
    }
  }, [safeSourceUrl, rotation90, fineAngle, flipH, flipV])

  // Aplicar preset de relación de aspecto
  const handleSelectAspect = useCallback(
    (preset: AspectPreset) => {
      setAspectPreset(preset)
      if (preset === 'full') {
        setCrop({ x: 0, y: 0, w: 100, h: 100 })
        return
      }
      if (preset === 'free') {
        setCrop({ x: 8, y: 8, w: 84, h: 84 })
        return
      }

      const targetRatio =
        preset === '1:1' ? 1 : preset === '4:5' ? 4 / 5 : 4 / 3
      const imgRatio = naturalSize.w / (naturalSize.h || 1)

      // En coordenadas porcentuales (0..100): (wPct * naturalW) / (hPct * naturalH) = targetRatio
      // => wPct / hPct = targetRatio / imgRatio
      const pctRatio = targetRatio / imgRatio
      let wPct = 82
      let hPct = wPct / pctRatio
      if (hPct > 86) {
        hPct = 86
        wPct = hPct * pctRatio
      }
      if (wPct > 90) {
        wPct = 90
        hPct = wPct / pctRatio
      }
      setCrop({
        x: Math.round((100 - wPct) / 2),
        y: Math.round((100 - hPct) / 2),
        w: Math.round(wPct),
        h: Math.round(hPct),
      })
    },
    [naturalSize]
  )

  // Manejo de arrastre táctil y mouse para el recuadro de recorte
  const handlePointerDown = (
    e: React.PointerEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragStateRef.current
    if (!state.mode || !imgContainerRef.current) return
    e.stopPropagation()
    e.preventDefault()

    const rect = imgContainerRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const dxPct = ((e.clientX - state.startX) / rect.width) * 100
    const dyPct = ((e.clientY - state.startY) / rect.height) * 100
    const s = state.startCrop
    const MIN_SIZE = 12

    if (state.mode === 'move') {
      const nextX = Math.max(0, Math.min(100 - s.w, s.x + dxPct))
      const nextY = Math.max(0, Math.min(100 - s.h, s.y + dyPct))
      setCrop({ ...s, x: nextX, y: nextY })
      return
    }

    let nextX = s.x
    let nextY = s.y
    let nextW = s.w
    let nextH = s.h

    if (state.mode.includes('e')) {
      nextW = Math.max(MIN_SIZE, Math.min(100 - s.x, s.w + dxPct))
    }
    if (state.mode.includes('s')) {
      nextH = Math.max(MIN_SIZE, Math.min(100 - s.y, s.h + dyPct))
    }
    if (state.mode.includes('w')) {
      const maxDeltaX = s.w - MIN_SIZE
      const clampedDx = Math.max(-s.x, Math.min(maxDeltaX, dxPct))
      nextX = s.x + clampedDx
      nextW = s.w - clampedDx
    }
    if (state.mode.includes('n')) {
      const maxDeltaY = s.h - MIN_SIZE
      const clampedDy = Math.max(-s.y, Math.min(maxDeltaY, dyPct))
      nextY = s.y + clampedDy
      nextH = s.h - clampedDy
    }

    setCrop({
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStateRef.current.mode) {
      e.stopPropagation()
      dragStateRef.current.mode = null
    }
  }

  // 3. Generar la imagen final recortada y rotada al confirmar
  const handleConfirmApply = async () => {
    if (!transformedUrl) return
    setIsApplying(true)
    setLoadError(null)

    try {
      const finalDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => {
          const srcW = img.naturalWidth || img.width
          const srcH = img.naturalHeight || img.height

          const cropX = Math.max(0, Math.round((crop.x / 100) * srcW))
          const cropY = Math.max(0, Math.round((crop.y / 100) * srcH))
          const cropW = Math.max(1, Math.min(srcW - cropX, Math.round((crop.w / 100) * srcW)))
          const cropH = Math.max(1, Math.min(srcH - cropY, Math.round((crop.h / 100) * srcH)))

          const MAX_OUT = 900
          const scale = Math.min(1, MAX_OUT / Math.max(cropW, cropH))
          const outW = Math.max(1, Math.round(cropW * scale))
          const outH = Math.max(1, Math.round(cropH * scale))

          const canvas = document.createElement('canvas')
          canvas.width = outW
          canvas.height = outH
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('No se pudo inicializar el lienzo de recorte.'))

          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, outW, outH)
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH)

          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => reject(new Error('Error al exportar la imagen recortada.'))
        img.src = transformedUrl
      })

      await onApply(finalDataUrl)
      onClose()
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Error al guardar el recorte.')
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gira la imagen o arrastra las esquinas del recuadro para recortar a tu gusto
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loadError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Área de Trabajo Visual (Canvas + Crop Box interactivo) */}
          <div className="relative w-full min-h-[280px] sm:min-h-[340px] max-h-[48vh] bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden p-3 select-none">
            {loadingSource ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <span className="text-xs font-semibold">Preparando imagen para edición...</span>
              </div>
            ) : transformedUrl ? (
              <div
                ref={imgContainerRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative inline-block max-h-[44vh] max-w-full touch-none select-none"
              >
                <img
                  src={transformedUrl}
                  alt="Vista previa editable"
                  draggable={false}
                  className="block max-h-[44vh] max-w-full w-auto h-auto object-contain pointer-events-none select-none"
                />

                {/* Recuadro de Recorte Interactivo */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.w}%`,
                    height: `${crop.h}%`,
                    boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.62)',
                  }}
                  className="absolute border-2 border-blue-400 cursor-move touch-none"
                >
                  {/* Guías de tercios (3x3) */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-white/30" />
                    <div className="border-r border-white/30" />
                    <div />
                  </div>

                  {/* Controles de Esquinas (NW, NE, SW, SE) */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'nw')}
                    className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nwse-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'ne')}
                    className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nesw-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'sw')}
                    className="absolute -bottom-2.5 -left-2.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nesw-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'se')}
                    className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nwse-resize"
                  />

                  {/* Controles de Lados (N, S, E, W) */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'n')}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 rounded-full bg-white/90 border border-blue-500 cursor-ns-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 rounded-full bg-white/90 border border-blue-500 cursor-ns-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'w')}
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 rounded-full bg-white/90 border border-blue-500 cursor-ew-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'e')}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 rounded-full bg-white/90 border border-blue-500 cursor-ew-resize"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Barra de Herramientas de Giro y Volteo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Girar y Voltear Imagen
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRotation90((prev) => (prev - 90 + 360) % 360)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Girar 90° a la izquierda"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>-90° Izq</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotation90((prev) => (prev + 90) % 360)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Girar 90° a la derecha"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>+90° Der</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((prev) => !prev)}
                  className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    flipH
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                  }`}
                  title="Voltear horizontalmente (Espejo)"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((prev) => !prev)}
                  className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    flipV
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                  }`}
                  title="Voltear verticalmente"
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Ajuste fino de inclinación */}
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-500 w-16">
                  Inclinación: {fineAngle}°
                </span>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={fineAngle}
                  onChange={(e) => setFineAngle(Number(e.target.value))}
                  className="flex-1 accent-blue-600 cursor-pointer h-1.5"
                />
                {fineAngle !== 0 && (
                  <button
                    type="button"
                    onClick={() => setFineAngle(0)}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    0°
                  </button>
                )}
              </div>
            </div>

            {/* Formato / Proporción de Recorte */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proporción de Recorte
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRotation90(0)
                    setFineAngle(0)
                    setFlipH(false)
                    setFlipV(false)
                    setAspectPreset('full')
                    setCrop({ x: 0, y: 0, w: 100, h: 100 })
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { id: 'free' as AspectPreset, label: 'Libre', icon: Crop },
                  { id: '1:1' as AspectPreset, label: '1:1', icon: Square },
                  { id: '4:5' as AspectPreset, label: '4:5', icon: RectangleVertical },
                  { id: '4:3' as AspectPreset, label: '4:3', icon: RectangleHorizontal },
                  { id: 'full' as AspectPreset, label: 'Todo', icon: Maximize2 },
                ].map((opt) => {
                  const IconComp = opt.icon
                  const active = aspectPreset === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectAspect(opt.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-[10px] font-bold transition cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/60 dark:bg-slate-950/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loadingSource || isApplying || !transformedUrl}
            onClick={handleConfirmApply}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aplicando y respaldando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Aplicar Recorte y Giro</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

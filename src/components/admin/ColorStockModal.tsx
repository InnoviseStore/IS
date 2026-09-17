'use client'

import { useMemo } from 'react'
import type { Product } from '@/types/database'
import { parseColorVariants, type ColorVariantItem } from '@/lib/colorVariants'
import { 
  X, 
  Palette, 
  Package, 
  Pencil, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Info 
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  onEditProduct?: (product: Product) => void
}

export function ColorStockModal({ isOpen, onClose, product, onEditProduct }: Props) {
  if (!isOpen || !product) return null

  const { colors } = useMemo(() => {
    return parseColorVariants(product.description)
  }, [product.description])

  const totalColorUnits = useMemo(() => {
    return colors.reduce((acc, c) => acc + (typeof c.stock === 'number' ? c.stock : 0), 0)
  }, [colors])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  Inventario Detallado
                </span>
                {product.sku && (
                  <span className="text-[11px] font-mono text-slate-400">#{product.sku}</span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate max-w-[280px] sm:max-w-md mt-0.5">
                {product.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Superior */}
        <div className="p-4 sm:p-5 grid grid-cols-3 gap-2.5 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800/60 border-b border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Colores</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{colors.length}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total en Colores</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{totalColorUnits} <span className="text-xs font-semibold text-slate-400">unds</span></span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stock General</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{product.stock} <span className="text-xs font-semibold text-slate-400">unds</span></span>
          </div>
        </div>

        {/* Listado de Colores con Stock */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {colors.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              Este producto no tiene colores habilitados actualmente.
            </div>
          ) : (
            <div className="space-y-2.5">
              {colors.map((c, idx) => {
                const stockVal = typeof c.stock === 'number' ? c.stock : 0
                const percent = totalColorUnits > 0 ? Math.round((stockVal / totalColorUnits) * 100) : 0

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                    OK ({stockVal})
                  </span>
                )
                if (stockVal === 0) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                      Agotado (0)
                    </span>
                  )
                } else if (stockVal < 3) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                      Bajo ({stockVal})
                    </span>
                  )
                }

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex flex-col gap-2 shadow-2xs hover:border-blue-400/60 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Círculo de color */}
                        {c.hex ? (
                          <span
                            className="w-5 h-5 rounded-full border border-black/20 shadow-xs shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                        )}

                        {/* Miniatura si tiene foto de variante */}
                        {c.image_url && (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                            <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {c.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            {typeof c.stock === 'number' ? c.stock : '—'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 ml-1">unds</span>
                        </div>
                        {statusBadge}
                      </div>
                    </div>

                    {/* Barra de proporción visual */}
                    {totalColorUnits > 0 && typeof c.stock === 'number' && (
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                          title={`${percent}% del total`}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {totalColorUnits !== product.stock && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Nota:</strong> La suma de los colores ({totalColorUnits} unds) difiere del stock general del producto ({product.stock} unds). Puedes hacer clic en &quot;Editar Producto&quot; para sincronizarlos automáticamente.
              </span>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cerrar
          </button>

          {onEditProduct && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onEditProduct(product)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar Producto / Ajustar Stock</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

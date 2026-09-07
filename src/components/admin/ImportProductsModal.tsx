'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportProductsModal({ isOpen, onClose, onSuccess }: Props) {
  const { tenant } = useTenant()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleImport() {
    if (!tenant || !csvText.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const lines = csvText.trim().split(/\r?\n/)
      if (lines.length <= 1) {
        throw new Error('El archivo o texto no tiene suficientes filas para procesar.')
      }

      // Detect header index
      const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      const nameIdx = headers.findIndex((h) => h.includes('nombre') || h.includes('name'))
      const skuIdx = headers.findIndex((h) => h.includes('sku') || h.includes('codigo'))
      const priceIdx = headers.findIndex((h) => h.includes('precio') || h.includes('price'))
      const costIdx = headers.findIndex((h) => h.includes('costo') || h.includes('cost'))
      const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('cantidad'))

      if (nameIdx === -1 || priceIdx === -1) {
        throw new Error('Las columnas mínimas requeridas son "Nombre" y "Precio".')
      }

      const rowsToInsert = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))

        const name = cols[nameIdx]
        const base_price_usd = parseFloat(cols[priceIdx]) || 0
        if (!name || base_price_usd <= 0) continue

        const sku = skuIdx !== -1 ? cols[skuIdx] || null : null
        const cost_usd = costIdx !== -1 ? parseFloat(cols[costIdx]) || null : null
        const stock = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : 0

        rowsToInsert.push({
          tenant_id: tenant.id,
          name,
          sku,
          base_price_usd,
          cost_usd,
          stock,
          is_active: true,
        })
      }

      if (rowsToInsert.length === 0) {
        throw new Error('No se encontraron filas con datos válidos para importar.')
      }

      const { error: insertErr } = await supabase.from('products').insert(rowsToInsert)
      if (insertErr) throw insertErr

      setResult({ count: rowsToInsert.length })
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 my-6 transition-all space-y-4 text-xs font-medium">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Importar Productos en Lote</h2>
            <p className="text-[11px] text-slate-500">Carga rápida de catálogo mediante CSV o texto tabulado</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              ¡Se importaron {result.count} productos exitosamente!
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                Formato esperado (primera línea como encabezados):
              </label>
              <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-all">
{`Nombre,SKU,Precio,Costo,Stock
Funda iPhone 15,FUND-15,12.00,4.50,25
Vidrio Templado,VID-01,5.00,1.20,50
Cargador Tipo C 20W,CARG-20,15.50,6.00,15`}
              </pre>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                Pega tus datos CSV o arrastra tu archivo:
              </label>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Pega aquí el contenido de tu hoja Excel guardada como CSV..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-mono text-[11px]"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || !csvText.trim()}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Importar Productos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

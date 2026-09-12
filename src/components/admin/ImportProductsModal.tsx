'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { 
  X, 
  UploadCloud, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileSpreadsheet, 
  Image as ImageIcon,
  Check,
  Eye,
  Trash2
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ParsedProductRow {
  name: string
  sku: string | null
  base_price_usd: number
  cost_usd: number | null
  stock: number
  category?: string
  gender?: string
  sizes?: string[]
  color?: string
  image_url?: string | null
  description?: string | null
}

export function ImportProductsModal({ isOpen, onClose, onSuccess }: Props) {
  const { tenant } = useTenant()
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // 1. Descargar Plantilla Excel Modelo (Formato CSV compatible con Excel en Windows)
  function handleDownloadTemplate() {
    const headers = [
      'Nombre',
      'SKU',
      'Precio_USD',
      'Costo_USD',
      'Stock',
      'Categoria',
      'Genero',
      'Tallas',
      'Color',
      'Imagen_URL',
      'Descripcion'
    ].join(',')

    const sampleRows = [
      'Franela Casual Oversize Cotton,FRA-001,22.50,11.00,20,Franelas & Camisetas,Unisex,"S, M, L, XL",Negro Lavado,https://images.unsplash.com/photo-1521572267360-ee0c2909d518,Franela 100% algodon peinado corte oversize',
      'Sneakers Urbanos Running Pro,CAL-002,48.00,24.00,15,Calzado Deportivo / Sneakers,Unisex,"38, 39, 40, 41, 42",Blanco,https://images.unsplash.com/photo-1542291026-7eec264c27ff,Zapatillas deportivas ligeras con amortiguacion y suela antideslizante',
      'Camisa Manga Larga Oxford,CAM-003,32.00,15.00,12,Camisas & Blusas,Hombre,"M, L, XL",Azul Celeste,https://images.unsplash.com/photo-1596755094514-f87e34085b2c,Camisa casual formal con botones ideal para oficina y salidas',
      'Vestido Estampado Verano,VES-004,29.00,14.00,10,Vestidos & Faldas,Mujer,"S, M",Floral,https://images.unsplash.com/photo-1572804013309-59a88b7e92f1,Vestido fresco de tela suave con estampado moderno'
    ].join('\r\n')

    // Prefijo BOM UTF-8 (\uFEFF) para que Excel en Windows interprete tildes y columnas con coma
    const csvContent = '\uFEFF' + headers + '\r\n' + sampleRows

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `plantilla_modelo_productos_${tenant?.slug ?? 'tienda'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 2. Parser inteligente de líneas CSV soportando comillas y delimitadores , o ;
  function parseCSVLine(text: string, delimiter: string = ','): string[] {
    const result: string[] = []
    let current = ''
    let insideQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      if (char === '"') {
        insideQuotes = !insideQuotes
      } else if (char === delimiter && !insideQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''))
    return result
  }

  // 3. Procesar el texto ingresado o archivo cargado
  function processCSV(rawText: string) {
    setError(null)
    setCsvText(rawText)

    const lines = rawText.trim().split(/\r?\n/)
    if (lines.length <= 1) {
      setParsedRows([])
      return
    }

    // Detectar delimitador (coma o punto y coma)
    const firstLine = lines[0]
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','

    const rawHeaders = parseCSVLine(firstLine, delimiter).map((h) => h.toLowerCase().trim())
    
    // Mapeo de índices de columnas
    const nameIdx = rawHeaders.findIndex((h) => h.includes('nombre') || h.includes('name') || h.includes('producto'))
    const skuIdx = rawHeaders.findIndex((h) => h.includes('sku') || h.includes('codigo') || h.includes('código'))
    const priceIdx = rawHeaders.findIndex((h) => h.includes('precio') || h.includes('price'))
    const costIdx = rawHeaders.findIndex((h) => h.includes('costo') || h.includes('cost'))
    const stockIdx = rawHeaders.findIndex((h) => h.includes('stock') || h.includes('cantidad') || h.includes('existencia'))
    const catIdx = rawHeaders.findIndex((h) => h.includes('categoria') || h.includes('categoría') || h.includes('prenda'))
    const genderIdx = rawHeaders.findIndex((h) => h.includes('genero') || h.includes('género') || h.includes('publico') || h.includes('público'))
    const sizesIdx = rawHeaders.findIndex((h) => h.includes('talla') || h.includes('sizes') || h.includes('size'))
    const colorIdx = rawHeaders.findIndex((h) => h.includes('color'))
    const imgIdx = rawHeaders.findIndex((h) => h.includes('imagen') || h.includes('image') || h.includes('foto') || h.includes('link'))
    const descIdx = rawHeaders.findIndex((h) => h.includes('descrip') || h.includes('detalle'))

    if (nameIdx === -1 || priceIdx === -1) {
      setError('La plantilla debe contener al menos las columnas "Nombre" y "Precio_USD".')
      setParsedRows([])
      return
    }

    const rows: ParsedProductRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const cols = parseCSVLine(line, delimiter)
      const name = cols[nameIdx]
      // Manejar formato de números con coma decimal o punto
      const rawPrice = (cols[priceIdx] || '').replace(',', '.')
      const price = parseFloat(rawPrice) || 0

      if (!name || price <= 0) continue

      const sku = skuIdx !== -1 && cols[skuIdx] ? cols[skuIdx] : null
      const rawCost = costIdx !== -1 && cols[costIdx] ? (cols[costIdx] || '').replace(',', '.') : null
      const cost = rawCost ? parseFloat(rawCost) || null : null
      const stock = stockIdx !== -1 && cols[stockIdx] ? parseInt(cols[stockIdx], 10) || 0 : 0
      
      const category = catIdx !== -1 ? cols[catIdx] : undefined
      const gender = genderIdx !== -1 ? cols[genderIdx] : undefined
      const rawSizes = sizesIdx !== -1 ? cols[sizesIdx] : undefined
      const sizes = rawSizes ? rawSizes.split(/[,/|]/).map((s) => s.trim()).filter(Boolean) : []
      const color = colorIdx !== -1 ? cols[colorIdx] : undefined
      const image_url = imgIdx !== -1 && cols[imgIdx]?.startsWith('http') ? cols[imgIdx].trim() : null
      const description = descIdx !== -1 ? cols[descIdx] : null

      rows.push({
        name,
        sku,
        base_price_usd: price,
        cost_usd: cost,
        stock,
        category,
        gender,
        sizes,
        color,
        image_url,
        description
      })
    }

    setParsedRows(rows)
    if (rows.length === 0) {
      setError('No se detectaron filas válidas. Revisa que el archivo contenga nombres y precios mayores a 0.')
    }
  }

  // 4. Manejar archivo seleccionado por el usuario
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      processCSV(text)
    }
    reader.readAsText(file)
  }

  // 5. Enviar a Supabase para inserción masiva
  async function handleConfirmImport() {
    if (!tenant || parsedRows.length === 0) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const rowsToInsert = parsedRows.map((r) => {
        // Estructurar atributos de moda y badges si aplica
        let finalDesc = r.description ? r.description.trim() : ''
        const hasApparel = r.category || r.gender || (r.sizes && r.sizes.length > 0) || r.color

        if (hasApparel) {
          const apparelData = {
            garmentType: r.category || undefined,
            gender: r.gender || undefined,
            sizes: r.sizes && r.sizes.length > 0 ? r.sizes : undefined,
            color: r.color || undefined
          }

          const badgeParts: string[] = []
          if (r.category) badgeParts.push(r.category)
          if (r.gender) badgeParts.push(r.gender)
          if (r.sizes && r.sizes.length > 0) badgeParts.push(`Tallas: ${r.sizes.join(', ')}`)
          if (r.color) badgeParts.push(`Color: ${r.color}`)

          const badgeLine = badgeParts.length > 0 ? `🏷️ ${badgeParts.join(' | ')}\n\n` : ''
          finalDesc = `<!--APPAREL_ATTRIBUTES:${JSON.stringify(apparelData)}-->\n${badgeLine}${finalDesc}`
        }

        return {
          tenant_id: tenant.id,
          name: r.name,
          sku: r.sku,
          base_price_usd: r.base_price_usd,
          cost_usd: r.cost_usd,
          stock: r.stock,
          is_active: true,
          image_url: r.image_url || null,
          images: r.image_url ? [r.image_url] : [],
          description: finalDesc || null
        }
      })

      const { error: insertErr } = await supabase.from('products').insert(rowsToInsert)
      if (insertErr) throw insertErr

      setResult({ count: rowsToInsert.length })
      onSuccess()
    } catch (err) {
      setError((err as Error).message || 'Error al guardar los productos en lote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-6 transition-all space-y-4 text-xs font-medium">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Importación Masiva de Productos
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sube tu catálogo completo mediante archivo Excel / CSV con imágenes por link
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          /* Estado Exitoso */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                ¡Catálogo Importado con Éxito!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Se agregaron <strong className="text-emerald-600 dark:text-emerald-400">{result.count} productos</strong> correctamente al inventario de {tenant?.name ?? 'tu tienda'}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Cerrar y Ver Inventario
            </button>
          </div>
        ) : (
          <>
            {/* Tarjeta de Descarga de Plantilla Modelo */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Plantilla Excel Modelo Detallada
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Incluye columnas de Ropa, Calzado, Tallas, Género y Enlaces de Imágenes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Plantilla (.csv)</span>
              </button>
            </div>

            {/* Subir Archivo o Arrastrar */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Selecciona o Arrastra tu archivo Excel / CSV:
              </label>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-5 text-center bg-slate-50/50 dark:bg-slate-800/30 transition cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2 transition" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fileName ? (
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center gap-1">
                      <Check className="w-4 h-4 text-emerald-500" /> {fileName}
                    </span>
                  ) : (
                    'Haz clic aquí para seleccionar el archivo CSV de tu computadora'
                  )}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Compatible con hojas de cálculo de Excel exportadas como CSV UTF-8
                </p>
              </div>
            </div>

            {/* Alternativa: Pegar texto directo */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                O pega los datos CSV directamente:
              </label>
              <textarea
                rows={3}
                value={csvText}
                onChange={(e) => processCSV(e.target.value)}
                placeholder="Pega aquí el contenido de tu hoja con encabezados..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-mono text-[10px] leading-relaxed resize-none"
              />
            </div>

            {/* Vista Previa de Productos Detectados */}
            {parsedRows.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    Vista Previa: <strong className="text-blue-600 dark:text-blue-400">{parsedRows.length} productos detectados</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([])
                      setCsvText('')
                      setFileName(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-[10px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {parsedRows.slice(0, 6).map((p, idx) => (
                    <div key={idx} className="p-2.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                          {p.sku && <span className="font-mono">SKU: {p.sku}</span>}
                          {p.category && <span className="text-blue-600 font-semibold">{p.category}</span>}
                          {p.gender && <span className="text-purple-600 font-semibold">({p.gender})</span>}
                          {p.sizes && p.sizes.length > 0 && <span>Tallas: {p.sizes.join(', ')}</span>}
                          <span>Stock: {p.stock}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 text-xs">
                          ${p.base_price_usd.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  ))}
                  {parsedRows.length > 6 && (
                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/40">
                      y {parsedRows.length - 6} productos más listos para importar...
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </p>
            )}

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading || parsedRows.length === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar e Importar {parsedRows.length > 0 ? `(${parsedRows.length})` : ''}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Product } from '@/types/database'
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
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import {
  extractCategory,
  extractSubcategory,
  detectCategory,
  cleanCategoryName,
  cleanSubcategoryName,
  cleanProductDescription,
  getRubroCategories
} from '@/lib/categories'
import { getProductBarcode, injectBarcodeIntoDescription } from '@/lib/barcodeUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  existingProducts?: Product[]
}

interface ParsedProductRow {
  name: string
  sku: string | null
  barcode?: string | null
  base_price_usd: number
  cost_usd: number | null
  stock: number
  category?: string
  subcategory?: string
  gender?: string
  sizes?: string[]
  color?: string
  image_url?: string | null
  description?: string | null
}

export function ImportProductsModal({ isOpen, onClose, onSuccess, existingProducts = [] }: Props) {
  const { tenant } = useTenant()
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ updated: number; inserted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const rubro = ((tenant?.settings as Record<string, unknown>)?.rubro as string) || 'tecnologia'
  const isFashionRubro = rubro === 'moda' || tenant?.slug === 'emeve-vzla'
  const hasExistingProducts = existingProducts.length > 0

  // 1. Descargar Plantilla Excel / Exportar Productos Existentes para Edición
  function handleDownloadTemplate() {
    const isFashion = isFashionRubro

    // Si la tienda ya tiene productos, exportar todos los productos actuales para edición masiva
    if (hasExistingProducts) {
      const headers = isFashion
        ? ['Nombre', 'SKU', 'Codigo_Barras', 'Precio_USD', 'Costo_USD', 'Stock', 'Categoria', 'Subcategoria', 'Genero', 'Tallas', 'Color', 'Imagen_URL', 'Descripcion']
        : ['Nombre', 'SKU', 'Codigo_Barras', 'Precio_USD', 'Costo_USD', 'Stock', 'Categoria', 'Subcategoria', 'Imagen_URL', 'Descripcion']

      const lines = existingProducts.map((p) => {
        const cat = cleanCategoryName(extractCategory(p.description) || detectCategory(p.name, p.description))
        const subcat = cleanSubcategoryName(extractSubcategory(p.description) || '')
        const barcode = getProductBarcode(p) || ''
        const cleanDesc = cleanProductDescription(p.description)
        const safeDesc = cleanDesc.replace(/"/g, '""').replace(/\r?\n/g, ' ')
        const safeName = p.name.replace(/"/g, '""')
        const sku = p.sku || ''
        const price = p.base_price_usd.toFixed(2)
        const cost = p.cost_usd ? p.cost_usd.toFixed(2) : ''
        const stock = p.stock || 0
        const img = p.image_url || ''

        if (isFashion) {
          return `"${safeName}","${sku}","${barcode}",${price},${cost},${stock},"${cat}","${subcat}","","","","${img}","${safeDesc}"`
        }

        return `"${safeName}","${sku}","${barcode}",${price},${cost},${stock},"${cat}","${subcat}","${img}","${safeDesc}"`
      })

      const csvContent = '\uFEFF' + headers.join(',') + '\r\n' + lines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `inventario_${tenant?.slug ?? 'tienda'}_para_edicion.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    // Si la tienda aún no tiene productos, generar plantilla de ejemplo adaptada a su rubro comercial
    let headers: string[] = []
    let sampleRows: string[] = []

    if (rubro === 'automotriz') {
      headers = ['Nombre', 'SKU', 'Codigo_Barras', 'Precio_USD', 'Costo_USD', 'Stock', 'Categoria', 'Subcategoria', 'Imagen_URL', 'Descripcion']
      sampleRows = [
        '"Pastillas de Freno Delanteras Corolla 2012-2018","FRE-001","7591234567890",35.00,18.00,10,"Frenos & Suspensión","Pastillas de Freno","https://images.unsplash.com/photo-1486006920555-c77dce18193b","Pastillas cerámicas de alto frenado sin ruido."',
        '"Filtro de Aceite PH4967","FIL-002","7591234567891",8.50,4.00,25,"Filtros & Lubricantes","Filtros de Aceite","https://images.unsplash.com/photo-1486006920555-c77dce18193b","Filtro de alta filtración para vehículos Toyota y Chevrolet."',
        '"Bujías Iridium Laser Juego de 4","MOT-003","7591234567892",28.00,14.00,15,"Motor & Transmisión","Bujías & Bobinas","","Juego de bujías iridium larga vida util 100.000km."'
      ]
    } else if (rubro === 'moda') {
      headers = ['Nombre', 'SKU', 'Codigo_Barras', 'Precio_USD', 'Costo_USD', 'Stock', 'Categoria', 'Subcategoria', 'Genero', 'Tallas', 'Color', 'Imagen_URL', 'Descripcion']
      sampleRows = [
        '"Franela Casual Oversize Cotton","FRA-001","7591234567890",22.50,11.00,20,"Prendas Superiores","Franelas / T-Shirts","Unisex","S, M, L, XL","Negro Lavado","https://images.unsplash.com/photo-1521572267360-ee0c2909d518","Franela 100% algodon corte oversize"',
        '"Sneakers Urbanos Running Pro","CAL-002","7591234567891",48.00,24.00,15,"Calzado & Zapatos","Calzado Deportivo / Sneakers","Unisex","38, 39, 40, 41, 42","Blanco","https://images.unsplash.com/photo-1542291026-7eec264c27ff","Zapatillas deportivas con amortiguacion y suela antideslizante"',
        '"Jean Denim Skinny Fit","PAN-003","7591234567892",34.00,16.00,12,"Pantalones & Jeans","Jeans Denim","Hombre","30, 32, 34","Azul Oscuro","","Pantalon jean stretch de alta durabilidad"'
      ]
    } else {
      // Tecnología & General por defecto
      headers = ['Nombre', 'SKU', 'Codigo_Barras', 'Precio_USD', 'Costo_USD', 'Stock', 'Categoria', 'Subcategoria', 'Imagen_URL', 'Descripcion']
      sampleRows = [
        '"Cargador Rápido GaN 30W USB-C","CRG-001","7591234567890",15.00,7.50,25,"Cargadores & Energía","Cargadores de Pared GaN","https://images.unsplash.com/photo-1583863788434-e58a36330cf0","Cargador ultracompacto carga rápida compatible con iPhone y Android."',
        '"Vidrio Templado 9D Pantalla Completa","VID-002","7591234567891",5.00,1.20,50,"Vidrios Templados & Protección","Vidrios Templados 9D / 11D","https://images.unsplash.com/photo-1584438784894-089d6a62b8fa","Protector de pantalla vidrio templado dureza 9H antihuellas."',
        '"Cable Tipo-C a Tipo-C 60W Reforzado 1.2m","CAB-003","7591234567892",8.00,3.00,30,"Cables & Conectividad","Cables Tipo-C a Tipo-C","https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c","Cable trenzado de alta resistencia compatible con carga rápida."',
        '"Audífonos Inalámbricos Bluetooth TWS Pro","TWS-004","7591234567893",25.00,12.00,15,"Audio & Sonido","Audífonos Bluetooth / TWS","https://images.unsplash.com/photo-1590658268037-6bf12165a8df","Audífonos inalámbricos estéreo con estuche de carga y baja latencia."'
      ]
    }

    const csvContent = '\uFEFF' + headers.join(',') + '\r\n' + sampleRows.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `plantilla_${rubro}_${tenant?.slug ?? 'tienda'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 2. Parser inteligente de líneas CSV soportando comillas dobles y delimitadores , o ;
  function parseCSVLine(text: string, delimiter: string = ','): string[] {
    const result: string[] = []
    let current = ''
    let insideQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      if (char === '"') {
        if (insideQuotes && text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
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
    const barcodeIdx = rawHeaders.findIndex((h) => h.includes('barras') || h.includes('barcode') || h.includes('ean') || h.includes('upc'))
    const priceIdx = rawHeaders.findIndex((h) => h.includes('precio') || h.includes('price'))
    const costIdx = rawHeaders.findIndex((h) => h.includes('costo') || h.includes('cost'))
    const stockIdx = rawHeaders.findIndex((h) => h.includes('stock') || h.includes('cantidad') || h.includes('existencia'))
    const catIdx = rawHeaders.findIndex((h) => h === 'categoria' || h === 'categoría' || h.includes('categoria'))
    const subcatIdx = rawHeaders.findIndex((h) => h.includes('subcategoria') || h.includes('subcategoría') || h.includes('sub_categoria'))
    const genderIdx = rawHeaders.findIndex((h) => h.includes('genero') || h.includes('género') || h.includes('publico'))
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

      const sku = skuIdx !== -1 && cols[skuIdx] ? cols[skuIdx].trim() : null
      const barcode = barcodeIdx !== -1 && cols[barcodeIdx] ? cols[barcodeIdx].trim() : null
      const rawCost = costIdx !== -1 && cols[costIdx] ? (cols[costIdx] || '').replace(',', '.') : null
      const cost = rawCost ? parseFloat(rawCost) || null : null
      const stock = stockIdx !== -1 && cols[stockIdx] ? parseInt(cols[stockIdx], 10) || 0 : 0
      
      const rawCategory = catIdx !== -1 ? cols[catIdx] : undefined
      const category = cleanCategoryName(rawCategory)
      const rawSubcat = subcatIdx !== -1 ? cols[subcatIdx] : undefined
      const subcategory = cleanSubcategoryName(rawSubcat)
      
      const gender = genderIdx !== -1 ? cols[genderIdx] : undefined
      const rawSizes = sizesIdx !== -1 ? cols[sizesIdx] : undefined
      const sizes = rawSizes ? rawSizes.split(/[,/|]/).map((s) => s.trim()).filter(Boolean) : []
      const color = colorIdx !== -1 ? cols[colorIdx] : undefined
      const image_url = imgIdx !== -1 && cols[imgIdx]?.startsWith('http') ? cols[imgIdx].trim() : null
      const rawDesc = descIdx !== -1 ? cols[descIdx] : null
      const description = cleanProductDescription(rawDesc)

      rows.push({
        name,
        sku,
        barcode,
        base_price_usd: price,
        cost_usd: cost,
        stock,
        category,
        subcategory,
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

  // 5. Enviar a Supabase para Upsert / Inserción Masiva
  async function handleConfirmImport() {
    if (!tenant || parsedRows.length === 0) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      // Indexar productos existentes por SKU y por Nombre en minúsculas para actualización rápida
      const existingBySku = new Map<string, Product>()
      const existingByName = new Map<string, Product>()
      existingProducts.forEach((p) => {
        if (p.sku) existingBySku.set(p.sku.toLowerCase().trim(), p)
        if (p.name) existingByName.set(p.name.toLowerCase().trim(), p)
      })

      let updatedCount = 0
      const rowsToInsert: any[] = []

      for (const r of parsedRows) {
        let baseDesc = cleanProductDescription(r.description)

        if (r.subcategory?.trim()) {
          baseDesc = `<!--SUBCATEGORY:${cleanSubcategoryName(r.subcategory)}-->\n${baseDesc}`
        }
        if (r.category?.trim()) {
          baseDesc = `<!--CATEGORY:${cleanCategoryName(r.category)}-->\n${baseDesc}`
        }

        // Si es tienda de moda y tiene atributos
        if (isFashionRubro && (r.gender || (r.sizes && r.sizes.length > 0) || r.color)) {
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
          baseDesc = `<!--APPAREL_ATTRIBUTES:${JSON.stringify(apparelData)}-->\n${badgeLine}${baseDesc}`
        }

        const finalDescWithBarcode = injectBarcodeIntoDescription(baseDesc, r.barcode || null)

        // Verificar si este producto ya existe en la tienda (Upsert)
        const matchBySku = r.sku ? existingBySku.get(r.sku.toLowerCase().trim()) : null
        const matchByName = existingByName.get(r.name.toLowerCase().trim())
        const existingMatch = matchBySku || matchByName

        if (existingMatch) {
          // Actualizar producto existente
          const updatePayload: Record<string, any> = {
            name: r.name,
            sku: r.sku || existingMatch.sku,
            barcode: r.barcode || existingMatch.barcode || null,
            base_price_usd: r.base_price_usd,
            cost_usd: r.cost_usd ?? existingMatch.cost_usd,
            stock: r.stock,
            description: finalDescWithBarcode || existingMatch.description,
            updated_at: new Date().toISOString()
          }
          if (r.image_url) {
            updatePayload.image_url = r.image_url
            updatePayload.images = [r.image_url]
          }

          const { error: updErr } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', existingMatch.id)
            .eq('tenant_id', tenant.id)

          if (updErr) throw updErr
          updatedCount++
        } else {
          // Insertar nuevo producto
          rowsToInsert.push({
            tenant_id: tenant.id,
            name: r.name,
            sku: r.sku,
            barcode: r.barcode || null,
            base_price_usd: r.base_price_usd,
            cost_usd: r.cost_usd,
            stock: r.stock,
            is_active: true,
            image_url: r.image_url || null,
            images: r.image_url ? [r.image_url] : [],
            description: finalDescWithBarcode || null
          })
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('products').insert(rowsToInsert)
        if (insErr) throw insErr
      }

      setResult({ updated: updatedCount, inserted: rowsToInsert.length })
      onSuccess()
    } catch (err) {
      setError((err as Error).message || 'Error al procesar los productos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Carga Masiva & Edición en Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasExistingProducts 
                  ? `Tienda con ${existingProducts.length} productos registrados · Edita precios o agrega nuevos`
                  : `Carga rápida de catálogo adaptada al rubro ${rubro.toUpperCase()}`
                }
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Tarjeta de descarga de plantilla inteligente */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-slate-800/80 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {hasExistingProducts ? 'Exportar Inventario Actual para Editar' : 'Plantilla Modelo para este Rubro'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {rubro.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                {hasExistingProducts
                  ? `Descarga tu archivo con los ${existingProducts.length} productos que ya tienes registrados. Modifica precios, costos o stock en Excel y vuelve a subirlo aquí mismo para actualizarlos automáticamente.`
                  : `Descarga el formato modelo con columnas y ejemplos específicos para tu rubro (${rubro}). Llénalo en Excel y súbelo para poblar tu tienda al instante.`
                }
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{hasExistingProducts ? `Descargar Inventario (${existingProducts.length})` : 'Descargar Plantilla CSV'}</span>
            </button>
          </div>

          {/* Zona de Drop / Carga de Archivo */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Subir Archivo Editado (CSV o Excel guardado como CSV)
            </label>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".csv,text/csv" 
              className="hidden" 
              onChange={handleFileChange} 
            />

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {fileName ? fileName : 'Haz clic para seleccionar o arrastra tu archivo CSV'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Compatible con delimitadores de coma (,) o punto y coma (;) de Excel
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resultado de la Importación */}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold">
                  ¡Actualización masiva completada! {result.updated > 0 ? `${result.updated} productos actualizados` : ''} {result.inserted > 0 ? `y ${result.inserted} productos nuevos agregados` : ''}.
                </span>
              </div>
              <button 
                onClick={onClose}
                className="font-bold underline cursor-pointer text-emerald-900 dark:text-emerald-100"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Vista Previa de Filas Parseadas */}
          {parsedRows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Vista Previa ({parsedRows.length} filas detectadas)
                </span>
                <span className="text-xs text-slate-400">
                  Los productos con SKU o Nombre existente se actualizarán automáticamente
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Producto</th>
                      <th className="px-3 py-2 font-semibold">SKU / Barras</th>
                      <th className="px-3 py-2 font-semibold">Categoría / Subcat</th>
                      <th className="px-3 py-2 font-semibold">Precio USD</th>
                      <th className="px-3 py-2 font-semibold">Costo</th>
                      <th className="px-3 py-2 font-semibold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {r.sku || r.barcode || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {r.category || 'General'}{r.subcategory ? ` • ${r.subcategory}` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                          ${r.base_price_usd.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {r.cost_usd ? `$${r.cost_usd.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                          {r.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-white dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={parsedRows.length === 0 || loading || !!result}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando e Importando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar e Importar ({parsedRows.length} productos)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}

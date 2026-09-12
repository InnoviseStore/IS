'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { ProductModal } from '@/components/admin/ProductModal'
import { ImportProductsModal } from '@/components/admin/ImportProductsModal'
import type { Product } from '@/types/database'
import { 
  Plus, 
  Search, 
  Pencil, 
  Package, 
  UploadCloud, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  X,
  Lock,
  Filter,
  Tag
} from 'lucide-react'
import { formatDateTime } from '@/lib/formatters'
import { getTenantFeatures } from '@/lib/planLimits'
import { detectCategory } from '@/lib/categories'

function StockBadge({ stock }: { stock: number }) {
  if (stock < 3) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900 whitespace-nowrap">Bajo ({stock})</span>
  if (stock < 10) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900 whitespace-nowrap">Medio ({stock})</span>
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 whitespace-nowrap">OK ({stock})</span>
}

export default function InventoryPage() {
  const { tenant, exchangeRate } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const features = getTenantFeatures(tenant)

  // Estados para eliminación de productos
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { load() }, [load])

  // Categorías presentes en este inventario
  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => set.add(detectCategory(p.name, p.description)))
    return ['all', ...Array.from(set)]
  }, [products])

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const cat = detectCategory(p.name, p.description)
    const matchesCategory = selectedCategory === 'all' || cat === selectedCategory
    return matchesSearch && matchesCategory
  })

  function openCreate() { setEditingProduct(null); setModalOpen(true) }
  function openEdit(p: Product) { setEditingProduct(p); setModalOpen(true) }

  async function handleDeleteConfirm() {
    if (!productToDelete) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/admin/products?id=${productToDelete.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'No se pudo eliminar el producto.')
      }

      setDeleteSuccess(`Producto "${productToDelete.name}" eliminado correctamente.`)
      setProductToDelete(null)
      load()
      setTimeout(() => setDeleteSuccess(null), 4000)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar el producto.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* Header Responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Inventario</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">{products.length} productos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!features.hasBulkImport) {
                alert('La importación masiva en Excel/CSV es una función exclusiva a partir del Plan Pro. Contacta al Administrador de la plataforma para actualizar tu suscripción.')
                return
              }
              setImportModalOpen(true)
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
            title={!features.hasBulkImport ? 'Función exclusiva de Plan Pro' : 'Importar productos desde Excel/CSV'}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Importar</span>
            {!features.hasBulkImport && <Lock className="w-2.5 h-2.5 text-slate-400" />}
          </button>
          <button
            onClick={openCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </div>
      </div>

      {/* Alerta de Éxito al Eliminar */}
      {deleteSuccess && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{deleteSuccess}</span>
          </div>
          <button onClick={() => setDeleteSuccess(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra de Búsqueda y Filtro de Categoría */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
          />
        </div>
        <div className="w-full sm:w-64 flex-shrink-0">
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer truncate"
            >
              <option value="all">Todas las categorías ({products.length})</option>
              {categories.filter((c) => c !== 'all').map((cat) => {
                const count = products.filter((p) => detectCategory(p.name, p.description) === cat).length
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Estados de Carga y Vacío */}
      {loading ? (
        <div className="glass-card p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium border border-slate-200/80 dark:border-slate-800/80">
          Cargando inventario…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-200/80 dark:border-slate-800/80">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No se encontraron productos</p>
        </div>
      ) : (
        <>
          {/* VISTA MÓVIL (< md): Tarjetas táctiles responsivas */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filtered.map((p) => {
              const priceVes = p.base_price_usd * exchangeRate
              return (
                <div 
                  key={p.id}
                  className="glass-card p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${p.is_active ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-900' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {detectCategory(p.name, p.description)}
                        </span>
                        {p.sku && <span className="font-mono text-[10px] text-slate-400">#{p.sku}</span>}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate mt-0.5">{p.name}</p>
                      
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-black text-sm text-blue-600 dark:text-blue-400">${p.base_price_usd.toFixed(2)}</span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Bs. {priceVes.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatDateTime(p.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
                    <StockBadge stock={p.stock} />
                    <div className="flex items-center gap-1 mt-2">
                      <button 
                        onClick={() => openEdit(p)} 
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                        title="Editar producto"
                        aria-label={`Editar ${p.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setProductToDelete(p)} 
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="Eliminar producto"
                        aria-label={`Eliminar ${p.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* VISTA TABLET Y DESKTOP (>= md): Tabla completa */}
          <div className="hidden md:block glass-card overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <tr>
                    {['Producto', 'Categoría', 'SKU', 'Precio USD', 'Precio VES', 'Costo', 'Margen', 'Stock', 'Estado', 'Fecha Registro', 'Acciones'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((p) => {
                    const priceVes = p.base_price_usd * exchangeRate
                    const margin = p.cost_usd && p.base_price_usd > 0
                      ? (((p.base_price_usd - p.cost_usd) / p.base_price_usd) * 100).toFixed(1)
                      : '—'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <span className="max-w-[180px] truncate">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {detectCategory(p.name, p.description)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 text-xs">{p.sku ?? '—'}</td>
                        <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">${p.base_price_usd.toFixed(2)}</td>
                        <td className="px-4 py-3.5 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{p.cost_usd ? `$${p.cost_usd.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{margin !== '—' ? `${margin}%` : '—'}</td>
                        <td className="px-4 py-3.5"><StockBadge stock={p.stock} /></td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${p.is_active ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-900' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                            {p.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(p.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition cursor-pointer" title="Editar producto">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setProductToDelete(p)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer" title="Eliminar producto">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Creación / Edición de Producto */}
      {modalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
          onDeleted={() => { setModalOpen(false); load() }}
          currentProductCount={products.length}
        />
      )}

      {/* Modal de Importación Masiva */}
      <ImportProductsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => { setImportModalOpen(false); load() }}
      />

      {/* Modal de Confirmación para Eliminar Producto */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  ¿Eliminar este producto?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Se eliminará permanentemente del inventario y del catálogo público de la tienda.
                </p>
              </div>
            </div>

            {/* Ficha del Producto a Eliminar */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                {productToDelete.image_url ? (
                  <img src={productToDelete.image_url} alt={productToDelete.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                  {productToDelete.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                  {productToDelete.sku && <span className="font-mono">SKU: #{productToDelete.sku}</span>}
                  <span>·</span>
                  <span className="font-semibold text-blue-600">${productToDelete.base_price_usd.toFixed(2)}</span>
                  <span>·</span>
                  <span>Stock: {productToDelete.stock}</span>
                </div>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setProductToDelete(null); setDeleteError(null) }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Eliminar Producto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

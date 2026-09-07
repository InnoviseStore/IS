'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { ProductModal } from '@/components/admin/ProductModal'
import { ImportProductsModal } from '@/components/admin/ImportProductsModal'
import type { Product } from '@/types/database'
import { Plus, Search, Pencil, Package, UploadCloud } from 'lucide-react'

function StockBadge({ stock }: { stock: number }) {
  if (stock < 3) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900">Bajo ({stock})</span>
  if (stock < 10) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900">Medio ({stock})</span>
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">OK ({stock})</span>
}

export default function InventoryPage() {
  const { tenant, exchangeRate } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

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

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() { setEditingProduct(null); setModalOpen(true) }
  function openEdit(p: Product) { setEditingProduct(p); setModalOpen(true) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Inventario</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">{products.length} productos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Importar Lote
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all duration-200 active:scale-95 shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Agregar Producto
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-xs"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">Cargando inventario…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No se encontraron productos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  {['Producto', 'SKU', 'Precio USD', 'Precio VES', 'Costo', 'Margen', 'Stock', 'Estado', ''].map((h) => (
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
                          <span className="max-w-[200px] truncate">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 text-xs">{p.sku ?? '—'}</td>
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">${p.base_price_usd.toFixed(2)}</td>
                      <td className="px-4 py-3.5 font-semibold text-blue-600 dark:text-blue-400">Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{p.cost_usd ? `$${p.cost_usd.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{margin !== '—' ? `${margin}%` : '—'}</td>
                      <td className="px-4 py-3.5"><StockBadge stock={p.stock} /></td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${p.is_active ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-900' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition" title="Editar producto">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}

      <ImportProductsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => { setImportModalOpen(false); load() }}
      />
    </div>
  )
}
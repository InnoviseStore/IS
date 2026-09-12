'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Quotation, Product, Customer } from '@/types/database'
import { Plus, Search, FileText, CheckCircle2, ArrowRight, Clock, Trash2, Loader2, Send, AlertCircle } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/formatters'

export default function QuotationsPage() {
  const router = useRouter()
  const { tenant, profile, exchangeRate } = useTenant()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Form states for new quotation
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customCustomerName, setCustomCustomerName] = useState('')
  const [customCustomerPhone, setCustomCustomerPhone] = useState('')
  const [customCustomerIdNumber, setCustomCustomerIdNumber] = useState('')
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([])
  const [validDays, setValidDays] = useState(15)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const loadQuotations = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quotations?tenant_id=${tenant.id}`)
      const data = await res.json()
      if (res.ok && data.quotations) {
        setQuotations(data.quotations as Quotation[])
      } else {
        setQuotations([])
      }
    } catch {
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  // Cargar productos y clientes al abrir el modal
  async function openCreateModal() {
    if (!tenant) return
    setIsCreating(true)
    setModalError(null)
    const supabase = createClient()
    const [{ data: prodData }, { data: custData }] = await Promise.all([
      supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('full_name'),
    ])
    setProducts(prodData ?? [])
    setCustomers(custData ?? [])
  }

  function addProductToQuote(product: Product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id)
      if (exists) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const quoteTotalUsd = cart.reduce((s, i) => s + i.product.base_price_usd * i.quantity, 0)
  const quoteTotalVes = quoteTotalUsd * exchangeRate

  async function handleSaveQuotation() {
    if (!tenant || cart.length === 0) return
    setSaving(true)
    setModalError(null)

    const validUntilDate = new Date()
    validUntilDate.setDate(validUntilDate.getDate() + validDays)

    const items = cart.map((i) => ({
      product_id: i.product.id,
      name: i.product.name,
      sku: i.product.sku,
      unit_price_usd: i.product.base_price_usd,
      quantity: i.quantity,
      subtotal_usd: parseFloat((i.product.base_price_usd * i.quantity).toFixed(4)),
    }))

    const customerName = selectedCustomer?.full_name || customCustomerName.trim() || 'Cliente General'
    const customerPhone = selectedCustomer?.phone || customCustomerPhone.trim() || null
    const customerIdNumber = selectedCustomer?.id_number || customCustomerIdNumber.trim() || null
    const customerEmail = selectedCustomer?.email || null

    try {
      const res = await fetch('/api/admin/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          customer_id: selectedCustomer?.id ?? null,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_id_number: customerIdNumber,
          items,
          subtotal_usd: parseFloat(quoteTotalUsd.toFixed(4)),
          total_usd: parseFloat(quoteTotalUsd.toFixed(4)),
          total_ves: parseFloat(quoteTotalVes.toFixed(2)),
          exchange_rate: exchangeRate,
          valid_until: validUntilDate.toISOString().split('T')[0],
          notes: notes.trim() || null,
          created_by: profile?.id ?? null,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al guardar el presupuesto.')
      }

      setIsCreating(false)
      setCart([])
      setSelectedCustomer(null)
      setCustomCustomerName('')
      setCustomCustomerPhone('')
      setCustomCustomerIdNumber('')
      setNotes('')
      loadQuotations()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Error inesperado al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteQuotation(id: string) {
    if (!tenant) return
    if (!confirm('¿Deseas eliminar este presupuesto?')) return
    try {
      await fetch(`/api/admin/quotations?id=${id}&tenant_id=${tenant.id}`, { method: 'DELETE' })
      loadQuotations()
    } catch (e) {
      console.error('Error al eliminar presupuesto:', e)
    }
  }

  function shareViaWhatsApp(q: Quotation) {
    const text = `📄 *Cotización ${q.quotation_number}* - ${tenant?.name ?? 'Innovise Store'}\n\n` +
      `📅 Válida hasta: ${formatDate(q.valid_until)}\n\n` +
      `📦 *Productos:*\n` +
      q.items.map((i) => `• ${i.quantity}x ${i.name} — $${(i.unit_price_usd * i.quantity).toFixed(2)}`).join('\n') +
      `\n\n💰 *Total: $${q.total_usd.toFixed(2)} USD | Bs. ${q.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}*\n` +
      `📊 Tasa aplicada: Bs. ${q.exchange_rate.toFixed(2)}/USD\n\n` +
      `_Para confirmar tu pedido o solicitar factura contáctanos directamente._`

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const filtered = quotations.filter((q) =>
    q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
    (q.notes ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Presupuestos y Cotizaciones</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Propuestas formales para clientes B2B convertibles en ventas con 1 clic
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Nueva Cotización
        </button>
      </div>

      {/* Barra de Búsqueda */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por número (ej: COT-2026-0001)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-400"
        />
      </div>

      {/* Lista de Cotizaciones */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando cotizaciones...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold">No hay presupuestos creados aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">N° Cotización</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Vence</th>
                  <th className="py-2.5 px-4">Artículos</th>
                  <th className="py-2.5 px-4 text-right">Total USD</th>
                  <th className="py-2.5 px-4 text-right">Total Bs.</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {q.quotation_number}
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                      {q.customer_name || 'Cliente General'}
                      {q.customer_id_number && (
                        <span className="block text-[10px] text-slate-400 font-normal">CI/RIF: {q.customer_id_number}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(q.valid_until)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {q.items.length} productos ({q.items.reduce((s, i) => s + i.quantity, 0)} uds)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      ${q.total_usd.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                      Bs. {q.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => shareViaWhatsApp(q)}
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                          title="Enviar por WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => router.push('/admin/pos')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                        >
                          Ir al POS <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuotation(q.id)}
                          className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Eliminar cotización"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Creación Minimalista */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsCreating(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 my-6 transition-all space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Generar Nuevo Presupuesto</h2>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Selector de Cliente y Validez */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Cliente Registrado (Opcional)</label>
                <select
                  value={selectedCustomer?.id ?? ''}
                  onChange={(e) => setSelectedCustomer(customers.find((c) => c.id === e.target.value) ?? null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="">Cliente Ocasional / Empresa</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.id_number ?? 'S/R'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Días de Validez</label>
                <select
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value={7}>7 Días</option>
                  <option value={15}>15 Días</option>
                  <option value={30}>30 Días</option>
                </select>
              </div>
            </div>

            {/* Datos del Cliente no registrado */}
            {!selectedCustomer ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Nombre / Empresa</label>
                  <input
                    type="text"
                    value={customCustomerName}
                    onChange={(e) => setCustomCustomerName(e.target.value)}
                    placeholder="ej. Inversiones Caracas C.A."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Cédula / RIF</label>
                  <input
                    type="text"
                    value={customCustomerIdNumber}
                    onChange={(e) => setCustomCustomerIdNumber(e.target.value)}
                    placeholder="ej. J-12345678-9"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={customCustomerPhone}
                    onChange={(e) => setCustomCustomerPhone(e.target.value)}
                    placeholder="ej. 0414-1234567"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-300">
                  Cliente: <strong>{selectedCustomer.full_name}</strong> (CI/RIF: {selectedCustomer.id_number || 'S/R'}) · Tlf: {selectedCustomer.phone || 'S/T'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-blue-600 hover:text-blue-800 text-[11px] font-bold"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Añadir Productos */}
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">Añadir Productos del Catálogo</label>
              <div className="max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {products.map((p) => (
                  <div key={p.id} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</p>
                      <p className="text-[11px] text-slate-400">${p.base_price_usd.toFixed(2)} USD</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProductToQuote(p)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md font-bold text-slate-700 dark:text-slate-300"
                    >
                      + Añadir
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Artículos Seleccionados */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Artículos en el Presupuesto ({cart.length})</h3>
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Selecciona productos arriba para armar la propuesta.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.product.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">×{item.quantity}</span>
                        <span className="font-bold text-slate-900 dark:text-white">${(item.product.base_price_usd * item.quantity).toFixed(2)}</span>
                        <button
                          onClick={() => setCart((prev) => prev.filter((i) => i.product.id !== item.product.id))}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totales */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-400">Total Cotizado:</span>
              <div className="text-right">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">${quoteTotalUsd.toFixed(2)} USD</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">Bs. {quoteTotalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuotation}
                disabled={saving || cart.length === 0}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

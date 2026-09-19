'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Quotation, Product, Customer } from '@/types/database'
import { Plus, Search, FileText, CheckCircle2, ArrowRight, Clock, Trash2, Loader2, Send, AlertCircle, FileDown, User, Tag, Percent, X } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { generateQuotationPdf } from '@/lib/pdfGenerator'
import { PdfLoadingModal } from '@/components/common/PdfLoadingModal'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { WhatsAppQuoteModal } from '@/components/admin/WhatsAppQuoteModal'

interface QuoteCartItem {
  product: Product
  quantity: number
  unit_price_usd: number
  discount_percent: number
}

export default function QuotationsPage() {
  const router = useRouter()
  const { tenant, profile, exchangeRate } = useTenant()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [whatsAppQuote, setWhatsAppQuote] = useState<Quotation | null>(null)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null)
  const [deletingQuotation, setDeletingQuotation] = useState(false)

  // Form states for new quotation
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [customCustomerName, setCustomCustomerName] = useState('')
  const [customCustomerPhone, setCustomCustomerPhone] = useState('')
  const [customCustomerIdNumber, setCustomCustomerIdNumber] = useState('')
  const [cart, setCart] = useState<QuoteCartItem[]>([])
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
    setCustomerSearch('')
    setCatalogSearch('')
    setIsCustomerDropdownOpen(false)
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
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_price_usd: Number(product.base_price_usd) || 0,
          discount_percent: 0,
        },
      ]
    })
  }

  function updateItemPrice(productId: string, newPrice: number) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, unit_price_usd: Math.max(0, newPrice) } : i))
    )
  }

  function updateItemDiscount(productId: string, discount: number) {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, discount_percent: Math.min(100, Math.max(0, discount)) }
          : i
      )
    )
  }

  function updateItemQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
      )
    }
  }

  const quoteTotalUsd = cart.reduce((s, i) => {
    const discounted = i.unit_price_usd * (1 - (i.discount_percent || 0) / 100)
    return s + discounted * i.quantity
  }, 0)
  const quoteTotalVes = quoteTotalUsd * exchangeRate

  async function handleSaveQuotation() {
    if (!tenant || cart.length === 0) return
    setSaving(true)
    setModalError(null)

    const validUntilDate = new Date()
    validUntilDate.setDate(validUntilDate.getDate() + validDays)

    const items = cart.map((i) => {
      const discounted = i.unit_price_usd * (1 - (i.discount_percent || 0) / 100)
      return {
        product_id: i.product.id,
        name: i.product.name,
        sku: i.product.sku,
        unit_price_usd: parseFloat(i.unit_price_usd.toFixed(4)),
        discount_percent: i.discount_percent || 0,
        quantity: i.quantity,
        subtotal_usd: parseFloat((discounted * i.quantity).toFixed(4)),
      }
    })

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
      setCustomerSearch('')
      setCatalogSearch('')
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

  async function confirmDeleteQuotation() {
    if (!tenant || !quotationToDelete) return
    const toDeleteId = quotationToDelete.id
    setDeletingQuotation(true)
    try {
      const res = await fetch(`/api/admin/quotations?id=${toDeleteId}&tenant_id=${tenant.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el presupuesto.')
      }
      setQuotations((prev) => prev.filter((q) => q.id !== toDeleteId))
      setQuotationToDelete(null)
      await loadQuotations()
    } catch (e) {
      console.error('Error al eliminar presupuesto:', e)
      alert(e instanceof Error ? e.message : 'No se pudo eliminar el presupuesto.')
    } finally {
      setDeletingQuotation(false)
    }
  }

  function handleLoadQuoteIntoPos(q: Quotation) {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pos_quote_import', JSON.stringify(q))
      }
    } catch {}
    router.push(`/admin/pos?fromQuotation=${q.id}`)
  }

  function shareViaWhatsApp(q: Quotation) {
    const text = `📄 *Cotización ${q.quotation_number}* - ${tenant?.name ?? 'Innovise Store'}\n\n` +
      `📅 Válida hasta: ${formatDate(q.valid_until)}\n\n` +
      `📦 *Productos:*\n` +
      q.items.map((i) => {
        const disc = i.discount_percent ? ` (${i.discount_percent}% desc)` : ''
        const line = i.subtotal_usd ?? (i.unit_price_usd * i.quantity)
        return `• ${i.quantity}x ${i.name} — $${line.toFixed(2)} USD${disc}`
      }).join('\n') +
      `\n\n💰 *Total Estimado: $${q.total_usd.toFixed(2)} USD | Bs. ${q.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}*\n` +
      `📊 Tasa referencial aplicada: Bs. ${q.exchange_rate.toFixed(2)}/USD\n\n` +
      `💡 *Nota:* Los pagos o abonos en Bolívares se calculan a la tasa oficial del BCV del día en que se efectúen.\n\n` +
      `_Para confirmar tu pedido o solicitar factura formal, contáctanos respondiendo a este mensaje._`

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const filtered = quotations.filter((q) =>
    q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
    (q.customer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (q.notes ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.id_number && c.id_number.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    )
  }, [customers, customerSearch])

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [products, catalogSearch])

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
                          onClick={() => setWhatsAppQuote(q)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          title="Enviar Cotización por WhatsApp al Cliente"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            setGeneratingPdf(true)
                            try {
                              await generateQuotationPdf({ quotation: q, tenant, action: 'download' })
                            } catch (err) {
                              console.error('Error generating quotation PDF:', err)
                              alert('No se pudo generar el PDF del presupuesto.')
                            } finally {
                              setGeneratingPdf(false)
                            }
                          }}
                          className="p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          title="Descargar Presupuesto en PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleLoadQuoteIntoPos(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer shadow-2xs"
                          title="Cargar productos de esta cotización directamente al Punto de Venta"
                        >
                          Ir al POS <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setQuotationToDelete(q)}
                          className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
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

            {/* Buscador de Cliente y Validez */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-start">
                <div className="sm:col-span-2 relative">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Buscar Cliente Registrado</span>
                    <span className="text-[10px] text-slate-400 font-normal">Nombre, Cédula o Teléfono</span>
                  </label>

                  {selectedCustomer ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-blue-900 dark:text-blue-200 text-xs">
                            {selectedCustomer.full_name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-blue-200 dark:bg-blue-900 text-[10px] font-bold text-blue-800 dark:text-blue-300">
                            Cliente Registrado
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {selectedCustomer.id_number && <span>CI/RIF: <strong>{selectedCustomer.id_number}</strong></span>}
                          {selectedCustomer.phone && <span>Tlf: <strong>{selectedCustomer.phone}</strong></span>}
                          {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Escribe para buscar cliente (ej: Carlos, V-12345, 0412...)"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setIsCustomerDropdownOpen(true)
                          }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                        />
                        {customerSearch && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Lista de Clientes */}
                      {isCustomerDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              No se encontraron clientes con "{customerSearch}". Puedes ingresar los datos manualmente abajo.
                            </div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(c)
                                  setIsCustomerDropdownOpen(false)
                                  setCustomerSearch('')
                                }}
                                className="w-full p-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition cursor-pointer"
                              >
                                <div>
                                  <p className="font-bold text-xs text-slate-900 dark:text-white">{c.full_name}</p>
                                  <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    {c.id_number && <span>CI/RIF: <strong>{c.id_number}</strong></span>}
                                    {c.phone && <span>Tlf: <strong>{c.phone}</strong></span>}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                  Seleccionar
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Días de Validez */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Días de Validez</label>
                  <select
                    value={validDays}
                    onChange={(e) => setValidDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value={7}>7 Días</option>
                    <option value={15}>15 Días</option>
                    <option value={30}>30 Días</option>
                    <option value={60}>60 Días</option>
                  </select>
                </div>
              </div>

              {/* Datos del Cliente no registrado si aplica */}
              {!selectedCustomer && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
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
              )}
            </div>

            {/* Añadir Productos del Catálogo con Buscador */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-slate-700 dark:text-slate-300 font-bold">
                  Añadir Productos del Catálogo ({products.length})
                </label>
                <span className="text-[10px] text-slate-400">Puedes editar el precio y aplicar descuentos abajo</span>
              </div>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar productos por nombre o SKU..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredCatalog.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-400">No se encontraron productos coincidentes.</p>
                ) : (
                  filteredCatalog.map((p) => (
                    <div key={p.id} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</p>
                        <p className="text-[11px] text-slate-400">${p.base_price_usd.toFixed(2)} USD {p.sku && `• SKU: ${p.sku}`}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProductToQuote(p)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        + Añadir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Artículos en el Presupuesto con Edición de Precio y Descuento */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Artículos en el Presupuesto ({cart.length})
                </h3>
                <span className="text-[10px] text-slate-400">Edita el precio unitario o asigna % de descuento por ítem</span>
              </div>
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  Selecciona productos arriba para armar la propuesta.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const discountedUnit = item.unit_price_usd * (1 - (item.discount_percent || 0) / 100)
                    const lineTotal = discountedUnit * item.quantity
                    return (
                      <div
                        key={item.product.id}
                        className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {item.product.name}
                            </p>
                            {item.product.sku && (
                              <p className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCart((prev) => prev.filter((i) => i.product.id !== item.product.id))}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-md transition"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
                          {/* Control Cantidad */}
                          <div>
                            <span className="block text-[10px] text-slate-400 font-semibold mb-0.5">Cantidad</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="font-bold text-slate-900 dark:text-white w-6 text-center text-xs">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Precio Unitario Editable */}
                          <div>
                            <span className="block text-[10px] text-slate-400 font-semibold mb-0.5">Precio Unit. ($)</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price_usd}
                              onChange={(e) => updateItemPrice(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Descuento % */}
                          <div>
                            <span className="block text-[10px] text-slate-400 font-semibold mb-0.5">Descuento (%)</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                placeholder="0"
                                value={item.discount_percent || ''}
                                onChange={(e) => updateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                                className="w-full pl-2 pr-5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                            </div>
                          </div>

                          {/* Total Línea */}
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-400 font-semibold mb-0.5">Total Línea</span>
                            <div className="flex flex-col items-end">
                              {item.discount_percent > 0 && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  ${(item.unit_price_usd * item.quantity).toFixed(2)}
                                </span>
                              )}
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                ${lineTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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

      {/* Modal de Carga de PDF */}
      <PdfLoadingModal
        isOpen={generatingPdf}
        title="Generando Presupuesto en PDF"
        message="Construyendo documento formal con logo, validez, productos y totales en USD y Bs. oficiales..."
      />

      {/* Modal de Confirmación para Eliminar Cotización */}
      <ConfirmModal
        isOpen={Boolean(quotationToDelete)}
        title="¿Eliminar presupuesto?"
        message={`¿Estás seguro de que deseas eliminar la cotización "${quotationToDelete?.quotation_number}" de ${quotationToDelete?.customer_name || 'Cliente General'} por un total de $${quotationToDelete?.total_usd?.toFixed(2)} USD?`}
        confirmText="Sí, eliminar presupuesto"
        cancelText="Cancelar"
        isDestructive={true}
        isLoading={deletingQuotation}
        onConfirm={confirmDeleteQuotation}
        onCancel={() => setQuotationToDelete(null)}
      />

      {/* Modal de Envío de Cotización por WhatsApp */}
      {whatsAppQuote && (
        <WhatsAppQuoteModal
          isOpen={Boolean(whatsAppQuote)}
          onClose={() => setWhatsAppQuote(null)}
          quotation={whatsAppQuote}
          tenantName={tenant?.name || 'Innovise Store'}
          exchangeRate={exchangeRate}
        />
      )}
    </div>
  )
}

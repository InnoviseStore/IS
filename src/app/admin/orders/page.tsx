'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/contexts/TenantContext'
import { formatDateTime } from '@/lib/formatters'
import {
  ClipboardList,
  Search,
  RefreshCw,
  ShoppingCart,
  MessageCircle,
  XCircle,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  CreditCard,
} from 'lucide-react'
import Link from 'next/link'
import { generateOrderPdf } from '@/lib/pdfGenerator'
import { PdfLoadingModal } from '@/components/common/PdfLoadingModal'
import PaymentAbonoModal from '@/components/admin/PaymentAbonoModal'

interface OrderItem {
  id: string
  product_id: string | null
  product_name: string
  product_sku: string | null
  unit_price_usd: number
  quantity: number
}

interface OrderCustomer {
  id?: string
  full_name?: string
  id_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

interface OrderRecord {
  id: string
  tenant_id: string
  order_number: string
  status: 'pending' | 'completed' | 'cancelled' | 'credit'
  payment_condition: string
  exchange_rate_at_sale: number
  subtotal_usd: number
  total_usd: number
  total_ves: number
  payment_breakdown: any[]
  notes: string | null
  created_at: string
  updated_at: string
  customer?: OrderCustomer | null
  order_items?: OrderItem[]
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const { tenant, exchangeRate } = useTenant()

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'credit' | 'completed' | 'cancelled' | 'all'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [abonoOrder, setAbonoOrder] = useState<OrderRecord | null>(null)

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!tenant) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch(`/api/admin/orders?tenant_id=${tenant.id}&status=${statusFilter}&limit=100`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.orders)) {
        setOrders(data.orders)
      } else {
        console.error('Error fetching orders:', data.error)
      }
    } catch (err) {
      console.error('Network error loading orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenant, statusFilter])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Toggle card item expand
  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Filtrado en memoria por texto
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return orders

    return orders.filter((o) => {
      const numMatch = o.order_number?.toLowerCase().includes(q)
      const custMatch = o.customer?.full_name?.toLowerCase().includes(q) || o.customer?.phone?.includes(q)
      const notesMatch = o.notes?.toLowerCase().includes(q)
      const itemMatch = o.order_items?.some((i) => i.product_name?.toLowerCase().includes(q) || i.product_sku?.toLowerCase().includes(q))
      return numMatch || custMatch || notesMatch || itemMatch
    })
  }, [orders, searchQuery])

  // Estadísticas rápidas
  const stats = useMemo(() => {
    let pendingCount = 0
    let pendingUsd = 0
    let creditCount = 0
    let creditUsd = 0
    let completedCount = 0
    let completedUsd = 0

    orders.forEach((o) => {
      if (o.status === 'pending') {
        pendingCount++
        pendingUsd += Number(o.total_usd) || 0
      } else if (o.status === 'credit' || o.payment_condition === 'credit_7d') {
        creditCount++
        const breakdown = Array.isArray(o.payment_breakdown) ? o.payment_breakdown : []
        const pagado = breakdown.reduce((acc: number, it: any) => it.method === 'credit_7d' ? acc : acc + (Number(it.amount_usd) || 0), 0)
        creditUsd += Math.max(0, (Number(o.total_usd) || 0) - pagado)
      } else if (o.status === 'completed') {
        completedCount++
        completedUsd += Number(o.total_usd) || 0
      }
    })

    return { pendingCount, pendingUsd, creditCount, creditUsd, completedCount, completedUsd }
  }, [orders])

  // Cancelar orden (marcar como cancelada)
  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`¿Estás seguro de anular el pedido #${orderNumber}?`)) return

    setActionLoading(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: 'cancelled' }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: `Pedido #${orderNumber} marcado como cancelado.` })
        loadOrders(true)
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Error al cancelar el pedido.' })
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Error de red al actualizar el pedido.' })
    } finally {
      setActionLoading(null)
    }
  }

  // Eliminar orden definitivamente
  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`¿Deseas eliminar definitivamente el pedido #${orderNumber}? Esta acción no se puede deshacer.`)) return

    setActionLoading(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: `Pedido #${orderNumber} eliminado.` })
        loadOrders(true)
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Error al eliminar pedido.' })
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Error de red al eliminar el pedido.' })
    } finally {
      setActionLoading(null)
    }
  }

  // Extraer nombre de cliente, cédula, teléfono y dirección del objeto customer o de las notas
  const getCustomerDisplay = (o: OrderRecord) => {
    let name = o.customer?.full_name || ''
    let phone = o.customer?.phone || ''
    let idNumber = o.customer?.id_number || ''
    let address = o.customer?.address || ''

    // Fallback: parsear de o.notes ("Cliente: X | CI/RIF: Y | WhatsApp: Z | Dirección: W")
    if (o.notes) {
      const parts = o.notes.split('|').map((p) => p.trim())
      parts.forEach((p) => {
        if (!name && p.toLowerCase().startsWith('cliente:')) name = p.replace(/cliente:/i, '').trim()
        if (!idNumber && (p.toLowerCase().startsWith('ci/rif:') || p.toLowerCase().startsWith('cédula:') || p.toLowerCase().startsWith('cedula:') || p.toLowerCase().startsWith('rif:'))) {
          idNumber = p.replace(/(ci\/rif|cédula|cedula|rif):/i, '').trim()
        }
        if (!phone && (p.toLowerCase().startsWith('whatsapp:') || p.toLowerCase().startsWith('tel:') || p.toLowerCase().startsWith('teléfono:'))) {
          phone = p.replace(/(whatsapp|teléfono|telefono|tel):/i, '').trim()
        }
        if (!address && (p.toLowerCase().startsWith('dirección:') || p.toLowerCase().startsWith('direccion:'))) {
          address = p.replace(/(dirección|direccion):/i, '').trim()
        }
      })
    }
    return {
      name: name || 'Cliente Web',
      phone,
      idNumber,
      address,
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <ClipboardList className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span>Pedidos Web & Catálogo</span>
            </h1>
            {stats.pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black animate-pulse">
                {stats.pendingCount} pendiente{stats.pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Revisa las solicitudes recibidas desde tu vitrina virtual y factura en un clic.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          <Link
            href="/admin/pos"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ir a POS</span>
          </Link>
        </div>
      </div>

      {/* Alerta de feedback */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in duration-150 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Pendientes */}
        <div className="glass-card p-4 rounded-3xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Pedidos por Facturar
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {stats.pendingCount}
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Monto: <strong className="text-slate-800 dark:text-slate-200">${stats.pendingUsd.toFixed(2)} USD</strong>
            </span>
          </div>
        </div>

        {/* Card 2: Facturados */}
        <div className="glass-card p-4 rounded-3xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Facturados / Completados
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {stats.completedCount}
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total: <strong className="text-slate-800 dark:text-slate-200">${stats.completedUsd.toFixed(2)} USD</strong>
            </span>
          </div>
        </div>

        {/* Card 3: Tasa de Cambio */}
        <div className="glass-card p-4 rounded-3xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Tasa Oficial Aplicada
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              Bs. {exchangeRate.toFixed(2)}
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Calculadora dual USD / VES
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="glass-card p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3.5">
        {/* Pestañas de estado */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('credit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'credit'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>A Crédito / Abonos</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'completed'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Facturados</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'cancelled'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelados</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Todos</span>
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar orden, cliente o teléfono..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Lista de Órdenes */}
      {loading ? (
        <div className="glass-card p-12 text-center rounded-3xl">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cargando pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No hay pedidos {statusFilter !== 'all' ? `${statusFilter === 'pending' ? 'pendientes' : statusFilter === 'completed' ? 'facturados' : 'cancelados'}` : ''}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Cuando los clientes hagan un pedido en tu vitrina de WhatsApp o registres ventas, aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const cust = getCustomerDisplay(order)
            const isExpanded = Boolean(expandedOrders[order.id])
            const itemsCount = order.order_items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0
            const cleanPhone = cust.phone ? cust.phone.replace(/\D/g, '') : ''
            const waChatUrl = cleanPhone
              ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`¡Hola ${cust.name}! Te escribimos de ${tenant?.name || 'la tienda'} referente a tu pedido #${order.order_number}.`)}`
              : null

            const breakdown = Array.isArray(order.payment_breakdown) ? order.payment_breakdown : []
            const pagadoPrevioUsd = breakdown.reduce((acc: number, item: any) => {
              if (item.method === 'credit_7d') return acc
              return acc + (Number(item.amount_usd) || 0)
            }, 0)
            const totalUsd = Number(order.total_usd) || 0
            const saldoPendienteUsd = Math.max(0, totalUsd - pagadoPrevioUsd)
            const isCreditSale = order.status === 'credit' || order.payment_condition === 'credit_7d'
            const canAbonar = isCreditSale || (order.status !== 'cancelled' && saldoPendienteUsd > 0.01)

            return (
              <div
                key={order.id}
                className={`glass-card rounded-3xl border transition-all duration-200 overflow-hidden ${
                  order.status === 'pending'
                    ? 'border-amber-300/80 dark:border-amber-700/60 bg-white/90 dark:bg-slate-900/90 shadow-md shadow-amber-500/5'
                    : isCreditSale
                    ? 'border-purple-300/80 dark:border-purple-700/60 bg-white/90 dark:bg-slate-900/90 shadow-md shadow-purple-500/5'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80'
                }`}
              >
                {/* Cabecera del pedido */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm sm:text-base font-black text-blue-600 dark:text-blue-400">
                      #{order.order_number}
                    </span>

                    {order.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        <Clock className="w-3 h-3" />
                        <span>Pendiente</span>
                      </span>
                    )}

                    {isCreditSale && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                        <CreditCard className="w-3 h-3" />
                        <span>A Crédito (7 días)</span>
                      </span>
                    )}

                    {order.status === 'completed' && !isCreditSale && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Facturado</span>
                      </span>
                    )}

                    {order.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                        <XCircle className="w-3 h-3" />
                        <span>Cancelado</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatDateTime(order.created_at)}</span>
                  </div>
                </div>

                {/* Contenido principal de la orden */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Info del Cliente */}
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente:</span>
                      <strong className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {cust.name}
                      </strong>
                      {cust.idNumber && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                          {cust.idNumber}
                        </span>
                      )}
                    </div>

                    {cust.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Teléfono:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{cust.phone}</span>
                        {waChatUrl && (
                          <a
                            href={waChatUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold hover:bg-emerald-100 transition"
                            title="Chatear por WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    )}

                    {cust.address && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-slate-400 font-semibold shrink-0">📍 Entrega:</span>
                        <span className="line-clamp-2">{cust.address}</span>
                      </div>
                    )}

                    {order.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Totales y Cantidad de Productos */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left lg:text-right">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Pedido ({itemsCount} {itemsCount === 1 ? 'ítem' : 'ítems'})
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                          ${Number(order.total_usd).toFixed(2)} USD
                        </span>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        Bs. {Number(order.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {saldoPendienteUsd > 0.01 && (
                        <div className="mt-1 flex items-center justify-start lg:justify-end gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Resta:</span>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                            ${saldoPendienteUsd.toFixed(2)} USD
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      {canAbonar && (
                        <button
                          type="button"
                          onClick={() => setAbonoOrder(order)}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Registrar abono a esta factura"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Abonar</span>
                        </button>
                      )}

                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/pos?fromOrder=${order.id}`)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          <span>Facturar en POS</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {order.status === 'pending' && (
                        <button
                          type="button"
                          disabled={actionLoading === order.id}
                          onClick={() => handleCancelOrder(order.id, order.order_number)}
                          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold transition active:scale-95 cursor-pointer"
                          title="Anular solicitud"
                        >
                          Anular
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          setGeneratingPdf(true)
                          try {
                            await generateOrderPdf({ order, tenant, action: 'download' })
                          } catch (err) {
                            console.error('Error generating PDF:', err)
                            alert('No se pudo generar el PDF. Revisa la consola.')
                          } finally {
                            setGeneratingPdf(false)
                          }
                        }}
                        className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Descargar Factura/Nota PDF"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading === order.id}
                        onClick={() => handleDeleteOrder(order.id, order.order_number)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Eliminar pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title={isExpanded ? 'Ocultar productos' : 'Ver productos'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desglose de Productos Expandible */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Productos Solicitados ({order.order_items?.length || 0})
                    </span>

                    <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                      {order.order_items && order.order_items.length > 0 ? (
                        order.order_items.map((item) => (
                          <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                                {item.quantity}x
                              </span>
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.product_name}
                                </span>
                                {item.product_sku && (
                                  <span className="text-[10px] text-slate-400 font-mono ml-2">
                                    SKU: {item.product_sku}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right font-semibold text-slate-700 dark:text-slate-300">
                              <span>${(item.unit_price_usd * item.quantity).toFixed(2)} USD</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-1">Sin productos asociados.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ventana Emergente de Carga de PDF */}
      <PdfLoadingModal
        isOpen={generatingPdf}
        title="Generando Factura en PDF"
        message="Construyendo diseño formal con logo, datos fiscales del cliente y desglose en USD y Bs. oficiales..."
      />

      {/* Modal para Registrar Abonos */}
      {abonoOrder && (
        <PaymentAbonoModal
          isOpen={Boolean(abonoOrder)}
          onClose={() => setAbonoOrder(null)}
          order={abonoOrder}
          exchangeRate={exchangeRate}
          onAbonoSuccess={() => {
            loadOrders(true)
          }}
        />
      )}
    </div>
  )
}

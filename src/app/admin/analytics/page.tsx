'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { useRouter } from 'next/navigation'
import {
  BarChart2, TrendingUp, Users, Eye, Calendar,
  RefreshCw, ExternalLink, Store, ChevronUp, ChevronDown,
  Loader2, Globe
} from 'lucide-react'

interface TenantStat {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  total: number
  today: number
  last7: number
  chart: { date: string; count: number }[]
}

type RangeOption = { label: string; value: string }

const RANGES: RangeOption[] = [
  { label: 'Hoy', value: '1' },
  { label: '7 días', value: '7' },
  { label: '30 días', value: '30' },
  { label: '90 días', value: '90' },
]

function MiniBarChart({ data, color = '#6366f1' }: { data: { date: string; count: number }[]; color?: string }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1)
  // Mostrar solo los últimos 14 días en el mini gráfico para no saturarlo
  const displayData = data.slice(-14)

  return (
    <div className="flex items-end gap-[2px] h-12 w-full">
      {displayData.map((d, i) => {
        const height = Math.round((d.count / maxVal) * 100)
        const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' })
        return (
          <div
            key={i}
            className="group relative flex-1 flex flex-col justify-end cursor-default"
            title={`${dayLabel}: ${d.count} visitas`}
          >
            <div
              className="w-full rounded-sm transition-all duration-300"
              style={{
                height: `${Math.max(height, d.count > 0 ? 10 : 2)}%`,
                backgroundColor: d.count > 0 ? color : '#e2e8f0',
                opacity: d.count > 0 ? 0.85 : 0.4,
              }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-800 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
              {d.count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatBadge({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
        <Icon className="h-3 w-3" />
        {value.toLocaleString()}
      </div>
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  const { profile } = useTenant()
  const router = useRouter()
  const [stats, setStats] = useState<TenantStat[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('7')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)

  const isSuperAdmin = profile?.role === 'superadmin'

  const loadStats = useCallback(async (selectedRange: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`)
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/admin')
          return
        }
        throw new Error('Error al cargar analíticas')
      }
      const data = await res.json()
      if (data.ok) {
        setStats(data.stats || [])
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('[analytics page] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (isSuperAdmin === false) {
      router.push('/admin')
      return
    }
    loadStats(range)
  }, [isSuperAdmin, range, loadStats, router])

  const totalVisits = stats.reduce((s, t) => s + t.total, 0)
  const totalToday = stats.reduce((s, t) => s + t.today, 0)
  const topStore = stats[0] || null

  if (!isSuperAdmin && profile !== null) {
    return null
  }

  // Colores para las tiendas
  const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
              <BarChart2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analíticas Web</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visitas al catálogo público por tienda
            {lastUpdated && (
              <span className="ml-2 text-xs text-slate-400">
                · Actualizado {lastUpdated.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de rango */}
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Botón refrescar */}
          <button
            onClick={() => loadStats(range)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Cards de resumen global */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Total período
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalVisits.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">visitas únicas (sesión)</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Hoy
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalToday.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">todas las tiendas</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Tienda líder
            </span>
          </div>
          {topStore ? (
            <>
              <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{topStore.tenant_name}</p>
              <p className="text-xs text-slate-400 mt-1">{topStore.total.toLocaleString()} visitas</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Sin datos aún</p>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="ml-3 text-slate-500">Cargando analíticas...</span>
        </div>
      )}

      {/* Lista de tiendas */}
      {!loading && (
        <div className="space-y-3">
          {stats.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <BarChart2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">Sin datos aún</h3>
              <p className="text-sm text-slate-400">
                Las visitas comenzarán a registrarse cuando los clientes visiten los catálogos.
              </p>
            </div>
          ) : (
            stats.map((t, idx) => {
              const color = COLORS[idx % COLORS.length]
              const isExpanded = expandedTenant === t.tenant_id
              const maxChartVal = Math.max(...t.chart.map((d) => d.count), 1)

              return (
                <div
                  key={t.tenant_id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                >
                  {/* Cabecera de la tienda */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Color badge */}
                      <div
                        className="mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Store className="h-4 w-4" style={{ color }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                            {t.tenant_name}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono shrink-0">/{t.tenant_slug}</span>
                          <a
                            href={`/${t.tenant_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto shrink-0 text-slate-400 hover:text-indigo-500 transition-colors"
                            title="Ver catálogo"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        {/* Stats rápidas */}
                        <div className="flex items-center gap-4 mb-3">
                          <StatBadge label="Hoy" value={t.today} icon={Eye} color="text-emerald-600 dark:text-emerald-400" />
                          <StatBadge label="7 días" value={t.last7} icon={Calendar} color="text-blue-600 dark:text-blue-400" />
                          <StatBadge label="Total" value={t.total} icon={Users} color="text-indigo-600 dark:text-indigo-400" />
                        </div>

                        {/* Mini gráfico */}
                        <MiniBarChart data={t.chart} color={color} />

                        {/* Etiquetas de fechas */}
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-slate-400">
                            {new Date(t.chart[0]?.date + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-[9px] text-slate-400">Hoy</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandir detalle diario */}
                    <button
                      onClick={() => setExpandedTenant(isExpanded ? null : t.tenant_id)}
                      className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {isExpanded ? (
                        <>Ver menos <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>Ver detalle diario <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  </div>

                  {/* Detalle diario expandible */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        Visitas por día
                      </p>
                      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                        {[...t.chart].reverse().map((d) => {
                          const pct = maxChartVal > 0 ? (d.count / maxChartVal) * 100 : 0
                          const fecha = new Date(d.date + 'T12:00:00').toLocaleDateString('es-VE', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })
                          return (
                            <div key={d.date} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-24 shrink-0 capitalize">{fecha}</span>
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: d.count > 0 ? color : 'transparent',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 w-6 text-right">
                                {d.count}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Nota informativa */}
      <div className="mt-6 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
        <p className="text-xs text-indigo-600 dark:text-indigo-400">
          <strong>ℹ️ Metodología:</strong> Cada visita se cuenta una vez por sesión de navegador (ventana de 4 horas).
          Los datos reflejan visitantes únicos al catálogo público, no páginas vistas totales.
        </p>
      </div>
    </div>
  )
}

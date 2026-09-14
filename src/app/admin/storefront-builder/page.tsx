'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import {
  Palette,
  Sparkles,
  Smartphone,
  Monitor,
  Check,
  Save,
  Loader2,
  ExternalLink,
  Crown,
  Eye,
  Store,
  Layers,
  ShoppingBag,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { createClient } from '@/lib/supabase/client'
import { getTenantPlan, PLAN_CONFIG } from '@/lib/planLimits'
import {
  StorefrontTemplate,
  StorefrontThemeConfig,
  DEFAULT_THEME_CONFIG,
  TEMPLATE_DEFINITIONS,
} from '@/types/storefrontTheme'
import type { Product } from '@/types/database'

const COLOR_PRESETS = [
  { name: 'Azul Innovise', hex: '#2563eb' },
  { name: 'Índigo Royal', hex: '#4f46e5' },
  { name: 'Cyan Cyber', hex: '#06b6d4' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Ámbar Dorado', hex: '#d97706' },
  { name: 'Rosa Rubí', hex: '#e11d48' },
  { name: 'Negro Carbón', hex: '#0f172a' },
]

export default function StorefrontBuilderPage() {
  const { tenant, profile, exchangeRate, switchTenant } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [productSearch, setProductSearch] = useState('')

  // Theme configuration state
  const [config, setConfig] = useState<StorefrontThemeConfig>(DEFAULT_THEME_CONFIG)

  // Plan verification
  const plan = getTenantPlan(tenant)
  const planDetails = PLAN_CONFIG[plan]
  const isSuperAdmin = profile?.role === 'superadmin' || !profile?.role
  const isUnlocked = isSuperAdmin || planDetails.hasStorefrontBuilder

  // Cargar productos y configuración del tema existente
  useEffect(() => {
    async function loadData() {
      if (!tenant) return
      setLoading(true)
      const supabase = createClient()

      // 1. Cargar configuración existente en settings
      const settings = (tenant.settings || {}) as Record<string, unknown>
      if (settings.storefront_theme && typeof settings.storefront_theme === 'object') {
        setConfig({
          ...DEFAULT_THEME_CONFIG,
          ...(settings.storefront_theme as StorefrontThemeConfig),
        })
      }

      // 2. Cargar productos activos
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')

      setProducts(prods ?? [])
      setLoading(false)
    }

    loadData()
  }, [tenant])

  // Filtrar productos para selector de destacados
  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(productSearch.toLowerCase())
    )
  }, [products, productSearch])

  // Alternar selección de producto destacado
  function toggleFeatured(productId: string) {
    setConfig((prev) => {
      const exists = prev.featuredProductIds.includes(productId)
      const updated = exists
        ? prev.featuredProductIds.filter((id) => id !== productId)
        : [...prev.featuredProductIds, productId]
      return { ...prev, featuredProductIds: updated }
    })
  }

  // Guardar configuración vía API de servidor segura con Service Role
  async function handleSave() {
    if (!tenant) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/admin/storefront-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          theme_config: config,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al guardar la configuración')
      }

      if (tenant) {
        switchTenant({
          ...tenant,
          settings: {
            ...((tenant.settings || {}) as Record<string, unknown>),
            storefront_theme: config,
          },
        })
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4500)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar el tema')
    } finally {
      setSaving(false)
    }
  }

  // Si el plan es básico y no es superadmin, mostrar banner de bloqueo PRO
  if (!loading && !isUnlocked) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 text-white border border-indigo-800/40 shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Palette className="w-72 h-72 text-white" />
          </div>

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black shadow-lg">
              <Crown className="w-4 h-4" />
              <span>DISPONIBLE EN PLAN PRO Y ENTERPRISE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Personalizador de Catálogo Web
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Elige entre 5 plantillas profesionales de diseño web, adapta los colores corporativos a la identidad de tu marca, selecciona tus productos destacados y ofrece una experiencia de compra prémium que multiplique tus ventas por WhatsApp.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>5 Plantillas Especializadas</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Colores y Acentos de Marca</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Selector de Productos Destacados</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Live Preview Móvil y Desktop</span>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-4">
              <a
                href={`https://wa.me/584126296839?text=${encodeURIComponent(
                  `Hola, deseo mejorar mi tienda "${tenant?.name || 'mi comercio'}" al Plan Pro para desbloquear el Catálogo Web Builder.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>Mejorar a Plan Pro Ahora</span>
                <Crown className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Plantilla seleccionada actualmente
  const activeTemplateDef = TEMPLATE_DEFINITIONS.find((t) => t.id === config.template) || TEMPLATE_DEFINITIONS[0]

  // Lista de productos para el live preview
  const featuredProductsList = products.filter((p) => config.featuredProductIds.includes(p.id))
  const previewProducts = products.slice(0, 4)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Catálogo Web Builder
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              Pro & Enterprise
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personaliza el diseño, la plantilla visual y los productos destacados de tu vitrina pública en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {tenant?.slug && (
            <a
              href={`/${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Ver Vitrina Real</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Guardando...' : 'Guardar y Publicar'}</span>
          </button>
        </div>
      </div>

      {/* Mensajes de Estado */}
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>¡Diseño guardado y publicado con éxito! Tu vitrina pública ya muestra los nuevos cambios.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Grid Principal: Editor (Izquierda) + Live Preview (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: Configuración y Controles */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. SELECCIÓN DE PLANTILLA */}
          <div className="glass-card p-5 space-y-4 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  1. Plantilla de Diseño
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                5 Estilos Disponibles
              </span>
            </div>

            <div className="space-y-2.5">
              {TEMPLATE_DEFINITIONS.map((tpl) => {
                const isSelected = config.template === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setConfig({ ...config, template: tpl.id })}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-1 border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {tpl.name}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tpl.badgeColor}`}>
                          {tpl.badgeText}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        {tpl.tagline}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        Ideal: {tpl.bestFor}
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <span>📐 {tpl.layoutLabel}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. COLOR PRIMARIO / IDENTIDAD */}
          <div className="glass-card p-5 space-y-4 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Color de Marca y Acentos
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setConfig({ ...config, primaryColor: c.hex })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      config.primaryColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-slate-900 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-xs flex-shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Color personalizado:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-24 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. BANNER DE ANUNCIOS */}
          <div className="glass-card p-5 space-y-3.5 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBanner}
                  onChange={(e) => setConfig({ ...config, showBanner: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  3. Barra Superior de Anuncios
                </span>
              </label>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {config.showBanner ? 'Activo' : 'Oculto'}
              </span>
            </div>

            {config.showBanner && (
              <div>
                <input
                  type="text"
                  value={config.bannerText}
                  onChange={(e) => setConfig({ ...config, bannerText: e.target.value })}
                  placeholder="Ej: Envíos gratis en Caracas por compras mayores a $30..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Aparece en la parte más alta de la vitrina con fondo del color de marca.
                </p>
              </div>
            )}
          </div>

          {/* 4. SELECCIÓN DE PRODUCTOS DESTACADOS */}
          <div className="glass-card p-5 space-y-3 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  4. Productos Destacados
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {config.featuredProductIds.length} seleccionados
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estos productos aparecerán en la sección principal del carrusel y en los destacados VIP.
            </p>

            <input
              type="text"
              placeholder="Buscar productos para destacar..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 outline-none"
            />

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron productos
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isChecked = config.featuredProductIds.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFeatured(p.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          {p.sku && <p className="text-[10px] font-mono text-slate-400">SKU: {p.sku}</p>}
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white flex-shrink-0">
                        ${Number(p.base_price_usd).toFixed(2)}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: LIVE PREVIEW INTERACTIVO */}
        <div className="lg:col-span-7 sticky top-4 space-y-3">
          {/* Barra de control del Preview */}
          <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Live Preview en Tiempo Real
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Escritorio</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Móvil</span>
              </button>
            </div>
          </div>

          {/* Marco contenedor del Mockup */}
          <div className="flex justify-center">
            <div
              className={`transition-all duration-300 overflow-hidden rounded-3xl border border-slate-300 dark:border-slate-800 shadow-2xl ${
                previewDevice === 'mobile'
                  ? 'w-[370px] max-w-full'
                  : 'w-full'
              }`}
            >
              {/* Encabezado del navegador del mockup */}
              <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-300 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 text-center font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate px-2">
                  system-is.netlify.app/{tenant?.slug || 'tienda'}
                </div>
              </div>

              {/* CONTENIDO RENDERIZADO DEL PREVIEW EN VIVO */}
              <div
                className={`min-h-[560px] max-h-[640px] overflow-y-auto ${activeTemplateDef.previewClasses.container}`}
              >
                {/* 1. Banner Superior */}
                {config.showBanner && (
                  <div
                    className="px-3 py-1.5 text-center text-[10px] font-extrabold text-white truncate shadow-xs"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    {config.bannerText}
                  </div>
                )}

                {/* 2. Topbar de la Tienda */}
                <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    {tenant?.logo_url ? (
                      <div className="relative w-6 h-6 rounded-lg overflow-hidden bg-white border border-slate-200 p-0.5">
                        <Image
                          src={tenant.logo_url}
                          alt="Logo"
                          width={24}
                          height={24}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        <Store className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {tenant?.name || 'Mi Comercio'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300">
                      Bs. {exchangeRate.toFixed(2)}/USD
                    </span>
                    <div
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <ShoppingBag className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* 3. Hero de la Tienda */}
                <div className="p-4 sm:p-5">
                  <div
                    className={`rounded-2xl p-4 border transition-all ${activeTemplateDef.previewClasses.hero}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border shadow-xs flex items-center justify-center p-1 flex-shrink-0">
                        {tenant?.logo_url ? (
                          <Image
                            src={tenant.logo_url}
                            alt="Logo"
                            width={40}
                            height={40}
                            className="object-contain"
                            unoptimized
                          />
                        ) : (
                          <Store className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                            ● Abierto
                          </span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            Plantilla {activeTemplateDef.name}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                          {tenant?.name || 'Innovise Store'}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          Catálogo digital optimizado con pagos duales USD / VES
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Sección Destacados VIP (si hay seleccionados) */}
                {featuredProductsList.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Destacados Especiales ({featuredProductsList.length})
                      </h4>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                      {featuredProductsList.map((p) => (
                        <div
                          key={p.id}
                          className={`w-36 flex-shrink-0 p-2.5 rounded-2xl border transition-all ${activeTemplateDef.previewClasses.card}`}
                        >
                          <div className="relative aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Store className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </p>
                          <p className="text-xs font-black mt-1" style={{ color: config.primaryColor }}>
                            ${Number(p.base_price_usd).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Cuadrícula de Productos Generales */}
                <div className="px-4 pb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Explora Todo el Catálogo
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {products.length} disponibles
                    </span>
                  </div>

                  {config.template === 'express' ? (
                    /* Layout Express: Lista Horizontal de Alta Densidad (Mayorista / Distribuidora) */
                    <div className="space-y-2">
                      {previewProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                              {p.image_url ? (
                                <Image
                                  src={p.image_url}
                                  alt={p.name}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <Store className="w-5 h-5 m-auto text-slate-400" />
                              )}
                            </div>
                            <div className="truncate">
                              <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                                {p.name}
                              </p>
                              <p className="text-[9px] font-mono text-slate-400">
                                SKU: {p.sku || 'REF-N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-black" style={{ color: config.primaryColor }}>
                                ${Number(p.base_price_usd).toFixed(2)}
                              </p>
                              <p className="text-[9px] font-semibold text-slate-500">
                                Bs. {(Number(p.base_price_usd) * exchangeRate).toFixed(0)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs cursor-pointer"
                              style={{ backgroundColor: config.primaryColor }}
                            >
                              + Pedir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : config.template === 'minimal' ? (
                    /* Layout Minimal: Lookbook Editorial de Moda / Lujo en 2 Columnas Grandes */
                    <div className="grid grid-cols-2 gap-3.5">
                      {previewProducts.map((p) => (
                        <div key={p.id} className="group space-y-1.5">
                          <div className="relative aspect-[3/4] bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <Store className="w-8 h-8 m-auto text-neutral-400" />
                            )}
                            <span className="absolute top-2 left-2 text-[8px] font-mono uppercase bg-black/80 text-white px-1.5 py-0.5">
                              Disponible
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
                              {p.name}
                            </p>
                            <p className="text-xs font-semibold" style={{ color: config.primaryColor }}>
                              ${Number(p.base_price_usd).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : config.template === 'tech' ? (
                    /* Layout Tech: Cuadrícula Cyber con Specs y Acentos Neón */
                    <div className="grid grid-cols-2 gap-2.5">
                      {previewProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-md shadow-cyan-950/20"
                        >
                          <div className="relative aspect-square rounded-xl bg-slate-950 overflow-hidden mb-2">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                unoptimized
                                className="object-contain p-2"
                              />
                            ) : (
                              <Store className="w-6 h-6 m-auto text-slate-700" />
                            )}
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-md bg-black/80 text-[8px] font-mono text-cyan-400">
                              ● Stock OK
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-white truncate">
                            {p.name}
                          </p>
                          <div className="flex items-baseline justify-between mt-1">
                            <p className="text-xs font-black text-cyan-400" style={{ color: config.primaryColor }}>
                              ${Number(p.base_price_usd).toFixed(2)}
                            </p>
                            <span className="text-[9px] font-mono text-slate-400">
                              {p.sku || 'SKU'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="w-full mt-2 py-1 rounded-xl text-[10px] font-bold text-slate-950 transition shadow-xs cursor-pointer"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            Configurar +
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : config.template === 'boutique' ? (
                    /* Layout Boutique: Vitrina Curva de Lujo con Acabados Cálidos */
                    <div className="grid grid-cols-2 gap-3">
                      {previewProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-3xl bg-white/90 dark:bg-[#1f1c1a]/90 border border-amber-200/60 dark:border-amber-900/40 shadow-xs"
                        >
                          <div className="relative aspect-square rounded-2xl bg-[#faf7f2] dark:bg-[#141210] overflow-hidden mb-2">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <Store className="w-6 h-6 m-auto text-amber-300" />
                            )}
                            <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-[8px] font-semibold text-amber-800">
                              Exclusivo
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                            {p.name}
                          </p>
                          <div className="flex items-baseline justify-between mt-1">
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300" style={{ color: config.primaryColor }}>
                              ${Number(p.base_price_usd).toFixed(2)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="w-full mt-2 py-1 rounded-xl text-[10px] font-bold text-white transition shadow-xs cursor-pointer"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            Seleccionar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Layout Aurora: Bento Cards Modernas */
                    <div className="grid grid-cols-2 gap-2.5">
                      {previewProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-2xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border-white/60 dark:border-slate-800 shadow-xs"
                        >
                          <div className="relative aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <Store className="w-6 h-6 m-auto text-slate-400" />
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </p>
                          <div className="flex items-baseline justify-between mt-1">
                            <p className="text-xs font-black" style={{ color: config.primaryColor }}>
                              ${Number(p.base_price_usd).toFixed(2)}
                            </p>
                            <p className="text-[9px] font-semibold text-slate-500">
                              Bs. {(Number(p.base_price_usd) * exchangeRate).toFixed(0)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="w-full mt-2 py-1.5 rounded-xl text-[10px] font-bold text-white transition shadow-xs cursor-pointer"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            Agregar +
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

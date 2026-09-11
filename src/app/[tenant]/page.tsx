import { createClient } from '@/lib/supabase/server'
import { createClient as createPublicClient } from '@supabase/supabase-js'
import { fetchLiveBcvRate } from '@/lib/bcv'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Tenant, Product as DBProduct } from '@/types/database'
import ProductGrid, { type Product } from '@/components/storefront/ProductGrid'
import { ProductCarousel } from '@/components/storefront/ProductCarousel'
import CartDrawer from '@/components/storefront/CartDrawer'
import ExchangeRateBanner from '@/components/storefront/ExchangeRateBanner'
import { MessageCircle, Sparkles } from 'lucide-react'

export const revalidate = 1800 // 30 minutes ISR

// generateStaticParams runs outside request scope (during build/ISR), so it must use a cookie-less client
export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || !url.startsWith('http')) {
    // Return fallback tenant if environment variables are not injected yet during local build
    return [{ tenant: 'innovise' }]
  }

  try {
    const publicClient = createPublicClient(url, key)
    const { data: tenants } = await publicClient
      .from('tenants')
      .select('slug')

    if (!tenants || tenants.length === 0) {
      return [{ tenant: 'innovise' }]
    }

    return tenants.map((t) => ({
      tenant: t.slug,
    }))
  } catch {
    return [{ tenant: 'innovise' }]
  }
}

async function getStorefrontData(slug: string) {
  const supabase = await createClient()

  // Fetch tenant info
  const { data: tenantRaw, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenantRaw) return null

  const tenant = tenantRaw as unknown as Tenant

  const { data: productsRaw } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const dbProducts = (productsRaw as unknown as DBProduct[]) ?? []

  const products: Product[] = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    unit_price_usd: Number(p.base_price_usd),
    stock_quantity: p.stock,
    image_url: p.image_url,
    images: (p.images as string[]) ?? (p.image_url ? [p.image_url] : []),
    is_active: p.is_active,
  }))

  const settings = (tenant.settings || {}) as Record<string, unknown>
  let fechaValor = (settings.bcv_fecha_valor as string) || null
  let exchangeRate = Number(tenant.currency_rate_bcv) || 91.5
  const lastSync = (settings.bcv_last_sync as string) || null

  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
  const isToday = lastSync && new Date(lastSync).toDateString() === new Date().toDateString()
  const isOutdated = !lastSync || !isToday || new Date(lastSync).getTime() < thirtyMinutesAgo

  if (isOutdated) {
    try {
      const bcvData = await fetchLiveBcvRate()
      exchangeRate = bcvData.rate
      fechaValor = bcvData.fechaValor

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createPublicClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        await adminClient
          .from('tenants')
          .update({
            currency_rate_bcv: bcvData.rate,
            settings: {
              ...settings,
              bcv_fecha_valor: bcvData.fechaValor,
              bcv_last_sync: bcvData.timestamp,
              bcv_source: bcvData.source,
            },
          })
          .eq('id', tenant.id)
      }
    } catch (e) {
      console.warn('Storefront SSR auto-sync error:', (e as Error).message)
    }
  }

  if (!fechaValor) {
    try {
      const today = new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
      fechaValor = today.charAt(0).toUpperCase() + today.slice(1)
    } catch {
      fechaValor = null
    }
  }

  return {
    tenant,
    products,
    exchangeRate,
    rateDate: tenant.created_at,
    fechaValor,
  }
}

interface PageProps {
  params: Promise<{ tenant: string }>
}

export default async function StorefrontPage({ params }: PageProps) {
  const { tenant: slug } = await params
  const data = await getStorefrontData(slug)

  if (!data) {
    notFound()
  }

  const { tenant, products, exchangeRate, rateDate, fechaValor } = data
  const settings = (tenant.settings || {}) as Record<string, unknown>

  return (
    <main className="min-h-[calc(100vh-16rem)]">
      {/* Exchange Rate Banner with direct link to BCV and official Fecha Valor */}
      <ExchangeRateBanner
        exchangeRate={exchangeRate}
        rateDate={rateDate}
        fechaValor={fechaValor}
        tenantSlug={tenant.slug}
      />

      {/* Hero / Store Banner with Logo and Official Badges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 animate-page-enter">
        <div className="rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-white/40 dark:to-slate-900/40 p-6 sm:p-8 border border-blue-200/60 dark:border-blue-900/30 backdrop-blur-md shadow-sm">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Logo de la tienda: Prioriza Imagotipo si existe */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-md flex-shrink-0 flex items-center justify-center p-2">
              <Image
                src={(settings.imagotype_url as string) || tenant.logo_url || '/logo.png'}
                alt={tenant.name}
                width={112}
                height={112}
                className="object-contain"
                unoptimized
                priority
              />
            </div>

            <div className="flex-1 text-center md:text-left space-y-2.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tienda Abierta
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                  Tasa Oficial BCV
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {tenant.name}
              </h1>

              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {(settings.slogan as string) || (settings.description as string) || 'Tienda Virtual - Conectando Vidas / Creando Futuro 🚀'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          products={products}
          exchangeRate={exchangeRate}
          tenantSlug={tenant.slug}
        />
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="border-t border-slate-200/70 dark:border-slate-800/70 pt-6 mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Explora Todo el Catálogo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Filtra por categoría o rango de precio para encontrar lo que buscas
          </p>
        </div>

        <ProductGrid
          products={products}
          exchangeRate={exchangeRate}
          tenantSlug={tenant.slug}
        />
      </section>

      {/* Cart Drawer */}
      <CartDrawer
        tenantSlug={tenant.slug}
        exchangeRate={exchangeRate}
        storePhone={tenant.phone_whatsapp || '584121234567'}
        storeName={tenant.name}
      />
    </main>
  )
}
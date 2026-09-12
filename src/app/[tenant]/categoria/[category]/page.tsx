import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tenant, Product as DBProduct } from '@/types/database'
import { detectCategory, slugifyCategory } from '@/lib/categories'
import ProductGrid, { type Product } from '@/components/storefront/ProductGrid'
import CartDrawer from '@/components/storefront/CartDrawer'
import ExchangeRateBanner from '@/components/storefront/ExchangeRateBanner'
import { ArrowLeft, Layers, ShoppingBag } from 'lucide-react'

export const revalidate = 1800

interface CategoryPageProps {
  params: Promise<{ tenant: string; category: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { tenant: slug, category: categorySlug } = await params
  const supabase = await createClient()

  // 1. Fetch Tenant
  const { data: tenantRaw, error: tenantErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (tenantErr || !tenantRaw) {
    notFound()
  }

  const tenant = tenantRaw as unknown as Tenant

  // 2. Fetch Active Products
  const { data: productsRaw } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const dbProducts = (productsRaw as unknown as DBProduct[]) ?? []

  // 3. Find matching category name and filter products
  let categoryDisplayName = ''
  const categoryProducts: Product[] = []

  dbProducts.forEach((p) => {
    const cat = detectCategory(p.name, p.description)
    const cSlug = slugifyCategory(cat)
    if (cSlug === categorySlug) {
      if (!categoryDisplayName) categoryDisplayName = cat
      categoryProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        unit_price_usd: Number(p.base_price_usd),
        stock_quantity: p.stock,
        image_url: p.image_url,
        images: (p.images as string[]) ?? (p.image_url ? [p.image_url] : []),
        is_active: p.is_active,
      })
    }
  })

  // If no products matched this slug, but user typed something, fallback display name
  if (!categoryDisplayName) {
    categoryDisplayName = categorySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const exchangeRate = Number(tenant.currency_rate_bcv) || 91.5
  const settings = (tenant.settings || {}) as Record<string, unknown>
  const fechaValor = (settings.bcv_fecha_valor as string) || null

  return (
    <main className="min-h-[calc(100vh-16rem)] pb-16">
      {/* Exchange Rate Banner */}
      <ExchangeRateBanner
        exchangeRate={exchangeRate}
        rateDate={tenant.created_at}
        fechaValor={fechaValor}
        tenantSlug={tenant.slug}
      />

      {/* Category Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="mb-4">
          <Link
            href={`/${tenant.slug}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a todo el catálogo</span>
          </Link>
        </div>

        <div className="rounded-3xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-white/40 dark:to-slate-900/40 p-6 sm:p-8 border border-blue-200/60 dark:border-blue-900/30 backdrop-blur-md shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
              <Layers className="w-3.5 h-3.5" />
              <span>Categoría de Productos</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {categoryDisplayName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              {categoryProducts.length === 1
                ? '1 producto disponible'
                : `${categoryProducts.length} productos disponibles en esta categoría`}
            </p>
          </div>

          <Link
            href={`/${tenant.slug}`}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Ver catálogo completo
          </Link>
        </div>
      </section>

      {/* Filtered Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {categoryProducts.length > 0 ? (
          <ProductGrid
            products={categoryProducts}
            exchangeRate={exchangeRate}
            tenantSlug={tenant.slug}
          />
        ) : (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No hay productos disponibles en esta categoría por los momentos.
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Te invitamos a explorar las demás categorías o revisar todo nuestro catálogo activo.
            </p>
            <Link
              href={`/${tenant.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20"
            >
              <span>Explorar todo el catálogo</span>
            </Link>
          </div>
        )}
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

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Tenant, Product as DBProduct } from '@/types/database'
import type { Product } from '@/components/storefront/ProductGrid'
import { ProductDetailClient } from '@/components/storefront/ProductDetailClient'
import CartDrawer from '@/components/storefront/CartDrawer'
import ExchangeRateBanner from '@/components/storefront/ExchangeRateBanner'

export const revalidate = 1800 // 30 minutes ISR

interface PageProps {
  params: Promise<{
    tenant: string
    id: string
  }>
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { tenant: slug, id: productId } = await params
  const supabase = await createClient()

  // 1. Get tenant
  const { data: tenantRaw, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenantRaw) {
    notFound()
  }

  const tenant = tenantRaw as unknown as Tenant

  // 2. Get target product
  const { data: productRaw, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (productError || !productRaw) {
    notFound()
  }

  const dbProduct = productRaw as unknown as DBProduct
  const product: Product = {
    id: dbProduct.id,
    name: dbProduct.name,
    sku: dbProduct.sku,
    description: dbProduct.description,
    unit_price_usd: Number(dbProduct.base_price_usd),
    stock_quantity: dbProduct.stock,
    image_url: dbProduct.image_url,
    images: (dbProduct.images as string[]) ?? (dbProduct.image_url ? [dbProduct.image_url] : []),
    is_active: dbProduct.is_active,
  }

  // 3. Get related products
  const { data: relatedRaw } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .neq('id', productId)
    .limit(4)

  const relatedProducts: Product[] = ((relatedRaw as unknown as DBProduct[]) ?? []).map((p) => ({
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

  const exchangeRate = Number(tenant.currency_rate_bcv) || 91.5
  const settings = (tenant.settings || {}) as Record<string, unknown>
  const fechaValor = (settings.bcv_fecha_valor as string) || null

  return (
    <main className="min-h-[calc(100vh-16rem)]">
      {/* Exchange Rate Banner */}
      <ExchangeRateBanner
        exchangeRate={exchangeRate}
        rateDate={tenant.created_at}
        fechaValor={fechaValor}
      />

      {/* Main product view */}
      <ProductDetailClient
        product={product}
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        tenantPhone={tenant.phone_whatsapp || '584121234567'}
        exchangeRate={exchangeRate}
        relatedProducts={relatedProducts}
      />

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

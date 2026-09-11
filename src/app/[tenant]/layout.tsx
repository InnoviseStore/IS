import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tenant } from '@/types/database'
import StorefrontLayoutClient, { type StoreData } from './StorefrontLayoutClient'

interface StorefrontLayoutProps {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}

export default async function StorefrontLayout({
  children,
  params,
}: StorefrontLayoutProps) {
  const { tenant: slug } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, phone_whatsapp, currency_rate_bcv, settings')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    notFound()
  }

  const tenant = data as unknown as Tenant
  const settings = (tenant.settings || {}) as Record<string, unknown>

  const rawDesc = (settings.description as string) || ''
  const isOldDefault = !rawDesc || rawDesc.toLowerCase().includes('tecnolog') || rawDesc.toLowerCase().includes('en caracas')
  const description = isOldDefault ? 'Tienda Oficial' : rawDesc

  const themeObj = (settings.theme || {}) as Record<string, string>
  const store: StoreData = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logo_url: (settings.logo_url as string) || (tenant as unknown as { logo_url?: string }).logo_url || '/logo.png',
    isotype_url: (settings.isotype_url as string) || null,
    imagotype_url: (settings.imagotype_url as string) || null,
    phone_whatsapp: tenant.phone_whatsapp,
    instagram_handle: (settings.instagram_handle as string) || 'innovise.ve',
    description,
    slogan: (settings.slogan as string) || null,
    primary_color: themeObj.primaryColor || null,
    accent_color: themeObj.accentColor || null,
  }

  const exchangeRate = Number(tenant.currency_rate_bcv) || 91.5

  return (
    <StorefrontLayoutClient store={store} exchangeRate={exchangeRate}>
      {children}
    </StorefrontLayoutClient>
  )
}
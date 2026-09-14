import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tenant } from '@/types/database'
import { 
  Truck, 
  BadgePercent, 
  Headphones, 
  ShoppingBag, 
  MessageCircle, 
  ShieldCheck, 
  Star,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react'

interface NosotrosPageProps {
  params: Promise<{ tenant: string }>
}

export default async function NosotrosPage({ params }: NosotrosPageProps) {
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
  const about = (settings.about || {}) as Record<string, string>

  const title = about.title || `Sobre ${tenant.name}`
  const description =
    about.description ||
    'Somos una tienda dedicada a brindar la mejor selección de productos con atención personalizada, entregas confiables y garantía de satisfacción.'

  const shippingText = about.shippingText || 'ENVÍOS A TODO EL PAÍS'
  const shippingSubtext =
    about.shippingSubtext ||
    'Despachos rápidos y asegurados a nivel nacional a través de Zoom, Tealca, MRW y entregas directas.'

  const priceText = about.priceText || 'EL MEJOR PRECIO DEL MERCADO'
  const priceSubtext =
    about.priceSubtext ||
    'Precios de oportunidad altamente competitivos y calculados a la tasa oficial del Banco Central de Venezuela.'

  const supportText = about.supportText || 'SOPORTE POSVENTA'
  const supportSubtext =
    about.supportSubtext ||
    'Acompañamiento, garantía real y atención personalizada directa por WhatsApp antes y después de tu compra.'

  const logoUrl =
    (settings.logo_url as string) ||
    (settings.imagotype_url as string) ||
    (tenant as unknown as { logo_url?: string }).logo_url ||
    '/logo.png'

  const cleanPhone = tenant.phone_whatsapp ? tenant.phone_whatsapp.replace(/\D/g, '') : ''
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`¡Hola! Estoy visitando la página Nosotros de ${tenant.name} y deseo más información.`)}`
    : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold mb-5 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Conoce Nuestra Propuesta</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
          {title}
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {/* Pilar 1: Envíos */}
        <div className="relative p-7 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/30 flex flex-col group hover:-translate-y-1 transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
            <Truck className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            Cobertura Nacional
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {shippingText}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
            {shippingSubtext}
          </p>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Envíos rápidos y rastreables</span>
          </div>
        </div>

        {/* Pilar 2: Precio */}
        <div className="relative p-7 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/30 flex flex-col group hover:-translate-y-1 transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform">
            <BadgePercent className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            Transparencia Total
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {priceText}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
            {priceSubtext}
          </p>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Tasa BCV oficial transparente</span>
          </div>
        </div>

        {/* Pilar 3: Soporte */}
        <div className="relative p-7 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/30 flex flex-col group hover:-translate-y-1 transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform">
            <Headphones className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            Atención Humana
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {supportText}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
            {supportSubtext}
          </p>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Asesoría directa personalizada</span>
          </div>
        </div>
      </div>

      {/* Extra Trust Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-8 sm:p-12 shadow-2xl shadow-blue-500/20 mb-12">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Compra 100% Segura</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
              ¿Listo para encontrar lo que necesitas?
            </h2>
            <p className="text-blue-100 text-sm sm:text-base mt-2">
              Explora nuestro catálogo completo o escríbenos directamente para responder cualquier inquietud sobre stock, envíos o formas de pago.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 w-full md:w-auto shrink-0">
            <Link
              href={`/${tenant.slug}`}
              className="px-6 py-3 rounded-2xl bg-white text-blue-600 hover:bg-blue-50 font-bold text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ver Catálogo</span>
            </Link>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contactar por WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

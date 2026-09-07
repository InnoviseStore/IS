import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, LayoutDashboard, ShieldCheck, ArrowRight, Store } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100">
      {/* Aurora Background */}
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto text-center space-y-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/25">
            <Store className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Innovise <span className="text-blue-600 dark:text-blue-400">Store</span> Platform
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto">
              Plataforma de comercio electrónico y facturación multimoneda (USD / VES) adaptada a comercios venezolanos.
            </p>
          </div>
        </div>

        {/* Action Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
          {/* Card 1: Storefront */}
          <Link
            href="/innovise"
            className="group glass-card p-6 sm:p-8 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between border border-white/60 dark:border-slate-700/60 hover:border-blue-400/50 dark:hover:border-blue-500/50"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Vitrina Virtual (Storefront)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Explora el catálogo oficial de Innovise Store con conversión de precios en vivo a tasa BCV y pedidos automatizados por WhatsApp.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <span>Abrir tienda pública</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Admin Panel */}
          <Link
            href="/admin"
            className="group glass-card p-6 sm:p-8 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between border border-white/60 dark:border-slate-700/60 hover:border-indigo-400/50 dark:hover:border-indigo-500/50"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Panel Administrativo & POS
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Gestión de inventario, punto de venta con pagos divididos (Zelle, Pago Móvil), créditos a 7 días y actualización de tasa oficial.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Acceder al panel</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500 pt-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Supabase RLS Multi-Tenant
          </span>
          <span>•</span>
          <span>Tasa Oficial BCV Dinámica</span>
          <span>•</span>
          <span>Checkout WhatsApp</span>
        </div>
      </div>
    </main>
  )
}
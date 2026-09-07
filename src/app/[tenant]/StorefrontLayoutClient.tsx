'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Instagram, MessageCircle, Store, Sun, Moon, ShieldCheck } from 'lucide-react'
import { CartProvider, useCart } from '@/contexts/CartContext'

export interface StoreData {
  id: string
  name: string
  slug: string
  logo_url: string | null
  phone_whatsapp: string | null
  instagram_handle: string | null
  description: string | null
}

interface Props {
  store: StoreData
  exchangeRate?: number
  children: React.ReactNode
}

function StorefrontHeader({ store }: { store: StoreData }) {
  const { itemCount, openCart } = useCart()
  const [isDark, setIsDark] = useState(false)

  // Sync dark class on client
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  function toggleDark() {
    setIsDark((d) => {
      const next = !d
      if (next) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return next
    })
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / store name */}
          <Link href={`/${store.slug}`} className="flex items-center gap-3 group">
            {store.logo_url ? (
              <div className="relative h-9 w-9 rounded-xl overflow-hidden ring-2 ring-blue-100 dark:ring-blue-900/60 group-hover:ring-blue-400 transition-all">
                <Image
                  src={store.logo_url}
                  alt={store.name}
                  fill
                  className="object-contain"
                  sizes="36px"
                />
              </div>
            ) : (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center ring-2 ring-blue-100 dark:ring-blue-900/60 group-hover:ring-blue-400 transition-all shadow-md shadow-blue-500/20">
                <Store className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {store.name}
            </span>
          </Link>

          {/* Right actions: Dark Mode Toggle + Cart Button */}
          <div className="flex items-center gap-2 sm:gap-3">

            <button
              onClick={toggleDark}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition active:scale-95"
              aria-label="Cambiar modo claro / oscuro"
              title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            <button
              onClick={openCart}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              aria-label="Abrir carrito"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrito</span>
              {itemCount > 0 && (
                <span className="h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center shadow-sm">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

function StorefrontShell({
  store,
  children,
}: {
  store: StoreData
  children: React.ReactNode
}) {
  const instagramUrl = store.instagram_handle
    ? `https://www.instagram.com/${store.instagram_handle.replace('@', '')}/`
    : null

  const whatsappUrl = store.phone_whatsapp
    ? `https://wa.me/${store.phone_whatsapp.replace(/\D/g, '')}`
    : null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative selection:bg-blue-500 selection:text-white transition-colors duration-200">
      {/* Aurora background */}
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Sticky Header */}
        <StorefrontHeader store={store} />

        {/* Page Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Branding */}
              <div className="flex items-center gap-3">
                {store.logo_url ? (
                  <div className="relative h-10 w-10 rounded-xl overflow-hidden">
                    <Image
                      src={store.logo_url}
                      alt={store.name}
                      fill
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{store.name}</p>
                  {store.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs line-clamp-1 mt-0.5">
                      {store.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Social links */}
              <div className="flex items-center gap-3">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:opacity-90 hover:scale-105 transition-all shadow-sm"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                    <span>@{store.instagram_handle?.replace('@', '') ?? 'innovise.ve'}</span>
                  </a>
                )}
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold hover:scale-105 transition-all shadow-sm"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <p>© {new Date().getFullYear()} {store.name}. Todos los derechos reservados.</p>
              <p className="text-slate-400">Atención y pedidos directos vía WhatsApp</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function StorefrontLayoutClient({
  store,
  exchangeRate = 91.5,
  children,
}: Props) {
  return (
    <CartProvider tenantSlug={store.slug} exchangeRate={exchangeRate}>
      <StorefrontShell store={store}>{children}</StorefrontShell>
    </CartProvider>
  )
}
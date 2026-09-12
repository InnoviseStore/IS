'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ShoppingCart,
  Instagram,
  MessageCircle,
  Store,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { CartProvider, useCart } from '@/contexts/CartContext'

export interface StoreData {
  id: string
  name: string
  slug: string
  logo_url: string | null
  isotype_url?: string | null
  imagotype_url?: string | null
  phone_whatsapp: string | null
  instagram_handle: string | null
  description: string | null
  slogan?: string | null
  primary_color?: string | null
  accent_color?: string | null
}

export interface StoreCategory {
  name: string
  slug: string
  count: number
}

interface Props {
  store: StoreData
  categories?: StoreCategory[]
  exchangeRate?: number
  children: React.ReactNode
}

function StorefrontHeader({
  store,
  categories = [],
}: {
  store: StoreData
  categories?: StoreCategory[]
}) {
  const { itemCount, openCart } = useCart()
  const [isDark, setIsDark] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync dark class on client
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  const headerLogo = store.isotype_url || store.logo_url || '/logo.png'
  const cleanPhone = store.phone_whatsapp ? store.phone_whatsapp.replace(/\D/g, '') : ''
  const whatsappContactUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`¡Hola! Me gustaría consultar sobre sus productos en ${store.name}`)}`
    : null

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Mobile hamburger + Store Brand */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link href={`/${store.slug}`} className="flex items-center gap-3 group">
                {headerLogo ? (
                  <div className="relative h-9 w-9 rounded-xl overflow-hidden ring-2 ring-blue-100 dark:ring-blue-900/60 group-hover:ring-blue-400 transition-all">
                    <Image
                      src={headerLogo}
                      alt={store.name}
                      fill
                      unoptimized
                      priority
                      className="object-contain"
                      sizes="36px"
                    />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center ring-2 ring-blue-100 dark:ring-blue-900/60 group-hover:ring-blue-400 transition-all shadow-md shadow-blue-500/20">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                )}
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                  {store.name}
                </span>
              </Link>
            </div>

            {/* Middle: Desktop horizontal navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <Link
                href={`/${store.slug}`}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Inicio
              </Link>

              {/* Categorías Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                    isCategoryDropdownOpen
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>Categorías</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isCategoryDropdownOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-slate-400'
                    }`}
                  />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Categorías
                      </span>
                      <Link
                        href={`/${store.slug}`}
                        onClick={() => setIsCategoryDropdownOpen(false)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Ver todo
                      </Link>
                    </div>

                    <div className="max-h-72 overflow-y-auto py-1">
                      {categories.length > 0 ? (
                        categories.map((cat) => (
                          <Link
                            key={cat.slug}
                            href={`/${store.slug}/categoria/${cat.slug}`}
                            onClick={() => setIsCategoryDropdownOpen(false)}
                            className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition"
                          >
                            <span className="font-medium truncate">{cat.name}</span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {cat.count}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">Sin categorías específicas</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Contáctanos WhatsApp Button */}
              {whatsappContactUrl && (
                <a
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 transition shadow-xs active:scale-95"
                  title="Escríbenos por WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Contáctanos</span>
                </a>
              )}
            </nav>

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

      {/* Mobile Drawer (Slide-out panel) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 animate-in slide-in-from-left duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {headerLogo ? (
                  <div className="relative h-9 w-9 rounded-xl overflow-hidden ring-2 ring-blue-100 dark:ring-blue-900/60">
                    <Image
                      src={headerLogo}
                      alt={store.name}
                      fill
                      unoptimized
                      className="object-contain"
                      sizes="36px"
                    />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{store.name}</h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Catálogo Digital</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation & Categories */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <Link
                  href={`/${store.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  <span>🏠 Inicio / Todo el Catálogo</span>
                  <ArrowRight className="w-4 h-4 opacity-50" />
                </Link>
              </div>

              <div>
                <h4 className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Categorías Disponibles
                </h4>
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/${store.slug}/categoria/${cat.slug}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        {cat.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer / Contact CTA */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
              {whatsappContactUrl && (
                <a
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold shadow-md shadow-emerald-600/20 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chatear por WhatsApp</span>
                </a>
              )}

              {store.instagram_handle && (
                <a
                  href={`https://www.instagram.com/${store.instagram_handle.replace('@', '')}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold hover:opacity-90 transition"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>@{store.instagram_handle.replace('@', '')}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StorefrontShell({
  store,
  categories = [],
  children,
}: {
  store: StoreData
  categories?: StoreCategory[]
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
        {/* Sticky Header with Categories and Contact */}
        <StorefrontHeader store={store} categories={categories} />

        {/* Page Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Branding */}
              <div className="flex items-center gap-3">
                {(store.imagotype_url || store.logo_url || '/logo.png') ? (
                  <div className="relative h-10 w-10 rounded-xl overflow-hidden">
                    <Image
                      src={store.imagotype_url || store.logo_url || '/logo.png'}
                      alt={store.name}
                      fill
                      unoptimized
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
  categories = [],
  exchangeRate = 91.5,
  children,
}: Props) {
  return (
    <CartProvider tenantSlug={store.slug} exchangeRate={exchangeRate}>
      <StorefrontShell store={store} categories={categories}>
        {children}
      </StorefrontShell>
    </CartProvider>
  )
}

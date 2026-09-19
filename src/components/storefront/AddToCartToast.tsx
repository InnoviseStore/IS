'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, ShoppingBag, X, ArrowRight, Sparkles } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'

export default function AddToCartToast({ exchangeRate = 1 }: { exchangeRate?: number }) {
  const { lastAddedToast, dismissToast, openCart, itemCount, totalUsd, totalVes } = useCart()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (lastAddedToast) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => dismissToast(), 300)
      }, 3800)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [lastAddedToast, dismissToast])

  if (!lastAddedToast && !isVisible) return null

  const item = lastAddedToast?.item
  if (!item) return null

  return (
    <div
      className={`fixed bottom-4 left-2.5 right-2.5 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:max-w-md transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="glass-card p-2.5 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 dark:border-emerald-500/30 shadow-2xl shadow-emerald-500/15 dark:shadow-black/60 rounded-2xl sm:rounded-3xl flex items-center gap-2.5 sm:gap-3 relative overflow-hidden">
        {/* Decorative Top Highlight Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />

        {/* Product Image / Icon */}
        <div className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              unoptimized
              className="object-contain p-1"
              sizes="48px"
            />
          ) : (
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
          )}
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs font-black">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>¡Agregado al Carrito!</span>
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
            {item.name}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {item.quantity > 1 ? `${item.quantity} un. • ` : ''}
            ${Number(item.unit_price_usd).toFixed(2)} USD
          </p>
        </div>

        {/* Action Button: Ver Carrito */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsVisible(false)
              dismissToast()
              openCart()
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
          >
            <span>Carrito</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-extrabold">
              {itemCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsVisible(false)
              dismissToast()
            }}
            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

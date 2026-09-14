'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingBag, MessageSquare, CheckCircle2, X, Sparkles, ArrowRight } from 'lucide-react'

interface OrderGuideModalProps {
  tenantSlug: string
  storeName: string
}

export default function OrderGuideModal({ tenantSlug, storeName }: OrderGuideModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const storageKey = `has_seen_order_guide_${tenantSlug}`
      const hasSeen = localStorage.getItem(storageKey)
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setIsOpen(true)
        }, 600)
        return () => clearTimeout(timer)
      }
    } catch {
      // Ignore
    }
  }, [tenantSlug])

  const handleDismiss = () => {
    try {
      const storageKey = `has_seen_order_guide_${tenantSlug}`
      localStorage.setItem(storageKey, 'true')
    } catch {
      // Ignore
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleDismiss}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-900/40">
                Guía Rápida
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                ¿Cómo comprar en {storeName}?
              </h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6">
            Hacer tus compras o consultar disponibilidad es muy fácil y directo. Sigue estos 3 pasos:
          </p>

          <div className="space-y-3.5 mb-6">
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                1
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-500" />
                  Elige tus productos
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Explora las categorías y agrega los artículos deseados a tu carrito virtual con un solo clic.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30">
                2
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  Revisa tu carrito
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Comprueba las cantidades y observa los montos en Dólares ($) y Bolívares (Bs.) calculados con la tasa BCV oficial.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30">
                3
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  Confirma por WhatsApp
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Al pulsar "Enviar Pedido", se abrirá WhatsApp con el detalle estructurado. Un asesor te atenderá al instante para coordinar entrega y pago.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span>¡Sin registros ni pasarelas complejas! Todo se procesa de forma humana y transparente.</span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-sm font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>¡Entendido! Explorar Tienda</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

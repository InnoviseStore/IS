'use client'

import React, { useState, useEffect } from 'react'
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Verificar si ya está en modo standalone (instalada)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true)
      return
    }

    // Verificar si el usuario ya descartó el banner en esta sesión
    const wasDismissed = sessionStorage.getItem('is_pwa_dismissed') === 'true'
    if (wasDismissed) {
      setDismissed(true)
    }

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIos(isIosDevice)

    // Capturar evento de instalación en Android / Chromium / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true)
      return
    }

    if (!deferredPrompt) {
      alert('Para instalar la app en tu teléfono o PC, pulsa en el menú de opciones de tu navegador (los 3 puntos) y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".')
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('is_pwa_dismissed', 'true')
  }

  if (isInstalled || dismissed) return null

  return (
    <>
      {/* Banner flotante discreto y moderno en la esquina inferior */}
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-40 animate-in slide-in-from-bottom-5 duration-300">
        <div className="glass-card p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-blue-200 dark:border-blue-900/60 shadow-2xl shadow-blue-600/15 backdrop-blur-xl text-slate-800 dark:text-slate-100 relative overflow-hidden">
          {/* Acento superior degradado */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Instala la App Web
              </h4>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                Innovise Store en tu Teléfono
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Accede más rápido, recibe alertas de pedidos al instante y gestiona tu negocio sin abrir el navegador.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isIos ? 'Ver Cómo Instalar' : 'Descargar / Instalar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Luego
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal explicativo para iPhone / Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-card max-w-sm w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative text-slate-900 dark:text-white">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Share className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold mb-1">Cómo instalar en tu iPhone</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Sigue estos 2 sencillos pasos en Safari para tener el icono en tu pantalla de inicio:
            </p>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <div>
                  Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari (el icono de un cuadro con flecha hacia arriba).
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <div>
                  Baja y selecciona <strong>&quot;Agregar a pantalla de inicio&quot;</strong> (icono con signo +).
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  )
}

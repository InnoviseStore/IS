'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Download, Smartphone, X, Check, Share, Monitor, Sparkles, Bell } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'

export function PwaInstallPrompt() {
  const { tenant } = useTenant()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const storeName = tenant?.name || 'Innovise Store'
  const logoUrl = tenant?.logo_url || '/logo.png'

  // Actualizar dinámicamente el manifiesto web con el nombre y logo de la empresa activa
  useEffect(() => {
    if (tenant?.id && typeof document !== 'undefined') {
      let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'manifest'
        document.head.appendChild(link)
      }
      link.href = `/api/manifest?tenant_id=${tenant.id}`
    }
  }, [tenant?.id, tenant?.name, tenant?.logo_url])

  useEffect(() => {
    // Verificar si ya está en modo standalone (instalada)
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true)
    ) {
      setIsInstalled(true)
    }

    // Detectar iOS
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
      setIsIos(isIosDevice)
    }

    // Capturar evento nativo de instalación en Android / Chromium / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowModal(false)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Escuchar evento personalizado para abrir el modal desde Topbar o Sidebar
    const handleOpenModal = () => {
      setShowModal(true)
    }
    window.addEventListener('open-pwa-install', handleOpenModal)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('open-pwa-install', handleOpenModal)
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
          setIsInstalled(true)
          setShowModal(false)
        }
        setDeferredPrompt(null)
      } catch (err) {
        console.warn('Error en prompt de instalación:', err)
      }
    } else {
      setShowModal(true)
    }
  }, [deferredPrompt])

  return (
    <>
      {/* Banner flotante discreto en la parte inferior si no está instalada */}
      {!isInstalled && !bannerDismissed && (
        <div className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-blue-200/90 dark:border-blue-900/60 shadow-2xl shadow-blue-600/15 backdrop-blur-xl text-slate-800 dark:text-slate-100 relative overflow-hidden">
            {/* Acento superior degradado */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

            <button
              onClick={() => setBannerDismissed(true)}
              className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              aria-label="Cerrar banner de instalación"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5 pr-5">
              {/* Logo de la Empresa */}
              {tenant?.logo_url ? (
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  <img src={tenant.logo_url} alt={storeName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
                  <Smartphone className="w-6 h-6" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Instala la App Oficial
                </h4>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5 truncate">
                  {storeName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Descarga la app con el logo de tu empresa en tu teléfono para acceso directo y alertas instantáneas.
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition active:scale-95 flex items-center justify-center gap-1.5 truncate cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Instalar App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  >
                    Luego
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Guiado de Instalación PWA (Abrible desde Topbar, Sidebar o Banner) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 overflow-hidden">
            {/* Acento superior */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Logo de la Empresa y Encabezado */}
            <div className="text-center pt-2 pb-4">
              {tenant?.logo_url ? (
                <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-800 p-2 border-2 border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center mx-auto mb-3 shadow-xl overflow-hidden">
                  <img src={tenant.logo_url} alt={storeName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-xl shadow-blue-500/25">
                  <Smartphone className="w-10 h-10" />
                </div>
              )}

              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Instalar {storeName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Accede a la app directamente desde tu pantalla de inicio con el logo de tu empresa y recibe notificaciones de pedidos en tiempo real.
              </p>
            </div>

            {/* Botón directo de instalación (Si el navegador soporta prompt de 1 clic) */}
            {deferredPrompt && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-blue-500/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>📲 Instalar Ahora (1 Clic)</span>
                </button>
              </div>
            )}

            {/* Instrucciones visuales paso a paso por plataforma */}
            <div className="space-y-2.5 my-4 text-xs">
              {isIos ? (
                /* Guía iPhone / Safari */
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Cómo instalar en iPhone (Safari):
                  </p>
                  <div className="space-y-2 pl-1 text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>Toca el botón <strong>Compartir</strong> en Safari (el icono de cuadro con flecha hacia arriba).</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>Desliza hacia abajo y pulsa <strong>&quot;Agregar a la pantalla de inicio&quot;</strong> (icono con signo +).</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Guía Android & Computadora */
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" /> En Teléfono Android (Chrome / Edge):
                  </p>
                  <p className="pl-5 text-[11px] leading-relaxed">
                    Toca el menú de los <strong>3 puntos (⋮)</strong> en la esquina superior derecha y selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                  </p>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> En Computadora (PC / Laptop):
                    </p>
                    <p className="pl-5 text-[11px] leading-relaxed">
                      Haz clic en el icono de instalación (⬇️) en la barra de direcciones de tu navegador, o pulsa Menú &gt; &quot;Instalar {storeName}&quot;.
                    </p>
                  </div>
                </div>
              )}

              {/* Ventajas clave */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Logo de tu empresa</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  <span>Notificaciones en vivo</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

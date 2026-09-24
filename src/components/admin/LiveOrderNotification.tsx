'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { Bell, ShoppingBag, ArrowRight, X, Volume2, VolumeX, AlertTriangle, Lock, Sparkles } from 'lucide-react'

// Sintetizador Web Audio nativo para un timbre agradable tipo campanilla de tienda
function playChimeAudio() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const now = ctx.currentTime
    // Arpegio brillante y placentero: C6 (1046.5Hz), E6 (1318.5Hz), G6 (1567.98Hz)
    const freqs = [1046.50, 1318.51, 1567.98]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)

      gain.gain.setValueAtTime(0.18, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.4)
    })
  } catch (err) {
    console.warn('Audio chime notice:', err)
  }
}

// Disparador de Notificación Nativa del Sistema Operativo / Teléfono
function sendNativeNotification(title: string, options: { body: string; icon?: string; data?: { url: string }; tag?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return

  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body: options.body,
            icon: options.icon || '/logo.png',
            badge: '/favicon.ico',
            data: options.data,
            tag: options.tag || 'innovise-order-alert',
            vibrate: [200, 100, 200],
          } as any)
        })
      } else {
        const notif = new Notification(title, {
          body: options.body,
          icon: options.icon || '/logo.png',
          data: options.data,
          tag: options.tag || 'innovise-order-alert',
        })
        notif.onclick = () => {
          window.focus()
          if (options.data?.url) {
            window.location.href = options.data.url
          }
        }
      }
    } catch (e) {
      console.warn('Native notification dispatch failed:', e)
    }
  }
}

interface NewOrderNotification {
  id: string
  order_number: string
  total_usd: number
  total_ves?: number
  created_at?: string
  customer_name?: string
  notes?: string
}

export function LiveOrderNotification() {
  const router = useRouter()
  const { tenant, exchangeRate } = useTenant()
  const [activeAlert, setActiveAlert] = useState<NewOrderNotification | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default')
  const [showPermissionBanner, setShowPermissionBanner] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Determinar si el comercio tiene acceso a alertas Pro & Enterprise
  const tenantPlan = ((tenant?.settings as any)?.plan || (tenant as any)?.plan || 'basic').toLowerCase()
  const isProOrEnterprise = tenantPlan === 'pro' || tenantPlan === 'enterprise'

  // Verificar estado de permisos de notificación
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported')
      return
    }

    setPermissionState(Notification.permission)

    // Si aún no ha decidido y no la ha cerrado antes, sugerirle activar
    if (Notification.permission === 'default') {
      const dismissed = sessionStorage.getItem('is_notif_banner_dismissed') === 'true'
      if (!dismissed) {
        setShowPermissionBanner(true)
      }
    }
  }, [])

  // Solicitar permisos de notificación
  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const perm = await Notification.requestPermission()
      setPermissionState(perm)
      setShowPermissionBanner(false)
      if (perm === 'granted') {
        sendNativeNotification('✅ ¡Notificaciones Activas!', {
          body: 'Recibirás avisos de pedidos, cobros pendientes y alertas de tu tienda directamente aquí.',
          data: { url: '/admin' },
        })
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err)
    }
  }

  const handleIncomingOrder = useCallback((order: any) => {
    // 1. Reproducir sonido si está habilitado
    if (soundEnabled) {
      playChimeAudio()
    }

    // 2. Extraer nombre de cliente si viene en notas o customer
    let custName = order.customer?.full_name || ''
    if (!custName && order.notes) {
      const match = order.notes.match(/Cliente:\s*([^|]+)/i)
      if (match) custName = match[1].trim()
    }

    const totalUsd = Number(order.total_usd) || 0
    const totalVes = Number(order.total_ves) || totalUsd * exchangeRate

    const notif: NewOrderNotification = {
      id: order.id,
      order_number: order.order_number || 'NUEVO',
      total_usd: totalUsd,
      total_ves: totalVes,
      created_at: order.created_at,
      customer_name: custName,
      notes: order.notes,
    }

    setActiveAlert(notif)

    // 3. Disparar notificación nativa al teléfono / sistema operativo
    sendNativeNotification(`🛍️ ¡Nuevo Pedido #${order.order_number || 'NUEVO'}!`, {
      body: `${custName ? `${custName} · ` : ''}$${totalUsd.toFixed(2)} USD (Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Toca para ver detalles.`,
      icon: tenant?.logo_url || '/logo.png',
      data: { url: '/admin/orders' },
      tag: `order-${order.id}`,
    })

    // 4. Notificar a las pantallas activas (Dashboard, Orders, etc.)
    window.dispatchEvent(new CustomEvent('is_new_order_received', { detail: order }))

    // 5. Auto-ocultar después de 14 segundos
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setActiveAlert(null)
    }, 14000)
  }, [soundEnabled, exchangeRate, tenant?.logo_url])

  // Escuchar órdenes nuevas en tiempo real
  useEffect(() => {
    if (!tenant?.id) return

    const supabase = createClient()
    const channelName = `realtime-orders-${tenant.id}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          handleIncomingOrder(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant?.id, handleIncomingOrder])

  // 🔔 ALARMAS PROGRAMADAS: Cobranzas pendientes y Cierre de caja (Solo Planes Pro y Enterprise)
  useEffect(() => {
    if (!tenant?.id || !isProOrEnterprise) return

    const todayStr = new Date().toISOString().split('T')[0]
    const supabase = createClient()

    // A) Alarma de clientes con saldo por pagar
    const lastCreditAlertDate = localStorage.getItem(`is_credit_alert_${tenant.id}`)
    if (lastCreditAlertDate !== todayStr) {
      const checkCreditDebts = async () => {
        try {
          const { data: debtCustomers } = await supabase
            .from('customers')
            .select('id, full_name, current_debt_usd')
            .eq('tenant_id', tenant.id)
            .gt('current_debt_usd', 0.01)

          if (debtCustomers && debtCustomers.length > 0) {
            const totalDebt = debtCustomers.reduce((acc, c) => acc + (Number(c.current_debt_usd) || 0), 0)
            localStorage.setItem(`is_credit_alert_${tenant.id}`, todayStr)

            sendNativeNotification('⚠️ Alarmas de Cobranza Pendiente', {
              body: `Tienes ${debtCustomers.length} cliente(s) con pagos por cobrar ($${totalDebt.toFixed(2)} USD). Toca para revisar.`,
              data: { url: '/admin/customers' },
              tag: 'credit-alarm',
            })
          }
        } catch (e) {
          console.warn('Credit debts check notice:', e)
        }
      }
      checkCreditDebts()
    }

    // B) Alarma de cierre de caja del día (a partir de las 5:00 PM)
    const currentHour = new Date().getHours()
    if (currentHour >= 17) {
      const lastClosingAlertDate = localStorage.getItem(`is_closing_alert_${tenant.id}`)
      if (lastClosingAlertDate !== todayStr) {
        const checkCashClosing = async () => {
          try {
            const { data: closing } = await supabase
              .from('cash_closings')
              .select('id')
              .eq('tenant_id', tenant.id)
              .gte('created_at', todayStr)
              .limit(1)

            if (!closing || closing.length === 0) {
              localStorage.setItem(`is_closing_alert_${tenant.id}`, todayStr)

              sendNativeNotification('🔒 Recordatorio de Cierre de Caja', {
                body: 'Aún no has registrado el cuadre de caja de hoy. Toca aquí para realizar el cierre del día.',
                data: { url: '/admin/cash-closing' },
                tag: 'cash-closing-reminder',
              })
            }
          } catch (e) {
            console.warn('Cash closing check notice:', e)
          }
        }
        checkCashClosing()
      }
    }
  }, [tenant?.id, isProOrEnterprise])

  return (
    <>
      {/* Banner de invitación para activar notificaciones nativas en el teléfono */}
      {showPermissionBanner && permissionState === 'default' && (
        <div className="fixed top-18 right-4 left-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-top-3 duration-300">
          <div className="glass-card p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-amber-300 dark:border-amber-700/60 shadow-xl shadow-amber-500/10 backdrop-blur-md flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Activa Notificaciones en tu Teléfono
                </p>
                {isProOrEnterprise && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Pro/Enterprise
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Recibe avisos al instante cuando tus clientes hagan pedidos y recordatorios de cobranza y cierre.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={requestPermission}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition active:scale-95 shadow-sm"
                >
                  Activar Alertas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPermissionBanner(false)
                    sessionStorage.setItem('is_notif_banner_dismissed', 'true')
                  }}
                  className="px-2 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  Luego
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPermissionBanner(false)
                sessionStorage.setItem('is_notif_banner_dismissed', 'true')
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta flotante en pantalla para nuevo pedido */}
      {activeAlert && (
        <div className="fixed top-5 right-4 left-4 md:left-auto md:right-6 md:w-96 z-[9999] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="glass-card p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/20 text-slate-900 dark:text-white relative overflow-hidden backdrop-blur-md">
            {/* Barra superior de acento animada */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 animate-pulse" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30 animate-bounce">
                  <Bell className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      ¡Nuevo Pedido Recibido!
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>

                  <p className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                    Orden #{activeAlert.order_number}
                  </p>

                  {activeAlert.customer_name && (
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Cliente: <span className="text-slate-900 dark:text-white">{activeAlert.customer_name}</span>
                    </p>
                  )}

                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                      ${activeAlert.total_usd.toFixed(2)} USD
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      (Bs. {(activeAlert.total_ves || activeAlert.total_usd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title={soundEnabled ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado (clic para activar)'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Cerrar notificación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveAlert(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                Ignorar
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAlert(null)
                  router.push('/admin/orders')
                }}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ver Pedido</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

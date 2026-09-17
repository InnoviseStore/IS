'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import { Bell, ShoppingBag, ArrowRight, X, Volume2, VolumeX } from 'lucide-react'

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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

    const notif: NewOrderNotification = {
      id: order.id,
      order_number: order.order_number || 'NUEVO',
      total_usd: Number(order.total_usd) || 0,
      total_ves: Number(order.total_ves) || (Number(order.total_usd) || 0) * exchangeRate,
      created_at: order.created_at,
      customer_name: custName,
      notes: order.notes,
    }

    setActiveAlert(notif)

    // 3. Notificar a las pantallas activas (Dashboard, Orders, etc.)
    window.dispatchEvent(new CustomEvent('is_new_order_received', { detail: order }))

    // 4. Auto-ocultar después de 14 segundos
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setActiveAlert(null)
    }, 14000)
  }, [soundEnabled, exchangeRate])

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

  if (!activeAlert) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
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
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
const HEARTBEAT_INTERVAL_MS = 25 * 1000 // 25 segundos

export function InactivityGuard() {
  const router = useRouter()
  const lastActivityRef = useRef<number>(Date.now())
  const sessionIdRef = useRef<string>('')

  useEffect(() => {
    // 1. Obtener o generar identificador único de sesión para este dispositivo/pestaña
    if (typeof window !== 'undefined') {
      let storedSessionId = sessionStorage.getItem('is_device_session_id')
      if (!storedSessionId) {
        storedSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        sessionStorage.setItem('is_device_session_id', storedSessionId)
      }
      sessionIdRef.current = storedSessionId
    }

    // 2. Escuchar eventos de interacción del usuario
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true })
    })

    // 3. Heartbeat periódico y verificación de sesión única concurrente
    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/admin/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            sessionId: sessionIdRef.current,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.forcedLogout && data.reason === 'concurrent_session') {
            // Desconectar inmediatamente: otro dispositivo abrió sesión
            const supabase = createClient()
            await supabase.auth.signOut().catch(() => {})
            router.push('/login?reason=concurrent_session')
          }
        }
      } catch {
        // Ignorar fallos de red en heartbeat
      }
    }

    // Enviar heartbeat inicial
    sendHeartbeat()
    const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    // 4. Verificación de inactividad de 30 minutos
    const inactivityTimer = setInterval(async () => {
      const now = Date.now()
      const elapsed = now - lastActivityRef.current

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // 30 minutos sin ninguna interacción del usuario
        clearInterval(inactivityTimer)
        clearInterval(heartbeatTimer)

        try {
          // Notificar al servidor el cierre de presencia
          await fetch('/api/admin/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'logout',
              sessionId: sessionIdRef.current,
            }),
          }).catch(() => {})

          // Cerrar sesión en Supabase (preserva el Service Worker y suscripción a notificaciones push)
          const supabase = createClient()
          await supabase.auth.signOut().catch(() => {})
        } finally {
          router.push('/login?reason=inactivity')
        }
      }
    }, 10000)

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, updateActivity)
      })
      clearInterval(inactivityTimer)
      clearInterval(heartbeatTimer)
    }
  }, [router])

  return null
}

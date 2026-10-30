'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Radio, Store, Clock, ChevronDown, CheckCircle2, RefreshCw, Timer } from 'lucide-react'
import { getRoleLabel } from '@/types/database'
import type { UserRole } from '@/types/database'
import { useTenant } from '@/contexts/TenantContext'

interface ActiveUser {
  userId: string
  tenantId: string
  fullName: string
  email: string
  role: string
  tenantName?: string
  connectedAt: number
  lastActive: number
  minutesAgo?: number
  connectedSeconds?: number
  connectedMinutes?: number
}

export function formatConnectionDuration(connectedAtMs: number, nowMs: number): string {
  if (!connectedAtMs || connectedAtMs > nowMs) return '00m 01s'
  const totalSec = Math.max(1, Math.floor((nowMs - connectedAtMs) / 1000))
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) {
    return `${hours}h ${pad(mins)}m ${pad(secs)}s`
  }
  return `${pad(mins)}m ${pad(secs)}s`
}

export function LivePresenceHeader() {
  const { tenant, profile } = useTenant()
  const [activeCount, setActiveCount] = useState<number>(0)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(profile?.role === 'superadmin')
  const [viewAllStores, setViewAllStores] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.role === 'superadmin') {
      setIsSuperAdmin(true)
    }
  }, [profile?.role])

  // Reloj en vivo cada 1 segundo para que el tiempo de conexión avance en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Enviar heartbeat y consultar usuarios activos
  const refreshPresence = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      let sessionId = ''
      let sessionStartedAt = Date.now()

      if (typeof window !== 'undefined') {
        sessionId = sessionStorage.getItem('is_device_session_id') || ''
        if (!sessionId) {
          sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
          sessionStorage.setItem('is_device_session_id', sessionId)
        }
        const storedStart = Number(sessionStorage.getItem('is_session_started_at') || '0')
        if (storedStart > 0 && storedStart <= Date.now()) {
          sessionStartedAt = storedStart
        } else {
          sessionStorage.setItem('is_session_started_at', String(sessionStartedAt))
        }
      }

      // 1. Heartbeat con datos de sesión y tienda activa
      await fetch('/api/admin/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          sessionId,
          sessionStartedAt,
          activeTenantId: tenant?.id,
        }),
      })

      // 2. Consulta de activos
      const params = new URLSearchParams()
      if (viewAllStores) {
        params.set('all', 'true')
      } else {
        params.set('all', 'false')
        if (tenant?.id) params.set('tenant_id', tenant.id)
      }

      const res = await fetch(`/api/admin/presence?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        const list: ActiveUser[] = Array.isArray(data.users) ? data.users : []
        const count = typeof data.activeCount === 'number' ? data.activeCount : (typeof data.total === 'number' ? data.total : list.length)
        setActiveCount(count)
        setActiveUsers(list)
        if (typeof data.isSuperAdmin === 'boolean') {
          setIsSuperAdmin(data.isSuperAdmin)
        }
      }
    } catch {
      // Fallo silencioso en segundo plano
    } finally {
      if (showSpinner) setRefreshing(false)
    }
  }, [viewAllStores, tenant?.id])

  useEffect(() => {
    refreshPresence()
    const interval = setInterval(() => refreshPresence(false), 20000) // cada 20s
    return () => clearInterval(interval)
  }, [refreshPresence])

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Encontrar la sesión del propio usuario para mostrar su tiempo en el badge si está disponible
  const currentUserRecord = activeUsers.find((u) => u.userId === profile?.id) || activeUsers[0]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Badge en la barra superior */}
      <button
        type="button"
        onClick={() => {
          const next = !isOpen
          setIsOpen(next)
          if (next) refreshPresence(true)
        }}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
          activeCount > 0
            ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/80 shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60'
        }`}
        title="Ver usuarios conectados en vivo y tiempo de conexión"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">En Vivo:</span>
        <span className="font-black text-emerald-700 dark:text-emerald-300">{activeCount}</span>
        {currentUserRecord?.connectedAt && (
          <span className="hidden lg:inline-flex items-center gap-1 pl-1.5 border-l border-emerald-300/70 dark:border-emerald-800 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
            <Timer className="w-3 h-3" />
            {formatConnectionDuration(currentUserRecord.connectedAt, nowTick)}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover / Dropdown con detalle de usuarios activos */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Popover Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                Usuarios Conectados ({activeCount})
              </h4>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setViewAllStores(!viewAllStores)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                    viewAllStores
                      ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                  }`}
                  title="Alternar entre todas las tiendas o solo la tienda activa"
                >
                  {viewAllStores ? '🌐 Todas las Tiendas' : `🏪 ${tenant?.name?.slice(0, 12) || 'Mi Tienda'}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => refreshPresence(true)}
                disabled={refreshing}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                title="Actualizar lista ahora"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* List of Active Users */}
          <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
            {activeUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No hay usuarios conectados en este filtro ahora mismo.
              </div>
            ) : (
              activeUsers.map((user) => {
                const isMe = user.userId === profile?.id
                const secSinceActive = Math.max(0, Math.floor((nowTick - (user.lastActive || nowTick)) / 1000))
                const minsAgo = Math.floor(secSinceActive / 60)
                const durationLabel = formatConnectionDuration(user.connectedAt || user.lastActive, nowTick)

                return (
                  <div
                    key={user.userId}
                    className="p-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {user.fullName}
                          </p>
                          {isMe && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap mt-0.5">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {getRoleLabel((user.role as UserRole) || 'cajero')}
                          </span>
                          {user.tenantName && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 text-slate-600 dark:text-slate-300 font-medium truncate">
                                <Store className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                {user.tenantName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Tiempo total de conexión en vivo */}
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70"
                        title="Tiempo transcurrido desde que inició su sesión actual"
                      >
                        <Timer className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{durationLabel}</span>
                      </span>

                      {/* Última actividad */}
                      <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        {minsAgo <= 0 ? 'Activo ahora' : `Act. hace ${minsAgo}m`}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex items-center justify-between px-3.5">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Monitoreo en tiempo real
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {activeCount} {activeCount === 1 ? 'conectado' : 'conectados'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Radio, Users, Shield, Store, Clock, ChevronDown, CheckCircle2, Globe } from 'lucide-react'
import { getRoleLabel } from '@/types/database'
import type { UserRole } from '@/types/database'

interface ActiveUser {
  userId: string
  fullName: string
  email: string
  role: string
  tenantName?: string
  minutesAgo: number
}

export function LivePresenceHeader() {
  const [activeCount, setActiveCount] = useState<number>(0)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false)
  const [viewAllStores, setViewAllStores] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Enviar heartbeat y consultar usuarios activos
  const refreshPresence = async () => {
    try {
      // 1. Heartbeat
      await fetch('/api/admin/presence', { method: 'POST' })
      
      // 2. Consulta de activos
      const res = await fetch(`/api/admin/presence${viewAllStores ? '?all=true' : ''}`)
      const data = await res.json()
      if (data.success) {
        setActiveCount(data.activeCount || 0)
        setActiveUsers(data.users || [])
        setIsSuperAdmin(Boolean(data.isSuperAdmin))
      }
    } catch {
      // Fallo silencioso en segundo plano
    }
  }

  useEffect(() => {
    refreshPresence()
    const interval = setInterval(refreshPresence, 45000) // cada 45s
    return () => clearInterval(interval)
  }, [viewAllStores])

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Badge en la barra superior */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
          activeCount > 0
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-200/60'
        }`}
        title="Ver usuarios conectados en vivo"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">En Vivo:</span>
        <span className="font-extrabold">{activeCount}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover / Dropdown con detalle de usuarios activos */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Popover Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Usuarios Conectados ({activeCount})
              </h4>
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setViewAllStores(!viewAllStores)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                  viewAllStores
                    ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {viewAllStores ? '🌐 Todas las Tiendas' : '🏪 Mi Tienda'}
              </button>
            )}
          </div>

          {/* List of Active Users */}
          <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
            {activeUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No hay otros colaboradores activos en este momento.
              </div>
            ) : (
              activeUsers.map((user) => (
                <div key={user.userId} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.fullName}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {getRoleLabel((user.role as UserRole) || 'cajero')}
                        </span>
                        {user.tenantName && isSuperAdmin && (
                          <>
                            <span>•</span>
                            <span className="truncate">{user.tenantName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                      <Clock className="w-2.5 h-2.5" />
                      {user.minutesAgo === 0 ? 'Activo ahora' : `Hace ${user.minutesAgo}m`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 text-center">
            <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Monitoreo de presencia en tiempo real
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Trash2,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShoppingBag,
  Package,
  Layers,
  Store,
  RefreshCw,
} from 'lucide-react'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { getRoleLabel } from '@/types/database'
import type { UserRole, Profile } from '@/types/database'

const ROLE_PERMISSIONS = [
  {
    role: 'cajero' as UserRole,
    name: 'Cajero / Facturación',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    icon: ShoppingBag,
    description: 'Opera el Punto de Venta (POS), emite facturas y cotizaciones, gestiona clientes y cobra pedidos web.',
    modules: ['Punto de Venta (POS)', 'Cierre de Caja', 'Pedidos Web', 'Clientes'],
  },
  {
    role: 'almacen' as UserRole,
    name: 'Almacén / Logística',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    icon: Package,
    description: 'Control de inventario, consulta de costos, existencias, ajustes de stock y despacho de pedidos web.',
    modules: ['Inventario (Control de Stock)', 'Pedidos Web (Despacho)'],
  },
  {
    role: 'vendedor' as UserRole,
    name: 'Vendedor / Asesor',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    icon: Store,
    description: 'Atiende clientes, genera cotizaciones, factura en POS y consulta el catálogo de productos.',
    modules: ['Punto de Venta (POS)', 'Cotizaciones', 'Clientes', 'Inventario (Catálogo)'],
  },
  {
    role: 'admin' as UserRole,
    name: 'Administrador de Tienda',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    icon: ShieldCheck,
    description: 'Control total de la sucursal: métricas, gestión de equipo, catálogo web, gastos y configuración.',
    modules: ['Dashboard & Métricas', 'Inventario & Costos', 'POS & Cierre', 'Gastos & Flujo', 'Catálogo Web', 'Equipo'],
  },
]

export default function AdminUsersPage() {
  const { tenant, profile: currentProfile } = useTenant()

  const [team, setTeam] = useState<Profile[]>([])
  const [maxUsers, setMaxUsers] = useState<number>(1)
  const [planName, setPlanName] = useState<string>('Básico')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modal Crear Usuario
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'cajero' as UserRole,
  })
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Modal Cambiar Rol
  const [roleModalUser, setRoleModalUser] = useState<Profile | null>(null)
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('cajero')
  const [isSubmittingRole, setIsSubmittingRole] = useState<boolean>(false)

  // Modal Reset Password
  const [pwdModalUser, setPwdModalUser] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState<string>('')
  const [isSubmittingPwd, setIsSubmittingPwd] = useState<boolean>(false)
  const [pwdError, setPwdError] = useState<string | null>(null)

  // Modal Eliminar
  const [deleteModalUser, setDeleteModalUser] = useState<Profile | null>(null)
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false)

  const isCurrentAdmin =
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'admin'

  const fetchTeam = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/admin/team')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar el equipo.')
      }
      setTeam(data.team || [])
      setMaxUsers(data.maxUsers ?? 1)
      setPlanName(data.planName || 'Básico')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  // Mostrar mensaje de éxito temporal
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  // Handle Crear Colaborador
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)

    if (!addForm.full_name.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('Por favor completa todos los campos requeridos.')
      return
    }

    if (addForm.password.length < 6) {
      setAddError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      setIsSubmittingAdd(true)
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el colaborador.')
      }

      setIsAddModalOpen(false)
      setAddForm({ full_name: '', email: '', password: '', role: 'cajero' })
      triggerSuccess('Colaborador creado y habilitado exitosamente.')
      await fetchTeam()
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Error al crear usuario.')
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Handle Cambiar Rol
  const handleUpdateRole = async () => {
    if (!roleModalUser) return
    try {
      setIsSubmittingRole(true)
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: roleModalUser.id,
          role: selectedNewRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el rol.')
      }
      setRoleModalUser(null)
      triggerSuccess('Rol del colaborador actualizado exitosamente.')
      await fetchTeam()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cambiar rol.')
    } finally {
      setIsSubmittingRole(false)
    }
  }

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwdModalUser) return
    setPwdError(null)

    if (newPassword.length < 6) {
      setPwdError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      setIsSubmittingPwd(true)
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pwdModalUser.id,
          password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo restablecer la contraseña.')
      }
      setPwdModalUser(null)
      setNewPassword('')
      triggerSuccess('Contraseña restablecida exitosamente.')
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Error al actualizar contraseña.')
    } finally {
      setIsSubmittingPwd(false)
    }
  }

  // Handle Eliminar Colaborador
  const handleDeleteUser = async () => {
    if (!deleteModalUser) return
    try {
      setIsSubmittingDelete(true)
      const res = await fetch(`/api/admin/team?id=${deleteModalUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el usuario.')
      }
      setDeleteModalUser(null)
      triggerSuccess('Colaborador eliminado del equipo.')
      await fetchTeam()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar usuario.')
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  const isUnlimited = !Number.isFinite(maxUsers)
  const isLimitReached = !isUnlimited && team.length >= maxUsers
  const usagePercentage = isUnlimited ? 20 : Math.min(100, Math.round((team.length / maxUsers) * 100))

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Gestión de Equipo & Roles
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Administra los colaboradores de tu tienda, asigna módulos de acceso y controla los cupos de tu plan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTeam()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
            title="Actualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isCurrentAdmin && (
            <button
              onClick={() => {
                setAddError(null)
                setIsAddModalOpen(true)
              }}
              disabled={isLimitReached}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95 ${
                isLimitReached
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 cursor-pointer'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Colaborador</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Top Cards: Plan Usage Meter & Roles Explainer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card: Plan Usage */}
        <div className="lg:col-span-1 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Límite de Colaboradores
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Plan {planName}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                {team.length}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                / {isUnlimited ? '∞ Ilimitados' : `${maxUsers} usuarios`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLimitReached
                    ? 'bg-rose-500'
                    : usagePercentage > 75
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isUnlimited
                ? 'Tu plan Enterprise permite crear usuarios de forma ilimitada para todas las áreas.'
                : isLimitReached
                ? 'Has alcanzado el límite máximo de usuarios para tu plan actual. Mejora tu suscripción a Pro o Enterprise para agregar más cuentas.'
                : `Tienes ${maxUsers - team.length} cupo(s) disponible(s) en tu plan actual.`}
            </p>
          </div>

          {isLimitReached && (
            <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800">
              <a
                href="/admin/settings"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Mejorar a Plan Pro o Enterprise
              </a>
            </div>
          )}
        </div>

        {/* Card: Permissions & Security Matrix */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-black/40">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm mb-4">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Módulos de Acceso por Rol</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {ROLE_PERMISSIONS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.role}
                  className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between space-y-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-2xs">
                          <Icon className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${item.badgeClass}`}>
                        {item.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                      {item.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/40 flex flex-wrap gap-1">
                    {item.modules.map((mod) => (
                      <span
                        key={mod}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Team Table Card */}
      <div className="rounded-3xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-black/40 overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Colaboradores de la Tienda ({team.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Tienda: {tenant?.name || 'Innovise Store'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs font-medium">Cargando equipo de la tienda...</p>
          </div>
        ) : team.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No hay colaboradores registrados
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Agrega tu primer cajero, asesor o encargado de almacén.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5">Colaborador</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Fecha Registro</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {team.map((user) => {
                  const isOwner = user.role === 'owner' || user.role === 'superadmin'
                  const isSelf = user.id === currentProfile?.id
                  const userRole = (user.role || 'cajero') as UserRole

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 text-xs shadow-2xs">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {user.full_name || 'Sin nombre'}
                              {isSelf && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400">ID: {user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {user.email || '—'}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                            userRole === 'superadmin' || userRole === 'owner' || userRole === 'admin'
                              ? 'bg-purple-100/90 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                              : userRole === 'cajero' || userRole === 'cashier'
                              ? 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                              : userRole === 'almacen'
                              ? 'bg-amber-100/90 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                              : 'bg-blue-100/90 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                          }`}
                        >
                          {getRoleLabel(userRole)}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cambiar Rol */}
                          {!isOwner && isCurrentAdmin && (
                            <button
                              onClick={() => {
                                setRoleModalUser(user)
                                setSelectedNewRole((user.role as UserRole) || 'cajero')
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold transition"
                              title="Cambiar rol o módulos"
                            >
                              Cambiar Rol
                            </button>
                          )}

                          {/* Reset Password */}
                          {isCurrentAdmin && (
                            <button
                              onClick={() => {
                                setPwdModalUser(user)
                                setNewPassword('')
                                setPwdError(null)
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              title="Restablecer contraseña"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {!isOwner && !isSelf && isCurrentAdmin && (
                            <button
                              onClick={() => setDeleteModalUser(user)}
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                              title="Eliminar colaborador"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Crear Nuevo Colaborador */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Agregar Nuevo Colaborador
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Crea los accesos de inicio de sesión para el personal de tu tienda.
                  </p>
                </div>
              </div>
            </div>

            {addError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Nombre Completo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Mendoza"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico (Login) *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="cajero@mitienda.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Contraseña Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña de Acceso (mínimo 6 caracteres) *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Rol y Módulos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rol Asignado & Módulos Disponibles *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_PERMISSIONS.map((p) => {
                    const isSelected = addForm.role === p.role
                    return (
                      <button
                        type="button"
                        key={p.role}
                        onClick={() => setAddForm({ ...addForm, role: p.role })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {p.name.split('/')[0].trim()}
                          </span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {p.modules.join(', ')}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/25 disabled:opacity-50"
                >
                  {isSubmittingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingAdd ? 'Creando...' : 'Crear Colaborador'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cambiar Rol */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cambiar Rol de {roleModalUser.full_name || roleModalUser.email}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Selecciona el nuevo rol y nivel de acceso para este usuario.
              </p>
            </div>

            <div className="space-y-2">
              {ROLE_PERMISSIONS.map((p) => {
                const isSelected = selectedNewRole === p.role
                return (
                  <button
                    type="button"
                    key={p.role}
                    onClick={() => setSelectedNewRole(p.role)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {p.name}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Módulos: {p.modules.join(', ')}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={isSubmittingRole}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Guardar Nuevo Rol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Restablecer Contraseña */}
      {pwdModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Restablecer Contraseña
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Para {pwdModalUser.full_name || pwdModalUser.email}
                </p>
              </div>
            </div>

            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {pwdError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPwdModalUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPwd}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmittingPwd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Contraseña</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: Eliminar Colaborador */}
      <ConfirmModal
        isOpen={Boolean(deleteModalUser)}
        title="¿Eliminar Colaborador?"
        message={`¿Estás seguro de que deseas eliminar a "${deleteModalUser?.full_name || deleteModalUser?.email}"? Esta acción revocará de inmediato sus credenciales y accesos a la tienda.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        isDestructive={true}
        isLoading={isSubmittingDelete}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteModalUser(null)}
      />
    </div>
  )
}

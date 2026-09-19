'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'
import {
  X,
  Loader2,
  UserPlus,
  AlertCircle,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react'
import {
  parseCustomerAuth,
  serializeCustomerNotes,
  hashCustomerPassword,
  generateRandomCustomerPassword,
} from '@/lib/customerUtils'

interface CustomerModalProps {
  tenantId: string
  customer?: Customer | null
  onClose: () => void
  onSaved: (savedCustomer: Customer) => void
}

export function CustomerModal({ tenantId, customer, onClose, onSaved }: CustomerModalProps) {
  const existingAuth = useMemo(() => parseCustomerAuth(customer?.notes), [customer?.notes])

  const [fullName, setFullName] = useState(customer?.full_name ?? '')
  const [idNumber, setIdNumber] = useState(customer?.id_number ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [creditLimitUsd, setCreditLimitUsd] = useState(customer?.credit_limit_usd?.toString() ?? '100')
  const [userNotes, setUserNotes] = useState(existingAuth.userNotes || '')

  // Configuración de acceso web
  const [enableWebAccess, setEnableWebAccess] = useState(!customer || existingAuth.hasAccount)
  const [customPassword, setCustomPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Detectar si el usuario ingresó datos nuevos
  const isDirty = Boolean(
    fullName.trim() !== (customer?.full_name ?? '') ||
    idNumber.trim() !== (customer?.id_number ?? '') ||
    phone.trim() !== (customer?.phone ?? '') ||
    email.trim() !== (customer?.email ?? '') ||
    address.trim() !== (customer?.address ?? '') ||
    userNotes.trim() !== existingAuth.userNotes ||
    customPassword.trim().length > 0
  )

  function handleAttemptClose() {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  // Interceptar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleAttemptClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty])

  function handleGeneratePassword() {
    setCustomPassword(generateRandomCustomerPassword())
    setShowPassword(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('El nombre o razón social del cliente es obligatorio.')
      return
    }

    if (enableWebAccess && customPassword && customPassword.trim().length < 4) {
      setError('La contraseña de acceso web debe tener al menos 4 caracteres.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Determinar hash de contraseña
      let passwordHash = existingAuth.passwordHash
      if (customPassword.trim().length >= 4) {
        passwordHash = hashCustomerPassword(customPassword.trim())
      }

      // Serializar notas
      const finalNotes = enableWebAccess || existingAuth.hasAccount || passwordHash
        ? serializeCustomerNotes(passwordHash, userNotes.trim(), {
            ...existingAuth.metadata,
            last_modal_update: new Date().toISOString(),
          })
        : userNotes.trim() || null

      const payload = {
        tenant_id: tenantId,
        full_name: fullName.trim(),
        id_number: idNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        credit_limit_usd: parseFloat(creditLimitUsd) || 0,
        notes: finalNotes,
        is_active: true,
      }

      let saved: Customer | null = null

      if (customer?.id) {
        const { data, error: updateErr } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customer.id)
          .select()
          .single()

        if (updateErr) throw new Error(updateErr.message)
        saved = data
      } else {
        const { data, error: insertErr } = await supabase
          .from('customers')
          .insert({
            ...payload,
            current_debt_usd: 0,
          })
          .select()
          .single()

        if (insertErr) throw new Error(insertErr.message)
        saved = data
      }

      if (saved) {
        onSaved(saved)
        onClose()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleAttemptClose} />
      <div className="relative z-10 w-full max-w-lg glass-card p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl my-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {customer ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {customer ? 'Actualiza los datos del cliente' : 'Añade un cliente para facturación, POS y catálogo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Nombre Completo / Razón Social <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ej. María Fernández o Inversiones Alfa C.A."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Cédula / RIF
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="ej. V-18.542.310 / J-12345678-9"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ej. 04141234567"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej. cliente@gmail.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Límite de Crédito (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditLimitUsd}
                  onChange={(e) => setCreditLimitUsd(e.target.value)}
                  placeholder="100.00"
                  className="w-full pl-7 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Dirección de Entrega / Facturación
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ej. Av. Principal, Edif. Centro, Caracas"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sección de Acceso Web al Catálogo */}
          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWebAccess}
                  onChange={(e) => setEnableWebAccess(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  Acceso Web al Catálogo
                </span>
              </label>
              {existingAuth.hasAccount && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                  Cuenta Activa
                </span>
              )}
            </div>

            {enableWebAccess && (
              <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    {customer && existingAuth.hasAccount
                      ? 'Cambiar / Asignar nueva contraseña:'
                      : 'Contraseña para inicio de sesión:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generar Clave</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={
                      existingAuth.hasAccount
                        ? 'Dejar en blanco para mantener la contraseña actual'
                        : 'ej. IS-8492 o Clave2026'
                    }
                    className="w-full pl-3 pr-10 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Notas Adicionales
            </label>
            <textarea
              rows={2}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Preferencias de pago, horarios o comentarios..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{customer ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
            </button>
          </div>
        </form>

        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    ¿Descartar datos del cliente?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Tienes información ingresada sin guardar. Si sales ahora, todos los cambios se perderán.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Continuar Editando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose()
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                >
                  Sí, Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

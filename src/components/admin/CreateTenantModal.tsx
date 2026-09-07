'use client'

import { useState } from 'react'
import { X, Loader2, Store, KeyRound, Mail, Phone, Tag } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTenantModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [phone, setPhone] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [plan, setPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function handleNameChange(val: string) {
    setName(val)
    // Auto-suggest clean slug
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    setSlug(generated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }

    if (adminPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          phone_whatsapp: phone.trim() || null,
          adminEmail: adminEmail.trim(),
          adminPassword,
          plan,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear la tienda.')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div 
        style={{ width: '100%', maxWidth: '680px', maxHeight: '88vh' }}
        className="relative z-10 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-all my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Crear Nueva Tienda (SaaS)</h2>
              <p className="text-[11px] text-slate-500">Configura un nuevo comercio cliente en 30 segundos</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-medium">
            {/* Nombre y Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bodegón Caracas"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Slug URL Vitrina</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400 font-mono text-xs">/</span>
                  <input
                    type="text"
                    required
                    placeholder="bodegon-caracas"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="w-full pl-6 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp y Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp de Pedidos
                </label>
                <input
                  type="text"
                  placeholder="584121234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Plan SaaS
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  <option value="basic">Básico</option>
                  <option value="pro">Profesional (Recomendado)</option>
                  <option value="enterprise">Corporativo / Enterprise</option>
                </select>
              </div>
            </div>

            {/* Credenciales de Acceso */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                Cuenta del Dueño (Owner)
              </p>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Correo Electrónico de Acceso</label>
                <input
                  type="email"
                  required
                  placeholder="contacto@comercio.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                {error}
              </p>
            )}
          </div>

          {/* Sticky footer actions */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear Tienda
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

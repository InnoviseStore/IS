'use client'

import { useState, useEffect } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { Save, ExternalLink, RefreshCw, Loader2, AlertCircle, Check, Tag, Sparkles } from 'lucide-react'
import { getPlanLabel } from '@/lib/formatters'
import Link from 'next/link'

export default function SettingsPage() {
  const { tenant, exchangeRate, bcvFechaValor, isSyncingBcv, syncBcvRate, updateTenantSettings } = useTenant()
  const [rate, setRate] = useState(exchangeRate.toString())
  const [phone, setPhone] = useState(tenant?.phone_whatsapp ?? '')
  const [plan, setPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Sincronizar inputs cuando cargue el tenant
  useEffect(() => {
    if (tenant?.phone_whatsapp) {
      setPhone(tenant.phone_whatsapp)
    }
    const tenantSettings = (tenant?.settings || {}) as Record<string, unknown>
    const currentPlan = (tenantSettings.plan as any) || (tenant as any)?.plan || 'pro'
    setPlan(currentPlan)
  }, [tenant])

  useEffect(() => {
    setRate(exchangeRate.toString())
  }, [exchangeRate])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMessage(null)

    const r = parseFloat(rate)
    const payload: { phone_whatsapp?: string; currency_rate_bcv?: number; plan?: string } = {
      phone_whatsapp: phone.trim(),
      plan,
    }

    if (!isNaN(r) && r > 0) {
      payload.currency_rate_bcv = r
    }

    const res = await updateTenantSettings(payload)

    setSaving(false)
    if (res.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setErrorMessage(res.error || 'No se pudo guardar la configuración.')
    }
  }

  async function handleLiveSync() {
    const res = await syncBcvRate()
    if (res.rate) {
      setRate(res.rate.toString())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Configuración de Tienda</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-medium">Parámetros generales de {tenant?.name}</p>
      </div>

      <div className="glass-card p-6 border border-slate-200/80 dark:border-slate-800/80">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
              Nombre de la Tienda
            </label>
            <input
              type="text"
              disabled
              value={tenant?.name ?? 'Innovise Store'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
              Slug del Storefront (URL Pública)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                value={`/${tenant?.slug ?? 'innovise'}`}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-sm cursor-not-allowed font-mono font-semibold"
              />
              <Link
                href={`/${tenant?.slug ?? 'innovise'}`}
                target="_blank"
                className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center justify-center border border-blue-200 dark:border-blue-800/60"
                title="Abrir vitrina virtual"
              >
                <ExternalLink className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wide">
              Teléfono WhatsApp (Pedidos Storefront)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="584121234567"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Formato internacional sin signos (ej. 584121234567).</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Tasa Oficial BCV (USD/VES)
              </label>
              <button
                type="button"
                onClick={handleLiveSync}
                disabled={isSyncingBcv}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBcv ? 'animate-spin' : ''}`} />
                Sincronizar ahora con bcv.org.ve
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">Bs.</span>
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold"
              />
            </div>
            {bcvFechaValor && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                Fecha Valor oficial registrada: <strong className="text-slate-800 dark:text-slate-200">{bcvFechaValor}</strong>
              </p>
            )}
          </div>

          {/* Plan de la Tienda */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Plan SaaS de la Tienda
              </label>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                Plan Activo: {getPlanLabel(plan)}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Selecciona el plan que se adapte al volumen de tu negocio. Puedes cambiarlo en cualquier momento:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Básico */}
              <button
                type="button"
                onClick={() => setPlan('basic')}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer relative flex flex-col justify-between ${
                  plan === 'basic'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">🟢 Básico</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">$15/m</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    1 Sucursal POS, WhatsApp checkout, 150 productos.
                  </p>
                </div>
                {plan === 'basic' && (
                  <span className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Seleccionado
                  </span>
                )}
              </button>

              {/* Pro */}
              <button
                type="button"
                onClick={() => setPlan('pro')}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer relative flex flex-col justify-between overflow-hidden ${
                  plan === 'pro'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-800/40'
                }`}
              >
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-bl">
                  Popular
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">🔵 Pro</span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">$35/m</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    BCV en vivo, Pagos Divididos, Créditos 7d, IA Edith.
                  </p>
                </div>
                {plan === 'pro' && (
                  <span className="mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Seleccionado
                  </span>
                )}
              </button>

              {/* Enterprise */}
              <button
                type="button"
                onClick={() => setPlan('enterprise')}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer relative flex flex-col justify-between ${
                  plan === 'enterprise'
                    ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/30 shadow-xs ring-1 ring-purple-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">🟣 Enterprise</span>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">$79/m</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    Multi-cajas, Dominio Propio, API, Soporte 24/7.
                  </p>
                </div>
                {plan === 'enterprise' && (
                  <span className="mt-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Seleccionado
                  </span>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" /> Cambios guardados correctamente
              </span>
            ) : <span />}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
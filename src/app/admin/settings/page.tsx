'use client'

import { useState } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { Save, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { tenant, exchangeRate, bcvFechaValor, isSyncingBcv, syncBcvRate, setExchangeRate } = useTenant()
  const [rate, setRate] = useState(exchangeRate.toString())
  const [phone, setPhone] = useState(tenant?.phone_whatsapp ?? '')
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const r = parseFloat(rate)
    if (!isNaN(r) && r > 0) {
      setExchangeRate(r)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
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

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {saved ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Cambios guardados correctamente</span>
            ) : <span />}
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition active:scale-95 shadow-md shadow-blue-500/20"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
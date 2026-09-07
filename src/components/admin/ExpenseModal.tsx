'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/TenantContext'
import type { Expense } from '@/types/database'
import { X, Loader2, UploadCloud } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  expense?: Expense | null
}

const CATEGORIES = [
  'Nómina y Salarios',
  'Alquiler de Local',
  'Servicios Públicos (Luz/Agua/Gas)',
  'Telecomunicaciones e Internet',
  'Insumos y Papelería',
  'Mantenimiento y Reparaciones',
  'Delivery y Envíos',
  'Publicidad y Mercadeo',
  'Impuestos y Tasas',
  'Otro Egresos',
]

const PAYMENT_METHODS = [
  { id: 'pago_movil', label: 'Pago Móvil (VES)' },
  { id: 'transfer_ves', label: 'Transferencia (VES)' },
  { id: 'cash_ves', label: 'Efectivo VES' },
  { id: 'cash_usd', label: 'Efectivo USD' },
  { id: 'zelle', label: 'Zelle (USD)' },
]

export function ExpenseModal({ isOpen, onClose, onSuccess, expense }: Props) {
  const { tenant, profile, exchangeRate } = useTenant()
  const [category, setCategory] = useState(expense?.category ?? CATEGORIES[0])
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amountInput, setAmountInput] = useState(expense ? String(expense.amount_usd) : '')
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'VES'>('USD')
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method ?? 'pago_movil')
  const [supplierName, setSupplierName] = useState(expense?.supplier_name ?? '')
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring ?? false)
  const [recurrencePeriod, setRecurrencePeriod] = useState<string>(expense?.recurrence_period ?? 'monthly')
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date ?? new Date().toISOString().split('T')[0])
  const [receiptUrl, setReceiptUrl] = useState(expense?.receipt_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Math conversions
  const rawNum = parseFloat(amountInput) || 0
  const amountUsd = inputCurrency === 'USD' ? rawNum : rawNum / exchangeRate
  const amountVes = inputCurrency === 'VES' ? rawNum : rawNum * exchangeRate

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || !profile) return
    if (!description.trim() || rawNum <= 0) {
      setError('Por favor completa la descripción y un monto válido.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const payload = {
        tenant_id: tenant.id,
        category,
        description: description.trim(),
        amount_usd: parseFloat(amountUsd.toFixed(4)),
        amount_ves: parseFloat(amountVes.toFixed(2)),
        exchange_rate: exchangeRate,
        payment_method: paymentMethod,
        supplier_name: supplierName.trim() || null,
        receipt_url: receiptUrl.trim() || null,
        is_recurring: isRecurring,
        recurrence_period: isRecurring ? (recurrencePeriod as Expense['recurrence_period']) : null,
        expense_date: expenseDate,
        created_by: profile.id,
      }

      if (expense) {
        const { error: err } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expense.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('expenses')
          .insert(payload)
        if (err) throw err
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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 my-6 transition-all">
        {/* Header minimalista */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {expense ? 'Editar Gasto' : 'Registrar Gasto'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          {/* Categoría y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-white dark:bg-slate-800">{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Fecha de Pago</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Descripción o Concepto</label>
            <input
              type="text"
              placeholder="Ej: Pago quincena vendedor de piso, luz mes en curso..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 outline-none"
            />
          </div>

          {/* Monto y Moneda */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-600 dark:text-slate-400 font-semibold">Monto</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setInputCurrency('USD')}
                  className={`px-2 py-0.5 rounded-md font-bold transition ${inputCurrency === 'USD' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setInputCurrency('VES')}
                  className={`px-2 py-0.5 rounded-md font-bold transition ${inputCurrency === 'VES' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  VES (Bs.)
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={inputCurrency === 'USD' ? '0.00 USD' : '0.00 Bs.'}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-1 focus:ring-slate-400 outline-none"
              />
            </div>

            {/* Conversión visual sutil */}
            {rawNum > 0 && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-right">
                Equivalente: <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {inputCurrency === 'USD'
                    ? `Bs. ${amountVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${amountUsd.toFixed(2)} USD`}
                </span> (Tasa: {exchangeRate.toFixed(2)})
              </p>
            )}
          </div>

          {/* Forma de Pago y Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Proveedor / Beneficiario</label>
              <input
                type="text"
                placeholder="Opcional"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Enlace o foto de comprobante */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
              Comprobante o Factura (URL / Referencia)
            </label>
            <input
              type="text"
              placeholder="https://... o Nro de recibo"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
            />
          </div>

          {/* Recurrencia */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-slate-900 dark:accent-slate-100"
              />
              <span className="font-semibold">¿Es un gasto recurrente?</span>
            </label>

            {isRecurring && (
              <select
                value={recurrencePeriod}
                onChange={(e) => setRecurrencePeriod(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </select>
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg">
              {error}
            </p>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {expense ? 'Guardar Cambios' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

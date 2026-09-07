'use client'

import { useState } from 'react'
import { Sparkles, Send, X, Bot, Loader2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function EdithAssistantModal() {
  const { tenant, exchangeRate } = useTenant()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `¡Hola! Soy Edith, tu copiloto inteligente de administración para ${tenant?.name ?? 'Innovise Store'}. ¿En qué te ayudo hoy? Puedes consultarme sobre tus ventas, qué productos reponer o tu ganancia neta.`,
    },
  ])
  const [loading, setLoading] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          tenantSlug: tenant?.slug,
          exchangeRate,
        }),
      })

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'No pude procesar esa consulta en este momento.',
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Hubo un error de conexión al consultar el asistente inteligente.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón flotante minimalista */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500 animate-pulse" />
        Preguntar a Edith (IA)
      </button>

      {/* Modal flotante */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[480px] transition-all">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Edith Copiloto</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">IA Activa</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-2.5 rounded-xl leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Edith está pensando...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Pregúntale algo sobre tu negocio..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

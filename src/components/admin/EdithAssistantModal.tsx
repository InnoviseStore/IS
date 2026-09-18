'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  X,
  Bot,
  Loader2,
  Package,
  ShoppingCart,
  Home,
  BarChart3,
  RotateCcw,
  Lock
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { getTenantFeatures } from '@/lib/planLimits'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  {
    id: 'stock',
    icon: Package,
    label: '📦 ¿Qué productos están por agotarse?',
    prompt: '¿Qué productos están por agotarse?',
    color: 'hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400'
  },
  {
    id: 'sales',
    icon: ShoppingCart,
    label: '🛒 ¿Cómo van mis ventas hoy?',
    prompt: '¿Cómo van mis ventas hoy?',
    color: 'hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
  },
  {
    id: 'cash',
    icon: Home,
    label: '🏠 ¿Cuánto dinero tengo disponible?',
    prompt: '¿Cuánto dinero tengo disponible?',
    color: 'hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
  },
  {
    id: 'profit',
    icon: BarChart3,
    label: '📊 ¿Cuánta utilidad generé este mes?',
    prompt: '¿Cuánta utilidad generé este mes?',
    color: 'hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
  }
]

export function EdithAssistantModal() {
  const { tenant, exchangeRate } = useTenant()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')

  const features = getTenantFeatures(tenant)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `¡Hola! Soy Edith, tu copiloto inteligente de administración para **${tenant?.name ?? 'tu tienda'}**.\n\nPuedes hacerme preguntas directas o presionar cualquiera de los botones rápidos de abajo sobre ventas, inventario crítico, dinero en caja o utilidad neta.`,
    },
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  async function executePrompt(userPrompt: string) {
    if (!userPrompt.trim() || loading) return

    const cleanPrompt = userPrompt.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: cleanPrompt }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          tenantSlug: tenant?.slug || 'innovise',
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
          content: 'Hubo un error de conexión al consultar al copiloto Edith.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    executePrompt(input)
  }

  function resetChat() {
    setMessages([
      {
        role: 'assistant',
        content: `Chat reiniciado. Estoy lista para responder sobre las métricas y estado operativo de **${tenant?.name ?? 'tu tienda'}**.`,
      },
    ])
  }

  return (
    <>
      {/* Pestaña Lateral Discreta de Edith (Acoplada al borde derecho sin tapar botones) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 py-3 pl-2.5 pr-1.5 rounded-l-2xl border-l border-y shadow-2xl transition-all duration-200 cursor-pointer select-none group ${
          isOpen
            ? 'bg-gradient-to-l from-indigo-700 to-blue-700 text-white border-indigo-400 shadow-indigo-500/30'
            : 'bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 dark:from-slate-900 dark:to-indigo-950 text-white border-indigo-400/30 hover:pl-3.5 hover:border-indigo-400 shadow-slate-950/40 backdrop-blur-md'
        }`}
        aria-label={isOpen ? 'Cerrar copiloto Edith' : 'Abrir copiloto inteligente Edith'}
        title="Copiloto Inteligente Edith (IA) — Asistente de negocio"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-indigo-200 group-hover:rotate-90 transition-transform" />
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-300 group-hover:scale-110 transition-transform" />
              <Sparkles className="w-2.5 h-2.5 text-amber-400 absolute -top-1.5 -right-1.5 animate-pulse" />
            </div>
            <span className="text-[9px] font-black tracking-widest text-indigo-200 uppercase leading-none mt-0.5">
              IA
            </span>
          </>
        )}
      </button>

      {/* Ventana Desplegable de Edith */}
      {isOpen && (
        <div
          className="fixed bottom-20 md:bottom-6 right-2 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-[410px] max-w-[420px] h-[520px] max-h-[75vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                    Edith Copiloto
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[190px]">
                  {tenant?.name ?? 'Innovise Store'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {features.hasAIEdith && (
                <button
                  type="button"
                  onClick={resetChat}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Reiniciar conversación"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Minimizar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!features.hasAIEdith ? (
            /* Pantalla de Bloqueo para Plan Básico */
            <div className="p-6 text-center space-y-4 flex flex-col items-center justify-center flex-1">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Copiloto IA Edith (Exclusivo Plan Pro)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                  Las consultas inteligentes sobre inventario crítico, ventas del día, caja disponible y utilidad neta con IA están disponibles a partir de <strong>Plan Pro</strong> y <strong>Plan Enterprise</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-700 dark:text-blue-300 font-semibold max-w-xs">
                Contacta al Administrador de la plataforma para activar tu Copiloto Edith.
              </div>
            </div>
          ) : (
            <>
              {/* Área de Mensajes */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs min-h-0">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] p-3 rounded-2xl leading-relaxed whitespace-pre-wrap text-xs ${
                        m.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-br-xs shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/50 dark:border-slate-700/50 shadow-2xs'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/60">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Consultando métricas de tu tienda...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Botones Predeterminados Rápidos */}
              <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex-shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Consultas Rápidas:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.id}
                      type="button"
                      disabled={loading}
                      onClick={() => executePrompt(qp.prompt)}
                      className={`px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs flex items-center gap-1.5 ${qp.color}`}
                    >
                      <span className="truncate">{qp.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Formulario de Entrada */}
              <form
                onSubmit={handleSend}
                className="p-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900 flex-shrink-0"
              >
                <input
                  type="text"
                  placeholder="Pregúntale algo a Edith..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-40 transition shadow-xs active:scale-95 cursor-pointer"
                  title="Enviar consulta"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}

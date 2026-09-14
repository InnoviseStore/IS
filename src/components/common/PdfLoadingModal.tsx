'use client'

import React from 'react'
import { Loader2, FileText, Sparkles } from 'lucide-react'

interface PdfLoadingModalProps {
  isOpen: boolean
  title?: string
  message?: string
}

export function PdfLoadingModal({
  isOpen,
  title = 'Generando Documento PDF',
  message = 'Procesando diseño formal, logotipo y desglose bimonetario...',
}: PdfLoadingModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop con desenfoque suave */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in" />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-950/60 animate-ping opacity-30" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <FileText className="w-7 h-7 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full shadow-xs">
            <Sparkles className="w-3 h-3" />
          </div>
        </div>

        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Por favor espera un instante...</span>
        </div>
      </div>
    </div>
  )
}

'use client';

import { TrendingUp, ExternalLink } from 'lucide-react';

interface ExchangeRateBannerProps {
  exchangeRate: number;
  rateDate: string | null;
  fechaValor?: string | null;
}

export default function ExchangeRateBanner({
  exchangeRate,
  rateDate,
  fechaValor,
}: ExchangeRateBannerProps) {
  const formatted = exchangeRate.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const displayDate = fechaValor || rateDate || 'Oficial';

  return (
    <div className="mb-6 flex items-center justify-center px-4">
      <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-blue-200/60 dark:border-blue-900/40 shadow-sm text-sm text-slate-700 dark:text-slate-200">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex items-center gap-1.5 font-medium">
          <span>Tasa Oficial BCV:</span>
          <span className="font-bold text-blue-700 dark:text-blue-400">
            Bs. {formatted}/USD
          </span>
        </div>

        {displayDate && (
          <>
            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              Fecha Valor: <strong className="font-semibold text-slate-700 dark:text-slate-300">{displayDate}</strong>
            </span>
          </>
        )}

        <a
          href="https://www.bcv.org.ve/"
          target="_blank"
          rel="noopener noreferrer"
          title="Verificar en la página oficial del Banco Central de Venezuela"
          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline ml-1"
        >
          <span>bcv.org.ve</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
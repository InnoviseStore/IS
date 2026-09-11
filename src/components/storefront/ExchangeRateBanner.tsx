'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';

interface ExchangeRateBannerProps {
  exchangeRate: number;
  rateDate?: string | null;
  fechaValor?: string | null;
  tenantSlug?: string;
}

function formatDisplayDate(rawDate?: string | null): string {
  if (rawDate && rawDate.trim().length > 0 && rawDate !== 'Oficial' && rawDate !== 'Oficial BCV') {
    const clean = rawDate.replace(/\s+/g, ' ').trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Fallback to today's date in Venezuelan Spanish
  try {
    const today = new Intl.DateTimeFormat('es-VE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return today.charAt(0).toUpperCase() + today.slice(1);
  } catch {
    return 'Hoy';
  }
}

export default function ExchangeRateBanner({
  exchangeRate: initialRate,
  rateDate,
  fechaValor: initialFechaValor,
  tenantSlug = 'innovise',
}: ExchangeRateBannerProps) {
  const [currentRate, setCurrentRate] = useState(initialRate);
  const [currentFechaValor, setCurrentFechaValor] = useState(initialFechaValor);

  // Background sync on client mount to ensure real-time rate & date matching today
  useEffect(() => {
    let isMounted = true;

    async function syncRate() {
      try {
        const res = await fetch(`/api/exchange-rate?tenant=${encodeURIComponent(tenantSlug)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          if (typeof data.rate === 'number' && data.rate > 0) {
            setCurrentRate(data.rate);
          }
          if (data.fechaValor) {
            setCurrentFechaValor(data.fechaValor);
          }
        }
      } catch (err) {
        console.warn('Background exchange rate sync error:', err);
      }
    }

    syncRate();
    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  const formatted = currentRate.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const displayDate = formatDisplayDate(currentFechaValor || rateDate);

  return (
    <div className="mb-6 flex items-center justify-center px-2 sm:px-4">
      <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-blue-200/60 dark:border-blue-900/40 shadow-xs text-xs sm:text-sm text-slate-700 dark:text-slate-200 text-center">
        <div className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60">
          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 font-medium">
          <span>Tasa BCV:</span>
          <span className="font-bold text-blue-700 dark:text-blue-400">
            Bs. {formatted}/USD
          </span>
        </div>

        {displayDate && (
          <>
            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
              Fecha Valor: <strong className="font-semibold text-slate-700 dark:text-slate-300">{displayDate}</strong>
            </span>
          </>
        )}

        <a
          href="https://www.bcv.org.ve/"
          target="_blank"
          rel="noopener noreferrer"
          title="Verificar en la página oficial del Banco Central de Venezuela"
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 hover:underline ml-0.5 sm:ml-1"
        >
          <span>bcv.org.ve</span>
          <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </a>
      </div>
    </div>
  );
}
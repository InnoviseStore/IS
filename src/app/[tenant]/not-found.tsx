import Link from 'next/link';
import { Store, ArrowLeft } from 'lucide-react';

export default function TenantNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-100 scale-[1.8] opacity-50" />
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Store className="h-10 w-10 text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Error code */}
        <p className="text-6xl font-black text-blue-100 select-none">404</p>

        {/* Heading */}
        <h1 className="mt-2 text-2xl font-extrabold text-slate-800 tracking-tight">
          Tienda no encontrada
        </h1>

        {/* Description */}
        <p className="mt-3 text-slate-500 text-base leading-relaxed">
          La tienda que buscas no existe, está inactiva, o la dirección es
          incorrecta. Verifica el enlace e intenta de nuevo.
        </p>

        {/* CTA */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-blue-200 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

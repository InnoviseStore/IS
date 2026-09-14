'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Package,
  MessageCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { buildWhatsAppCheckoutUrl } from '@/lib/whatsapp';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatUsd(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVes(n: number) {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CartDrawerProps {
  tenantSlug: string;
  exchangeRate: number;
  storePhone: string;
  storeName: string;
}

// ─── Empty state illustration ─────────────────────────────────────────────────
function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-950/60 scale-150 opacity-50" />
        <ShoppingBag className="relative h-20 w-20 text-blue-300 dark:text-blue-500" strokeWidth={1.2} />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">Tu carrito está vacío</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Agrega productos desde el catálogo para armar tu pedido.
        </p>
      </div>
    </div>
  );
}

// ─── CartDrawer Component ─────────────────────────────────────────────────────
export default function CartDrawer({
  tenantSlug,
  exchangeRate,
  storePhone,
  storeName,
}: CartDrawerProps) {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    totalUsd,
    totalVes,
    itemCount,
    isCartOpen,
    setIsCartOpen,
  } = useCart();

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; idNumber?: string }>({});

  // Cargar datos guardados previamente del cliente para no tener que escribirlos cada vez
  useEffect(() => {
    try {
      const savedCust = localStorage.getItem('is_saved_checkout_customer');
      if (savedCust) {
        const parsed = JSON.parse(savedCust);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.idNumber) setIdNumber(parsed.idNumber);
        if (parsed.address) setAddress(parsed.address);
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }, []);

  // Submission & Confirmation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);

  // Trap focus inside drawer
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCartOpen) {
      drawerRef.current?.focus();
    }
  }, [isCartOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isCartOpen) {
        setIsCartOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartOpen, setIsCartOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen]);

  // Validation
  function validate(): boolean {
    const nextErrors: typeof errors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Por favor ingresa tu nombre completo.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      nextErrors.phone = 'Por favor ingresa tu número de WhatsApp.';
    } else if (cleanPhone.length < 10) {
      nextErrors.phone = 'El número debe incluir código de área (ej. 04121234567).';
    }

    if (!idNumber.trim()) {
      nextErrors.idNumber = 'Indica tu cédula o RIF para facturación (ej. V-12345678).';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Guardar datos en localStorage para compras futuras del cliente
    try {
      localStorage.setItem(
        'is_saved_checkout_customer',
        JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          idNumber: idNumber.trim(),
          address: address.trim(),
        }),
      );
    } catch {
      // Ignorar errores de localStorage
    }

    try {
      let orderNumber: string | undefined = undefined;

      // 1. Registrar la orden en la base de datos de la tienda
      try {
        const res = await fetch('/api/storefront/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug,
            customer: {
              fullName: fullName.trim(),
              phone: phone.trim(),
              idNumber: idNumber.trim(),
              address: address.trim(),
              notes: notes.trim(),
            },
            items,
            totalUsd,
            totalVes,
            exchangeRate,
          }),
        });

        const data = await res.json();
        if (res.ok && data.order_number) {
          orderNumber = data.order_number;
          setConfirmedOrderNumber(data.order_number);
        }
      } catch (dbErr) {
        console.warn('Advertencia al registrar en BD, continuando por WhatsApp:', dbErr);
      }

      // 2. Generar el enlace de WhatsApp con el número de orden oficial
      const url = buildWhatsAppCheckoutUrl({
        items,
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          idNumber: idNumber.trim(),
          address: address.trim(),
          notes: notes.trim(),
          orderNumber,
        },
        totalUsd,
        totalVes,
        exchangeRate,
        config: { phone: storePhone, storeName },
      });

      setWhatsAppUrl(url);
      setIsSuccess(true);

      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (openErr) {
        console.warn('Popup bloqueado, enlace disponible en pantalla:', openErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClearAndClose() {
    setConfirmedOrderNumber(null);
    setWhatsAppUrl(null);
    clearCart();
    setIsSuccess(false);
    setFullName('');
    setPhone('');
    setNotes('');
    setErrors({});
    setIsCartOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isCartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5" />
            <h2 className="font-bold text-lg tracking-tight">Tu Carrito</h2>
            {itemCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-xl hover:bg-white/20 active:bg-white/30 transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center flex-1 px-6 gap-5 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                Pedido Registrado
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">¡Solicitud Enviada!</p>
              {confirmedOrderNumber && (
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                  N° de Pedido:{' '}
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                    #{confirmedOrderNumber}
                  </span>
                </p>
              )}
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mt-2 max-w-xs mx-auto">
                Tu pedido quedó registrado en el sistema de{' '}
                <strong className="font-semibold text-blue-600 dark:text-blue-400">{storeName}</strong> y se abrió WhatsApp para coordinar el pago y la entrega con un asesor.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full max-w-xs mt-2">
              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Abrir WhatsApp {confirmedOrderNumber ? `(#${confirmedOrderNumber})` : ''}</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleClearAndClose}
                className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition cursor-pointer"
              >
                Limpiar Carrito y Continuar
              </button>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Ver Catálogo
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : (
          /* Cart Content: Items + Form + Checkout */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {/* List of items */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Productos seleccionados
                </span>
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                >
                  Vaciar carrito
                </button>
              </div>

              {items.map((item) => {
                const lineUsd = item.unit_price_usd * item.quantity;
                const lineVes = lineUsd * exchangeRate;

                return (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full">
                          <Package className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col flex-1 min-w-0 justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                          {item.name}
                        </p>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition p-0.5 cursor-pointer"
                          aria-label={`Eliminar ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Qty controls */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-1.5 py-0.5 shadow-xs">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-6 w-6 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition cursor-pointer"
                            aria-label="Disminuir"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-6 w-6 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition cursor-pointer"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
                            ${formatUsd(lineUsd)}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            Bs. {formatVes(lineVes)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Customer Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Datos de Entrega
              </span>

              {/* Nombre y Cédula en dos columnas o apilados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    placeholder="Ej. Juan Pérez"
                    className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.fullName
                        ? 'border-rose-400 dark:border-rose-600'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Cédula o RIF *
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => {
                      setIdNumber(e.target.value);
                      if (errors.idNumber) setErrors((prev) => ({ ...prev, idNumber: undefined }));
                    }}
                    placeholder="V-12345678"
                    className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.idNumber
                        ? 'border-rose-400 dark:border-rose-600'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {errors.idNumber && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {errors.idNumber}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Teléfono WhatsApp *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="04121234567"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone
                      ? 'border-rose-400 dark:border-rose-600'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {errors.phone && (
                  <p className="flex items-center gap-1 text-xs text-rose-500 mt-1 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Dirección de Entrega (Opcional)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej. Calle Principal, Urb. Los Mangos, Casa #12"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones para entrega, puntos de referencia, etc."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Totals Section */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Total en Dólares:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-base">
                    ${formatUsd(totalUsd)} USD
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Total en Bolívares:</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 text-base">
                    Bs. {formatVes(totalVes)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                  Calculado a Tasa Oficial BCV: Bs. {formatVes(exchangeRate)}/USD
                </p>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Preparando pedido…</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5" />
                    <span>Enviar Pedido por WhatsApp</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

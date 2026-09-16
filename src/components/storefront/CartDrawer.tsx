'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Bike,
  Truck,
  Store,
  MapPin,
  Navigation,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import {
  buildWhatsAppCheckoutUrl,
  type DeliveryMethod,
  type ShippingAgency,
} from '@/lib/whatsapp';

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
  checkoutMode?: 'whatsapp_only' | 'direct_payment';
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
  checkoutMode = 'direct_payment',
}: CartDrawerProps) {
  const router = useRouter();
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

  // Delivery options state (Excluyentes: solo una activa a la vez)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery_bqto');
  const [shippingAgency, setShippingAgency] = useState<ShippingAgency>('Zoom');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    phone?: string;
    idNumber?: string;
    address?: string;
    agencyAddress?: string;
  }>({});

  // Geolocalización del usuario para Delivery Bqto
  function handleGetLocation() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationSuccess(true);
        setIsLocating(false);
      },
      (error) => {
        console.warn('Error al obtener ubicación:', error);
        alert('No se pudo obtener tu ubicación precisa. Puedes ingresar tu dirección escrita.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

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

    if (deliveryMethod === 'delivery_bqto' && !address.trim()) {
      nextErrors.address = 'Por favor ingresa tu dirección exacta en Barquisimeto.';
    }

    if (deliveryMethod === 'envio_nacional' && !agencyAddress.trim()) {
      nextErrors.agencyAddress = 'Ingresa la dirección o sede de la agencia de envío.';
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
              deliveryMethod,
              shippingAgency: deliveryMethod === 'envio_nacional' ? shippingAgency : undefined,
              agencyAddress: deliveryMethod === 'envio_nacional' ? agencyAddress.trim() : undefined,
              deliveryCoords: deliveryMethod === 'delivery_bqto' && deliveryCoords ? deliveryCoords : undefined,
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

      // 2. Generar el enlace de WhatsApp con el número de orden oficial y método de entrega
      const url = buildWhatsAppCheckoutUrl({
        items,
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          idNumber: idNumber.trim(),
          address: address.trim(),
          notes: notes.trim(),
          orderNumber,
          deliveryMethod,
          shippingAgency: deliveryMethod === 'envio_nacional' ? shippingAgency : undefined,
          agencyAddress: deliveryMethod === 'envio_nacional' ? agencyAddress.trim() : undefined,
          deliveryCoords: deliveryMethod === 'delivery_bqto' && deliveryCoords ? deliveryCoords : undefined,
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

            {/* Customer & Delivery Form: Only shown in whatsapp_only mode. In direct_payment mode, the user enters this cleanly in /[tenant]/checkout */}
            {checkoutMode === 'whatsapp_only' ? (
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

              {/* ─── Opciones de Entrega (Mutuamente Excluyentes) ─── */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Método de Entrega *
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Selecciona 1 opción
                  </span>
                </div>

                {/* 3 Selector Tabs / Radio Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod('delivery_bqto');
                      if (errors.agencyAddress) setErrors((prev) => ({ ...prev, agencyAddress: undefined }));
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      deliveryMethod === 'delivery_bqto'
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Bike className={`h-5 w-5 mb-1 ${deliveryMethod === 'delivery_bqto' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold leading-tight">Delivery en Bqto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod('envio_nacional');
                      if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      deliveryMethod === 'envio_nacional'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm ring-2 ring-indigo-500/20 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Truck className={`h-5 w-5 mb-1 ${deliveryMethod === 'envio_nacional' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold leading-tight">Envío Nacional</span>
                    <span className="text-[10px] opacity-75 font-normal">Cobro Destino</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod('retiro_sitio');
                      if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                      if (errors.agencyAddress) setErrors((prev) => ({ ...prev, agencyAddress: undefined }));
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      deliveryMethod === 'retiro_sitio'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Store className={`h-5 w-5 mb-1 ${deliveryMethod === 'retiro_sitio' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold leading-tight">Retiro en Sitio</span>
                    <span className="text-[10px] opacity-75 font-normal">Acordar</span>
                  </button>
                </div>

                {/* OPCIÓN 1: DELIVERY EN BARQUISIMETO */}
                {deliveryMethod === 'delivery_bqto' && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/50 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold text-xs">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span>Dirección en Barquisimeto *</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isLocating}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                        title="Usar GPS de mi teléfono o navegador"
                      >
                        {isLocating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Navigation className="h-3 w-3" />
                        )}
                        <span>{locationSuccess ? 'GPS Fijado ✓' : 'Usar mi GPS'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                      }}
                      placeholder="Ej. Urb. El Parral, Calle 3 con Av. Los Leones, Casa #45"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.address
                          ? 'border-rose-400 dark:border-rose-600'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {errors.address && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-500 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {errors.address}
                      </p>
                    )}

                    {/* Mini Mapa de Google Maps Interactivo Barquisimeto */}
                    <div className="rounded-xl overflow-hidden border border-blue-200/80 dark:border-blue-800/80 shadow-xs relative">
                      <iframe
                        title="Mapa de Ubicación Barquisimeto"
                        src={
                          deliveryCoords
                            ? `https://maps.google.com/maps?q=${deliveryCoords.lat},${deliveryCoords.lng}&z=16&output=embed`
                            : address.trim().length > 3
                            ? `https://maps.google.com/maps?q=${encodeURIComponent(address.trim() + ', Barquisimeto, Venezuela')}&z=15&output=embed`
                            : 'https://maps.google.com/maps?q=Barquisimeto,+Lara,+Venezuela&z=13&output=embed'
                        }
                        className="w-full h-36 border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 flex items-center justify-between">
                        <span>
                          {deliveryCoords
                            ? `📍 Ubicación GPS: ${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}`
                            : address.trim()
                            ? `📍 ${address.slice(0, 32)}...`
                            : '📍 Barquisimeto, Edo. Lara'}
                        </span>
                        {deliveryCoords && (
                          <span className="text-emerald-400 font-bold">Coordenadas listas</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* OPCIÓN 2: ENVÍO NACIONAL COBRO A DESTINO */}
                {deliveryMethod === 'envio_nacional' && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/50 space-y-3 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                        Agencia de Envío *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Zoom', 'Tealca', 'MRW'] as ShippingAgency[]).map((agency) => (
                          <button
                            key={agency}
                            type="button"
                            onClick={() => setShippingAgency(agency)}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              shippingAgency === agency
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {agency}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Dirección exacta de la Agencia ({shippingAgency}) *
                      </label>
                      <input
                        type="text"
                        value={agencyAddress}
                        onChange={(e) => {
                          setAgencyAddress(e.target.value);
                          if (errors.agencyAddress) setErrors((prev) => ({ ...prev, agencyAddress: undefined }));
                        }}
                        placeholder={`Ej. Agencia ${shippingAgency} Centro Comercial Sambil Caracas, Nivel Feria`}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          errors.agencyAddress
                            ? 'border-rose-400 dark:border-rose-600'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {errors.agencyAddress && (
                        <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          {errors.agencyAddress}
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      El flete se cancela al retirar el paquete en la agencia seleccionada (Cobro a Destino).
                    </p>
                  </div>
                )}

                {/* OPCIÓN 3: RETIRO EN SITIO */}
                {deliveryMethod === 'retiro_sitio' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                      <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Retiro en Sitio (Acordar con el Vendedor)</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Coordinarás la entrega directa o punto de encuentro con el vendedor al confirmar tu pedido por WhatsApp. No genera costos adicionales de envío.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales, punto de referencia, etc."
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
            ) : (
              /* En modo direct_payment: El carrito solo muestra el resumen de compra y el botón directo a checkout */
              <div className="p-5 space-y-4">
                {/* Totals Section */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal en Dólares:</span>
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    Tasa Oficial BCV: Bs. {formatVes(exchangeRate)}/USD
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      router.push(`/${tenantSlug}/checkout`);
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-black text-sm shadow-xl shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>Completar Compra Directa</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    Ingresarás tus datos de entrega y método de pago (Pago Móvil, Transferencia, Binance) en el siguiente paso.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

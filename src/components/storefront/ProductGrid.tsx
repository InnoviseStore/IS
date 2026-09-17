'use client';

import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Search, Package, ShoppingCart, Plus, Minus, Check, Filter, ArrowUpDown, Eye, LayoutGrid, List } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart, type CartItem } from '@/contexts/CartContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit_price_usd: number;
  stock_quantity?: number | null;
  image_url?: string | null;
  images?: string[] | null;
  is_active?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatUsd(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVes(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stockColor(qty?: number | null) {
  if (qty == null) return 'bg-slate-400';
  if (qty === 0) return 'bg-red-500';
  if (qty <= 5) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function stockLabel(qty?: number | null) {
  if (qty == null) return 'Disponible';
  if (qty === 0) return 'Agotado';
  if (qty <= 5) return `Últimas ${qty}`;
  return 'Disponible';
}

// Categorías intuitivas detectadas por palabra clave en catálogo o atributos de moda
function detectCategory(name: string, description?: string | null): string {
  if (description) {
    const match = description.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/)
    if (match) {
      try {
        const data = JSON.parse(match[1])
        if (data.garmentType) return data.garmentType
      } catch {}
    }
    const badgeMatch = description.match(/^🏷️\s*([^|\n]+)/)
    if (badgeMatch) return badgeMatch[1].trim()
  }

  const n = name.toLowerCase();
  // Ropa / Calzado
  if (n.includes('zapato') || n.includes('sneaker') || n.includes('calzado') || n.includes('zapatilla') || n.includes('sandalia') || n.includes('bota') || n.includes('tacón') || n.includes('tacon')) return 'Calzado & Zapatos';
  if (n.includes('pantalon') || n.includes('pantalón') || n.includes('jean') || n.includes('short') || n.includes('bermuda')) return 'Pantalones & Jeans';
  if (n.includes('camisa') || n.includes('franela') || n.includes('top') || n.includes('blusa') || n.includes('sweater') || n.includes('chaqueta')) return 'Prendas Superiores';
  if (n.includes('vestido') || n.includes('falda')) return 'Vestidos & Faldas';
  if (n.includes('bolso') || n.includes('cartera') || n.includes('mochila') || n.includes('billetera')) return 'Bolsos & Carteras';

  // Tecnología
  if (n.includes('funda') || n.includes('case')) return 'Fundas';
  if (n.includes('vidrio') || n.includes('mica') || n.includes('pantalla') || n.includes('protector')) return 'Micas y Protectores';
  if (n.includes('cable') || n.includes('adaptador')) return 'Cables y Conexiones';
  if (n.includes('cargador') || n.includes('power bank') || n.includes('bateria')) return 'Cargadores y Baterías';
  if (n.includes('audifono') || n.includes('earbud') || n.includes('sound') || n.includes('audio') || n.includes('altavoz') || n.includes('corneta')) return 'Audio';
  return 'General';
}

function parseApparelBadge(desc?: string | null): { gender?: string; sizes?: string[] } | null {
  if (!desc) return null
  const match = desc.match(/<!--APPAREL_ATTRIBUTES:(.*?)-->/)
  if (match) {
    try {
      const data = JSON.parse(match[1])
      return { gender: data.gender, sizes: data.sizes }
    } catch {}
  }
  return null
}

// ─── Product Card ─────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: Product;
  exchangeRate: number;
  tenantSlug: string;
  cartItem: CartItem | undefined;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}

const ProductCard = React.memo(function ProductCard({
  product,
  exchangeRate,
  tenantSlug,
  cartItem,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const [justAdded, setJustAdded] = useState(false);
  const priceVes = product.unit_price_usd * exchangeRate;
  const outOfStock = product.stock_quantity === 0;
  const apparel = parseApparelBadge(product.description);
  const cleanDescription = product.description
    ? product.description.replace(/<!--.*?-->/g, '').replace(/^🏷️[^\n]+\n\n?/, '').trim()
    : null;

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  const productSlug = encodeURIComponent(product.sku || product.id)
  const productHref = `/${tenantSlug}/p/${productSlug}`

  return (
    <div className="group relative flex flex-col rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-200/30 dark:shadow-black/40 hover:shadow-2xl hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden">
      {/* Image with zoom on hover and Link to detailed page */}
      <Link href={productHref} prefetch={true} className="relative aspect-square rounded-t-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 block cursor-pointer">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <Package className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Sin imagen</span>
          </div>
        )}

        {/* Stock indicator badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className={`h-2 w-2 rounded-full ${stockColor(product.stock_quantity)}`} />
          {stockLabel(product.stock_quantity)}
        </div>

        {/* Quick view icon badge */}
        <div className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60">
          <Eye className="w-3.5 h-3.5" />
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4 gap-2">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {detectCategory(product.name, product.description)}
          </span>
          <Link href={productHref} prefetch={true}>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-0.5">
              {product.name}
            </h3>
          </Link>
          {product.sku && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">SKU: {product.sku}</p>
          )}

          {/* Insignias de Moda (Género y Tallas) */}
          {apparel && (apparel.gender || (apparel.sizes && apparel.sizes.length > 0)) && (
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {apparel.gender && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {apparel.gender}
                </span>
              )}
              {apparel.sizes && apparel.sizes.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Tallas: {apparel.sizes.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {cleanDescription && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {cleanDescription}
          </p>
        )}

        {/* Pricing */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-blue-600 dark:text-blue-400 font-extrabold text-lg sm:text-xl leading-none tracking-tight">
            ${formatUsd(product.unit_price_usd)}
            <span className="text-slate-500 dark:text-slate-400 font-normal text-xs ml-1">USD</span>
          </p>
          <p className="text-slate-700 dark:text-slate-300 text-xs font-semibold mt-1">
            Bs. {formatVes(priceVes)}
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2">
          {outOfStock ? (
            <button
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed"
            >
              Agotado
            </button>
          ) : cartItem ? (
            /* In-cart quantity controls */
            <div className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-xs">
              <button
                onClick={onDecrease}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition active:scale-90"
                aria-label="Disminuir cantidad"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
                {cartItem.quantity} en carrito
              </span>
              <button
                onClick={onIncrease}
                disabled={
                  product.stock_quantity != null &&
                  cartItem.quantity >= product.stock_quantity
                }
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition active:scale-90"
                aria-label="Aumentar cantidad"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            /* Add button */
            <button
              onClick={handleAdd}
              className={`w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer ${
                justAdded
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/20'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>¡Agregado al carrito!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Agregar al Carrito</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Lookbook Card (Minimal Template - 2 Cols Editorial Fashion) ──────────────
const LookbookCard = React.memo(function LookbookCard({
  product,
  exchangeRate,
  tenantSlug,
  cartItem,
  onAdd,
  onIncrease,
  onDecrease,
  primaryColor,
}: ProductCardProps & { primaryColor?: string }) {
  const [justAdded, setJustAdded] = useState(false);
  const priceVes = product.unit_price_usd * exchangeRate;
  const outOfStock = product.stock_quantity === 0;
  const productSlug = encodeURIComponent(product.sku || product.id);
  const productHref = `/${tenantSlug}/p/${productSlug}`;

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="group flex flex-col space-y-3">
      <Link href={productHref} prefetch={true} className="relative aspect-[3/4] bg-neutral-100 dark:bg-neutral-900 overflow-hidden block">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
            <Package className="w-12 h-12 stroke-[1.5]" />
          </div>
        )}
        <div className="absolute top-4 left-4 text-[10px] font-mono uppercase tracking-widest bg-black/80 dark:bg-white/90 text-white dark:text-black px-2.5 py-1">
          {stockLabel(product.stock_quantity)}
        </div>
      </Link>

      <div className="flex flex-col space-y-1.5 pt-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={productHref} prefetch={true}>
            <h3 className="text-sm sm:text-base font-medium tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:opacity-75 transition-opacity line-clamp-1">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm sm:text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 flex-shrink-0" style={primaryColor ? { color: primaryColor } : undefined}>
            ${formatUsd(product.unit_price_usd)}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>{product.sku ? `REF: ${product.sku}` : detectCategory(product.name, product.description)}</span>
          <span>Bs. {formatVes(priceVes)}</span>
        </div>

        <div className="pt-2">
          {outOfStock ? (
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-mono">Agotado</span>
          ) : cartItem ? (
            <div className="flex items-center gap-2 border border-neutral-300 dark:border-neutral-700 px-3 py-1 w-fit">
              <button onClick={onDecrease} className="text-xs px-1 hover:opacity-70 cursor-pointer">-</button>
              <span className="text-xs font-mono px-2">{cartItem.quantity}</span>
              <button onClick={onIncrease} className="text-xs px-1 hover:opacity-70 cursor-pointer">+</button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="text-xs font-medium uppercase tracking-widest border-b border-black dark:border-white pb-0.5 hover:opacity-70 transition-opacity w-fit cursor-pointer"
            >
              {justAdded ? '✓ En la bolsa' : '+ Añadir a la bolsa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Tech Cyber Card (Gamer & Electronics Specs Layout) ─────────────────────────
const TechCard = React.memo(function TechCard({
  product,
  exchangeRate,
  tenantSlug,
  cartItem,
  onAdd,
  onIncrease,
  onDecrease,
  primaryColor = '#06b6d4',
}: ProductCardProps & { primaryColor?: string }) {
  const [justAdded, setJustAdded] = useState(false);
  const priceVes = product.unit_price_usd * exchangeRate;
  const outOfStock = product.stock_quantity === 0;
  const productSlug = encodeURIComponent(product.sku || product.id);
  const productHref = `/${tenantSlug}/p/${productSlug}`;

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="group relative flex flex-col bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 transition-all duration-300 rounded-2xl overflow-hidden shadow-lg shadow-cyan-950/20">
      <Link href={productHref} prefetch={true} className="relative aspect-square bg-slate-950 block overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            unoptimized
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-700">
            <Package className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-400">
          ● {stockLabel(product.stock_quantity)}
        </div>
      </Link>

      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5 bg-slate-900/95">
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/80 mb-1">
            <span>{detectCategory(product.name, product.description)}</span>
            {product.sku && <span>SKU: {product.sku}</span>}
          </div>
          <Link href={productHref} prefetch={true}>
            <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 hover:text-cyan-400 transition-colors">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-baseline justify-between">
            <p className="text-base font-extrabold text-cyan-400 tracking-tight" style={{ color: primaryColor }}>
              ${formatUsd(product.unit_price_usd)}
              <span className="text-[10px] font-normal text-slate-400 ml-1">USD</span>
            </p>
            <p className="text-[11px] font-mono text-slate-400">
              Bs. {formatVes(priceVes)}
            </p>
          </div>

          <div className="mt-2.5">
            {outOfStock ? (
              <button disabled className="w-full py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-mono">
                [AGOTADO]
              </button>
            ) : cartItem ? (
              <div className="flex items-center justify-between bg-slate-950 border border-cyan-500/40 rounded-xl px-2 py-1">
                <button onClick={onDecrease} className="p-1 text-cyan-400 hover:text-white cursor-pointer">-</button>
                <span className="text-xs font-mono font-bold text-white">{cartItem.quantity}</span>
                <button onClick={onIncrease} className="p-1 text-cyan-400 hover:text-white cursor-pointer">+</button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="w-full py-2 rounded-xl text-xs font-bold text-slate-950 transition active:scale-95 shadow-md shadow-cyan-500/20 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {justAdded ? '✓ Agregado' : 'Añadir al Setup +'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Boutique Card (Luxury Warm Showcase Layout) ────────────────────────────────
const BoutiqueCard = React.memo(function BoutiqueCard({
  product,
  exchangeRate,
  tenantSlug,
  cartItem,
  onAdd,
  onIncrease,
  onDecrease,
  primaryColor = '#d97706',
}: ProductCardProps & { primaryColor?: string }) {
  const [justAdded, setJustAdded] = useState(false);
  const priceVes = product.unit_price_usd * exchangeRate;
  const outOfStock = product.stock_quantity === 0;
  const productSlug = encodeURIComponent(product.sku || product.id);
  const productHref = `/${tenantSlug}/p/${productSlug}`;

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="group flex flex-col bg-white/90 dark:bg-[#1f1c1a]/90 rounded-3xl border border-amber-200/60 dark:border-amber-900/40 p-3.5 shadow-md shadow-amber-950/5 hover:shadow-xl hover:border-amber-400 transition-all duration-300">
      <Link href={productHref} prefetch={true} className="relative aspect-square rounded-2xl overflow-hidden bg-[#faf7f2] dark:bg-[#141210] block mb-3">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-amber-300 dark:text-amber-700">
            <Package className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-amber-50/90 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200 border border-amber-300/50 text-[10px] font-semibold">
          {stockLabel(product.stock_quantity)}
        </div>
      </Link>

      <div className="flex flex-col flex-1 justify-between gap-2">
        <div>
          <span className="text-[10px] font-medium tracking-wider text-amber-700 dark:text-amber-400 uppercase">
            {detectCategory(product.name, product.description)}
          </span>
          <Link href={productHref} prefetch={true}>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 hover:text-amber-700 transition-colors mt-0.5">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="pt-2 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
          <div>
            <p className="text-base font-extrabold text-amber-800 dark:text-amber-300" style={{ color: primaryColor }}>
              ${formatUsd(product.unit_price_usd)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Bs. {formatVes(priceVes)}
            </p>
          </div>

          <div>
            {outOfStock ? (
              <span className="text-xs text-slate-400">Agotado</span>
            ) : cartItem ? (
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                <button onClick={onDecrease} className="text-xs text-amber-800 dark:text-amber-300 px-1 cursor-pointer">-</button>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-100">{cartItem.quantity}</span>
                <button onClick={onIncrease} className="text-xs text-amber-800 dark:text-amber-300 px-1 cursor-pointer">+</button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs transition active:scale-95 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {justAdded ? '✓ Añadido' : 'Seleccionar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Express Row (Direct Wholesale / Supermarket Table-List Layout) ─────────────
const ExpressRow = React.memo(function ExpressRow({
  product,
  exchangeRate,
  tenantSlug,
  cartItem,
  onAdd,
  onIncrease,
  onDecrease,
  primaryColor = '#059669',
}: ProductCardProps & { primaryColor?: string }) {
  const [justAdded, setJustAdded] = useState(false);
  const priceVes = product.unit_price_usd * exchangeRate;
  const outOfStock = product.stock_quantity === 0;
  const productSlug = encodeURIComponent(product.sku || product.id);
  const productHref = `/${tenantSlug}/p/${productSlug}`;

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-xs transition-all gap-3">
      <div className="flex items-center gap-3.5 min-w-0">
        <Link href={productHref} prefetch={true} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill unoptimized className="object-cover" />
          ) : (
            <Package className="w-6 h-6 m-auto text-slate-400 absolute inset-0" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            {detectCategory(product.name, product.description)}
          </span>
          <Link href={productHref} prefetch={true}>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate hover:underline mt-0.5">
              {product.name}
            </h3>
          </Link>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            {product.sku && <span className="text-[10px] font-mono text-slate-400">SKU: {product.sku}</span>}
            <span className={`h-1.5 w-1.5 rounded-full ${stockColor(product.stock_quantity)}`} />
            <span className="text-[10px] text-slate-500 font-medium">{stockLabel(product.stock_quantity)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
        <div className="text-left sm:text-right">
          <p className="text-sm sm:text-base font-extrabold" style={{ color: primaryColor }}>
            ${formatUsd(product.unit_price_usd)} <span className="text-[10px] font-normal text-slate-400">USD</span>
          </p>
          <p className="text-[11px] font-semibold text-slate-500">
            Bs. {formatVes(priceVes)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {outOfStock ? (
            <span className="text-xs text-slate-400 font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">Agotado</span>
          ) : cartItem ? (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button onClick={onDecrease} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-xs font-bold px-1.5 text-slate-900 dark:text-white">{cartItem.quantity}</span>
              <button onClick={onIncrease} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{justAdded ? '¡Listo!' : 'Agregar'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Main ProductGrid with Filters ─────────────────────────────────────────────
import type { StorefrontTemplate } from '@/types/storefrontTheme';

interface ProductGridProps {
  products: Product[];
  exchangeRate: number;
  tenantSlug: string;
  template?: StorefrontTemplate;
  primaryColor?: string;
  showViewToggle?: boolean;
  defaultViewMode?: 'grid' | 'list';
}

export default function ProductGrid({
  products,
  exchangeRate,
  tenantSlug,
  template = 'aurora',
  primaryColor,
  showViewToggle = true,
  defaultViewMode,
}: ProductGridProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (defaultViewMode) return defaultViewMode;
    return template === 'express' ? 'list' : 'grid';
  });
  const { items, addItem, updateQuantity, itemCount, openCart } = useCart();

  // Load persisted view mode preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('is_catalog_view_mode') as 'grid' | 'list' | null;
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved);
      } else if (defaultViewMode) {
        setViewMode(defaultViewMode);
      } else if (template === 'express') {
        setViewMode('list');
      }
    } catch {}
  }, [defaultViewMode, template]);

  const handleToggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('is_catalog_view_mode', mode);
    } catch {}
  };

  // Extract all categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(detectCategory(p.name, p.description)));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Combined Filters and Sorting with Deferred Search
  const filtered = useMemo(() => {
    let list = [...products];

    // Search query with deferred value for instant non-blocking typing
    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          detectCategory(p.name, p.description).toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => detectCategory(p.name, p.description) === selectedCategory);
    }

    // Price range filter
    if (priceRange === 'under-10') {
      list = list.filter((p) => p.unit_price_usd < 10);
    } else if (priceRange === '10-25') {
      list = list.filter((p) => p.unit_price_usd >= 10 && p.unit_price_usd <= 25);
    } else if (priceRange === 'over-25') {
      list = list.filter((p) => p.unit_price_usd > 25);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.unit_price_usd - b.unit_price_usd);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.unit_price_usd - a.unit_price_usd);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, deferredQuery, selectedCategory, priceRange, sortBy]);

  function handleAdd(product: Product) {
    addItem({
      id: product.id,
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      unit_price_usd: product.unit_price_usd,
      image_url: product.image_url,
    });
  }

  return (
    <section className="space-y-6 pt-4">
      {/* Search & Filter Bar Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría o código SKU…"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categorías (Pills con scroll horizontal) */}
        {categories.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 pl-1">
              <Filter className="w-3.5 h-3.5" />
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {cat === 'all' ? 'Todos los Productos' : cat}
              </button>
            ))}
          </div>
        )}

        {/* Filtro de Precio, Ordenamiento y Modo de Vista */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Precio:</span>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Cualquier precio</option>
              <option value="under-10">Menos de $10 USD</option>
              <option value="10-25">$10 a $25 USD</option>
              <option value="over-25">Más de $25 USD</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> <span className="hidden sm:inline">Ordenar:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="featured">Destacados</option>
                <option value="price-asc">Precio: Menor a Mayor</option>
                <option value="price-desc">Precio: Mayor a Menor</option>
                <option value="name">Alfabético A-Z</option>
              </select>
            </div>

            {/* Selector de Vista: Cuadrícula / Lista */}
            {showViewToggle && (
              <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleToggleView('grid')}
                  title="Vista en Cuadrícula"
                  aria-label="Vista en Cuadrícula"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cuadrícula</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleView('list')}
                  title="Vista en Lista"
                  aria-label="Vista en Lista"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lista</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <p>
          {filtered.length === products.length
            ? `${products.length} producto${products.length !== 1 ? 's' : ''} en catálogo`
            : `Mostrando ${filtered.length} de ${products.length} producto${products.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          {viewMode === 'list' ? (
            <span className="text-[11px] font-semibold text-slate-400 hidden xs:inline">Modo Lista</span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 hidden xs:inline">Modo Cuadrícula</span>
          )}
          {(query || selectedCategory !== 'all' || priceRange !== 'all') && (
            <button
              onClick={() => { setQuery(''); setSelectedCategory('all'); setPriceRange('all'); setSortBy('featured') }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline text-xs ml-2 cursor-pointer"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-slate-500">
          <Search className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-bold text-slate-800 dark:text-slate-200">No hay productos que coincidan</p>
          <p className="text-xs text-slate-500 max-w-sm text-center">
            Prueba ajustando el término de búsqueda o seleccionando otra categoría o rango de precios.
          </p>
          <button
            onClick={() => { setQuery(''); setSelectedCategory('all'); setPriceRange('all') }}
            className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs hover:opacity-90 transition"
          >
            Ver todos los productos
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map((product) => {
            const cartItem = items.find((i) => i.id === product.id || i.product_id === product.id);
            return (
              <ExpressRow
                key={product.id}
                product={product}
                exchangeRate={exchangeRate}
                tenantSlug={tenantSlug}
                cartItem={cartItem}
                onAdd={() => handleAdd(product)}
                onIncrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity + 1)
                }
                onDecrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity - 1)
                }
                primaryColor={primaryColor}
              />
            );
          })}
        </div>
      ) : template === 'minimal' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14">
          {filtered.map((product) => {
            const cartItem = items.find((i) => i.id === product.id || i.product_id === product.id);
            return (
              <LookbookCard
                key={product.id}
                product={product}
                exchangeRate={exchangeRate}
                tenantSlug={tenantSlug}
                cartItem={cartItem}
                onAdd={() => handleAdd(product)}
                onIncrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity + 1)
                }
                onDecrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity - 1)
                }
                primaryColor={primaryColor}
              />
            );
          })}
        </div>
      ) : template === 'tech' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {filtered.map((product) => {
            const cartItem = items.find((i) => i.id === product.id || i.product_id === product.id);
            return (
              <TechCard
                key={product.id}
                product={product}
                exchangeRate={exchangeRate}
                tenantSlug={tenantSlug}
                cartItem={cartItem}
                onAdd={() => handleAdd(product)}
                onIncrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity + 1)
                }
                onDecrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity - 1)
                }
                primaryColor={primaryColor}
              />
            );
          })}
        </div>
      ) : template === 'boutique' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-5 md:gap-6">
          {filtered.map((product) => {
            const cartItem = items.find((i) => i.id === product.id || i.product_id === product.id);
            return (
              <BoutiqueCard
                key={product.id}
                product={product}
                exchangeRate={exchangeRate}
                tenantSlug={tenantSlug}
                cartItem={cartItem}
                onAdd={() => handleAdd(product)}
                onIncrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity + 1)
                }
                onDecrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity - 1)
                }
                primaryColor={primaryColor}
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-5 md:gap-6">
          {filtered.map((product) => {
            const cartItem = items.find((i) => i.id === product.id || i.product_id === product.id);
            return (
              <ProductCard
                key={product.id}
                product={product}
                exchangeRate={exchangeRate}
                tenantSlug={tenantSlug}
                cartItem={cartItem}
                onAdd={() => handleAdd(product)}
                onIncrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity + 1)
                }
                onDecrease={() =>
                  cartItem && updateQuantity(product.id, cartItem.quantity - 1)
                }
              />
            );
          })}
        </div>
      )}

      {/* Floating cart button (mobile helper) */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 sm:hidden">
          <button
            onClick={openCart}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-blue-500/40 hover:opacity-90 active:scale-95 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            Ver carrito ({itemCount})
          </button>
        </div>
      )}
    </section>
  );
}
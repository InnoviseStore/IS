'use client';

import { useState, useMemo } from 'react';
import { Search, Package, ShoppingCart, Plus, Minus, Check, Filter, ArrowUpDown, Eye } from 'lucide-react';
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

// Categorías intuitivas detectadas por palabra clave en catálogo
function detectCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('funda') || n.includes('case')) return 'Fundas';
  if (n.includes('vidrio') || n.includes('mica') || n.includes('pantalla') || n.includes('protector')) return 'Micas y Protectores';
  if (n.includes('cable') || n.includes('adaptador')) return 'Cables y Conexiones';
  if (n.includes('cargador') || n.includes('power bank') || n.includes('bateria')) return 'Cargadores y Baterías';
  if (n.includes('audifono') || n.includes('earbud') || n.includes('sound') || n.includes('audio')) return 'Audio';
  return 'Accesorios';
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

function ProductCard({
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
            {detectCategory(product.name)}
          </span>
          <Link href={productHref} prefetch={true}>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-0.5">
              {product.name}
            </h3>
          </Link>
          {product.sku && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">SKU: {product.sku}</p>
          )}
        </div>

        {product.description && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {product.description}
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
}

// ─── Main ProductGrid with Filters ─────────────────────────────────────────────
interface ProductGridProps {
  products: Product[];
  exchangeRate: number;
  tenantSlug: string;
}

export default function ProductGrid({
  products,
  exchangeRate,
  tenantSlug,
}: ProductGridProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const { items, addItem, updateQuantity, itemCount, openCart } = useCart();

  // Extract all categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(detectCategory(p.name)));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Combined Filters and Sorting
  const filtered = useMemo(() => {
    let list = [...products];

    // Search query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          detectCategory(p.name).toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => detectCategory(p.name) === selectedCategory);
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
  }, [products, query, selectedCategory, priceRange, sortBy]);

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

        {/* Filtro de Precio y Ordenamiento */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Precio:</span>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="all">Cualquier precio</option>
              <option value="under-10">Menos de $10 USD</option>
              <option value="10-25">$10 a $25 USD</option>
              <option value="over-25">Más de $25 USD</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="featured">Destacados</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="name">Alfabético A-Z</option>
            </select>
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
        {(query || selectedCategory !== 'all' || priceRange !== 'all') && (
          <button
            onClick={() => { setQuery(''); setSelectedCategory('all'); setPriceRange('all'); setSortBy('featured') }}
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline text-xs"
          >
            Restablecer filtros
          </button>
        )}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
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
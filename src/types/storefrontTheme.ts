export type StorefrontTemplate = 'aurora' | 'minimal' | 'tech' | 'boutique' | 'express'

export interface StorefrontThemeConfig {
  template: StorefrontTemplate
  primaryColor: string
  accentColor?: string
  bannerText: string
  showBanner: boolean
  featuredProductIds: string[]
  cardStyle?: 'glass' | 'minimal' | 'rounded' | 'compact'
  showBadges?: boolean
}

export const DEFAULT_THEME_CONFIG: StorefrontThemeConfig = {
  template: 'aurora',
  primaryColor: '#2563eb',
  accentColor: '#4f46e5',
  bannerText: '🚚 Envíos a todo el país · ⚡ Entregas el mismo día en Caracas · 🛡️ Garantía oficial',
  showBanner: true,
  featuredProductIds: [],
  cardStyle: 'glass',
  showBadges: true,
}

export interface TemplateDefinition {
  id: StorefrontTemplate
  name: string
  tagline: string
  description: string
  layoutLabel: string
  bestFor: string
  badgeText: string
  badgeColor: string
  previewClasses: {
    container: string
    hero: string
    card: string
    button: string
  }
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'aurora',
    name: 'Modern Aurora',
    tagline: 'Fluido, moderno y envolvente',
    description: 'Fondos dinámicos con efecto degradado translúcido, tarjetas glassmorphism y carrusel de novedades.',
    layoutLabel: 'Estructura: Bento Grid & Carrusel',
    bestFor: 'Tecnología, comercios modernos y tiendas multimarca.',
    badgeText: 'Popular',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    previewClasses: {
      container: 'bg-slate-50 dark:bg-slate-950',
      hero: 'bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent border-blue-200/50 dark:border-blue-800/40',
      card: 'bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-md',
      button: 'bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal Clean B&W',
    tagline: 'Elegancia sobria estilo Apple / Zara',
    description: 'Espacios en blanco puros, tipografía sans refinada, bordes sutiles de 1px y protagonismo absoluto a la fotografía en 2 columnas grandes.',
    layoutLabel: 'Estructura: Lookbook Editorial 2 Columnas',
    bestFor: 'Moda, calzado, joyería, cosmética y diseño de interiores.',
    badgeText: 'Elegante',
    badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    previewClasses: {
      container: 'bg-white dark:bg-black',
      hero: 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
      card: 'bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-none hover:border-neutral-400',
      button: 'bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg',
    },
  },
  {
    id: 'tech',
    name: 'Tech Cyber & Gaming',
    tagline: 'Oscuro de alto impacto con acentos neón',
    description: 'Estética futurista oscura con acentos cian/eléctricos, tipografía monoespaciada para códigos SKU y badges de specs.',
    layoutLabel: 'Estructura: Cuadrícula Tech con Specs',
    bestFor: 'Electrónica, telefonía, repuestos, informática y gaming.',
    badgeText: 'Gamer / Tech',
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    previewClasses: {
      container: 'bg-slate-950 dark:bg-black',
      hero: 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-500/10',
      card: 'bg-slate-900/80 border border-cyan-500/20 hover:border-cyan-400 shadow-sm shadow-cyan-500/5',
      button: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-md shadow-cyan-500/25',
    },
  },
  {
    id: 'boutique',
    name: 'Boutique Luxury Warm',
    tagline: 'Tonos cálidos, arena y acabados prémium',
    description: 'Paleta cálida refinada en tonos crema, arena y ámbar suave, bordes muy redondeados y sombras aterciopeladas.',
    layoutLabel: 'Estructura: Vitrina Curva de Lujo',
    bestFor: 'Perfumería, regalos de lujo, gourmet, cuidado personal y accesorios de alta gama.',
    badgeText: 'Premium',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    previewClasses: {
      container: 'bg-[#faf7f2] dark:bg-[#181614]',
      hero: 'bg-gradient-to-br from-amber-100/50 via-rose-100/30 to-amber-50/20 dark:from-amber-950/40 dark:to-neutral-900 border-amber-200/60 dark:border-amber-900/40',
      card: 'bg-white/90 dark:bg-neutral-900/90 border border-amber-200/50 dark:border-amber-900/30 rounded-3xl shadow-md shadow-amber-950/5',
      button: 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-700/20',
    },
  },
  {
    id: 'express',
    name: 'Direct Express Mayorista',
    tagline: 'Catálogo de alta densidad con compra directa',
    description: 'Formato lista/tabla horizontal optimizado para recorrer decenas de productos rápido con selector numérico y botón de pedido inmediato.',
    layoutLabel: 'Estructura: Lista / Tabla Rápida de Mayorista',
    bestFor: 'Bodegones, distribuidores, ferreterías, farmacias y víveres.',
    badgeText: 'Conversión',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    previewClasses: {
      container: 'bg-slate-100/70 dark:bg-slate-950',
      hero: 'bg-emerald-600/10 border-emerald-300/60 dark:border-emerald-800/40',
      card: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs',
      button: 'bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm',
    },
  },
]

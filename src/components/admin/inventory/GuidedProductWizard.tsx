'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Package,
  Layers,
  Palette,
  Tag,
  DollarSign,
  TrendingUp,
  Percent,
  Upload,
  Camera,
  Trash2,
  X,
  Loader2,
  Shirt,
  Footprints,
  ShoppingBag,
  Box,
  Coins,
  Check,
  AlertCircle
} from 'lucide-react'
import type { ColorVariantItem } from '@/lib/colorVariants'
import type { ApparelAttributes, SizeStockItem } from '@/lib/apparelAttributes'

export interface GuidedProductWizardPayload {
  name: string
  category: string
  subcategory: string
  brand: string
  sku: string
  barcode: string
  description: string
  priceUsd: number
  costUsd: number | null
  stock: number
  isActive: boolean
  images: string[]
  colors: ColorVariantItem[]
  apparel: ApparelAttributes
}

interface GuidedProductWizardProps {
  tenantName?: string
  exchangeRate: number
  currencyType?: string
  currencySymbol?: string
  initialData?: Partial<GuidedProductWizardPayload>
  onSave: (payload: GuidedProductWizardPayload) => Promise<void>
  onSwitchToTraditional: (draftData: Partial<GuidedProductWizardPayload>) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// Opciones de configuración guiada
const MAIN_CATEGORIES = [
  { id: 'calzado', label: 'Calzado & Zapatos', icon: Footprints, description: 'Deportivos, botas, tacones, sandalias...' },
  { id: 'ropa', label: 'Ropa & Vestimenta', icon: Shirt, description: 'Franelas, pantalones, vestidos, chaquetas...' },
  { id: 'accesorios', label: 'Accesorios & Bolsos', icon: ShoppingBag, description: 'Carteras, gorras, cinturones, relojes...' },
  { id: 'general', label: 'General / Otro', icon: Box, description: 'Artículos generales o de cualquier categoría' },
] as const

const GENDERS = [
  { id: 'Dama', label: 'Dama / Mujer', emoji: '👩' },
  { id: 'Caballero', label: 'Caballero / Hombre', emoji: '👨' },
  { id: 'Unisex', label: 'Unisex / Mixto', emoji: '⚧️' },
  { id: 'Niño', label: 'Niño', emoji: '👦' },
  { id: 'Niña', label: 'Niña', emoji: '👧' },
  { id: 'Bebé', label: 'Bebé', emoji: '👶' },
]

const SUBTYPES_BY_CAT: Record<string, string[]> = {
  calzado: [
    'Sneakers / Deportivos',
    'Zapatos Casuales',
    'Sandalias & Pantuflas',
    'Botas & Botines',
    'Tacones & Plataformas',
    'Mocasines & Formales',
    'Crocs / Zuecos',
  ],
  ropa: [
    'Franelas & Camisetas',
    'Camisas & Blusas',
    'Pantalones & Jeans',
    'Shorts & Bermudas',
    'Vestidos & Faldas',
    'Chaquetas & Sweaters',
    'Ropa Deportiva / Fitness',
    'Ropa Interior & Pijamas',
    'Conjuntos',
  ],
  accesorios: [
    'Carteras & Bolsos',
    'Mochilas & Morrales',
    'Gorras & Sombreros',
    'Cinturones & Correas',
    'Billeteras & Monederos',
    'Joyería & Relojes',
    'Lentes de Sol',
  ],
  general: [
    'General',
    'Artículos Varios',
    'Tecnología',
    'Hogar',
  ]
}

const FOOTWEAR_SIZES_ADULT = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']
const FOOTWEAR_SIZES_KIDS = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
const APPAREL_SIZES_LETTER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const APPAREL_SIZES_PANTS = ['26', '28', '30', '32', '34', '36', '38', '40']

const POPULAR_COLORS = [
  { name: 'Negro', hex: '#000000' },
  { name: 'Blanco', hex: '#FFFFFF' },
  { name: 'Gris', hex: '#64748B' },
  { name: 'Azul Marino', hex: '#1E3A8A' },
  { name: 'Rojo', hex: '#EF4444' },
  { name: 'Rosa', hex: '#F472B6' },
  { name: 'Beige / Nude', hex: '#D7BA89' },
  { name: 'Verde Militar', hex: '#3F6212' },
  { name: 'Marrón', hex: '#78350F' },
]

export function GuidedProductWizard({
  tenantName,
  exchangeRate,
  currencyType = 'USD',
  currencySymbol = '$',
  initialData,
  onSave,
  onSwitchToTraditional,
  onCancel,
  isSubmitting = false,
}: GuidedProductWizardProps) {
  // Paso actual (1 a 5)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)

  // 1. Tipo & Categoría Principal
  const [mainType, setMainType] = useState<string>(() => {
    if (initialData?.category?.toLowerCase().includes('calzado') || initialData?.apparel?.garmentType?.toLowerCase().includes('calzado')) {
      return 'calzado'
    }
    if (initialData?.apparel?.garmentType) return 'ropa'
    return 'calzado'
  })

  // 2. Género y Subtipo
  const [gender, setGender] = useState<string>(initialData?.apparel?.gender || 'Dama')
  const [subtype, setSubtype] = useState<string>(() => {
    if (initialData?.subcategory) return initialData.subcategory
    if (initialData?.apparel?.garmentType) return initialData.apparel.garmentType
    return SUBTYPES_BY_CAT[mainType]?.[0] || 'Sneakers / Deportivos'
  })

  // 3. Tallas & Existencias por Talla
  const [sizeStock, setSizeStock] = useState<SizeStockItem[]>(() => {
    if (initialData?.apparel?.sizeStock && initialData.apparel.sizeStock.length > 0) {
      return initialData.apparel.sizeStock
    }
    if (initialData?.apparel?.sizes && initialData.apparel.sizes.length > 0) {
      return initialData.apparel.sizes.map(s => ({ size: s, stock: 1 }))
    }
    // Por defecto sugerimos tallas vacías listas
    return []
  })
  const [customSizeInput, setCustomSizeInput] = useState('')
  const [apparelSizeType, setApparelSizeType] = useState<'letter' | 'number'>('letter')

  // Stock simple para artículos sin matriz de tallas
  const [generalStock, setGeneralStock] = useState<number>(initialData?.stock ?? 1)

  // Colores seleccionados
  const [colors, setColors] = useState<ColorVariantItem[]>(initialData?.colors || [])

  // 4. Identificación & Fotos
  const [brand, setBrand] = useState<string>(initialData?.brand || '')
  const [modelName, setModelName] = useState<string>(initialData?.name || '')
  const [sku, setSku] = useState<string>(initialData?.sku || '')
  const [barcode, setBarcode] = useState<string>(initialData?.barcode || '')
  const [images, setImages] = useState<string[]>(initialData?.images || [])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 5. Precios & Ganancia
  const [costUsd, setCostUsd] = useState<string>(initialData?.costUsd?.toString() || '')
  const [priceUsd, setPriceUsd] = useState<string>(initialData?.priceUsd?.toString() || '')
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive ?? true)

  // Cálculos dinámicos
  const totalStock = useMemo(() => {
    if (mainType === 'calzado' || mainType === 'ropa') {
      if (sizeStock.length > 0) {
        return sizeStock.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0)
      }
      return generalStock
    }
    return generalStock
  }, [mainType, sizeStock, generalStock])

  const parsedCost = parseFloat(costUsd) || 0
  const parsedPrice = parseFloat(priceUsd) || 0
  const priceVes = parsedPrice * exchangeRate
  const netProfit = parsedPrice - parsedCost
  const profitMargin = parsedPrice > 0 && parsedCost > 0 
    ? ((netProfit / parsedPrice) * 100).toFixed(1) 
    : null

  // Tallas recomendadas según selección
  const availableQuickSizes = useMemo(() => {
    if (mainType === 'calzado') {
      if (gender === 'Niño' || gender === 'Niña' || gender === 'Bebé') {
        return FOOTWEAR_SIZES_KIDS
      }
      return FOOTWEAR_SIZES_ADULT
    }
    if (mainType === 'ropa') {
      return apparelSizeType === 'letter' ? APPAREL_SIZES_LETTER : APPAREL_SIZES_PANTS
    }
    return []
  }, [mainType, gender, apparelSizeType])

  // Generador de título sugerido si está vacío o automático
  const autoGeneratedTitle = useMemo(() => {
    const parts = []
    if (subtype) parts.push(subtype.split('/')[0].trim())
    if (brand.trim()) parts.push(brand.trim())
    if (gender && gender !== 'Unisex') parts.push(gender)
    if (colors.length === 1) parts.push(colors[0].name)
    return parts.join(' ')
  }, [subtype, brand, gender, colors])

  // Sincronizar título sugerido cuando cambian parámetros si el usuario aún no escribió uno personalizado
  const currentTitle = modelName.trim() || autoGeneratedTitle

  // Manejo de tallas en matriz
  const handleToggleSize = (sizeLabel: string) => {
    setSizeStock(prev => {
      const exists = prev.find(item => item.size === sizeLabel)
      if (exists) {
        return prev.filter(item => item.size !== sizeLabel)
      } else {
        return [...prev, { size: sizeLabel, stock: 1 }]
      }
    })
  }

  const handleUpdateSizeStock = (sizeLabel: string, qty: number) => {
    const safeQty = Math.max(0, qty)
    setSizeStock(prev =>
      prev.map(item => (item.size === sizeLabel ? { ...item, stock: safeQty } : item))
    )
  }

  const handleAddCustomSize = () => {
    const val = customSizeInput.trim()
    if (!val) return
    if (!sizeStock.some(s => s.size.toLowerCase() === val.toLowerCase())) {
      setSizeStock(prev => [...prev, { size: val, stock: 1 }])
    }
    setCustomSizeInput('')
  }

  // Manejo de colores
  const handleToggleColor = (col: { name: string; hex: string }) => {
    setColors(prev => {
      const exists = prev.find(c => c.name.toLowerCase() === col.name.toLowerCase())
      if (exists) {
        return prev.filter(c => c.name.toLowerCase() !== col.name.toLowerCase())
      } else {
        return [...prev, { name: col.name, hex: col.hex, stock: 0 }]
      }
    })
  }

  // Subida de imagen
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        setImages(prev => (prev.includes(result) ? prev : [...prev, result]))
      }
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim() && !images.includes(imageUrlInput.trim())) {
      setImages(prev => [...prev, imageUrlInput.trim()])
      setImageUrlInput('')
    }
  }

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  // Auto-generación de SKU inteligente
  const generateSuggestedSku = () => {
    const prefix = mainType === 'calzado' ? 'CALZ' : mainType === 'ropa' ? 'ROPA' : 'ART'
    const gen = gender ? gender.substring(0, 3).toUpperCase() : 'UNI'
    const rnd = Math.floor(100 + Math.random() * 900)
    return `${prefix}-${gen}-${rnd}`
  }

  // Recopilar el borrador completo para guardar o transferir al modo tradicional
  const compilePayload = (): GuidedProductWizardPayload => {
    const finalName = currentTitle
    const finalCategory = mainType === 'calzado' ? 'Calzado' : mainType === 'ropa' ? 'Ropa & Vestimenta' : 'General'
    const finalSubcategory = subtype || ''

    const apparelData: ApparelAttributes = {
      garmentType: subtype || (mainType === 'calzado' ? 'Calzado' : 'Prenda'),
      gender: gender || 'Unisex',
      sizes: sizeStock.map(s => s.size),
      sizeStock: sizeStock.length > 0 ? sizeStock : undefined,
    }

    return {
      name: finalName,
      category: finalCategory,
      subcategory: finalSubcategory,
      brand: brand.trim(),
      sku: sku.trim() || generateSuggestedSku(),
      barcode: barcode.trim(),
      description: '',
      priceUsd: parsedPrice,
      costUsd: parsedCost > 0 ? parsedCost : null,
      stock: totalStock,
      isActive,
      images,
      colors,
      apparel: apparelData,
    }
  }

  // Validación de paso para avanzar
  const handleNextStep = () => {
    setError(null)

    if (currentStep === 1) {
      if (!mainType) {
        setError('Por favor selecciona qué tipo de artículo vas a ingresar.')
        return
      }
      // Actualizar subtipo por defecto si no corresponde
      if (!SUBTYPES_BY_CAT[mainType]?.includes(subtype)) {
        setSubtype(SUBTYPES_BY_CAT[mainType]?.[0] || '')
      }
      setCurrentStep(2)
      return
    }

    if (currentStep === 2) {
      if (!subtype) {
        setError('Selecciona el modelo o subtipo del producto.')
        return
      }
      setCurrentStep(3)
      return
    }

    if (currentStep === 3) {
      if ((mainType === 'calzado' || mainType === 'ropa') && sizeStock.length === 0) {
        setError('Selecciona al menos una talla disponible para este producto.')
        return
      }
      setCurrentStep(4)
      return
    }

    if (currentStep === 4) {
      if (!currentTitle.trim()) {
        setError('Escribe un nombre o modelo para el producto.')
        return
      }
      if (!sku.trim()) {
        setSku(generateSuggestedSku())
      }
      setCurrentStep(5)
      return
    }
  }

  const handleFinalSubmit = async () => {
    setError(null)
    if (parsedPrice <= 0) {
      setError('Por favor ingresa un precio de venta mayor a 0.')
      return
    }
    const payload = compilePayload()
    await onSave(payload)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl overflow-hidden shadow-2xl">
      {/* Barra Superior con Stepper & Switch a Modo Tradicional */}
      <div className="bg-white dark:bg-slate-950 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Asistente Guiado Inteligente
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Paso {currentStep} de 5
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {tenantName ? `Para: ${tenantName}` : 'Carga rápida de inventario'}
            </p>
          </div>
        </div>

        {/* Botón para cambiar a Tradicional si se prefiere */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitchToTraditional(compilePayload())}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title="Cambiar al formulario clásico sin asistente"
          >
            <span>⚡ Modo Tradicional</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Indicador de Progreso (Tabs numerados) */}
      <div className="px-6 py-2.5 bg-slate-100/80 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs overflow-x-auto gap-2">
        {[
          { num: 1, label: 'Tipo' },
          { num: 2, label: 'Modelo' },
          { num: 3, label: 'Tallas & Stock' },
          { num: 4, label: 'Fotos & Datos' },
          { num: 5, label: 'Precios' },
        ].map(step => (
          <button
            key={step.num}
            type="button"
            onClick={() => {
              if (step.num < currentStep) setCurrentStep(step.num)
            }}
            disabled={step.num > currentStep}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              currentStep === step.num
                ? 'bg-blue-600 text-white shadow-sm'
                : step.num < currentStep
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                : 'text-slate-400 opacity-60 cursor-not-allowed'
            }`}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono">
              {step.num < currentStep ? '✓' : step.num}
            </span>
            <span>{step.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido Dinámico del Paso */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 1: ¿Qué tipo de artículo estás cargando?              */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="text-center max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                ¿Qué tipo de artículo deseas registrar?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona la categoría para habilitar las preguntas y tallas adecuadas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl mx-auto pt-2">
              {MAIN_CATEGORIES.map((item) => {
                const IconComponent = item.icon
                const isSelected = mainType === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMainType(item.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-md shadow-blue-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2.5 rounded-xl ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200'
                      }`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {item.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 2: ¿Para quién es y qué modelo / subtipo es?         */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-xl mx-auto animate-in fade-in">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                ¿Para quién es y cuál es el tipo de modelo?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esto ayuda a segmentar tu catálogo y que tus clientes encuentren rápido el producto.
              </p>
            </div>

            {/* Género / Público */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Público / Género:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGender(g.id)}
                    className={`py-3 px-3.5 rounded-2xl border text-center font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                      gender === g.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-base">{g.emoji}</span>
                    <span>{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subtipo / Modelo específico */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                2. Subtipo o Estilo:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                {(SUBTYPES_BY_CAT[mainType] || []).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubtype(sub)}
                    className={`p-3 rounded-2xl border text-left font-bold text-xs transition cursor-pointer flex items-center justify-between ${
                      subtype === sub
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{sub}</span>
                    {subtype === sub && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 3: Tallas Disponibles, Colores y Existencias          */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6 max-w-xl mx-auto animate-in fade-in">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Tallas, Colores y Stock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona las tallas que tienes y escribe la cantidad exacta por cada una.
              </p>
            </div>

            {/* Si es Calzado o Ropa: Matriz de Tallas */}
            {(mainType === 'calzado' || mainType === 'ropa') && (
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-white">
                      Tallas Disponibles ({sizeStock.length})
                    </span>
                  </div>

                  {mainType === 'ropa' && (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-xl text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setApparelSizeType('letter')}
                        className={`px-2 py-1 rounded-lg transition ${
                          apparelSizeType === 'letter' ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        Letras (S/M/L)
                      </button>
                      <button
                        type="button"
                        onClick={() => setApparelSizeType('number')}
                        className={`px-2 py-1 rounded-lg transition ${
                          apparelSizeType === 'number' ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        Numéricas (28-38)
                      </button>
                    </div>
                  )}
                </div>

                {/* Chips rápidos de tallas */}
                <div className="flex flex-wrap gap-1.5">
                  {availableQuickSizes.map((sz) => {
                    const isSelected = sizeStock.some(s => s.size === sz)
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleToggleSize(sz)}
                        className={`h-9 min-w-9 px-2.5 rounded-xl font-mono font-bold text-xs transition cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {sz}
                      </button>
                    )
                  })}
                </div>

                {/* Input para agregar talla personalizada */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomSize()
                      }
                    }}
                    placeholder="Otra talla (ej. 32x34, Talla Única)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSize}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>

                {/* Matriz interactiva de existencias por cada talla seleccionada */}
                {sizeStock.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Existencia en stock por talla:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sizeStock.map((item) => (
                        <div
                          key={item.size}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                            Talla {item.size}
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={item.stock}
                              onChange={(e) => handleUpdateSizeStock(item.size, parseInt(e.target.value) || 0)}
                              className="w-14 text-center py-1 px-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleSize(item.size)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 px-1 text-xs font-black text-blue-600 dark:text-blue-400">
                      <span>Total Unidades Sumadas:</span>
                      <span className="text-sm font-mono bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
                        {totalStock} {mainType === 'calzado' ? 'pares' : 'unidades'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Si es General o sin tallas: Stock Único */}
            {mainType !== 'calzado' && mainType !== 'ropa' && (
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-black uppercase text-slate-800 dark:text-white">
                  Cantidad en Stock / Existencias
                </label>
                <input
                  type="number"
                  min="0"
                  value={generalStock}
                  onChange={(e) => setGeneralStock(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm"
                  placeholder="Ej. 10"
                />
              </div>
            )}

            {/* Selector de Colores */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-white">
                    Colores Disponibles ({colors.length})
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Opcional</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {POPULAR_COLORS.map((col) => {
                  const isSelected = colors.some(c => c.name.toLowerCase() === col.name.toLowerCase())
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => handleToggleColor(col)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-600 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 4: Nombre, Marca, SKU y Fotos                        */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="space-y-5 max-w-xl mx-auto animate-in fade-in">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Nombre del Producto y Fotos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personaliza el nombre generado, asigna la marca y sube las fotos de tu artículo.
              </p>
            </div>

            {/* Nombre del Producto */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nombre / Modelo del Producto *
                </label>
                {autoGeneratedTitle && (
                  <button
                    type="button"
                    onClick={() => setModelName(autoGeneratedTitle)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Usar sugerido
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={autoGeneratedTitle || "Ej. Sneakers Air Force 1 Dama Blanco"}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Marca y SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Marca (Opcional)
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej. Nike, Adidas, Zara..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Código / SKU
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder={generateSuggestedSku()}
                    className="flex-1 px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setSku(generateSuggestedSku())}
                    className="px-2.5 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                    title="Generar código aleatorio"
                  >
                    🎲
                  </button>
                </div>
              </div>
            </div>

            {/* Subida de Fotos */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Fotos del Producto ({images.length})
                </span>
                <span className="text-[10px] text-slate-400">La primera será la foto principal</span>
              </div>

              {/* Galería de fotos actuales */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden group shadow-2xs"
                    >
                      <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute inset-0 bg-rose-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botones de subida rápida */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>Subir desde dispositivo</span>
                </button>
              </div>

              {/* Alternativa URL */}
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="O pega el enlace URL de la foto..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 5: Precios, Rentabilidad & Confirmación Final          */}
        {/* ========================================================= */}
        {currentStep === 5 && (
          <div className="space-y-5 max-w-xl mx-auto animate-in fade-in">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Precios y Rentabilidad del Negocio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calcula tu margen de ganancia y el equivalente oficial en Bolívares.
              </p>
            </div>

            {/* Inputs de Costo y Venta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Costo de Compra ({currencySymbol} {currencyType})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costUsd}
                    onChange={(e) => setCostUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400">¿Cuánto te costó adquirirlo?</p>
              </div>

              <div className="p-4 rounded-3xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                  Precio de Venta ({currencySymbol} {currencyType}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  Equivalente BCV: Bs. {priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Tarjeta de Análisis de Rentabilidad */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Rendimiento Estimado
                </span>
                <span className="text-[10px] text-indigo-400">
                  Tasa BCV: Bs. {exchangeRate.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Ganancia Neta por Unidad:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {netProfit > 0 ? `+${currencySymbol}${netProfit.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Margen de Utilidad:</span>
                  <span className="text-lg font-black text-blue-300 font-mono">
                    {profitMargin ? `${profitMargin}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Resumen del Producto */}
              <div className="pt-2 border-t border-indigo-900/60 text-xs space-y-1 text-slate-300">
                <p><strong>Artículo:</strong> {currentTitle}</p>
                <p><strong>Total en inventario:</strong> {totalStock} unidades</p>
                {sizeStock.length > 0 && (
                  <p className="text-[11px] text-indigo-300 truncate">
                    <strong>Tallas:</strong> {sizeStock.map(s => `${s.size} (${s.stock})`).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle Activo */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white block">
                  Publicar en vitrina y tienda activa
                </span>
                <span className="text-[10px] text-slate-400">
                  Estará disponible para venta en POS y catálogo web
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Barra Inferior con Navegación y Botón de Acción */}
      <div className="bg-white dark:bg-slate-950 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>

        <div>
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-500/25 active:scale-95 transition cursor-pointer"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Producto en Inventario</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

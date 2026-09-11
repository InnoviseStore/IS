'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Loader2,
  Store,
  KeyRound,
  Mail,
  Phone,
  Tag,
  Sparkles,
  Smartphone,
  Shirt,
  Wine,
  HeartPulse,
  Palette,
  Car,
  Wrench,
  Boxes,
  Instagram,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  HelpCircle,
  Layout,
  ExternalLink,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const RUBRO_OPTIONS = [
  { id: 'tecnologia', label: 'Tecnología & Celulares', icon: Smartphone, defaultColor: '#2563eb', accent: '#4f46e5' },
  { id: 'moda', label: 'Moda & Calzado', icon: Shirt, defaultColor: '#db2777', accent: '#9333ea' },
  { id: 'bodegon', label: 'Bodegón & Bebidas', icon: Wine, defaultColor: '#b45309', accent: '#dc2626' },
  { id: 'farmacia', label: 'Farmacia & Salud', icon: HeartPulse, defaultColor: '#059669', accent: '#0284c7' },
  { id: 'belleza', label: 'Belleza & Cosmética', icon: Palette, defaultColor: '#e11d48', accent: '#c026d3' },
  { id: 'automotriz', label: 'Repuestos & Automotriz', icon: Car, defaultColor: '#ea580c', accent: '#475569' },
  { id: 'ferreteria', label: 'Ferretería & Construcción', icon: Wrench, defaultColor: '#d97706', accent: '#1e293b' },
  { id: 'general', label: 'Comercio General & Otro', icon: Boxes, defaultColor: '#0284c7', accent: '#4338ca' },
]

export function CreateTenantModal({ isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'branding' | 'account'>('info')

  // Step 1: Basic & Rubro
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [rubroId, setRubroId] = useState('tecnologia')
  const [isAiOptimizing, setIsAiOptimizing] = useState(false)
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null)

  // Step 2: Branding & Logos
  const [isotypeUrl, setIsotypeUrl] = useState('')
  const [imagotypeUrl, setImagotypeUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [accentColor, setAccentColor] = useState('#4f46e5')
  const [slogan, setSlogan] = useState('Conectando Vidas / Creando Futuro 🚀')
  const [suggestedCategories, setSuggestedCategories] = useState<{ name: string; prefix: string }[]>([])
  const [sampleProducts, setSampleProducts] = useState<any[]>([])
  const [createSampleProducts, setCreateSampleProducts] = useState(true)

  // Step 3: Social, Contact & Owner Credentials
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [plan, setPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  function handleNameChange(val: string) {
    setName(val)
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    setSlug(generated)
  }

  // Optimize with AI based on chosen Rubro & Store Name
  async function handleOptimizeWithAi() {
    setIsAiOptimizing(true)
    setAiSuccessMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/ai/tenant-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rubroId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.suggestedSlogan) setSlogan(data.suggestedSlogan)
        if (data.theme?.primaryColor) setPrimaryColor(data.theme.primaryColor)
        if (data.theme?.accentColor) setAccentColor(data.theme.accentColor)
        if (Array.isArray(data.categories)) setSuggestedCategories(data.categories)
        if (Array.isArray(data.sampleProducts)) setSampleProducts(data.sampleProducts)
        setAiSuccessMessage(`¡Catálogo y marca optimizados para el rubro "${data.rubro.label}"!`)
      }
    } catch (err: unknown) {
      setError('No se pudo completar la sugerencia de IA.')
    } finally {
      setIsAiOptimizing(false)
    }
  }

  // Handle local file uploads into data URLs
  function handleFileUpload(file: File, type: 'isotype' | 'imagotype') {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (type === 'isotype') {
        setIsotypeUrl(result)
      } else {
        setImagotypeUrl(result)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Por favor completa el nombre, enlace, correo y contraseña.')
      setActiveTab('info')
      return
    }

    if (adminPassword.length < 6) {
      setError('La contraseña del dueño debe tener al menos 6 caracteres.')
      setActiveTab('account')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          phone_whatsapp: phone.trim() || null,
          adminEmail: adminEmail.trim(),
          adminPassword,
          plan,
          rubro: rubroId,
          logo_url: imagotypeUrl || isotypeUrl || '/logo.png',
          isotype_url: isotypeUrl || null,
          imagotype_url: imagotypeUrl || null,
          slogan: slogan.trim() || null,
          instagram_handle: instagram.trim() || null,
          theme: { primaryColor, accentColor },
          suggested_categories: suggestedCategories.map((c) => c.name),
          createSampleProducts,
          sampleProducts,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear la tienda.')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        style={{ width: '100%', maxWidth: '780px', maxHeight: '88vh' }}
        className="relative z-10 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Crear Comercio Multi-Tienda (SaaS)
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Configura rubro, optimización con IA, logotipos y colores en un solo paso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>1. Rubro & Datos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'branding'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>2. Logos & Colores</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'account'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>3. Eslogan & Cuenta</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs font-medium">
            {error && (
              <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <X className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: Rubro & Datos Básicos */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Nombre y Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Nombre Comercial de la Tienda *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Bodegón Caracas, Óptica París..."
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Enlace Único de la Vitrina *
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 font-mono text-xs">/</span>
                      <input
                        type="text"
                        required
                        placeholder="bodegon-caracas"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="w-full pl-6 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Selección de Rubro con Tarjetas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      Selecciona el Rubro o Nicho Comercial
                    </label>
                    <span className="text-[11px] text-slate-400">Determina categorías y copy</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {RUBRO_OPTIONS.map((r) => {
                      const Icon = r.icon
                      const isSelected = rubroId === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setRubroId(r.id)
                            setPrimaryColor(r.defaultColor)
                            setAccentColor(r.accent)
                          }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                            {r.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Botón de Optimización IA */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/60 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                      Optimizar Catálogo y Estilo con IA
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Genera eslogan comercial, categorías recomendadas y paleta de colores para este rubro.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOptimizeWithAi}
                    disabled={isAiOptimizing}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                  >
                    {isAiOptimizing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analizando Rubro...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Optimizar con IA
                      </>
                    )}
                  </button>
                </div>

                {aiSuccessMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{aiSuccessMessage}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Identidad Visual, Logos e Isotipo / Imagotipo */}
            {activeTab === 'branding' && (
              <div className="space-y-5">
                {/* Cuadro Educativo: Recomendación de Espacios para Isotipo e Imagotipo */}
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                    <Layout className="w-4 h-4 text-amber-600" />
                    <span>Recomendación Inteligente de Colocación de Logos en el Catálogo:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-100 dark:border-amber-950">
                      <strong className="text-blue-600 dark:text-blue-400 block mb-0.5">🔹 Isotipo (Símbolo o Icono Cuadrado):</strong>
                      Ubicado en la <strong>barra de navegación superior (36x36px)</strong>, pestaña del navegador (Favicon) y avatar de WhatsApp móvil.
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-100 dark:border-amber-950">
                      <strong className="text-indigo-600 dark:text-indigo-400 block mb-0.5">🔹 Imagotipo / Logotipo (Horizontal o Completo):</strong>
                      Ubicado en el <strong>Hero Banner principal del catálogo (112x112px o apaisado)</strong> y en las cotizaciones/facturas PDF.
                    </div>
                  </div>
                </div>

                {/* Subida de Isotipo e Imagotipo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Isotipo */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                        Isotipo (Icono Cuadrado)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        Navbar 36px
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {isotypeUrl ? (
                          <img src={isotypeUrl} alt="Isotipo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Store className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 cursor-pointer shadow-xs transition">
                          <Upload className="w-3 h-3 text-blue-600" />
                          Subir Archivo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'isotype')
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="O pegar URL del isotipo..."
                          value={isotypeUrl}
                          onChange={(e) => setIsotypeUrl(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Imagotipo */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        Imagotipo / Logotipo
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Banner Hero 112px
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {imagotypeUrl ? (
                          <img src={imagotypeUrl} alt="Imagotipo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Store className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 cursor-pointer shadow-xs transition">
                          <Upload className="w-3 h-3 text-indigo-600" />
                          Subir Archivo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'imagotype')
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="O pegar URL del imagotipo..."
                          value={imagotypeUrl}
                          onChange={(e) => setImagotypeUrl(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paleta de Colores de la Marca */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-pink-500" />
                      Paleta de Colores de la Tienda
                    </span>
                    <span className="text-[11px] text-slate-400">Acentos, botones y degradados</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                      />
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-500">Color Primario</label>
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                      />
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-500">Color de Acento</label>
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Previsualización en Vivo de la Tarjeta */}
                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Vista previa de apariencia del botón:</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        style={{ background: `linear-gradient(to right, ${primaryColor}, ${accentColor})` }}
                        className="px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md shadow-blue-500/10"
                      >
                        Añadir al Carrito
                      </button>
                      <span
                        style={{ color: primaryColor }}
                        className="text-xs font-black"
                      >
                        $25.00 USD
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Eslogan, Contacto & Cuenta Dueño */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                {/* Eslogan de la Tienda */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold">
                      Eslogan Comercial de la Vitrina
                    </label>
                    <span className="text-[11px] text-slate-400">Aparecerá bajo el nombre de la tienda</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej. Tienda Virtual - Conectando Vidas / Creando Futuro 🚀"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-medium"
                  />
                </div>

                {/* WhatsApp e Instagram */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp de Pedidos
                    </label>
                    <input
                      type="text"
                      placeholder="584121234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                      <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram (@usuario)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 font-bold text-xs">@</span>
                      <input
                        type="text"
                        placeholder="mitienda.ve"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                        className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Plan SaaS */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" /> Plan SaaS Asignado
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="basic">Básico</option>
                    <option value="pro">Profesional (Recomendado)</option>
                    <option value="enterprise">Corporativo / Enterprise</option>
                  </select>
                </div>

                {/* Checkbox de Productos de muestra */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createSampleProducts}
                    onChange={(e) => setCreateSampleProducts(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Crear 3 productos de demostración para el catálogo de este rubro
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Permite que la tienda nueva arranque con stock de ejemplo listo para el catálogo público y el POS.
                    </span>
                  </div>
                </label>

                {/* Credenciales de Acceso del Dueño */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-indigo-500" />
                    Cuenta del Dueño (Owner)
                  </p>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Correo Electrónico de Acceso *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@comercio.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Contraseña Inicial *</label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
            <div>
              {activeTab !== 'info' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'account') setActiveTab('branding')
                    else if (activeTab === 'branding') setActiveTab('info')
                  }}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Atrás
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition"
              >
                Cancelar
              </button>

              {activeTab !== 'account' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'info') setActiveTab('branding')
                    else if (activeTab === 'branding') setActiveTab('account')
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Crear Tienda Oficial 🚀
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

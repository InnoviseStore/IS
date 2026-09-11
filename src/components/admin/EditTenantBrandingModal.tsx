'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  X,
  Loader2,
  Palette,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Tag,
  Phone,
  Instagram,
  Sparkles,
  Smartphone,
  Shirt,
  Wine,
  HeartPulse,
  Car,
  Wrench,
  Boxes,
  HelpCircle,
  ExternalLink
} from 'lucide-react'
import type { Tenant } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  tenant: Tenant | null
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

export function EditTenantBrandingModal({ isOpen, onClose, tenant, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'logos' | 'colors' | 'info'>('logos')

  const [name, setName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [rubroId, setRubroId] = useState('tecnologia')
  const [isotypeUrl, setIsotypeUrl] = useState('')
  const [imagotypeUrl, setImagotypeUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [accentColor, setAccentColor] = useState('#4f46e5')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '')
      const settings = (tenant.settings || {}) as Record<string, unknown>
      const theme = (settings.theme || {}) as Record<string, string>

      setSlogan((settings.slogan as string) || (settings.description as string) || '')
      setRubroId((settings.rubro as string) || 'general')
      setIsotypeUrl((settings.isotype_url as string) || '')
      setImagotypeUrl((settings.imagotype_url as string) || tenant.logo_url || '')
      setPrimaryColor(theme.primaryColor || '#2563eb')
      setAccentColor(theme.accentColor || '#4f46e5')
      setPhone(tenant.phone_whatsapp || '')
      setInstagram((settings.instagram_handle as string) || '')
      setError(null)
      setSavedSuccess(false)
    }
  }, [tenant, isOpen])

  if (!isOpen || !mounted || !tenant) return null

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return

    setLoading(true)
    setError(null)
    setSavedSuccess(false)

    try {
      const res = await fetch('/api/admin/tenants/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: name.trim(),
          phone_whatsapp: phone.trim() || null,
          isotype_url: isotypeUrl || null,
          imagotype_url: imagotypeUrl || null,
          logo_url: imagotypeUrl || isotypeUrl || '/logo.png',
          slogan: slogan.trim() || null,
          instagram_handle: instagram.trim() || null,
          rubro: rubroId,
          theme: {
            primaryColor,
            accentColor,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar la configuración de la tienda.')
      }

      setSavedSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div 
        style={{ width: '100%', maxWidth: '780px', maxHeight: '88vh' }}
        className="relative z-10 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header (fixed) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Editar Vitrina & Marca
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  /{tenant.slug}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Personaliza logotipos (isotipo/imagotipo), colores y datos de {tenant.name}
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
            onClick={() => setActiveTab('logos')}
            className={`py-2.5 px-4 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'logos'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>1. Logos (Isotipo e Imagotipo)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('colors')}
            className={`py-2.5 px-4 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'colors'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>2. Colores & Vista Previa</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-2.5 px-4 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>3. Eslogan & Contacto</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-medium">
            {error && (
              <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <X className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {savedSuccess && (
              <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                <span className="font-bold">¡Marca y vitrina actualizadas exitosamente!</span>
              </div>
            )}

            {/* TAB 1: LOGOS */}
            {activeTab === 'logos' && (
              <div className="space-y-4">
                {/* Cuadro de Orientación y Recomendación Visual */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300/40 dark:border-amber-700/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Recomendación Inteligente de Colocación de Logos en el Catálogo:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-800/30">
                      <span className="font-bold text-blue-700 dark:text-blue-300 block mb-0.5">
                        ◆ Isotipo (Icono o Símbolo Cuadrado):
                      </span>
                      Ubicado en la <strong>barra de navegación superior (36×36px)</strong>, pestaña del navegador (Favicon) y avatar de WhatsApp móvil.
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-800/30">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                        ◆ Imagotipo / Logotipo (Horizontal o Completo):
                      </span>
                      Ubicado en el <strong>Hero Banner principal del catálogo (112×112px o apaisado)</strong> y en las cotizaciones/facturas PDF.
                    </div>
                  </div>
                </div>

                {/* Subida de Isotipo e Imagotipo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Isotipo */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        Isotipo (Icono Cuadrado)
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                        Navbar 36px
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                        {isotypeUrl ? (
                          <Image
                            src={isotypeUrl}
                            alt="Isotipo"
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          Subir Archivo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, 'isotype')
                            }}
                          />
                        </label>
                        {isotypeUrl && (
                          <button
                            type="button"
                            onClick={() => setIsotypeUrl('')}
                            className="block text-[11px] text-rose-500 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="O pega URL de imagen (https://...)"
                      value={isotypeUrl}
                      onChange={(e) => setIsotypeUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Imagotipo */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        Imagotipo / Logotipo
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                        Banner Hero 112px
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-24 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                        {imagotypeUrl ? (
                          <Image
                            src={imagotypeUrl}
                            alt="Imagotipo"
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          Subir Archivo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, 'imagotype')
                            }}
                          />
                        </label>
                        {imagotypeUrl && (
                          <button
                            type="button"
                            onClick={() => setImagotypeUrl('')}
                            className="block text-[11px] text-rose-500 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="O pega URL de imagen (https://...)"
                      value={imagotypeUrl}
                      onChange={(e) => setImagotypeUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COLORES & VISTA PREVIA */}
            {activeTab === 'colors' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Color Primario */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                      Color Primario de la Marca
                    </label>
                    <p className="text-[11px] text-slate-500">Botones principales, acentos del header y enlaces</p>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  {/* Color de Acento */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: accentColor }} />
                      Color Secundario / Acento
                    </label>
                    <p className="text-[11px] text-slate-500">Gradientes decorativos, badges y efectos hover</p>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Vista Previa Interactiva en Vivo */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Simulación en Vivo del Catálogo:
                    </span>
                    <span className="text-[11px] text-slate-400">/{tenant.slug}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center p-1">
                        <Image
                          src={isotypeUrl || imagotypeUrl || '/logo.png'}
                          alt="Logo Preview"
                          width={44}
                          height={44}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {name || tenant.name}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">
                          {slogan || 'Tienda Virtual - Conectando Vidas / Creando Futuro 🚀'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-black px-2.5 py-1 rounded-xl"
                        style={{ color: primaryColor, backgroundColor: `${primaryColor}15` }}
                      >
                        $45.00 USD
                      </span>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-sm transition"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Agregar al Carrito
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: INFORMACIÓN & CONTACTO */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Nombre de la tienda */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Nombre Comercial de la Tienda *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Eslogan del Catálogo */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Eslogan o Subtítulo del Catálogo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Tienda Virtual - Conectando Vidas / Creando Futuro 🚀"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se muestra en el banner superior principal de la tienda virtual pública.
                  </p>
                </div>

                {/* Rubro */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                    Rubro Comercial
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {RUBRO_OPTIONS.map((r) => {
                      const Icon = r.icon
                      const isSelected = rubroId === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRubroId(r.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-[11px] truncate">{r.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Redes y Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      Teléfono / WhatsApp para Pedidos
                    </label>
                    <input
                      type="text"
                      placeholder="0412-1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                      <Instagram className="w-3.5 h-3.5 text-pink-600" />
                      Usuario de Instagram
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 font-bold text-xs">@</span>
                      <input
                        type="text"
                        placeholder="innovise.ve"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                        className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer (Fixed and always visible) */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex-shrink-0">
            <a
              href={`/${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-blue-600 text-xs font-semibold flex items-center gap-1"
            >
              Ver vitrina actual <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar Cambios de Marca 🎨
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

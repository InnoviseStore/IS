import Image from 'next/image'
import Link from 'next/link'
import {
  Store,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Smartphone,
  Layers,
  Bot,
  Mail,
  PhoneCall,
  ExternalLink,
  DollarSign
} from 'lucide-react'

export default function LandingPage() {
  const whatsappDevUrl = `https://wa.me/584120000000?text=${encodeURIComponent(
    'Hola! Vengo de la página principal de Innovise Store / IS System. Me gustaría consultar presupuesto y detalles para implementar esta plataforma de comercio electrónico y POS para mi negocio.'
  )}`

  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Aurora Background System */}
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                IS <span className="text-blue-600 dark:text-blue-400">System</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                SaaS Venezuela 🇻🇪
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/innovise"
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Ver Tienda Demo
            </Link>
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 dark:border-slate-700 hover:border-slate-400 transition"
            >
              Portal Admin
            </Link>
            <a
              href={whatsappDevUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contactar Desarrollador</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold animate-bounce-subtle">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Solución integral para el comercio venezolano</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          La Plataforma de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500">Comercio Digital & POS</span> para Venezuela 🚀
        </h1>

        <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Optimiza y automatiza tu negocio con catálogo virtual de alta velocidad, sincronización en vivo con la <strong>Tasa Oficial del Banco Central de Venezuela (BCV)</strong>, punto de venta para pagos divididos (Zelle, Pago Móvil, Efectivo USD/VES) y checkout automatizado directo a WhatsApp.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
          <a
            href={whatsappDevUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-200 shadow-xl shadow-emerald-600/30 active:scale-98"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Hablar con el Desarrollador</span>
          </a>

          <Link
            href="/innovise"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-200 shadow-md active:scale-98"
          >
            <span>Ver Vitrina de Ejemplo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Badges de confianza */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Cero comisiones por venta
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Tasa BCV oficial en tiempo real
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Despliegue llave en mano
          </span>
        </div>
      </section>

      {/* Visual Mockups Showcase (Lo que hace la plataforma) */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Todo lo que tu comercio necesita en un solo lugar
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Diseñado especialmente para superar los desafíos diarios del comercio en Venezuela: multimoneda, inflación, pagos mixtos y ventas rápidas por WhatsApp.
          </p>
        </div>

        {/* Bento Grid con Capturas / Módulos del Sistema */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Tasa BCV Oficial */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-blue-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Tasa Oficial BCV Automatizada
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Extracción en vivo de la tasa del Banco Central de Venezuela con Fecha Valor del día. Convierte automáticamente todos los precios en dólares a bolívares sin que tengas que calcular nada a mano.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <TrendingUp className="w-4 h-4" />
                <span>Tasa BCV Oficial:</span>
              </div>
              <span className="font-mono font-black text-blue-800 dark:text-blue-200">
                Sincronizada en vivo
              </span>
            </div>
          </div>

          {/* Card 2: Punto de Venta & Pagos Divididos */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-indigo-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              POS para Pagos Mixtos y Créditos
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Cobra una misma venta combinando Zelle, Pago Móvil, Efectivo USD y Bolívares. Incluye cálculo de IGTF (3%), gestión de créditos a clientes frecuentes y cierres de caja diarios.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>🟢 Zelle USD</span>
                <span className="font-bold">$20.00</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>🟣 Pago Móvil</span>
                <span className="font-bold">Bs. 832,50</span>
              </div>
            </div>
          </div>

          {/* Card 3: Checkout WhatsApp */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-emerald-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Catálogo Web con Pedidos por WhatsApp
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Tus clientes navegan por un catálogo ultra-rápido en su teléfono, seleccionan colores, añaden al carrito y te envían el pedido formateado directo a tu WhatsApp con un solo clic.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                <MessageCircle className="w-4 h-4" />
                <span>Pedido listo para WhatsApp</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">100% Automático</span>
            </div>
          </div>

          {/* Card 4: Asistente Inteligente con IA */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-purple-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Asistente con Inteligencia Artificial
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Edith AI analiza tus ganancias netas del mes, te avisa qué productos están agotándose y genera automáticamente categorías y códigos de producto (SKU) al agregarlos al sistema.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs text-purple-800 dark:text-purple-300 font-medium">
              ✨ Auto-clasificación de productos y análisis financiero
            </div>
          </div>

          {/* Card 5: Multi-Tenant & Aislamiento Total */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-amber-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Seguridad de Grado Bancario
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Aislamiento estricto por Row Level Security (RLS) en Supabase PostgreSQL. Tus ventas, inventarios, precios y clientes están 100% protegidos y aislados.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 font-medium">
              🔒 Row Level Security (RLS) activo
            </div>
          </div>

          {/* Card 6: Variantes por Color y Fotos */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 hover:border-cyan-500/50 transition-all">
            <div className="p-3 w-fit rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Variantes de Color con Fotos Propias
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Muestra a tus clientes exactamente el color que van a comprar. Al hacer clic en un color, la vitrina cambia automáticamente la imagen a la foto de ese color específico.
            </p>
            {/* Visual Preview */}
            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/60 flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600" />
              <span className="w-3.5 h-3.5 rounded-full bg-slate-900" />
              <span className="w-3.5 h-3.5 rounded-full bg-red-600" />
              <span className="text-cyan-800 dark:text-cyan-300 font-semibold ml-1">Swatches interactivos</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE CONTACTO CON EL DESARROLLADOR */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          {/* Decorative glows */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-indigo-500/30 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-cyan-200 text-xs font-extrabold uppercase tracking-wider backdrop-blur-xs">
              <Zap className="w-3.5 h-3.5" />
              Contacto Directo con el Desarrollador
            </span>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              ¿Quieres implementar esta plataforma para tu tienda o negocio?
            </h2>

            <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
              Hola, soy el desarrollador de <strong>IS System</strong>. Puedo configurar, desplegar y personalizar esta plataforma completa para tu negocio en tiempo récord con tu propio dominio, logo, catálogo y número de WhatsApp.
            </p>

            {/* Beneficios del servicio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>Instalación y configuración completa</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>Carga inicial de tus productos y fotos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>Soporte técnico continuo y adaptaciones</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>Hosting en la nube de alta disponibilidad</span>
              </div>
            </div>

            {/* Botones de Contacto */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
              <a
                href={whatsappDevUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Escribir por WhatsApp</span>
              </a>

              <a
                href="mailto:yiovannerpc@gmail.com?subject=Consulta%20Plataforma%20IS%20System"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-xs transition active:scale-95"
              >
                <Mail className="w-4 h-4" />
                <span>yiovannerpc@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">
              IS
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">Innovise Store SaaS Platform</span>
            <span>·</span>
            <span>Todos los derechos reservados © {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/innovise" className="hover:text-blue-600 transition">
              Tienda Demo (Innovise)
            </Link>
            <Link href="/login" className="hover:text-blue-600 transition">
              Acceso Administrativo
            </Link>
            <a
              href="https://www.bcv.org.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition flex items-center gap-1"
            >
              <span>BCV Oficial</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
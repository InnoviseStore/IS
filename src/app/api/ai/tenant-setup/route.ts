import { NextResponse } from 'next/server'

interface RubroConfig {
  id: string
  label: string
  icon: string
  sloganTemplates: string[]
  primaryColor: string
  accentColor: string
  categories: { name: string; prefix: string; icon: string }[]
  sampleProducts: {
    name: string
    sku: string
    description: string
    base_price_usd: number
    cost_usd: number
    stock: number
  }[]
}

const RUBROS: Record<string, RubroConfig> = {
  tecnologia: {
    id: 'tecnologia',
    label: 'Tecnología & Celulares',
    icon: 'Smartphone',
    sloganTemplates: [
      'Conectando Vidas / Creando Futuro 🚀',
      'Tu portal oficial de tecnología de vanguardia y accesorios premium ⚡',
      'Innovación, calidad y los mejores gadgets a tu alcance 📱',
    ],
    primaryColor: '#2563eb', // Blue-600
    accentColor: '#4f46e5',  // Indigo-600
    categories: [
      { name: 'Altavoces & Audio', prefix: 'ALT', icon: 'Volume2' },
      { name: 'Audífonos & Auriculares', prefix: 'AUD', icon: 'Headphones' },
      { name: 'Cables & Cargadores Rápidos', prefix: 'CAB', icon: 'Zap' },
      { name: 'Periféricos & Computación', prefix: 'PER', icon: 'Mouse' },
      { name: 'Protectores & Fundas', prefix: 'CAS', icon: 'Shield' },
      { name: 'Smartwatches & Wearables', prefix: 'REL', icon: 'Watch' },
    ],
    sampleProducts: [
      {
        name: 'Audífonos Inalámbricos Bluetooth Pro TWS',
        sku: 'AUD-001',
        description: 'Cancelación de ruido estéreo, batería de larga duración hasta 24h con estuche de carga USB-C.',
        base_price_usd: 25.0,
        cost_usd: 14.0,
        stock: 15,
      },
      {
        name: 'Altavoz Portátil Impermeable BT 10W',
        sku: 'ALT-001',
        description: 'Resistente al agua IPX6, graves potentes con radiador pasivo y batería de 12 horas continuas.',
        base_price_usd: 35.0,
        cost_usd: 20.0,
        stock: 12,
      },
      {
        name: 'Cable USB-C a USB-C Trenzado 65W 1.8M',
        sku: 'CAB-001',
        description: 'Carga ultrarrápida Power Delivery con nylon trenzado de alta durabilidad resistente a dobleces.',
        base_price_usd: 8.5,
        cost_usd: 3.5,
        stock: 30,
      },
    ],
  },
  moda: {
    id: 'moda',
    label: 'Moda, Calzado & Accesorios',
    icon: 'Shirt',
    sloganTemplates: [
      'Estilo, tendencia y exclusividad en cada prenda ✨',
      'Viste tu mejor versión con lo último en moda y elegancia 👗',
      'Tu outfit ideal para cada momento con envíos directos 🛍️',
    ],
    primaryColor: '#db2777', // Pink-600
    accentColor: '#9333ea',  // Purple-600
    categories: [
      { name: 'Prendas Superiores / Tops & Camisas', prefix: 'TOP', icon: 'Shirt' },
      { name: 'Pantalones & Jeans', prefix: 'PAN', icon: 'Scissors' },
      { name: 'Calzado & Zapatos', prefix: 'CAL', icon: 'Footprints' },
      { name: 'Carteras & Bolsos', prefix: 'BOL', icon: 'ShoppingBag' },
      { name: 'Accesorios & Joyería', prefix: 'ACC', icon: 'Sparkles' },
    ],
    sampleProducts: [
      {
        name: 'Camisa Oversize Algodón Premium',
        sku: 'TOP-001',
        description: 'Confección 100% algodón suave y transpirable, corte moderno relajado para uso diario.',
        base_price_usd: 22.0,
        cost_usd: 11.0,
        stock: 20,
      },
      {
        name: 'Sneakers Casual Urban Suela Ligera',
        sku: 'CAL-001',
        description: 'Zapatillas deportivas urbanas con plantilla acolchada ergonómica y diseño versátil.',
        base_price_usd: 42.0,
        cost_usd: 24.0,
        stock: 10,
      },
      {
        name: 'Bolso Cruzado Minimalista de Cuero Sintético',
        sku: 'BOL-001',
        description: 'Compartimentos interiores con cierre metálico reforzado y correa ajustable.',
        base_price_usd: 18.0,
        cost_usd: 8.5,
        stock: 14,
      },
    ],
  },
  bodegon: {
    id: 'bodegon',
    label: 'Bodegón, Alimentos & Bebidas',
    icon: 'Wine',
    sloganTemplates: [
      'Sabores selectos, licores premium y delicateses para compartir 🍷',
      'Calidad garantizada, frescura y las mejores marcas importadas 🧀',
      'Tu despensa gourmet con atención y despacho inmediato 🛒',
    ],
    primaryColor: '#b45309', // Amber-700
    accentColor: '#dc2626',  // Red-600
    categories: [
      { name: 'Licores & Vinos', prefix: 'LIC', icon: 'Wine' },
      { name: 'Snacks & Golosinas Importadas', prefix: 'SNA', icon: 'Cookie' },
      { name: 'Embutidos & Quesos Gourmet', prefix: 'DEL', icon: 'Utensils' },
      { name: 'Café & Infusiones', prefix: 'CAF', icon: 'Coffee' },
      { name: 'Bebidas & Refrescos', prefix: 'BEB', icon: 'GlassWater' },
    ],
    sampleProducts: [
      {
        name: 'Vino Tinto Reserva Especial 750ml',
        sku: 'LIC-001',
        description: 'Aromas frutales con notas de roble y frutos rojos, maridaje ideal para carnes y quesos.',
        base_price_usd: 16.5,
        cost_usd: 10.0,
        stock: 24,
      },
      {
        name: 'Café de Especialidad Tueste Medio 500g',
        sku: 'CAF-001',
        description: 'Granos arábica seleccionados de altura, notas achocolatadas y acidez balanceada.',
        base_price_usd: 9.0,
        cost_usd: 5.2,
        stock: 18,
      },
      {
        name: 'Chocolate Suizo con Almendras Tostadas 200g',
        sku: 'SNA-001',
        description: 'Tableta gourmet con textura crujiente e intenso sabor a cacao de origen controlado.',
        base_price_usd: 6.0,
        cost_usd: 3.5,
        stock: 35,
      },
    ],
  },
  farmacia: {
    id: 'farmacia',
    label: 'Farmacia & Cuidado de la Salud',
    icon: 'HeartPulse',
    sloganTemplates: [
      'Salud, bienestar y medicamentos de confianza al mejor precio 💊',
      'Cuidando de ti y tu familia con atención profesional y cercana 🩺',
      'Tu farmacia digital con disponibilidad y entrega rápida 🏥',
    ],
    primaryColor: '#059669', // Emerald-600
    accentColor: '#0284c7',  // Sky-600
    categories: [
      { name: 'Medicamentos & Tratamientos', prefix: 'MED', icon: 'Pill' },
      { name: 'Cuidado Personal & Aseo', prefix: 'CUI', icon: 'Heart' },
      { name: 'Vitaminas & Suplementos', prefix: 'VIT', icon: 'Sparkles' },
      { name: 'Primeros Auxilios & Botiquín', prefix: 'AUX', icon: 'BriefcaseMedical' },
      { name: 'Mamá & Bebé', prefix: 'BEB', icon: 'Baby' },
    ],
    sampleProducts: [
      {
        name: 'Multivitamínico Completo A-Z 60 Cápsulas',
        sku: 'VIT-001',
        description: 'Fórmula con zinc, vitamina C, complejo B y minerales para reforzar el sistema inmune.',
        base_price_usd: 14.5,
        cost_usd: 8.0,
        stock: 25,
      },
      {
        name: 'Termómetro Digital Infrarrojo Sin Contacto',
        sku: 'AUX-001',
        description: 'Lectura instantánea en 1 segundo con pantalla LCD retroiluminada y alarma de fiebre.',
        base_price_usd: 18.0,
        cost_usd: 10.5,
        stock: 12,
      },
      {
        name: 'Crema Hidratante Piel Sensible 250ml',
        sku: 'CUI-001',
        description: 'Hipoalergénica con ceramidas y ácido hialurónico, libre de fragancias e irritantes.',
        base_price_usd: 11.0,
        cost_usd: 6.2,
        stock: 20,
      },
    ],
  },
  belleza: {
    id: 'belleza',
    label: 'Belleza, Cosmética & Skincare',
    icon: 'Sparkles',
    sloganTemplates: [
      'Realza tu belleza natural con productos profesionales de alta gama 💄',
      'Skincare, maquillaje y cuidado capilar para brillar todos los días ✨',
      'El secreto de tu piel perfecta en un solo lugar 🌸',
    ],
    primaryColor: '#e11d48', // Rose-600
    accentColor: '#c026d3',  // Fuchsia-600
    categories: [
      { name: 'Skincare & Tratamientos Faciales', prefix: 'SKI', icon: 'Sparkles' },
      { name: 'Maquillaje Profesional', prefix: 'MAQ', icon: 'Brush' },
      { name: 'Cuidado Capilar & Peluquería', prefix: 'CAP', icon: 'Scissors' },
      { name: 'Perfumería & Fragancias', prefix: 'PER', icon: 'Flame' },
      { name: 'Uñas & Manicura', prefix: 'UNA', icon: 'Hand' },
    ],
    sampleProducts: [
      {
        name: 'Serum Facial Ácido Hialurónico + Vitamina C 30ml',
        sku: 'SKI-001',
        description: 'Fórmula rejuvenecedora antioxidante que aporta luminosidad, hidratación profunda y firmeza.',
        base_price_usd: 15.0,
        cost_usd: 7.5,
        stock: 22,
      },
      {
        name: 'Labial Mate Larga Duración Indeleble',
        sku: 'MAQ-001',
        description: 'Acabado aterciopelado de alta pigmentación que no reseca los labios ni se transfiere.',
        base_price_usd: 8.5,
        cost_usd: 4.0,
        stock: 30,
      },
      {
        name: 'Mascarilla Capilar Reparadora Argán & Keratina 300g',
        sku: 'CAP-001',
        description: 'Nutrición intensiva para cabello maltratado, sella puntas abiertas y aporta brillo sedoso.',
        base_price_usd: 12.0,
        cost_usd: 6.0,
        stock: 16,
      },
    ],
  },
  automotriz: {
    id: 'automotriz',
    label: 'Repuestos & Automotriz',
    icon: 'Car',
    sloganTemplates: [
      'Repuestos originales, lubricantes y accesorios para tu vehículo 🚗',
      'Potencia, seguridad y confianza en cada kilómetro de tu viaje 🔧',
      'Mantenimiento garantizado con despacho de repuestos a nivel nacional ⚙️',
    ],
    primaryColor: '#ea580c', // Orange-600
    accentColor: '#475569',  // Slate-600
    categories: [
      { name: 'Lubricantes & Fluidos', prefix: 'LUB', icon: 'Droplet' },
      { name: 'Filtros (Aceite, Aire, Gasolina)', prefix: 'FIL', icon: 'Filter' },
      { name: 'Frenos & Suspensión', prefix: 'FRE', icon: 'Disc' },
      { name: 'Baterías & Electricidad', prefix: 'BAT', icon: 'BatteryCharging' },
      { name: 'Accesorios & Limpieza Car Care', prefix: 'ACC', icon: 'Sparkles' },
    ],
    sampleProducts: [
      {
        name: 'Aceite de Motor Sintético 5W-30 Cuarto (946ml)',
        sku: 'LUB-001',
        description: 'Protección superior contra desgaste térmico, optimiza el rendimiento y ahorra combustible.',
        base_price_usd: 12.5,
        cost_usd: 7.8,
        stock: 36,
      },
      {
        name: 'Pastillas de Freno Delanteras Cerámicas',
        sku: 'FRE-001',
        description: 'Frenado silencioso sin polvo negro, máxima disipación de calor para conducción segura.',
        base_price_usd: 28.0,
        cost_usd: 16.0,
        stock: 14,
      },
      {
        name: 'Filtro de Aire Motor Alto Flujo',
        sku: 'FIL-001',
        description: 'Filtración de micropartículas con flujo optimizado que protege el motor y la inyección.',
        base_price_usd: 9.5,
        cost_usd: 4.8,
        stock: 20,
      },
    ],
  },
  ferreteria: {
    id: 'ferreteria',
    label: 'Ferretería, Construcción & Hogar',
    icon: 'Wrench',
    sloganTemplates: [
      'Herramientas, materiales y soluciones sólidas para tus proyectos 🛠️',
      'Todo para la construcción, plomería y mejoras del hogar 🏠',
      'Calidad industrial y asesoría experta en cada herramienta 🔩',
    ],
    primaryColor: '#d97706', // Amber-600
    accentColor: '#1e293b',  // Slate-800
    categories: [
      { name: 'Herramientas Eléctricas & Manuales', prefix: 'HER', icon: 'Wrench' },
      { name: 'Pinturas & Impermeabilizantes', prefix: 'PIN', icon: 'Paintbrush' },
      { name: 'Electricidad & Iluminación LED', prefix: 'ELE', icon: 'Zap' },
      { name: 'Plomería & Grifería', prefix: 'PLO', icon: 'Wrench' },
      { name: 'Tornillería & Fijaciones', prefix: 'TOR', icon: 'Boxes' },
    ],
    sampleProducts: [
      {
        name: 'Taladro Percutor Inalámbrico 20V con Maletín y 2 Baterías',
        sku: 'HER-001',
        description: 'Motor de alto torque con 2 velocidades, mandril de metal de 1/2 pulgada y luz LED auxiliar.',
        base_price_usd: 65.0,
        cost_usd: 42.0,
        stock: 8,
      },
      {
        name: 'Reflector LED Exterior 50W Luz Blanca Impermeable IP66',
        sku: 'ELE-001',
        description: 'Iluminación de alta eficiencia con carcasa de aluminio disipador y vidrio templado.',
        base_price_usd: 12.0,
        cost_usd: 6.5,
        stock: 25,
      },
      {
        name: 'Juego de Destornilladores Magnéticos de Precisión (6 Piezas)',
        sku: 'HER-002',
        description: 'Puntas de acero cromo vanadio imantadas con mango ergonómico antideslizante.',
        base_price_usd: 8.5,
        cost_usd: 4.0,
        stock: 18,
      },
    ],
  },
  general: {
    id: 'general',
    label: 'Comercio General & Variedades',
    icon: 'Store',
    sloganTemplates: [
      'Tu tienda de confianza con variedad, buenos precios y entregas seguras 🛍️',
      'Calidad, conveniencia y el mejor surtido para tu día a día 🌟',
      'Atención rápida y catálogo actualizado con envíos a domicilio 📦',
    ],
    primaryColor: '#0284c7', // Sky-600
    accentColor: '#4338ca',  // Indigo-700
    categories: [
      { name: 'Artículos Destacados', prefix: 'DES', icon: 'Sparkles' },
      { name: 'Hogar & Cocina', prefix: 'HOG', icon: 'Home' },
      { name: 'Accesorios & Regalos', prefix: 'REG', icon: 'Gift' },
      { name: 'Tecnología Útil', prefix: 'TEC', icon: 'Cpu' },
      { name: 'Promociones & Ofertas', prefix: 'OFE', icon: 'Tag' },
    ],
    sampleProducts: [
      {
        name: 'Botella Térmica de Acero Inoxidable 750ml',
        sku: 'HOG-001',
        description: 'Mantiene bebidas frías hasta 24h y calientes hasta 12h, con tapa hermética antiderrame.',
        base_price_usd: 12.0,
        cost_usd: 6.0,
        stock: 20,
      },
      {
        name: 'Lámpara de Mesa LED Recargable Touch con 3 Intensidades',
        sku: 'HOG-002',
        description: 'Brazo flexible 360 grados, luz cálida y blanca para lectura con batería recargable USB.',
        base_price_usd: 14.5,
        cost_usd: 7.2,
        stock: 15,
      },
      {
        name: 'Organizador Multiuso Plegable para Armario y Gavetas',
        sku: 'HOG-003',
        description: 'Material textil reforzado lavable con divisiones prácticas para optimizar el espacio.',
        base_price_usd: 7.5,
        cost_usd: 3.2,
        stock: 28,
      },
    ],
  },
}

export async function POST(req: Request) {
  try {
    const { name, rubroId } = await req.json()

    const cleanName = (name || '').toString().trim()
    const targetRubroKey = (rubroId || 'tecnologia').toString().toLowerCase()

    const config = RUBROS[targetRubroKey] || RUBROS.tecnologia

    // Generar eslogan dinámico incorporando el nombre si es propicio
    const randomTemplate = config.sloganTemplates[Math.floor(Math.random() * config.sloganTemplates.length)]
    const suggestedSlogan = cleanName ? `${cleanName} — ${randomTemplate}` : randomTemplate

    // Recomendación de colocación de logos según espacios de la vitrina
    const logoGuidance = {
      isotype: {
        title: 'Isotipo (Icono o Símbolo Cuadrado)',
        recommendedSpace: 'Barra de navegación compacta (36x36px) y Pestaña del navegador (Favicon)',
        details: 'Un símbolo gráfico simplificado sin texto pequeño. Se adapta a espacios reducidos de pantallas móviles y avatares.',
      },
      imagotype: {
        title: 'Imagotipo / Logotipo (Horizontal con Nombre)',
        recommendedSpace: 'Banner Hero del Catálogo (112x112px o apaisado) y Encabezados de Presupuestos',
        details: 'El identificador oficial completo de la marca. Tiene mayor peso visual y se luce en la cabecera principal de la vitrina.',
      },
    }

    return NextResponse.json({
      success: true,
      rubro: {
        id: config.id,
        label: config.label,
        icon: config.icon,
      },
      suggestedSlogan,
      theme: {
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
      },
      categories: config.categories,
      sampleProducts: config.sampleProducts,
      logoGuidance,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en optimizador IA' },
      { status: 500 }
    )
  }
}

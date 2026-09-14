import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ApparelAttributes {
  garmentType?: string
  gender?: string
  sizes?: string[]
}

interface ColorItem {
  name: string
  hex?: string
}

import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export async function POST(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const body = await req.json()
    const {
      name,
      category,
      apparelAttributes,
      colors,
    }: {
      name?: string
      category?: string
      apparelAttributes?: ApparelAttributes
      colors?: ColorItem[]
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Por favor indica el nombre del producto para generar su descripción.' },
        { status: 400 }
      )
    }

    const cleanName = name.trim()
    const n = cleanName.toLowerCase()

    // 1. Detect category profile if not provided
    let profile = 'general'
    if (
      category?.toLowerCase().includes('calzado') ||
      category?.toLowerCase().includes('zapato') ||
      n.includes('zapato') ||
      n.includes('sneaker') ||
      n.includes('zapatilla') ||
      n.includes('calzado') ||
      n.includes('bota') ||
      n.includes('sandalia') ||
      n.includes('tacón') ||
      n.includes('tacon')
    ) {
      profile = 'footwear'
    } else if (
      category?.toLowerCase().includes('ropa') ||
      category?.toLowerCase().includes('pantalon') ||
      category?.toLowerCase().includes('camisa') ||
      category?.toLowerCase().includes('prenda') ||
      n.includes('franela') ||
      n.includes('pantalon') ||
      n.includes('pantalón') ||
      n.includes('jean') ||
      n.includes('camisa') ||
      n.includes('vestido') ||
      n.includes('falda') ||
      n.includes('short') ||
      n.includes('blusa') ||
      n.includes('sweater') ||
      n.includes('chaqueta')
    ) {
      profile = 'apparel'
    } else if (
      category?.toLowerCase().includes('audio') ||
      category?.toLowerCase().includes('auricular') ||
      category?.toLowerCase().includes('corneta') ||
      category?.toLowerCase().includes('altavoz') ||
      n.includes('audifono') ||
      n.includes('auricular') ||
      n.includes('altavoz') ||
      n.includes('corneta') ||
      n.includes('speaker') ||
      n.includes('earbud') ||
      n.includes('soundbar')
    ) {
      profile = 'audio'
    } else if (
      category?.toLowerCase().includes('funda') ||
      category?.toLowerCase().includes('case') ||
      category?.toLowerCase().includes('protector') ||
      category?.toLowerCase().includes('mica') ||
      category?.toLowerCase().includes('cable') ||
      category?.toLowerCase().includes('cargador') ||
      n.includes('funda') ||
      n.includes('case') ||
      n.includes('protector') ||
      n.includes('mica') ||
      n.includes('vidrio') ||
      n.includes('cargador') ||
      n.includes('cable') ||
      n.includes('adaptador') ||
      n.includes('powerbank')
    ) {
      profile = 'accessories'
    } else if (
      n.includes('reloj') ||
      n.includes('smartwatch') ||
      n.includes('band') ||
      n.includes('pulsera')
    ) {
      profile = 'smartwatch'
    } else if (
      n.includes('bolso') ||
      n.includes('cartera') ||
      n.includes('mochila') ||
      n.includes('morral') ||
      n.includes('billetera')
    ) {
      profile = 'bags'
    }

    let description = ''

    // Helper for sizes string
    const sizesStr =
      apparelAttributes?.sizes && apparelAttributes.sizes.length > 0
        ? apparelAttributes.sizes.join(', ')
        : ''

    const colorsStr =
      colors && colors.length > 0
        ? colors.map((c) => c.name).join(', ')
        : ''

    const genderStr = apparelAttributes?.gender
      ? ` (${apparelAttributes.gender})`
      : ''

    if (profile === 'footwear') {
      description = `Descubre el equilibrio perfecto entre estilo, confort y durabilidad con ${cleanName}${genderStr}. Diseñado para adaptarse a tu ritmo diario con una pisada amortiguada y un acabado moderno que combina con cualquier outfit casual o deportivo.

✨ Características destacadas:
• Suela antiderrapante con gran tracción y resistencia al desgaste.
• Interior acolchado y plantilla ergonómica para máximo confort durante todo el día.
• Materiales de alta calidad, ligeros y transpirables.`

      if (sizesStr) {
        description += `\n• Tallas disponibles: ${sizesStr}.`
      }
      if (colorsStr) {
        description += `\n• Variantes de color: ${colorsStr}.`
      }
      description += `\n\nIdeal para uso diario, salidas casuales o entrenamientos. ¡Añádelo a tu colección!`
    } else if (profile === 'apparel') {
      const garment = apparelAttributes?.garmentType || 'prenda'
      description = `Eleva tu estilo cotidiano con ${cleanName}${genderStr}. Confeccionado pensando en la comodidad y la frescura, este ${garment} ofrece un ajuste favorecedor y una textura suave al contacto con la piel.

✨ Aspectos destacados:
• Tejido premium de alta durabilidad que mantiene su forma y color tras cada lavado.
• Corte moderno y versátil, fácil de combinar para ocasiones formales o casuales.
• Costuras reforzadas para un acabado impecable y máxima resistencia.`

      if (sizesStr) {
        description += `\n• Tallas disponibles: ${sizesStr}.`
      }
      if (colorsStr) {
        description += `\n• Tonos y colores: ${colorsStr}.`
      }
      description += `\n\nUna prenda esencial y cómoda para lucir siempre impecable.`
    } else if (profile === 'audio') {
      description = `Disfruta de una experiencia sonora envolvente y de alta fidelidad con ${cleanName}. Diseñado para los amantes de la buena música, llamadas nítidas y entretenimiento continuo con graves profundos y agudos balanceados.

✨ Especificaciones principales:
• Sonido estéreo de alta resolución con cancelación de ruido pasiva/activa.
• Conectividad inalámbrica rápida y estable, compatible con iOS, Android y computadoras.
• Batería de larga duración para horas continuas de reproducción y carga rápida.
• Diseño ergonómico, liviano y portátil para llevar a donde vayas.`

      if (colorsStr) {
        description += `\n• Colores disponibles: ${colorsStr}.`
      }
      description += `\n\n¡Lleva tu música favorita al siguiente nivel!`
    } else if (profile === 'accessories') {
      description = `Protege y complementa tus dispositivos con ${cleanName}. Fabricado con materiales de grado superior que garantizan máxima protección contra caídas, rayones y el desgaste diario sin perder la elegancia.

✨ Beneficios clave:
• Protección robusta de alto impacto con perfil estilizado.
• Ajuste milimétrico y acceso total a todos los puertos, botones y funciones.
• Acabado suave al tacto con agarre antideslizante para evitar caídas accidentales.
• Durabilidad garantizada y fácil instalación.`

      if (colorsStr) {
        description += `\n• Colores disponibles: ${colorsStr}.`
      }
      description += `\n\nEl accesorio indispensable para mantener tu equipo seguro y como nuevo.`
    } else if (profile === 'smartwatch') {
      description = `Monitorea tu salud, actividad física y mantente conectado en todo momento con ${cleanName}. Un smartwatch versátil, elegante y funcional que te acompaña en tus entrenamientos y jornadas diarias.

✨ Funciones destacadas:
• Pantalla táctil de alta definición con excelente visibilidad bajo la luz del sol.
• Monitoreo de pasos, ritmo cardíaco, calidad del sueño y modos deportivos.
• Notificaciones en tiempo real de llamadas, mensajes y aplicaciones favoritas.
• Batería de larga autonomía y resistencia al sudor y salpicaduras.`

      if (colorsStr) {
        description += `\n• Opciones de color: ${colorsStr}.`
      }
      description += `\n\n¡Tu compañero ideal para un estilo de vida activo y conectado!`
    } else if (profile === 'bags') {
      description = `Organiza y transporta tus pertenencias con total seguridad y estilo gracias a ${cleanName}. Creado para quienes buscan practicidad, durabilidad y un diseño contemporáneo.

✨ Características clave:
• Compartimentos inteligentes de amplia capacidad y bolsillos de fácil acceso.
• Material impermeable y resistente al desgarro con cierres reforzados de alta calidad.
• Correas ergonómicas y acolchadas para un transporte cómodo y sin fatiga.`

      if (colorsStr) {
        description += `\n• Colores y modelos: ${colorsStr}.`
      }
      description += `\n\nPerfecto para el trabajo, universidad, viajes o salidas del día a día.`
    } else {
      // General commercial copy
      description = `Descubre la calidad, practicidad y rendimiento que te ofrece ${cleanName}. Diseñado con altos estándares para brindarte una solución confiable, moderna y duradera que supera tus expectativas.

✨ Características principales:
• Fabricado con materiales de primera calidad para una vida útil prolongada.
• Diseño funcional, ergonómico y pensado en la facilidad de uso cotidiano.
• Excelente relación precio-calidad con total garantía de satisfacción.`

      if (colorsStr) {
        description += `\n• Variantes disponibles: ${colorsStr}.`
      }
      description += `\n\n¡Un producto garantizado listo para enriquecer tu día a día!`
    }

    return NextResponse.json({
      success: true,
      description,
      profile,
    })
  } catch (err) {
    console.error('Error generating description:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Error al generar la descripción del producto' },
      { status: 500 }
    )
  }
}

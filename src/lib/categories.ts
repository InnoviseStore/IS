export function detectCategory(name: string, description?: string | null): string {
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

  const n = (name || '').toLowerCase();
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

export function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

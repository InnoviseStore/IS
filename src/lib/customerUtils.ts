import crypto from 'crypto'

export interface NormalizedIdInfo {
  digits: string
  prefix: 'V-' | 'J-' | 'E-' | 'G-'
  canonical: string
  variants: string[]
}

/**
 * Normaliza la cédula o RIF venezolano a un formato estándar (ej. V-12345678, J-123456789)
 * y genera todas las variantes posibles (con/sin guion, con/sin letra) para búsquedas flexibles
 * que evitan duplicados si el cliente escribe '12345678', 'V12345678' o 'V-12345678'.
 */
export function normalizeIdNumber(raw?: string | null): NormalizedIdInfo {
  if (!raw) {
    return { digits: '', prefix: 'V-', canonical: '', variants: [] }
  }

  const trimmed = raw.trim().toUpperCase()
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) {
    return { digits: '', prefix: 'V-', canonical: trimmed, variants: [trimmed] }
  }

  let prefix: 'V-' | 'J-' | 'E-' | 'G-' = 'V-'
  if (trimmed.startsWith('J') || trimmed.startsWith('J-')) {
    prefix = 'J-'
  } else if (trimmed.startsWith('E') || trimmed.startsWith('E-')) {
    prefix = 'E-'
  } else if (trimmed.startsWith('G') || trimmed.startsWith('G-')) {
    prefix = 'G-'
  }

  const prefixLetter = prefix.replace('-', '')
  const canonical = `${prefix}${digits}`

  const variants = Array.from(
    new Set([
      canonical,
      `${prefixLetter}${digits}`,
      digits,
      `V-${digits}`,
      `V${digits}`,
      `J-${digits}`,
      `J${digits}`,
      `E-${digits}`,
      `E${digits}`,
      `G-${digits}`,
      `G${digits}`,
    ])
  )

  return { digits, prefix, canonical, variants }
}

/**
 * Normaliza el teléfono eliminando caracteres no numéricos y asegurando código de país 58
 */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return ''
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '58' + digits.slice(1)
  } else if (digits.length === 10 && !digits.startsWith('58')) {
    digits = '58' + digits
  }
  return digits
}

/**
 * Hashing seguro de contraseña de cliente con salt de 16 bytes y scrypt
 */
export function hashCustomerPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

/**
 * Valida una contraseña contra el hash scrypt almacenado
 */
export function verifyCustomerPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.includes(':')) return false
    const [salt, key] = storedHash.split(':')
    const keyBuffer = Buffer.from(key, 'hex')
    const derivedKey = crypto.scryptSync(password, salt, 64)
    return crypto.timingSafeEqual(keyBuffer, derivedKey)
  } catch {
    return false
  }
}

const JWT_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'innovise-customer-auth-secret-key-2026'

/**
 * Genera un token HMAC-SHA256 seguro para la sesión del cliente en el catálogo
 */
export function generateCustomerToken(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 días de vigencia
    })
  ).toString('base64url')

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url')

  return `${header}.${body}.${signature}`
}

/**
 * Verifica y decodifica el token HMAC-SHA256 de la sesión del cliente
 */
export function verifyCustomerToken(token?: string | null): Record<string, any> | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, signature] = parts
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url')

  if (signature !== expectedSignature) return null

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null // Token expirado
    }
    return data
  } catch {
    return null
  }
}

/**
 * Extrae y analiza los datos de autenticación de cliente almacenados en customer.notes
 */
export function parseCustomerAuth(notesRaw?: string | null): {
  hasAccount: boolean
  passwordHash: string | null
  userNotes: string
  metadata: Record<string, any>
  updatedAt: string | null
} {
  if (!notesRaw) {
    return { hasAccount: false, passwordHash: null, userNotes: '', metadata: {}, updatedAt: null }
  }
  try {
    const parsed = JSON.parse(notesRaw)
    if (parsed && typeof parsed === 'object' && parsed.__is_customer_account) {
      return {
        hasAccount: Boolean(parsed.password_hash),
        passwordHash: parsed.password_hash || null,
        userNotes: parsed.user_notes || '',
        metadata: parsed.metadata || {},
        updatedAt: parsed.updated_at || null,
      }
    }
  } catch {
    // Es texto plano normal de notas
  }
  return { hasAccount: false, passwordHash: null, userNotes: notesRaw, metadata: {}, updatedAt: null }
}

/**
 * Serializa de forma segura la estructura de autenticación en customer.notes
 */
export function serializeCustomerNotes(
  passwordHash: string | null,
  userNotes: string = '',
  metadata: Record<string, any> = {}
): string {
  return JSON.stringify({
    __is_customer_account: true,
    password_hash: passwordHash,
    user_notes: userNotes,
    metadata,
    updated_at: new Date().toISOString(),
  })
}

/**
 * Genera una contraseña segura y fácil de dictar o compartir con el cliente
 */
export function generateRandomCustomerPassword(prefix = 'IS'): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${digits}`
}


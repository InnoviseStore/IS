/**
 * Utilidades para enmascaramiento de datos personales (PII) y sanitización de registros/telemetría.
 */

export function maskIdNumber(idNumber: string | null | undefined): string {
  if (!idNumber) return '—'
  const str = String(idNumber).trim()
  if (str.length <= 4) return '****'
  const visibleLast = str.slice(-4)
  const prefix = str.includes('-') ? str.split('-')[0] + '-***' : '***'
  return `${prefix}${visibleLast}`
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const str = String(phone).replace(/\D/g, '')
  if (str.length < 6) return '****'
  const country = str.slice(0, 2)
  const lastThree = str.slice(-3)
  return `+${country} **** ***${lastThree}`
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '—'
  const [user, domain] = email.split('@')
  if (user.length <= 2) {
    return `${user.charAt(0)}***@${domain}`
  }
  return `${user.charAt(0)}***${user.charAt(user.length - 1)}@${domain}`
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'cvv',
  'cvc',
  'card_number',
  'pin',
  'admin_security_pin',
  'idempotency_key',
  'authorization',
  'cookie',
])

/**
 * Recorre recursivamente un objeto o payload para ofuscar campos sensibles antes de ser emitidos a logs.
 */
export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging)
  }

  const sanitized: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('pass') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED_SENSITIVE]'
    } else if (typeof val === 'object') {
      sanitized[key] = sanitizeForLogging(val)
    } else {
      sanitized[key] = val
    }
  }
  return sanitized
}

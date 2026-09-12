/**
 * Formatters for system-wide dates and plan labels
 * Enforces DD-MM-AAAA (and optional HH:MM) format across the platform.
 */

/**
 * Formats a date string, timestamp, or Date object into DD-MM-AAAA
 * Example: 2026-09-12 -> 12-09-2026
 */
export function formatDate(input?: string | number | Date | null): string {
  if (!input) return '—'

  // If already in YYYY-MM-DD format (like standard HTML date inputs)
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-')
    return `${d}-${m}-${y}`
  }

  const date = new Date(input)
  if (isNaN(date.getTime())) {
    if (typeof input === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(input.trim())) {
      return input.trim()
    }
    return String(input)
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}-${month}-${year}`
}

/**
 * Formats a date string, timestamp, or Date object into DD-MM-AAAA HH:MM
 * Used in the admin panel for activity, changes, and logs.
 * Example: 2026-09-12T14:30:00Z -> 12-09-2026 10:30 (in local time)
 */
export function formatDateTime(input?: string | number | Date | null): string {
  if (!input) return '—'

  const date = new Date(input)
  if (isNaN(date.getTime())) {
    return String(input)
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}-${month}-${year} ${hours}:${minutes}`
}

/**
 * Formats a date object or timestamp to HH:MM only
 */
export function formatTime(input?: string | number | Date | null): string {
  if (!input) return '—'
  const date = new Date(input)
  if (isNaN(date.getTime())) return '—'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Returns the human-friendly label for a tenant's plan
 * e.g. 'pro' -> 'Plan Pro', 'basic' -> 'Plan Básico', 'enterprise' -> 'Plan Enterprise'
 */
export function getPlanLabel(plan?: string | null): string {
  if (!plan) return 'Plan Pro'
  const p = plan.trim().toLowerCase()
  if (p === 'basic' || p === 'basico' || p === 'básico') return 'Plan Básico'
  if (p === 'pro' || p === 'profesional') return 'Plan Pro'
  if (p === 'enterprise' || p === 'corporativo' || p === 'empresarial') return 'Plan Enterprise'
  if (p.startsWith('plan ')) {
    return plan
  }
  return `Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
}

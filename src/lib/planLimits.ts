export type PlanType = 'basic' | 'pro' | 'enterprise'

export interface PlanFeatures {
  planId: PlanType
  name: string
  priceUsd: number
  maxProducts: number
  hasAIEdith: boolean
  hasCreditSales: boolean
  hasSplitPayments: boolean
  hasBulkImport: boolean
  hasQuotations: boolean
  maxUsers: number
  hasMultipleBranches: boolean
  hasCustomDomain: boolean
}

export const PLAN_CONFIG: Record<PlanType, PlanFeatures> = {
  basic: {
    planId: 'basic',
    name: 'Plan Básico (Emprendedor)',
    priceUsd: 15,
    maxProducts: 150,
    hasAIEdith: false,
    hasCreditSales: false,
    hasSplitPayments: false,
    hasBulkImport: false,
    hasQuotations: true,
    maxUsers: 1,
    hasMultipleBranches: false,
    hasCustomDomain: false,
  },
  pro: {
    planId: 'pro',
    name: 'Plan Pro (Comercio Activo)',
    priceUsd: 35,
    maxProducts: Infinity,
    hasAIEdith: true,
    hasCreditSales: true,
    hasSplitPayments: true,
    hasBulkImport: true,
    hasQuotations: true,
    maxUsers: 3,
    hasMultipleBranches: false,
    hasCustomDomain: false,
  },
  enterprise: {
    planId: 'enterprise',
    name: 'Plan Enterprise (Cadenas & Franquicias)',
    priceUsd: 79,
    maxProducts: Infinity,
    hasAIEdith: true,
    hasCreditSales: true,
    hasSplitPayments: true,
    hasBulkImport: true,
    hasQuotations: true,
    maxUsers: Infinity,
    hasMultipleBranches: true,
    hasCustomDomain: true,
  },
}

export function getTenantPlan(tenant: unknown): PlanType {
  if (!tenant || typeof tenant !== 'object') return 'pro'
  const t = tenant as { settings?: Record<string, unknown>; plan?: string }
  const settings = t.settings || {}
  const plan = (settings.plan as string) || t.plan || 'pro'
  if (plan === 'basic' || plan === 'pro' || plan === 'enterprise') {
    return plan
  }
  return 'pro'
}

export function getTenantFeatures(tenant: unknown): PlanFeatures {
  const plan = getTenantPlan(tenant)
  return PLAN_CONFIG[plan]
}

export function checkCanAddProduct(tenant: unknown, currentProductCount: number): { allowed: boolean; max: number; message?: string } {
  const features = getTenantFeatures(tenant)
  if (features.maxProducts !== Infinity && currentProductCount >= features.maxProducts) {
    return {
      allowed: false,
      max: features.maxProducts,
      message: `Has alcanzado el límite de ${features.maxProducts} productos de tu ${features.name}. Para agregar más productos, solicita la actualización a Plan Pro al administrador.`,
    }
  }
  return { allowed: true, max: features.maxProducts }
}

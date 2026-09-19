'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tenant, Profile, UserRole } from '@/types/database'

interface TenantContextValue {
  tenant: Tenant | null
  profile: Profile | null
  exchangeRate: number
  bcvFechaValor: string | null
  isSyncingBcv: boolean
  allTenants: Tenant[]
  setExchangeRate: (rate: number) => void
  syncBcvRate: () => Promise<{ rate?: number; fechaValor?: string; error?: string }>
  switchTenant: (newTenant: Tenant) => void
  switchTenantById: (tenantId: string) => void
  refreshTenants: () => Promise<void>
  updateTenantSettings: (params: { 
    phone_whatsapp?: string; 
    currency_rate_bcv?: number; 
    name?: string; 
    plan?: string; 
    about?: Record<string, unknown>; 
    admin_security_pin?: string;
    checkout_mode?: string;
    customer_auth_mode?: string;
    payment_accounts?: any[];
    whatsapp_automation?: any;
  }) => Promise<{ success: boolean; error?: string }>
  isLoading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  profile: null,
  exchangeRate: 91.5,
  bcvFechaValor: null,
  isSyncingBcv: false,
  allTenants: [],
  setExchangeRate: () => {},
  syncBcvRate: async () => ({}),
  switchTenant: () => {},
  switchTenantById: () => {},
  refreshTenants: async () => {},
  updateTenantSettings: async () => ({ success: false }),
  isLoading: true,
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exchangeRate, setExchangeRateState] = useState<number>(91.5)
  const [bcvFechaValor, setBcvFechaValor] = useState<string | null>(null)
  const [isSyncingBcv, setIsSyncingBcv] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const updateTenantSettings = useCallback(async (params: { 
    phone_whatsapp?: string; 
    currency_rate_bcv?: number; 
    name?: string; 
    plan?: string; 
    about?: Record<string, unknown>; 
    admin_security_pin?: string;
    checkout_mode?: string;
    customer_auth_mode?: string;
    payment_accounts?: any[];
    whatsapp_automation?: any;
  }) => {
    if (!tenant) return { success: false, error: 'No hay tienda activa' }
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          ...params,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Error al guardar configuración' }
      }
      if (data.tenant) {
        setTenant(data.tenant)
        if (data.tenant.currency_rate_bcv) {
          setExchangeRateState(Number(data.tenant.currency_rate_bcv))
        }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }, [tenant])

  const setExchangeRate = useCallback(async (rate: number) => {
    setExchangeRateState(rate)
    if (tenant) {
      updateTenantSettings({ currency_rate_bcv: rate })
    }
  }, [tenant, updateTenantSettings])

  const syncBcvRate = useCallback(async () => {
    setIsSyncingBcv(true)
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_bcv' }),
      })

      const data = await res.json()
      if (res.ok && data.rate) {
        setExchangeRateState(data.rate)
        if (data.fechaValor) setBcvFechaValor(data.fechaValor)
        return { rate: data.rate, fechaValor: data.fechaValor }
      } else {
        return { error: data.error || 'Error al sincronizar con BCV' }
      }
    } catch (e) {
      return { error: (e as Error).message }
    } finally {
      setIsSyncingBcv(false)
    }
  }, [])

  const [allTenants, setAllTenants] = useState<Tenant[]>([])

  const refreshTenants = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('tenants').select('*').order('name', { ascending: true })
      if (data && data.length > 0) {
        setAllTenants(data as Tenant[])
      }
    } catch (e) {
      console.warn('Error fetching all tenants:', e)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsLoading(false); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        const effectiveRole = ((user.user_metadata?.role as UserRole) || profileData.role) as UserRole
        setProfile({
          ...profileData,
          role: effectiveRole,
        })

        // Si es superadmin o tiene acceso, cargar todas las tiendas disponibles
        let loadedAllTenants: Tenant[] = []
        try {
          const { data: list } = await supabase.from('tenants').select('*').order('name', { ascending: true })
          if (list && list.length > 0) {
            loadedAllTenants = list as Tenant[]
            setAllTenants(loadedAllTenants)
          }
        } catch (e) {
          console.warn('Error loading tenants list:', e)
        }

        // Determinar tienda activa (usar localStorage si es superadmin y seleccionó previamente)
        let activeTenantId = profileData.tenant_id
        if (profileData.role === 'superadmin' && typeof window !== 'undefined') {
          const savedTenantId = localStorage.getItem('is_active_tenant_id')
          if (savedTenantId && loadedAllTenants.some(t => t.id === savedTenantId)) {
            activeTenantId = savedTenantId
          }
        }

        let tenantData = loadedAllTenants.find(t => t.id === activeTenantId)
        if (!tenantData && activeTenantId) {
          const { data: singleTenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', activeTenantId)
            .single()
          if (singleTenant) tenantData = singleTenant
        }

        if (tenantData) {
          setTenant(tenantData)
          setExchangeRateState(Number(tenantData.currency_rate_bcv) || 91.5)
          const settings = (tenantData.settings || {}) as Record<string, unknown>
          if (settings.bcv_fecha_valor) {
            setBcvFechaValor(settings.bcv_fecha_valor as string)
          } else {
            // Trigger background sync if never synced
            fetch('/api/exchange-rate?sync=true&tenant=' + tenantData.slug)
              .then((r) => r.json())
              .then((d) => {
                if (d.rate) setExchangeRateState(d.rate)
                if (d.fechaValor) setBcvFechaValor(d.fechaValor)
              })
              .catch(() => {})
          }
        }
      }
      setIsLoading(false)
    }
    load()
  }, [])

  const switchTenant = useCallback((newTenant: Tenant) => {
    setTenant(newTenant)
    if (typeof window !== 'undefined') {
      localStorage.setItem('is_active_tenant_id', newTenant.id)
    }
    setExchangeRateState(Number(newTenant.currency_rate_bcv) || 91.5)
    const settings = (newTenant.settings || {}) as Record<string, unknown>
    if (settings.bcv_fecha_valor) {
      setBcvFechaValor(settings.bcv_fecha_valor as string)
    }
  }, [])

  const switchTenantById = useCallback((tenantId: string) => {
    const target = allTenants.find(t => t.id === tenantId)
    if (target) {
      switchTenant(target)
    }
  }, [allTenants, switchTenant])

  const contextValue = useMemo(
    () => ({
      tenant,
      profile,
      exchangeRate,
      bcvFechaValor,
      isSyncingBcv,
      allTenants,
      setExchangeRate,
      syncBcvRate,
      switchTenant,
      switchTenantById,
      refreshTenants,
      updateTenantSettings,
      isLoading,
    }),
    [
      tenant,
      profile,
      exchangeRate,
      bcvFechaValor,
      isSyncingBcv,
      allTenants,
      setExchangeRate,
      syncBcvRate,
      switchTenant,
      switchTenantById,
      refreshTenants,
      updateTenantSettings,
      isLoading,
    ]
  )

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
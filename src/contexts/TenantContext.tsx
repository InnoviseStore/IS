'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tenant, Profile, UserRole, BcvRateHistoryItem } from '@/types/database'

interface TenantContextValue {
  tenant: Tenant | null
  profile: Profile | null
  exchangeRate: number
  currencyType: 'USD' | 'EUR'
  currencySymbol: string
  rateMode: 'official' | 'custom'
  customRate: number | null
  bcvRateEur: number | null
  bcvFechaValor: string | null
  bcvRatesHistory: BcvRateHistoryItem[]
  isSyncingBcv: boolean
  allTenants: Tenant[]
  setExchangeRate: (rate: number) => void
  syncBcvRate: (tenantId?: string) => Promise<{ rate?: number; rateEur?: number; fechaValor?: string; rates_history?: BcvRateHistoryItem[]; error?: string }>
  saveHistoryRate: (entry: { date: string; rate?: number; rate_usd?: number; rate_eur?: number; fecha_valor?: string; label?: string; tenant_id?: string }) => Promise<{ success: boolean; error?: string }>
  deleteHistoryRate: (date: string, tenantId?: string) => Promise<{ success: boolean; error?: string }>
  updateStoreCurrency: (params: { tenantId?: string; currency_type: 'USD' | 'EUR'; rate_mode: 'official' | 'custom'; custom_rate?: number }) => Promise<{ success: boolean; error?: string }>
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
    invoice_pdf_color?: string;
    quotation_pdf_color?: string;
    quotation_defaults?: any;
    currency_type?: 'USD' | 'EUR';
    rate_mode?: 'official' | 'custom';
    custom_rate?: number;
  }) => Promise<{ success: boolean; error?: string }>
  isLoading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  profile: null,
  exchangeRate: 91.5,
  currencyType: 'USD',
  currencySymbol: '$',
  rateMode: 'official',
  customRate: null,
  bcvRateEur: null,
  bcvFechaValor: null,
  bcvRatesHistory: [],
  isSyncingBcv: false,
  allTenants: [],
  setExchangeRate: () => {},
  syncBcvRate: async () => ({}),
  saveHistoryRate: async () => ({ success: false }),
  deleteHistoryRate: async () => ({ success: false }),
  updateStoreCurrency: async () => ({ success: false }),
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
  const [bcvRatesHistory, setBcvRatesHistory] = useState<BcvRateHistoryItem[]>([])
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
    invoice_pdf_color?: string;
    quotation_pdf_color?: string;
    quotation_defaults?: any;
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

  const syncBcvRate = useCallback(async (tenantId?: string) => {
    setIsSyncingBcv(true)
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_bcv', tenant_id: tenantId || tenant?.id }),
      })

      const data = await res.json()
      if (res.ok && data.rate) {
        setExchangeRateState(data.rate)
        if (data.fechaValor) setBcvFechaValor(data.fechaValor)
        if (Array.isArray(data.rates_history)) setBcvRatesHistory(data.rates_history)
        if (tenant) {
          setTenant((prev) => {
            if (!prev) return prev
            const prevSettings = (prev.settings || {}) as Record<string, unknown>
            return {
              ...prev,
              currency_rate_bcv: data.rate,
              settings: {
                ...prevSettings,
                bcv_rate_usd: data.rate_usd,
                bcv_rate_eur: data.rate_eur,
                bcv_fecha_valor: data.fechaValor,
                bcv_rates_history: data.rates_history,
              },
            }
          })
        }
        return { rate: data.rate, rateEur: data.rate_eur, fechaValor: data.fechaValor, rates_history: data.rates_history }
      } else {
        return { error: data.error || 'Error al sincronizar con BCV' }
      }
    } catch (e) {
      return { error: (e as Error).message }
    } finally {
      setIsSyncingBcv(false)
    }
  }, [tenant])

  const saveHistoryRate = useCallback(async (entry: { 
    date: string; 
    rate?: number; 
    rate_usd?: number; 
    rate_eur?: number; 
    fecha_valor?: string; 
    label?: string; 
    tenant_id?: string 
  }) => {
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_history_rate',
          tenant_id: entry.tenant_id || tenant?.id,
          ...entry,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Error al guardar tasa histórica' }
      }

      if (Array.isArray(data.rates_history)) {
        setBcvRatesHistory(data.rates_history)
      }

      // Si la fecha guardada es hoy, actualizar también la tasa activa
      const todayDate = new Date().toISOString().split('T')[0]
      if (entry.date === todayDate && (entry.rate || entry.rate_usd)) {
        setExchangeRateState(entry.rate || entry.rate_usd!)
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }, [tenant])

  const deleteHistoryRate = useCallback(async (date: string, tenantId?: string) => {
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_history_rate',
          date,
          tenant_id: tenantId || tenant?.id,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Error al eliminar tasa' }
      }

      if (Array.isArray(data.rates_history)) {
        setBcvRatesHistory(data.rates_history)
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }, [tenant])

  const updateStoreCurrency = useCallback(async (params: { 
    tenantId?: string; 
    currency_type: 'USD' | 'EUR'; 
    rate_mode: 'official' | 'custom'; 
    custom_rate?: number 
  }) => {
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_store_currency',
          tenant_id: params.tenantId || tenant?.id,
          ...params,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Error al actualizar moneda de la tienda' }
      }

      if (data.effective_rate) {
        setExchangeRateState(data.effective_rate)
      }

      // Actualizar tenant en estado local si aplica
      const targetId = params.tenantId || tenant?.id
      if (tenant && tenant.id === targetId) {
        setTenant((prev) => {
          if (!prev) return prev
          const prevSettings = (prev.settings || {}) as Record<string, unknown>
          return {
            ...prev,
            currency_rate_bcv: data.effective_rate || prev.currency_rate_bcv,
            settings: {
              ...prevSettings,
              currency_type: params.currency_type,
              rate_mode: params.rate_mode,
              custom_rate: params.custom_rate,
            },
          }
        })
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }, [tenant])

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
          if (Array.isArray(settings.bcv_rates_history)) {
            setBcvRatesHistory(settings.bcv_rates_history as BcvRateHistoryItem[])
          }
          if (settings.bcv_fecha_valor) {
            setBcvFechaValor(settings.bcv_fecha_valor as string)
          } else {
            // Trigger background sync if never synced
            fetch('/api/exchange-rate?sync=true&tenant=' + tenantData.slug)
              .then((r) => r.json())
              .then((d) => {
                if (d.rate) setExchangeRateState(d.rate)
                if (d.fechaValor) setBcvFechaValor(d.fechaValor)
                if (Array.isArray(d.rates_history)) setBcvRatesHistory(d.rates_history)
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
    if (Array.isArray(settings.bcv_rates_history)) {
      setBcvRatesHistory(settings.bcv_rates_history as BcvRateHistoryItem[])
    } else {
      setBcvRatesHistory([])
    }
  }, [])

  const switchTenantById = useCallback((tenantId: string) => {
    const target = allTenants.find(t => t.id === tenantId)
    if (target) {
      switchTenant(target)
    }
  }, [allTenants, switchTenant])

  const tenantSettings = (tenant?.settings || {}) as Record<string, unknown>
  const currencyType: 'USD' | 'EUR' = ((tenantSettings.currency_type as string) || 'USD').toUpperCase() === 'EUR' ? 'EUR' : 'USD'
  const currencySymbol = currencyType === 'EUR' ? '€' : '$'
  const rateMode: 'official' | 'custom' = ((tenantSettings.rate_mode as string) || 'official').toLowerCase() === 'custom' ? 'custom' : 'official'
  const customRate = typeof tenantSettings.custom_rate === 'number' ? tenantSettings.custom_rate : null
  const bcvRateEur = typeof tenantSettings.bcv_rate_eur === 'number' ? tenantSettings.bcv_rate_eur : null

  const contextValue = useMemo(
    () => ({
      tenant,
      profile,
      exchangeRate,
      currencyType,
      currencySymbol,
      rateMode,
      customRate,
      bcvRateEur,
      bcvFechaValor,
      bcvRatesHistory,
      isSyncingBcv,
      allTenants,
      setExchangeRate,
      syncBcvRate,
      saveHistoryRate,
      deleteHistoryRate,
      updateStoreCurrency,
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
      currencyType,
      currencySymbol,
      rateMode,
      customRate,
      bcvRateEur,
      bcvFechaValor,
      bcvRatesHistory,
      isSyncingBcv,
      allTenants,
      setExchangeRate,
      syncBcvRate,
      saveHistoryRate,
      deleteHistoryRate,
      updateStoreCurrency,
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
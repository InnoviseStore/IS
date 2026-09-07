'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tenant, Profile } from '@/types/database'

interface TenantContextValue {
  tenant: Tenant | null
  profile: Profile | null
  exchangeRate: number
  bcvFechaValor: string | null
  isSyncingBcv: boolean
  setExchangeRate: (rate: number) => void
  syncBcvRate: () => Promise<{ rate?: number; fechaValor?: string; error?: string }>
  switchTenant: (newTenant: Tenant) => void
  isLoading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  profile: null,
  exchangeRate: 91.5,
  bcvFechaValor: null,
  isSyncingBcv: false,
  setExchangeRate: () => {},
  syncBcvRate: async () => ({}),
  switchTenant: () => {},
  isLoading: true,
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exchangeRate, setExchangeRateState] = useState<number>(91.5)
  const [bcvFechaValor, setBcvFechaValor] = useState<string | null>(null)
  const [isSyncingBcv, setIsSyncingBcv] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const setExchangeRate = useCallback(async (rate: number) => {
    setExchangeRateState(rate)
    const supabase = createClient()
    if (tenant) {
      await supabase
        .from('tenants')
        .update({ currency_rate_bcv: rate })
        .eq('id', tenant.id)
    }
  }, [tenant])

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
        setProfile(profileData)
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single()

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
    setExchangeRateState(Number(newTenant.currency_rate_bcv) || 91.5)
    const settings = (newTenant.settings || {}) as Record<string, unknown>
    if (settings.bcv_fecha_valor) {
      setBcvFechaValor(settings.bcv_fecha_valor as string)
    }
  }, [])

  return (
    <TenantContext.Provider
      value={{
        tenant,
        profile,
        exchangeRate,
        bcvFechaValor,
        isSyncingBcv,
        setExchangeRate,
        syncBcvRate,
        switchTenant,
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
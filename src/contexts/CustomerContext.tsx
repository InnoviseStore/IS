'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CustomerProfile {
  id: string
  full_name: string
  id_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  credit_limit_usd?: number
  current_debt_usd?: number
  metadata?: Record<string, any>
  created_at?: string
}

export interface CustomerOrder {
  id: string
  order_number: string
  status: 'pending' | 'completed' | 'cancelled' | 'credit'
  payment_condition: string
  total_usd: number
  total_ves: number
  exchange_rate_at_sale: number
  due_date?: string | null
  payment_breakdown?: any[]
  created_at: string
  order_items?: any[]
}

interface CustomerContextType {
  customer: CustomerProfile | null
  token: string | null
  orders: CustomerOrder[]
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: {
    full_name: string
    id_number?: string
    phone?: string
    email?: string
    address?: string
    password: string
  }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshCustomer: () => Promise<void>
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

export function CustomerProvider({
  children,
  tenantSlug,
}: {
  children: React.ReactNode
  tenantSlug: string
}) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const storageKey = `is_customer_token_${tenantSlug}`

  const fetchSession = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`/api/storefront/auth?tenant_slug=${tenantSlug}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCustomer(data.customer)
        setOrders(data.orders || [])
      } else {
        // Token inválido o expirado
        localStorage.removeItem(storageKey)
        setCustomer(null)
        setToken(null)
      }
    } catch (e) {
      console.error('[CustomerContext] Error fetching customer session:', e)
    } finally {
      setIsLoading(false)
    }
  }, [tenantSlug, storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedToken = localStorage.getItem(storageKey)
    if (savedToken) {
      setToken(savedToken)
      fetchSession(savedToken)
    } else {
      setIsLoading(false)
    }
  }, [fetchSession, storageKey])

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/storefront/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          tenant_slug: tenantSlug,
          identifier,
          password,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.token) {
        localStorage.setItem(storageKey, data.token)
        setToken(data.token)
        setCustomer(data.customer)
        fetchSession(data.token)
        return { success: true }
      }
      return { success: false, error: data.error || 'Error al iniciar sesión' }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión' }
    }
  }

  const register = async (formData: {
    full_name: string
    id_number?: string
    phone?: string
    email?: string
    address?: string
    password: string
  }) => {
    try {
      const res = await fetch('/api/storefront/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          tenant_slug: tenantSlug,
          ...formData,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.token) {
        localStorage.setItem(storageKey, data.token)
        setToken(data.token)
        setCustomer(data.customer)
        fetchSession(data.token)
        return { success: true }
      }
      return { success: false, error: data.error || 'Error al registrarse' }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión' }
    }
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
    setCustomer(null)
    setToken(null)
    setOrders([])
  }

  const refreshCustomer = async () => {
    if (token) {
      await fetchSession(token)
    }
  }

  return (
    <CustomerContext.Provider
      value={{
        customer,
        token,
        orders,
        isLoading,
        login,
        register,
        logout,
        refreshCustomer,
      }}
    >
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer() {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error('useCustomer debe utilizarse dentro de un CustomerProvider')
  }
  return context
}

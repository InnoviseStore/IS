'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────
export interface CartItem {
  id: string
  product_id: string
  name: string
  sku?: string | null
  unit_price_usd: number
  quantity: number
  image_url?: string | null
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> & { quantity?: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartItem[] }

interface CartState {
  items: CartItem[]
}

const initialState: CartState = {
  items: [],
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.payload }

    case 'ADD_ITEM': {
      const { quantity: qty = 1, ...rest } = action.payload
      const existingIndex = state.items.findIndex(
        (i) => i.id === rest.id || i.product_id === rest.product_id
      )

      if (existingIndex > -1) {
        const updated = [...state.items]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        }
        return { items: updated }
      }

      return { items: [...state.items, { ...rest, quantity: qty }] }
    }

    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (i) => i.id !== action.payload.id && i.product_id !== action.payload.id
        ),
      }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload
      if (quantity <= 0) {
        return {
          items: state.items.filter((i) => i.id !== id && i.product_id !== id),
        }
      }
      return {
        items: state.items.map((i) =>
          i.id === id || i.product_id === id ? { ...i, quantity } : i
        ),
      }
    }

    case 'CLEAR_CART':
      return { items: [] }

    default:
      return state
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
interface CartContextValue {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalUsd: number
  totalVes: number
  itemCount: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({
  tenantSlug,
  exchangeRate = 1,
  children,
}: {
  tenantSlug: string
  exchangeRate: number
  children: React.ReactNode
}) {
  const storageKey = `cart_${tenantSlug}`
  const [state, dispatch] = useReducer(cartReducer, initialState)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // 1. Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch({ type: 'HYDRATE', payload: parsed })
        }
      }
    } catch {
      // ignore
    } finally {
      setIsHydrated(true)
    }
  }, [storageKey])

  // 2. Persist to localStorage whenever items change (after initial hydration)
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.items))
    } catch {
      // storage full or unavailable
    }
  }, [state.items, storageKey, isHydrated])

  // ── Actions ────────────────────────────────────────────────────────────────
  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      dispatch({ type: 'ADD_ITEM', payload: item })
      // Automatically open cart drawer for immediate tactile feedback
      setIsCartOpen(true)
    },
    []
  )

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const openCart = useCallback(() => setIsCartOpen(true), [])
  const closeCart = useCallback(() => setIsCartOpen(false), [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalUsd = state.items.reduce(
    (sum, item) => sum + Number(item.unit_price_usd) * Number(item.quantity),
    0
  )

  const totalVes = totalUsd * exchangeRate

  const itemCount = state.items.reduce((sum, item) => sum + Number(item.quantity), 0)

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalUsd,
        totalVes,
        itemCount,
        isCartOpen,
        setIsCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
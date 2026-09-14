'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: 'light' | 'dark'
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // 1. Leer preferencia guardada
    const saved = localStorage.getItem('is_theme') as ThemeMode | null
    const initialMode = saved && ['light', 'dark', 'system'].includes(saved) ? saved : 'system'
    setModeState(initialMode)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentMode: ThemeMode) => {
      let resolved: 'light' | 'dark'
      if (currentMode === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light'
      } else {
        resolved = currentMode
      }
      setTheme(resolved)
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    applyTheme(initialMode)

    // Escuchar cambios en la preferencia del sistema operativo si está en modo 'system'
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const currentSaved = localStorage.getItem('is_theme') as ThemeMode | null
      if (!currentSaved || currentSaved === 'system') {
        const resolved = e.matches ? 'dark' : 'light'
        setTheme(resolved)
        if (resolved === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleMediaChange)
    return () => mediaQuery.removeEventListener('change', handleMediaChange)
  }, [])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem('is_theme', newMode)

    let resolved: 'light' | 'dark'
    if (newMode === 'system') {
      const darkPrefers = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolved = darkPrefers ? 'dark' : 'light'
    } else {
      resolved = newMode
    }

    setTheme(resolved)
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setMode(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

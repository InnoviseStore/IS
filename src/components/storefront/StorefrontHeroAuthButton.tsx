'use client'

import React from 'react'
import Link from 'next/link'
import { User, Sparkles } from 'lucide-react'
import { useCustomer } from '@/contexts/CustomerContext'

interface Props {
  tenantSlug: string
}

export function StorefrontHeroAuthButton({ tenantSlug }: Props) {
  const { customer } = useCustomer()

  const firstName = customer?.full_name?.split(' ')[0] || customer?.full_name

  return (
    <Link
      href={`/${tenantSlug}/cuenta`}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 transition active:scale-95 cursor-pointer text-center"
      title={customer ? `Sesión iniciada como ${customer.full_name}` : 'Iniciar Sesión / Registrarme'}
    >
      <User className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[200px] xs:max-w-none">
        {customer ? `Hola, ${firstName} • Mi Cuenta` : 'Iniciar Sesión / Mi Cuenta'}
      </span>
    </Link>
  )
}

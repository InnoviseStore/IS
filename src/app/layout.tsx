import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Innovise Store',
    default: 'Innovise Store — Plataforma de Comercios',
  },
  description:
    'Plataforma SaaS multi-tenant para la digitalización de comercios venezolanos. Gestión de inventario, facturación multimoneda USD/VES y tienda virtual con checkout por WhatsApp.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}

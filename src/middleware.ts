import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 1. Protección perimetral para endpoints de administración (/api/admin/*)
  if (pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json(
      { error: 'No autorizado: se requiere autenticación para acceder a los recursos administrativos.' },
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  }

  // 2. Protección perimetral para el copiloto financiero con IA (/api/ai/assistant)
  if (pathname.startsWith('/api/ai/assistant') && !user) {
    return NextResponse.json(
      { error: 'No autorizado: el asistente IA requiere una sesión activa.' },
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  }

  // 3. Redirección de rutas de interfaz gráfica administrativa (/admin)
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Redirección de usuario autenticado fuera del login
  if (pathname === '/login' && user) {
    const adminUrl = request.nextUrl.clone()
    adminUrl.pathname = '/admin'
    return NextResponse.redirect(adminUrl)
  }

  // 5. Inyección de Cabeceras de Ciberseguridad Estrictas (OWASP ASVS & PCI-DSS)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: https://*.supabase.co https://lh3.googleusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.bcv.org.ve https://api.exchangerate-api.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  supabaseResponse.headers.set('Content-Security-Policy', csp)
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self), payment=(self)'
  )
  supabaseResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
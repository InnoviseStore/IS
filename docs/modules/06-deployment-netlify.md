# Módulo 6: Configuración de Despliegue en Netlify

## 1. Visión General
Estructura y directivas para compilar y desplegar la plataforma Next.js 15 en la infraestructura de Netlify Edge con renderizado híbrido (SSR, SSG, ISR y API Routes).

---

## 2. Archivo `netlify.toml`
- **Plugin Oficial:** Utiliza `@netlify/plugin-nextjs` para convertir rutas dinámicas SSR y API routes en Netlify Functions de forma desatendida.
- **Cabeceras de Seguridad:** Aplica directivas de protección:
  - `X-Frame-Options = "DENY"` (previene clickjacking).
  - `X-Content-Type-Options = "nosniff"` (previene ataques MIME).
  - `Referrer-Policy = "strict-origin-when-cross-origin"`.
- **Caché Inmutable:** Configura reglas de caché para assets estáticos empaquetados (`/_next/static/*`).

---

## 3. Configuración de Next.js (`next.config.ts`)
Para soportar la carga optimizada de imágenes externas (logos, fotografías de productos en Supabase Storage o repositorios CDN):
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
}

export default nextConfig
```

---

## 4. Variables de Entorno en Netlify
Configurar en el panel de Netlify (**Site Settings > Environment Variables**):
| Variable | Descripción | Ámbito |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (ej. `https://kbmxxcdetvqamvpdmgxu.supabase.co`) | Build y Runtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anónima pública de Supabase | Build y Runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave privada con permisos elevados (solo servidor) | Runtime |

---

## 5. Verificación de Compilación Pre-Despliegue
Antes de subir cambios a producción, ejecutar localmente:
```powershell
# 1. Chequeo de tipos estáticos
npx tsc --noEmit

# 2. Compilación de producción completa
npm run build
```
Ambos comandos deben completar con código de salida `0`. Todas las rutas estáticas (`/[tenant]`) se pre-renderizan correctamente y las rutas administrativas se optimizan como dinámicas.
---
name: storefront-whatsapp
description: Gestión de vitrinas virtuales públicas Next.js SSR/ISR, persistencia del carrito de compras y formateo de pedidos estructurados para WhatsApp.
---

# Skill: Vitrina Virtual y Checkout por WhatsApp

Esta habilidad rige el comportamiento de la vitrina orientada al cliente final, el estado unificado del carrito de compras y la pasarela de pedidos asistida vía WhatsApp.

## Cuándo usar esta habilidad
- Al modificar o extender el catálogo en [`src/app/[tenant]/page.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/[tenant]/page.tsx) o [`ProductGrid.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/ProductGrid.tsx).
- Al alterar la lógica o interfaz del carrito en [`CartDrawer.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/CartDrawer.tsx) o [`src/contexts/CartContext.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/contexts/CartContext.tsx).
- Al ajustar la plantilla del mensaje generado para WhatsApp en [`src/lib/whatsapp.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/lib/whatsapp.ts).
- Al solucionar problemas de sincronización de ítems agregados o discrepancias en modo claro/oscuro en el storefront.

## Arquitectura del Carrito (Cart Context Global)
> [!IMPORTANT]
> **Nunca instanciar `useReducer` de forma local en componentes individuales.**
> Todo el storefront debe estar envuelto en `<CartProvider>` ([`CartContext.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/contexts/CartContext.tsx)). Los componentes (`ProductGrid`, `CartDrawer`, `StorefrontLayoutClient`) consumen el hook `useCart()` desde dicho contexto. Esto asegura que al hacer clic en "Agregar al carrito", el badge de la barra superior y el cajón lateral se actualicen de manera instantánea y reactiva.

## Directrices de Implementación
1. **Aislamiento de Carrito en LocalStorage:**
   - La persistencia utiliza la clave `cart_${tenantSlug}` para garantizar que si un cliente abre múltiples tiendas del SaaS, cada una conserve su propio carrito de forma aislada.
2. **Estructura del Mensaje de WhatsApp (`whatsapp.ts`):**
   - Encabezado con emoji y nombre de la tienda: `🛒 *Nuevo Pedido - [Nombre]*`.
   - Bloque de cliente: `👤 Cliente: [Nombre]` y `📱 Teléfono: [Teléfono]`.
   - Detalle por producto: `• [qty]x [Nombre] — $[subtotalUsd] USD | Bs. [subtotalVes]`.
   - Totales destacados: `💰 *Total: $[totalUsd] USD | Bs. [totalVes]*`.
   - Tasa BCV aplicada con valor oficial: `📊 Tasa BCV aplicada: Bs. [tasa]/USD`.
   - Bloque opcional para notas especiales del cliente.
3. **Generación de Enlaces wa.me:**
   - Teléfono saneado sin caracteres no numéricos (ej. `584121234567`).
   - Texto del mensaje codificado con `encodeURIComponent`.
4. **Modo Claro y Oscuro de Alto Contraste:**
   - El storefront debe renderizar tipografías oscuras y definidas en modo claro (`text-slate-900`, `text-slate-800`), e hipervínculos contrastados.
   - En modo oscuro, aplicar fondos contrastados con `dark:text-slate-100` y bordes visibles con `dark:border-slate-800`.
   - Incluir el botón de cambio de tema en el encabezado del cliente (`StorefrontLayoutClient.tsx`).
5. **Carrusel Destacado y Filtros Interactivos:**
   - Los productos con stock inmediato se exhiben en el carrusel horizontal interactivo `ProductCarousel.tsx`.
   - El catálogo principal `ProductGrid.tsx` debe soportar filtrado instantáneo por categorías inteligentes, rangos de precio ($) y ordenamiento dinámico.
6. **Página de Producto Dedicada con Zoom Óptico (`/[tenant]/p/[id]`):**
   - Cada artículo dispone de una vista individual con zoom interactivo sobre la imagen oficial, bloque de precios duales USD/VES, selector de cantidad y botón directo de consulta a WhatsApp con los datos del producto precargados.
7. **Privacidad del Catálogo vs Panel Privado:**
   - La vitrina pública (`/[tenant]`) **no debe exponer enlaces directos** al panel administrativo o POS para el público general. El acceso administrativo se realiza de forma privada mediante la URL `/admin` o `/login`. En el panel de control interno, el botón "Ver Tienda" permite a los administradores auditar la vitrina pública.
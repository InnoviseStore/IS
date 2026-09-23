---
name: storefront-whatsapp
description: Gestión de vitrinas virtuales públicas Next.js SSR/ISR, persistencia del carrito de compras, variantes de color interactivas con foto y formateo de pedidos estructurados para WhatsApp para cualquier tipo de tienda.
---

# Skill: Vitrina Virtual y Checkout por WhatsApp

Esta habilidad rige el comportamiento de la vitrina orientada al cliente final, el estado unificado del carrito de compras, las variantes de color interactivas y la pasarela de pedidos asistida vía WhatsApp para cualquier rubro comercial.

## Cuándo usar esta habilidad
- Al modificar o extender el catálogo en [`src/app/[tenant]/page.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/[tenant]/page.tsx) o [`ProductGrid.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/ProductGrid.tsx).
- Al alterar la lógica o interfaz del carrito en [`CartDrawer.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/CartDrawer.tsx) o [`src/contexts/CartContext.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/contexts/CartContext.tsx).
- Al ajustar la vista de detalle de producto y selección de colores en [`ProductDetailClient.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/ProductDetailClient.tsx).
- Al ajustar la plantilla del mensaje generado para WhatsApp en [`src/lib/whatsapp.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/lib/whatsapp.ts).
- Al solucionar problemas de sincronización de pedidos web o notificaciones en tiempo real en [`LiveOrderNotification.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/admin/LiveOrderNotification.tsx).

## Arquitectura del Carrito (Cart Context Global)
> [!IMPORTANT]
> **Nunca instanciar `useReducer` de forma local en componentes individuales.**
> Todo el storefront debe estar envuelto en `<CartProvider>` ([`CartContext.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/contexts/CartContext.tsx)). Los componentes (`ProductGrid`, `CartDrawer`, `StorefrontLayoutClient`) consumen el hook `useCart()` desde dicho contexto. Esto asegura que al hacer clic en "Agregar al carrito", el badge de la barra superior y el cajón lateral se actualicen de manera instantánea y reactiva.

## Directrices de Implementación
1. **Aislamiento de Carrito en LocalStorage:**
   - La persistencia utiliza la clave `cart_${tenantSlug}` para garantizar que si un cliente abre múltiples tiendas del SaaS, cada una conserve su propio carrito de forma aislada.
2. **Variantes de Color con Fotografía Dinámica:**
   - En la vista de producto [`ProductDetailClient.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/ProductDetailClient.tsx), al seleccionar cualquier variante de color, la fotografía principal conmuta inmediatamente a la foto específica asignada a ese color (soportando tanto URLs externas como imágenes subidas).
3. **Estructura del Mensaje de WhatsApp (`whatsapp.ts`):**
   - Encabezado con emoji y nombre de la tienda: `🛒 *Nuevo Pedido - [Nombre]*`.
   - Bloque de cliente: `👤 Cliente: [Nombre]` y `📱 Teléfono: [Teléfono]`.
   - Detalle por producto: `• [qty]x [Nombre] (Color/Talla) — $[subtotalUsd] USD | Bs. [subtotalVes]`.
   - Totales destacados: `💰 *Total: $[totalUsd] USD | Bs. [totalVes]*`.
   - Tasa BCV aplicada con valor oficial: `📊 Tasa BCV aplicada: Bs. [tasa]/USD`.
   - Bloque para notas especiales y dirección de entrega.
4. **Notificaciones en Vivo a Administradores:**
   - Todo pedido recibido a través del checkout web dispara un evento en tiempo real que alerta a los operadores en `/admin` mediante [`LiveOrderNotification.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/admin/LiveOrderNotification.tsx) con sonido y aviso emergente.
5. **Modo Claro y Oscuro de Alto Contraste:**
   - El storefront debe renderizar tipografías oscuras y definidas en modo claro (`text-slate-900`, `text-slate-800`), e hipervínculos contrastados.
   - En modo oscuro, aplicar fondos contrastados con `dark:text-slate-100` y bordes visibles con `dark:border-slate-800`.
6. **Carrusel Destacado y Filtros Interactivos:**
   - Los productos con stock inmediato se exhiben en el carrusel horizontal interactivo `ProductCarousel.tsx`.
   - El catálogo principal `ProductGrid.tsx` soporta filtrado instantáneo por subcategorías específicas, rangos de precio ($) y ordenamiento dinámico.
7. **Página de Producto Dedicada con Zoom Óptico (`/[tenant]/p/[id]`):**
   - Cada artículo dispone de una vista individual con zoom interactivo sobre la imagen oficial, bloque de precios duales USD/VES, selector de cantidad y botón directo de consulta a WhatsApp con los datos del producto precargados.
8. **Adaptabilidad para Cualquier Sector Comercial:**
   - Compatible para tiendas de ropa (selección de tallas y variantes), calzado, cosméticos, tecnología, farmacias y víveres.
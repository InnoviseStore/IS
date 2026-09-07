# Módulo 5: Vitrina Pública (Storefront) y Checkout por WhatsApp

## 1. Visión General
Permite a cada comercio disponer de un catálogo web ultra-rápido, indexable por motores de búsqueda e interactivo en `/[tenant-slug]` (ejemplo: `/innovise`), sin la fricción de comisiones bancarias ni pasarelas complejas, convirtiendo el tráfico directamente en conversaciones de venta asistida vía WhatsApp.

---

## 2. Arquitectura de Renderizado (Next.js SSR / ISR)
- **Ruta Dinámica:** `src/app/[tenant]/page.tsx`
- **Pre-renderizado Estático (SSG/ISR):** Las tiendas se generan estáticamente usando `generateStaticParams` mediante una consulta directa sin cookies a Supabase y se revalidan cada 3600 segundos (`revalidate = 3600`).
- **Conversión Dinámica Dual:** Cada tarjeta de producto muestra el precio base en `$X.XX USD` y el cálculo simultáneo en `Bs. Y.YYY,YY` empleando la tasa oficial del día del tenant.

---

## 3. Arquitectura Centralizada del Carrito (`src/contexts/CartContext.tsx`)

Para evitar inconsistencias de estado entre componentes aislados:
- **`CartProvider` Global:** Envuelve la vitrina pública en `src/app/[tenant]/StorefrontLayoutClient.tsx`.
- **Sincronización Total e Inmediata:**
  - Al pulsar **"Agregar al carrito"** en una tarjeta ([`ProductGrid.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/ProductGrid.tsx)), el badge del navbar actualiza su conteo al milisegundo.
  - La tarjeta muestra controles reactivos de incremento (`+`) y decremento (`-`) de unidades.
  - El cajón lateral deslizable ([`CartDrawer.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/storefront/CartDrawer.tsx)) refleja instantáneamente los subtotales duales y el resumen de ítems.
- **Aislamiento Multi-Tenant en LocalStorage:**
  - Clave de persistencia: `cart_${tenantSlug}`.
  - Esto garantiza que si un usuario navega entre diferentes tiendas del SaaS (ej. `/innovise` y `/otra-tienda`), sus carritos no se mezclen ni se sobrescriban.

---

## 4. Motor de Checkout por WhatsApp (`src/lib/whatsapp.ts`)

Cuando el cliente completa su Nombre, Teléfono y Notas en el `CartDrawer` y presiona **"Enviar Pedido por WhatsApp 🚀"**:
1. El sistema valida los campos requeridos.
2. Invoca `buildWhatsAppCheckoutUrl()` estructurando un mensaje limpio y profesional:
   ```text
   🛒 *Nuevo Pedido - Innovise Store*

   👤 Cliente: Juan Pérez
   📱 Teléfono: +58 412 1234567

   📦 *Detalle del Pedido:*
   • 2x Case Magsafe iPhone 15 — $30.00 USD | Bs. 24,412.08
   • 1x Vidrio Templado 9D — $5.00 USD | Bs. 4,068.68

   💰 *Total: $35.00 USD | Bs. 28,480.76*
   📊 Tasa BCV aplicada: Bs. 813.74/USD

   📝 Notas: Entregar en horario de la tarde.

   _Mensaje generado desde Innovise Store_
   ```
3. Genera el enlace directo en formato `https://wa.me/58412XXXXXXX?text=...` y abre la aplicación en una pestaña nueva.
4. Tras confirmarse el envío, el cajón ofrece vaciar el carrito y muestra un estado de confirmación satisfactoria.

---

## 5. Elementos de Confianza y Diseño
- **Banner Oficial de Cotización (`ExchangeRateBanner.tsx`):** Exhibe la cotización oficial del BCV junto con la **Fecha Valor** oficial y un hipervínculo directo a `https://www.bcv.org.ve/`.
- **Selector de Tema en Cabecera:** Permite al comprador alternar entre Modo Claro (fondo nítido y letras oscuras) y Modo Oscuro (fondo nocturno profundo y texto claro) con contraste óptimo en ambos casos.

---

## 6. Mejoras Visuales, Carrusel y Página de Producto
- **Hero de Marca con Logo:** Presentación oficial del comercio con su imagotipo, badges dinámicos ("Tienda Abierta", "Tasa Oficial BCV") y acceso al portal administrativo.
- **Carrusel de Productos Disponibles (`ProductCarousel.tsx`):** Desplazamiento horizontal fluido de artículos con disponibilidad inmediata para compra rápida.
- **Filtros Avanzados y Ordenamiento (`ProductGrid.tsx`):**
  - Barra de categorías dinámicas en formato pills con detección inteligente.
  - Filtro por rango de precio (menos de $10, $10 a $25, más de $25).
  - Ordenamiento por destacados, menor precio, mayor precio y alfabético.
- **Página de Detalle por Producto (`/[tenant]/p/[id]`):**
  - Vista individual con zoom óptico interactivo al pasar el mouse o dedo sobre la fotografía.
  - Bloque de precios en alto contraste dual USD/VES.
  - Botón primario de adición al carrito con apertura automática del drawer.
  - Botón secundario directo para consultar dudas específicas de ese producto por WhatsApp.
  - Galería de productos relacionados al pie de la página.
- **Separación Estricta entre Catálogo Público y Panel Administrativo Privado:**
  - Se eliminaron los botones y accesos a `/admin` de la cabecera y el pie de página de la vitrina pública para garantizar que ningún cliente o visitante externo tenga enlaces visibles ni acceso accidental al panel administrativo o POS.
  - El personal de la tienda accede de forma segura mediante la URL privada `/login` o `/admin`.
  - En el panel administrativo privado se mantiene el botón **"Ver Tienda"** en la barra superior para que el dueño/cajero pueda auditar la vitrina pública en cualquier momento.
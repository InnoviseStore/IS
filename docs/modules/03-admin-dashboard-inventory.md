# Módulo 3: Panel Administrativo y Catálogo de Inventario Universal

## 1. Visión General y Adaptabilidad Universal
El panel administrativo permite a propietarios, gerentes y cajeros gestionar el catálogo completo de productos, controlar existencias físicas en tiempo real, auditar kardex/movimientos y supervisar métricas financieras clave en USD y Bolívares.

La plataforma está diseñada con una arquitectura **universal y agnóstica al tipo de comercio**, adaptándose a:
- 📱 **Tecnología y Electrónica:** Seriales, especificaciones de voltaje/wattage, modelos y marcas.
- 👗 **Moda, Ropa y Calzado:** Variantes de color, tallas (XS a XXL, números 35-45), telas y géneros.
- 🛒 **Supermercados y Abarrotes:** Códigos de barra EAN-13, fechas de vencimiento, unidades por empaque.
- 💊 **Farmacias y Cuidado Personal:** Códigos de barra comerciales, principios activos y laboratorios.
- 🔧 **Ferreterías y Repuestos Automotrices:** Códigos de parte OEM, medidas métricas/pulgadas y equivalencias.
- 💄 **Cosmética y Perfumería:** Variantes de tono, fragancia y registros cosméticos.

---

## 2. Sistema de Códigos Dual: SKU Interno + Código de Barras (Barcode)

El registro y consulta de productos soporta dos identificadores independientes y complementarios:
1. **SKU Interno (Obligatorio/Automático):** Código de referencia interna asignado por la tienda o generado automáticamente (ej: `TECH-001`, `PANT-AZ-32`, `MED-IBU-400`).
2. **Código de Barras (Opcional):** Código comercial estándar (EAN-13, UPC-A, Code 128, etc.) presente en el empaque del fabricante.
   - No es obligatorio para artículos artesanales, a granel o confeccionados.
   - Cuando se proporciona, el sistema permite la búsqueda instantánea por **cualquiera de los dos códigos** (o por nombre) tanto en el inventario como en el Punto de Venta (POS).
3. **Escáner Rápido por Cámara:**
   - Botón directo de escaneo con cámara en el formulario de creación/edición de productos.
   - Lector por cámara web o móvil que captura el código de barras y lo inserta automáticamente en la casilla correspondiente para agilizar el registro en mostrador o almacén sin necesidad de teclear dígitos manualmente.

---

## 3. Inteligencia Artificial para Catálogo: Investigación Profunda y Categorización Precisa

Integrado directamente en el modal de productos (`src/components/admin/ProductModal.tsx`) y asistido por modelos de lenguaje de última generación:

1. **Generador de Descripción con Investigación Profunda:**
   - Al pulsar *"Investigar y Redactar"*, la IA no se limita a repetir el título; analiza características clave del producto, funciones, ventajas competitivas, compatibilidad y materiales relevantes para el rubro comercial correspondiente.
   - Produce descripciones persuasivas optimizadas para venta en vitrina web y WhatsApp.
2. **Categorización Granular y Específica:**
   - La IA clasifica automáticamente el producto en categorías comerciales precisas según la vertical del negocio (ej. *"Accesorios para Telefonía > Vidrios Templados"*, *"Calzado Masculino > Zapatillas Deportivas"*, *"Cuidado Capilar > Champús Anticaspa"*), evitando categorías genéricas como "Varios" o "General".
3. **Reconocimiento Visual por Foto (Vision AI):**
   - Análisis inteligente de la fotografía o empaque del producto para extraer nombre comercial sugerido, presentación, peso/medidas y código de barras visible.

---

## 4. Gestión Avanzada de Variantes de Color e Imágenes Multi-Fuente

El sistema permite enriquecer cada producto con variantes visuales de color:
- **Asignación de Color:** Nombre del tono (ej. Azul Marino, Rojo Carmín, Negro Mate) y selector de color HEX para renderizado de swatch interactivo.
- **Asociación de Fotografía por Tres Fuentes:**
  1. **Enlace URL Directo:** Inserción de enlace web de la imagen del color específico (CDN externo, catálogo de fábrica o hosting de imágenes).
  2. **Subida de Archivo Local:** Carga directa de fotos desde el dispositivo móvil o PC (PNG, JPG, WEBP).
  3. **Selector de Galería del Producto:** Reutilización de imágenes ya cargadas en la ficha del producto.
- **Interactividad en Vitrina Web (`/[tenant]`):**
  - Cuando el cliente hace clic en un color disponible, la vitrina cambia de inmediato la fotografía principal del producto para mostrar exactamente la variante seleccionada antes de enviar el pedido a WhatsApp.

---

## 5. Sistema de Diseño de Alto Contraste (Modo Claro / Modo Oscuro)

Para garantizar máxima legibilidad en ambientes de mostrador físico o almacén con iluminación variable:
- **Compatibilidad Tailwind CSS v4:** Se configuró en `src/app/globals.css`:
  ```css
  @custom-variant dark (&:where(.dark, .dark *));
  ```
- **Modo Claro (Default):** Tipografías oscuras de alto contraste (`text-slate-900`, `text-slate-800`, `text-slate-700`) sobre fondos translúcidos nítidos (`bg-white/80 dark:bg-slate-900/80`), eliminando grises tenues que dificultaban la lectura en monitores con brillo reducido.
- **Modo Oscuro:** Activación dinámica con clase `.dark` en el elemento raíz `<html>`, aplicando `dark:text-slate-100`, `dark:bg-slate-950` y bordes reforzados `dark:border-slate-800`.
- **Efecto Aurora:** Fondos fluidos con blobs difuminados (`blur-[120px]`) que otorgan modernidad visual sin perjudicar la visibilidad de los datos numéricos.

---

## 6. Componentes Clave del Panel

- **Layout Administrativo (`src/app/admin/layout.tsx`):**
  - **Sidebar Bento-Glass:** Accesos directos a Dashboard (`/admin`), Inventario (`/admin/inventory`), POS (`/admin/pos`), Pedidos Web (`/admin/orders`), Clientes (`/admin/customers`), Gastos (`/admin/expenses`), Cotizaciones (`/admin/quotations`), Cierre de Caja (`/admin/cash-closing`) y Configuración (`/admin/settings`).
  - **Topbar Inteligente:** 
    - Selector interactivo de Modo Claro / Oscuro.
    - Chip de Tasa BCV Oficial con enlace a `bcv.org.ve` y Fecha Valor.
    - Botón de refresco instantáneo con indicador de carga para forzar la sincronización con el Banco Central.
- **Dashboard de Métricas (`src/app/admin/page.tsx`):**
  - Métricas Bento Glass reactivas:
    1. **Ventas Hoy:** Total facturado en el día en USD y su equivalente en Bolívares.
    2. **Utilidad Neta del Mes:** Cálculo en tiempo real ($\text{Ventas} - \text{Gastos Operativos}$).
    3. **Gastos del Mes:** Egresos acumulados de nómina, servicios y alquileres.
    4. **Stock Crítico:** Contador de artículos con menos de 5 unidades en almacén.
    5. **Banner de Cierre de Caja:** Estado en tiempo real (Caja ABIERTA o CERRADA).
- **Catálogo de Inventario (`src/app/admin/inventory/page.tsx`):**
  - Búsqueda simultánea en tiempo real por nombre de producto, SKU o código de barras.
  - Indicadores semafóricos de stock:
    - 🟢 Verde: Stock óptimo ($> 10$ unidades).
    - 🟡 Amarillo: Advertencia ($3 - 10$ unidades).
    - 🔴 Rojo: Stock crítico ($< 3$ unidades).
  - Cálculo instantáneo del margen comercial:
    $$\text{Margen (\%)} = \frac{\text{Precio Base USD} - \text{Costo USD}}{\text{Precio Base USD}} \times 100$$
- **Modal de Creación y Edición (`src/components/admin/ProductModal.tsx`):**
  - Campos completos adaptados para cualquier tienda: Nombre, SKU, Código de Barras (con botón de escáner), Categoría asistida por IA, Descripción con investigación profunda, Variantes de Color con fotos por URL/archivo, Precio Base USD, Costo USD, Stock Inicial y Estado (`is_active`).
  - Panel lateral de previsualización en vivo: calcula el precio en Bolívares al tipo de cambio actual y el porcentaje de margen proyectado antes de registrar en Supabase.
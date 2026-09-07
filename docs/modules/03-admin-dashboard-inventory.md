# Módulo 3: Panel Administrativo y Catálogo de Inventario

## 1. Visión General
El panel administrativo permite a los propietarios y administradores gestionar su catálogo de productos, controlar existencias en tiempo real, auditar kardex/movimientos y supervisar las métricas financieras clave en USD y Bolívares.

---

## 2. Sistema de Diseño de Alto Contraste (Modo Claro / Modo Oscuro)

Para garantizar máxima legibilidad en ambientes de mostrador físico o almacén con iluminación variable:
- **Compatibilidad Tailwind CSS v4:** Se configuró en `src/app/globals.css`:
  ```css
  @custom-variant dark (&:where(.dark, .dark *));
  ```
- **Modo Claro (Default):** Tipografías oscuras de alto contraste (`text-slate-900`, `text-slate-800`, `text-slate-700`) sobre fondos translúcidos nítidos (`bg-white/80 dark:bg-slate-900/80`), eliminando grises tenues que dificultaban la lectura en monitores con brillo reducido.
- **Modo Oscuro:** Activación dinámica con clase `.dark` en el elemento raíz `<html>`, aplicando `dark:text-slate-100`, `dark:bg-slate-950` y bordes reforzados `dark:border-slate-800`.
- **Efecto Aurora:** Fondos fluidos con blobs difuminados (`blur-[120px]`) que otorgan modernidad visual sin perjudicar la visibilidad de los datos numéricos.

---

## 3. Componentes Clave del Panel

- **Layout Administrativo (`src/app/admin/layout.tsx`):**
  - **Sidebar Bento-Glass:** Accesos directos a Dashboard (`/admin`), Inventario (`/admin/inventory`), POS (`/admin/pos`), Clientes (`/admin/customers`) y Configuración (`/admin/settings`).
  - **Topbar Inteligente:** 
    - Selector interactivo de Modo Claro / Oscuro.
    - Chip de Tasa BCV Oficial con enlace a `bcv.org.ve`.
    - Botón de refresco instantáneo con indicador de carga para forzar la sincronización con el Banco Central.
- **Dashboard de Métricas (`src/app/admin/page.tsx`):**
  - Métricas Bento Glass reactivas:
    1. **Ventas Hoy:** Total facturado en el día en USD y su equivalente en Bolívares.
    2. **Utilidad Neta del Mes:** Cálculo en tiempo real ($\text{Ventas} - \text{Gastos Operativos}$).
    3. **Gastos del Mes:** Egresos acumulados de nómina, servicios y alquileres.
    4. **Stock Crítico:** Contador de artículos con menos de 5 unidades en almacén.
    5. **Banner de Cierre de Caja:** Estado en tiempo real (Caja ABIERTA o CERRADA).
- **Módulo de Gastos Operativos (`src/app/admin/expenses/page.tsx`):**
  - Registro de egresos fijos y variables con soporte para gastos recurrentes (nómina, servicios, alquiler).
  - Carga y visualización de comprobantes adjuntos y facturas.
  - Conversión dinámica USD/VES según tasa oficial del día.
- **Presupuestos y Cotizaciones (`src/app/admin/quotations/page.tsx`):**
  - Generación de propuestas formales para clientes con cálculo de vigencia.
  - Envío formateado por WhatsApp y enlace rápido para facturación en POS.
- **Importación Masiva de Inventario (`src/components/admin/ImportProductsModal.tsx`):**
  - Carga masiva de catálogos desde texto CSV o copiado de Excel en un clic.
- **Asistente de IA "Nina" (`src/components/admin/NinaAssistantModal.tsx` & `/api/ai/assistant`):**
  - Copiloto inteligente flotante que responde en lenguaje natural sobre ventas, márgenes netos, reposición de inventario y deudas de clientes con datos en vivo del tenant.
- **Catálogo de Inventario (`src/app/admin/inventory/page.tsx`):**
  - Búsqueda en tiempo real por nombre de producto o SKU.
  - Indicadores semafóricos de stock:
    - 🟢 Verde: Stock óptimo ($> 10$ unidades).
    - 🟡 Amarillo: Advertencia ($3 - 10$ unidades).
    - 🔴 Rojo: Stock crítico ($< 3$ unidades).
  - Cálculo instantáneo del margen comercial:
    $$\text{Margen (\%)} = \frac{\text{Precio Base USD} - \text{Costo USD}}{\text{Precio Base USD}} \times 100$$
- **Modal de Creación y Edición (`src/components/admin/ProductModal.tsx`):**
  - Campos: Nombre, SKU, Descripción, Precio Base USD, Costo USD, Stock Inicial y Estado (`is_active`).
  - **Subida de Imágenes Multi-Modo:** Permite subir archivos locales de imagen (PNG, JPG, WEBP) o vincular URLs directas con previsualización en vivo, optimización y opción para eliminar la fotografía.
  - **Miniaturas Visuales:** La tabla de inventario renderiza la miniatura del producto junto a su nombre para rápida identificación visual en almacén o mostrador.
  - Panel lateral de previsualización en vivo: calcula el precio en Bolívares al tipo de cambio actual y el porcentaje de margen proyectado antes de registrar en Supabase.
# 🏪 Innovise Store — Plataforma SaaS Multi-Tenant Universal para Comercios Venezolanos

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_RLS-3ECF8E?logo=supabase)](https://supabase.com/)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify)](https://www.netlify.com/)

Plataforma SaaS multi-tenant diseñada para digitalizar y gestionar **cualquier tipo de comercio** (físico y virtual) en Venezuela: tiendas de tecnología, ropa/moda, calzado, supermercados y abarrotes, farmacias, ferreterías, cosméticos, repuestos automotrices, librerías y más.

Resuelve de forma nativa las particularidades comerciales y cambiarias venezolanas: manejo de precios base en **USD**, conversión dinámica a **Bolívares (VES)** con tasa oficial BCV y Fecha Valor, **pagos divididos** (Zelle, Pago Móvil, Efectivo USD/VES, Débito), **créditos a 7 días** y abonos con selección de tasa, **cierre de caja diario**, **seguridad administrativa por PIN** y vitrinas públicas con **checkout directo hacia WhatsApp** sin intermediarios.

---

## 🏬 Adaptabilidad Universal por Tipo de Comercio

El sistema provee flexibilidad total sin requerir adaptaciones de código:

| Sector Comercial | Particularidades Soportadas |
|---|---|
| 📱 **Tecnología y Electrónica** | Seriales, marcas, especificaciones técnicas (watts, voltaje), accesorios compatibles. |
| 👗 **Moda, Ropa y Calzado** | Variantes interactivas de color con swatch y fotos dinámicas, tallas (XS–XXL, 35–45), géneros. |
| 🛒 **Supermercados y Alimentos** | Códigos de barra comerciales EAN-13/UPC, empaques, bultos y cajas. |
| 💊 **Farmacias y Cuidado Personal** | Búsqueda por principio activo o código de barra, laboratorios, recetas y lotes. |
| 🔧 **Ferreterías y Repuestos** | Códigos de parte OEM, medidas métricas/pulgadas, repuestos universales y alternativos. |
| 💄 **Cosmética y Perfumería** | Variantes de tono con selector de color HEX, fotos por URL o archivo, fragancias. |

---

## 🏛️ Diagrama de Arquitectura del Sistema

```mermaid
graph TD
    User([Cliente Final]) -->|Visita /[tenant-slug]| Storefront[Next.js Storefront SSR / ISR]
    Storefront -->|Arma carrito & checkout| WhatsApp[WhatsApp wa.me Gateway]
    
    Merchant([Comerciante / Cajero / Admin]) -->|Inicia sesión en /admin| AdminApp[Admin Dashboard, POS & Pedidos]
    
    subgraph "Next.js App (Netlify Edge)"
        Storefront
        AdminApp
        ApiRate["/api/exchange-rate"]
        ApiOrders["/api/admin/orders"]
        ApiAI["/api/ai/* (Edith / Asistente)"]
    end
    
    subgraph "Supabase Backend (PostgreSQL)"
        Auth[Supabase Auth]
        RLS[Row Level Security Engine]
        DB[(PostgreSQL DB)]
        
        RLS -->|Aislamiento estricto por tenant_id| DB
        Auth -->|Genera JWT auth.uid| RLS
    end
    
    AdminApp -->|@supabase/ssr + browser client| RLS
    Storefront -->|@supabase/ssr server client| RLS
    ApiRate -->|Lee / Sincroniza tasa oficial BCV| DB
```

---

## 🚀 Stack Tecnológico

| Capa | Tecnología | Descripción |
|---|---|---|
| **Framework Web** | Next.js 15 (App Router) | Renderizado híbrido (SSR / ISR para vitrinas públicas, Client SPA para panel y POS). |
| **Frontend UI** | React 19 + Tailwind CSS v4 | Diseño Híbrido: Aurora UI + Bento Grid + Glassmorphism con Alto Contraste. |
| **Iconografía** | Lucide React | Iconografía vectorial minimalista y responsiva. |
| **Base de Datos & Auth** | Supabase (PostgreSQL 15+) | Almacenamiento relacional, autenticación y Row Level Security (RLS) criptográficamente aislado. |
| **SSR Supabase** | `@supabase/ssr` | Manejo seguro de cookies de sesión en el servidor y middleware de protección de rutas. |
| **Inteligencia Artificial** | Gemini 2.5 / OpenAI Vision | Copiloto Edith, investigación profunda de productos y categorización granular comercial. |
| **Hosting & CI/CD** | Netlify | Alojamiento serverless en el edge con plugin oficial `@netlify/plugin-nextjs`. |

---

## ✨ Características Principales

- **Multi-Tenancy Criptográficamente Aislado:** Todas las tablas (`products`, `orders`, `customers`, `inventory_logs`, `cash_closings`) contienen `tenant_id` y están protegidas por políticas **RLS (Row Level Security)** en PostgreSQL. Un comercio jamás puede acceder ni visualizar datos de otro.
- **Sistema de Códigos Dual (SKU + Código de Barras):**
  - Admite un SKU interno y un código de barras comercial (EAN-13, UPC, Code 128).
  - Incluye **botón de escáner rápido con cámara** para registrar y buscar productos al instante sin necesidad de digitar.
  - Búsqueda unificada en inventario y Punto de Venta (POS) que evalúa nombre, SKU y código de barras simultáneamente.
- **Variantes de Color con Fotografía Dinámica:**
  - Configuración de colores con selector HEX.
  - Vinculación de fotos por **enlace URL directo**, subida de archivo local o selección de la galería existente.
  - En la vitrina web, al hacer clic en un color, la imagen principal cambia de inmediato.
- **Inteligencia Artificial Integrada:**
  - **Investigación Profunda de Productos:** Genera fichas descriptivas ricas analizando ventajas, materiales y compatibilidad.
  - **Categorización Específica:** Asigna categorías granulares según el nicho de mercado del comercio.
  - **Copiloto Edith:** Asistente conversacional para consultas gerenciales de ventas, stock y finanzas.
- **Seguridad y Control Administrativo con PIN:**
  - La eliminación o anulación de pedidos y facturas requiere obligatoriamente la **Clave de Seguridad de Administrador** (`admin_security_pin`).
- **Módulo de Pedidos Web (`/admin/orders`) Potenciado:**
  - Pestaña **"Todos"** con conteo en tiempo real para auditar órdenes en cualquier estado.
  - **Filtro de Fechas** con selectores personalizados y accesos rápidos (Hoy, 7 días, 30 días, Este Mes, Todo el tiempo).
- **Multimoneda Dual (USD Base + VES Dinámico):** El catálogo y costos se registran en USD. La conversión a Bolívares se calcula en tiempo real según la cotización oficial BCV con soporte de Fecha Valor.
- **Punto de Venta (POS) con Pagos Divididos:** Permite registrar transacciones combinadas en una sola venta (ejemplo: $20.00 en Zelle + el resto en Pago Móvil al cambio oficial, o efectivo con cálculo automático de vuelto).
- **Módulo de Créditos a 7 Días y Abonos:** Cálculo automatizado de fecha de vencimiento (`due_date = NOW() + 7 días`), validación de límites de crédito por cliente y abonos con selección de tasa BCV del día o histórica.
- **Storefront Público con Checkout WhatsApp:** Vitrina rápida e indexable para cada tienda (ej. `/innovise`). El cliente selecciona productos y al presionar "Pedir por WhatsApp" se genera un mensaje formateado con cantidades, precios duales y tasa aplicada.

---

## 📋 Requisitos Previos

- **Node.js 20+** instalado en el equipo.
- Una cuenta en [Supabase](https://supabase.com).
- Una cuenta en [Netlify](https://www.netlify.com).

---

## 🗄️ Configuración de la Base de Datos (Supabase)

1. **Crear Proyecto:** Inicia sesión en Supabase y crea un nuevo proyecto (ej. `innovise-store-db`).
2. **Ejecutar Migración de Tablas:**
   - Ve a la sección **SQL Editor** en el panel de Supabase.
   - Abre el archivo [`supabase/migrations/01_initial_schema.sql`](./supabase/migrations/01_initial_schema.sql), copia todo su contenido y pulsa **Run**.
3. **Ejecutar Políticas de Seguridad (RLS):**
   - En el **SQL Editor**, copia y ejecuta el contenido de [`supabase/migrations/02_row_level_security.sql`](./supabase/migrations/02_row_level_security.sql).
4. **Cargar Datos Iniciales (Seed):**
   - En el **SQL Editor**, ejecuta [`supabase/seed.sql`](./supabase/seed.sql) para inicializar la tienda modelo **Innovise Store** con productos, clientes y orden de muestra.
5. **Habilitar Autenticación por Correo:**
   - Ve a **Authentication** > **Providers** > **Email** y asegúrate de que esté habilitado.
6. **Obtener Credenciales de API:**
   - Ve a **Project Settings** > **API**.
   - Copia la `Project URL` y la `anon public key`.

---

## ⚙️ Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto basándote en `.env.example`:

```env
# URL de tu instancia Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave pública anónima de Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui

# Clave privada de servicio (Opcional, para funciones administrativas seguras)
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

---

## 💻 Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

Una vez iniciado el servidor:
- **Vitrina Pública de Innovise Store:** [http://localhost:3000/innovise](http://localhost:3000/innovise)
- **Panel Administrativo & POS:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Pantalla de Inicio de Sesión:** [http://localhost:3000/login](http://localhost:3000/login)

---

## 🌐 Despliegue en Netlify

El repositorio incluye el archivo [`netlify.toml`](./netlify.toml) preconfigurado con `@netlify/plugin-nextjs`.

1. Sube tu código a un repositorio en **GitHub**, **GitLab** o **Bitbucket**.
2. Entra en [Netlify](https://app.netlify.com) y selecciona **Add new site** > **Import an existing project**.
3. Conecta con tu repositorio.
4. Netlify detectará automáticamente Next.js. Verifica los siguientes parámetros:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
5. En la sección **Environment variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (opcional)
6. Haz clic en **Deploy site**.

---

## 👑 Módulo Principal Super Admin (`/admin/master`)

El sistema incluye una consola de administración global para comercializar la plataforma como SaaS a múltiples clientes manteniendo al mismo tiempo tu tienda propia (`Innovise Store`):

### Funcionalidades del Panel Master:
1. **Creación de Tiendas en 30 Segundos:**
   - Botón *"Nueva Tienda"* en `/admin/master`.
   - Genera el `tenant`, slug único, WhatsApp de ventas y crea la cuenta del dueño en Supabase Auth con confirmación automática.
2. **Control de Accesos y Suspensión:**
   - Activar / Suspender tiendas en 1 clic (ej. cobro de mensualidad o baja de servicio).
   - Reseteo de contraseña de cualquier usuario/cajero de cualquier comercio sin ingresar a la consola de Supabase.
3. **Context Switch / Impersonation:**
   - Botón *"Entrar a Tienda"* que permite al Superadmin auditar el inventario, POS, cotizaciones y caja de cualquier tienda cliente sin tener que cerrar sesión ni pedir contraseñas.
4. **Asignación del Rol Superadmin:**
   - Ejecuta en el SQL Editor de Supabase:
   ```sql
   UPDATE public.profiles SET role = 'superadmin' WHERE email = 'tu_correo_admin@innovise.ve';
   ```
   - Inmediatamente aparecerá el ítem **Panel Master** en el menú lateral del panel administrativo.

---

## 📈 Tasa Oficial BCV y Sincronización en Vivo

### Conexión Directa con el Banco Central de Venezuela
- **Scraper Oficial:** Se conecta vía HTTPS directo a [https://www.bcv.org.ve/](https://www.bcv.org.ve/) extrayendo la cotización del dólar y la **Fecha Valor** oficial de vigencia.
- **Sincronización en 1 Clic:** Desde la barra superior del panel administrativo `/admin`, haz clic en el botón de sincronización junto a la tasa para refrescar al instante.
- **Vía API:** Puedes solicitar `GET /api/exchange-rate?tenant=innovise&sync=true` para forzar la actualización en base de datos.
- **Resiliencia:** Si el portal del BCV presenta interrupciones, conmuta automáticamente a DolarAPI como mirror de contingencia.

---

## 📚 Documentación Modular (`docs/modules/`)

Para una comprensión profunda de cada sub-sistema, consulta los manuales técnicos especializados:

- 📄 [`docs/modules/01-multi-tenant-database.md`](./docs/modules/01-multi-tenant-database.md): Modelo entidad-relación, Row Level Security (RLS) y aislamiento de datos.
- 📄 [`docs/modules/02-multicurrency-bcv.md`](./docs/modules/02-multicurrency-bcv.md): Motor de scraping de `bcv.org.ve`, Fecha Valor, snapshot de ventas y API.
- 📄 [`docs/modules/03-admin-dashboard-inventory.md`](./docs/modules/03-admin-dashboard-inventory.md): Catálogo universal, sistema dual SKU/Barcode, escáner por cámara, variantes de color con fotos por URL/archivo y descripciones por IA.
- 📄 [`docs/modules/04-pos-split-payments.md`](./docs/modules/04-pos-split-payments.md): Facturación rápida POS, pagos divididos, clave PIN de seguridad para eliminación, pedidos web con pestaña Todos y filtros por fecha.
- 📄 [`docs/modules/05-storefront-whatsapp.md`](./docs/modules/05-storefront-whatsapp.md): Vitrina virtual SSR/ISR, CartContext reactivo, cambio interactivo de fotos por variante de color y checkout formateado a WhatsApp.
- 📄 [`docs/modules/06-deployment-netlify.md`](./docs/modules/06-deployment-netlify.md): Despliegue en Netlify, variables de entorno y optimización de imágenes.
- 📄 [`docs/modules/07-expenses-and-net-profit.md`](./docs/modules/07-expenses-and-net-profit.md): Control de gastos operativos, egresos recurrentes y cálculo de utilidad neta real.
- 📄 [`docs/modules/08-quotations-b2b.md`](./docs/modules/08-quotations-b2b.md): Presupuestos y cotizaciones formales para ventas B2B con envío a WhatsApp.
- 📄 [`docs/modules/09-edith-ai-assistant.md`](./docs/modules/09-edith-ai-assistant.md): Copiloto de inteligencia artificial Edith con consultas vivas de stock, ventas y rentabilidad.

---

## 🤖 Habilidades de Agente (Skills en `.agents/skills/`)

- 🧠 `bcv-multicurrency`: Reglas de scraping de `bcv.org.ve`, regex, certificados SSL, snapshots y tasas históricas en abonos.
- 🧠 `manage-tenants-db`: Procedimientos de alta de tenants, columna barcode, clave de seguridad PIN y políticas RLS universales.
- 🧠 `pos-billing-split-payment`: Algoritmos de balance restante, cálculo multi-moneda, IGTF, crédito 7d, seguridad PIN y filtro de pedidos web.
- 🧠 `storefront-whatsapp`: Contexto global del carrito (`CartContext`), persistencia local, cambio de foto por variante de color y enlaces wa.me.
- 🧠 `edith-ai-assistant`: Protocolo de respuesta en lenguaje natural, investigación profunda de productos y categorización granular comercial.
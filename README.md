# 🏪 Innovise Store — Plataforma SaaS Multi-Tenant para Comercios Venezolanos

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_RLS-3ECF8E?logo=supabase)](https://supabase.com/)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify)](https://www.netlify.com/)

Plataforma SaaS multi-tenant orientada a digitalizar comercios físicos y virtuales en Venezuela. Diseñada para resolver las particularidades del mercado venezolano: manejo de precios base en **USD**, conversión dinámica a **Bolívares (VES)** con tasa oficial BCV, **pagos divididos** (Zelle, Pago Móvil, Efectivo), **créditos a 7 días**, y vitrinas públicas con **checkout directo hacia WhatsApp** sin necesidad de pasarelas de pago tradicionales.

---

## 🏛️ Diagrama de Arquitectura del Sistema

```mermaid
graph TD
    User([Cliente Final]) -->|Visita /[tenant-slug]| Storefront[Next.js Storefront SSR / ISR]
    Storefront -->|Arma carrito & checkout| WhatsApp[WhatsApp wa.me Gateway]
    
    Merchant([Comerciante / Cajero]) -->|Inicia sesión en /admin| AdminApp[Admin Dashboard & POS SPA]
    
    subgraph "Next.js App (Netlify Edge)"
        Storefront
        AdminApp
        ApiRate["/api/exchange-rate"]
    end
    
    subgraph "Supabase Backend (PostgreSQL)"
        Auth[Supabase Auth]
        RLS[Row Level Security Engine]
        DB[(PostgreSQL DB)]
        
        RLS -->|Aislamiento por tenant_id| DB
        Auth -->|Genera JWT auth.uid| RLS
    end
    
    AdminApp -->|@supabase/ssr + browser client| RLS
    Storefront -->|@supabase/ssr server client| RLS
    ApiRate -->|Lee / Actualiza tasa BCV| DB
```

---

## 🚀 Stack Tecnológico

| Capa | Tecnología | Descripción |
|---|---|---|
| **Framework Web** | Next.js 15 (App Router) | Renderizado híbrido (SSR / ISR para vitrinas, Client SPA para panel). |
| **Frontend UI** | React 19 + Tailwind CSS v4 | Diseño Híbrido: Aurora UI + Bento Grid + Glassmorphism. |
| **Iconografía** | Lucide React | Iconos vectoriales minimalistas. |
| **Base de Datos & Auth** | Supabase (PostgreSQL 15+) | Almacenamiento relacional, autenticación y Row Level Security (RLS). |
| **SSR Supabase** | `@supabase/ssr` | Manejo seguro de cookies de sesión en el servidor y middleware. |
| **Hosting & CI/CD** | Netlify | Alojamiento serverless con plugin `@netlify/plugin-nextjs`. |

---

## ✨ Características Principales

- **Multi-Tenancy Criptográficamente Aislado:** Todas las tablas (`products`, `orders`, `customers`, `inventory_logs`) contienen `tenant_id` y están protegidas por políticas **RLS (Row Level Security)** en PostgreSQL. Un comerciante jamás puede ver ni modificar datos de otra tienda.
- **Multimoneda Dual (USD Base + VES Dinámico):** El catálogo y costos se registran en USD. La conversión a Bolívares se calcula en tiempo real según la cotización oficial BCV guardada por cada comercio.
- **Punto de Venta (POS) con Pagos Divididos:** Permite registrar transacciones combinadas en una sola venta (ejemplo: $20.00 en Zelle + el resto en Pago Móvil al cambio oficial).
- **Módulo de Créditos a 7 Días:** Cálculo automatizado de fecha de vencimiento (`due_date = NOW() + 7 días`), validación de límites de crédito por cliente y seguimiento de saldos deudores.
- **Storefront Público con Checkout WhatsApp:** Vitrina rápida e indexable para cada tienda (ej. `/innovise`). El cliente selecciona productos y al presionar "Pedir por WhatsApp" se genera un mensaje formateado con cantidades, precios duales y tasa aplicada.

---

## 📋 Requisitos Previos

- **Node.js 20+** instalado en el equipo.
- Una cuenta gratuita o Pro en [Supabase](https://supabase.com).
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

# Clave privada de servicio (Opcional, solo en funciones administrativas seguras)
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

## 🏢 Gestión Multi-Tenant Manual (Alternativa SQL)

Si prefieres dar de alta un comercio manualmente por SQL:

```sql
-- 1. Insertar el nuevo comercio
INSERT INTO tenants (name, slug, phone_whatsapp, currency_rate_bcv, settings)
VALUES (
  'Mi Nueva Tienda',
  'mi-tienda',
  '584121234567',
  91.50,
  '{"instagram_handle": "mitienda.ve", "description": "Comercio en Caracas"}'::jsonb
)
RETURNING id;

-- 2. Crear un usuario en Supabase Auth (Authentication > Users > Add User)
-- Luego vincularlo a la tienda como propietario:
INSERT INTO profiles (id, tenant_id, role, full_name, email)
VALUES (
  '<UUID-DEL-USUARIO-AUTH>',
  '<UUID-DE-LA-TIENDA-OBTENIDO-ARRIBA>',
  'owner',
  'Carlos Propietario',
  'carlos@mitienda.com'
);
```

Inmediatamente el comercio estará activo en:
- Vitrina pública: `https://tudominio.netlify.app/mi-tienda`
- Su panel administrativo filtrará exclusivamente sus productos, clientes y órdenes.

---

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
- 📄 [`docs/modules/03-admin-dashboard-inventory.md`](./docs/modules/03-admin-dashboard-inventory.md): Dashboard Bento, diseño de alto contraste claro/oscuro y catálogo con cálculo de margen.
- 📄 [`docs/modules/04-pos-split-payments.md`](./docs/modules/04-pos-split-payments.md): Facturación rápida POS, IGTF 3% en divisas, Cierre de Caja diario y crédito a 7 días.
- 📄 [`docs/modules/05-storefront-whatsapp.md`](./docs/modules/05-storefront-whatsapp.md): Vitrina virtual SSR/ISR, CartContext reactivo y checkout formateado a WhatsApp.
- 📄 [`docs/modules/06-deployment-netlify.md`](./docs/modules/06-deployment-netlify.md): Despliegue en Netlify, variables de entorno y optimización de imágenes.
- 📄 [`docs/modules/07-expenses-and-net-profit.md`](./docs/modules/07-expenses-and-net-profit.md): Control de gastos operativos, egresos recurrentes y cálculo de utilidad neta real.
- 📄 [`docs/modules/08-quotations-b2b.md`](./docs/modules/08-quotations-b2b.md): Presupuestos y cotizaciones formales para ventas B2B con envío a WhatsApp.
- 📄 [`docs/modules/09-edith-ai-assistant.md`](./docs/modules/09-edith-ai-assistant.md): Copiloto de inteligencia artificial Edith con consultas vivas de stock, ventas y rentabilidad.

---

## 🤖 Habilidades de Agente (Skills en `.agents/skills/`)

- 🧠 `bcv-multicurrency`: Reglas de scraping de `bcv.org.ve`, regex, certificados SSL y snapshots.
- 🧠 `manage-tenants-db`: Procedimientos de alta de tenants, configuración JSONB y políticas RLS.
- 🧠 `pos-billing-split-payment`: Algoritmos de balance restante, cálculo multi-moneda, IGTF y crédito 7d.
- 🧠 `storefront-whatsapp`: Contexto global del carrito (`CartContext`), almacenamiento local y enlaces wa.me.
- 🧠 `edith-ai-assistant`: Protocolo de respuesta en lenguaje natural para consultas gerenciales del comercio.
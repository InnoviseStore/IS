---
name: manage-tenants-db
description: Procedimientos y guías para gestionar tenants, migraciones de base de datos, políticas RLS y usuarios en Supabase para la plataforma Innovise Store.
---

# Skill: Gestión de Base de Datos Multi-Tenant & RLS

Esta habilidad instruye al agente sobre cómo administrar la base de datos PostgreSQL de Supabase en este proyecto SaaS multi-inquilino.

## Cuándo usar esta habilidad
- Al agregar un nuevo comercio/tienda (`tenant`) a la plataforma.
- Al modificar o extender tablas (`tenants`, `profiles`, `products`, `customers`, `orders`, `inventory_logs`).
- Al solucionar problemas de permisos con Row Level Security (RLS).
- Al crear usuarios administradores o cajeros en Supabase Auth.
- Al depurar errores en `generateStaticParams` o renderizado en el servidor.

## Flujo de Trabajo: Alta de un Nuevo Tenant
1. **Insertar el Tenant en SQL:**
   ```sql
   INSERT INTO tenants (name, slug, phone_whatsapp, currency_rate_bcv, settings)
   VALUES (
     'Nombre Comercio',
     'slug-comercio',
     '584121234567',
     813.7361,
     '{
       "instagram_handle": "comercio.ve",
       "bcv_fecha_valor": "Lunes, 07 Septiembre 2026",
       "bcv_source": "https://www.bcv.org.ve/",
       "bcv_last_sync": "2026-09-07T00:00:00Z"
     }'::jsonb
   )
   RETURNING id;
   ```
2. **Crear el Usuario Auth y Perfil:**
   - Crear el usuario en Supabase Auth (ej. `admin@comercio.com`).
   - Insertar la fila en `profiles`:
     ```sql
     INSERT INTO profiles (id, tenant_id, role, full_name, email)
     VALUES ('<auth_user_uuid>', '<tenant_uuid>', 'owner', 'Nombre Persona', 'admin@comercio.com');
     ```

## Panel Master Super Admin (Gestión Global de Comercios)
Para comercializar el sistema como SaaS, existe el **Panel Master** (`/admin/master`):
- **Rol `superadmin`:** Usuario global con permisos de auditoría, creación de tiendas e impersonación.
- **Creación en 30 Segundos:** Vía API `/api/admin/tenants/create` usando `SUPABASE_SERVICE_ROLE_KEY` del servidor:
  - Crea el `tenant` (nombre, slug único, WhatsApp).
  - Crea el usuario dueño en Supabase Auth (`supabase.auth.admin.createUser`) con confirmación automática de email.
  - Asocia el registro en `profiles` con rol `owner`.
- **Control de Acceso y Estado:**
  - Botón de Activar/Suspender comercio (`/api/admin/tenants/toggle-status`).
  - Reseteo directo de contraseñas de dueños/cajeros (`/api/admin/users/reset-password`).
  - **Context Switch (Impersonation):** Botón *"Entrar a Tienda"* que conmuta el contexto activo en memoria sin cerrar la sesión de Superadmin.

## Reglas Críticas de Seguridad y Arquitectura
- **Nunca omitir `tenant_id`:** Cualquier tabla que almacene datos de un comercio debe tener la columna `tenant_id UUID REFERENCES tenants(id) NOT NULL`.
- **Verificar siempre `get_auth_tenant_id()`:** Las políticas RLS deben condicionar las operaciones con `tenant_id = get_auth_tenant_id()` o `get_auth_role() = 'superadmin'`.
- **Permisos Públicos Controlados:** La vitrina pública solo debe poder hacer `SELECT` en `tenants` y en `products WHERE is_active = TRUE`.
- **Evitar `cookies()` en Contextos Fuera de Petición (`generateStaticParams`):**
  Al generar parámetros estáticos durante el build (`src/app/[tenant]/page.tsx`), no se debe invocar `createClient()` de servidor basado en `cookies()` de Next.js, ya que provoca el error `cookies was called outside a request scope`. Se debe utilizar el cliente anónimo directo `createBrowserClient` o la instancia directa de Supabase con URL y ANON KEY.
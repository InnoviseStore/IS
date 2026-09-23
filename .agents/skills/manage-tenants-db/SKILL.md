---
name: manage-tenants-db
description: Procedimientos y guías para gestionar tenants, migraciones de base de datos, políticas RLS, claves de seguridad y usuarios en Supabase para la plataforma Innovise Store.
---

# Skill: Gestión de Base de Datos Multi-Tenant & RLS

Esta habilidad instruye al agente sobre cómo administrar la base de datos PostgreSQL de Supabase en este proyecto SaaS multi-inquilino adaptado para cualquier tipo de negocio.

## Cuándo usar esta habilidad
- Al agregar un nuevo comercio/tienda (`tenant`) a la plataforma.
- Al modificar o extender tablas (`tenants`, `profiles`, `products`, `customers`, `orders`, `inventory_logs`).
- Al solucionar problemas de permisos con Row Level Security (RLS).
- Al crear usuarios administradores o cajeros en Supabase Auth.
- Al gestionar claves de seguridad de tienda (`admin_security_pin`).

## Flujo de Trabajo: Alta de un Nuevo Tenant
1. **Insertar el Tenant en SQL:**
   ```sql
   INSERT INTO tenants (name, slug, phone_whatsapp, currency_rate_bcv, settings)
   VALUES (
     'Nombre Comercio',
     'slug-comercio',
     '584121234567',
     91.50,
     '{
       "instagram_handle": "comercio.ve",
       "admin_security_pin": "1234",
       "bcv_fecha_valor": "Miércoles, 23 Septiembre 2026",
       "bcv_source": "https://www.bcv.org.ve/",
       "bcv_last_sync": "2026-09-23T00:00:00Z"
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

## Esquema Extendido de Productos y Doble Código
- Tabla `products`:
  - `sku TEXT`: Código interno o asignado por el usuario (ej. `CRG-001`, `FRA-002`).
  - `barcode TEXT`: Código de barras estándar del fabricante (EAN-13, UPC, etc.). Es 100% opcional.
  - `description TEXT`: Admite serialización de variantes de color `<!--COLOR_VARIANTS:[...]-->`, atributos de moda `<!--APPAREL_ATTRIBUTES:{...}-->` y fallback `<!--BARCODE:...-->`.

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
- **Clave de Administrador para Operaciones Sensibles:** Las operaciones críticas (eliminación de pedidos, anulación de facturas, cambio de configuración sensible) requieren verificación de `settings.admin_security_pin`.
- **Permisos Públicos Controlados:** La vitrina pública solo debe poder hacer `SELECT` en `tenants` y en `products WHERE is_active = TRUE`.
- **Universalidad de Rubro:** La arquitectura de base de datos está diseñada para acomodar cualquier rubro comercial (tiendas de ropa con tallas, farmacias, bodegones, ferreterías, tecnología, calzado y repuestos).
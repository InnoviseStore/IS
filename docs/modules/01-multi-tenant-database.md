# Módulo 1: Arquitectura Multi-Tenant y Base de Datos (Supabase / PostgreSQL)

## 1. Visión General
Este módulo gestiona la infraestructura de persistencia, aislamiento estricto de datos y modelo relacional para múltiples tiendas dentro de una misma base de datos PostgreSQL en Supabase.

---

## 2. Tablas Principales

| Tabla | Propósito | Llaves Foráneas / Restricciones |
|---|---|---|
| `tenants` | Datos de cada comercio registrado (slug único, teléfono, tasa BCV, settings, `is_active`, `plan`, `custom_domain`). | `id` UUID PK, `slug` UNIQUE. |
| `profiles` | Usuarios administradores y cajeros vinculados a cada tienda. | `id` FK `auth.users`, `tenant_id` FK `tenants`. Rol: `superadmin`, `owner`, `admin`, `cashier`. |
| `products` | Catálogo de productos. Precios base obligatorios en USD. | `tenant_id` FK `tenants`. Soft-delete con `is_active`. |
| `customers` | Directorio de clientes con cédula/RIF, teléfono y línea de crédito. | `tenant_id` FK `tenants`. |
| `orders` | Ventas generadas por el POS o la vitrina virtual. | `tenant_id` FK `tenants`, `customer_id` FK `customers` (opcional). |
| `order_items` | Línea de detalle de productos por orden con snapshot de precios. | `order_id` FK `orders`, `product_id` FK `products`. |
| `inventory_logs` | Auditoría inmutable de entradas, salidas y ventas de inventario. | `tenant_id` FK `tenants`, `product_id` FK `products`. |

---

## 3. Seguridad a Nivel de Fila (Row Level Security - RLS)

El aislamiento multi-inquilino se aplica criptográficamente en el motor de base de datos mediante las funciones auxiliares:

```sql
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;
```

### Reglas de Acceso:
1. **Acceso Público (Storefront):**
   - Lectura abierta de `tenants` filtrando por `slug` donde `is_active = TRUE`.
   - Lectura de `products` donde `is_active = TRUE`.
2. **Acceso Autenticado por Comercio (Panel Admin & POS):**
   - Operaciones `SELECT`, `INSERT`, `UPDATE`, `DELETE` limitadas estrictamente a filas donde `tenant_id = get_auth_tenant_id()`.
3. **Acceso Super Admin (Panel Master `/admin/master`):**
   - Permiso global irrestricto si `get_auth_role() = 'superadmin'`, permitiendo visualizar todos los comercios, suspender/activar tiendas, resetear contraseñas de dueños y realizar context-switch para auditar cualquier catálogo o POS.

---

## 4. Triggers y Funciones del Sistema
- `generate_order_number`: Genera correlativos anuales por tienda (ej. `IS-2026-0001`).
- `set_order_due_date`: Si `payment_condition = 'credit_7d'`, establece automáticamente `due_date = created_at + INTERVAL '7 days'`.
- `decrement_stock`: Procedimiento almacenado que descuenta stock en productos atómicamente evitando condiciones de carrera.
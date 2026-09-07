-- =============================================================================
-- Migration: 02_row_level_security.sql
-- Project:   Innovise Store — Multi-Tenant SaaS (Venezuelan Commerce)
-- Created:   2026-09-06
-- Description: Row Level Security (RLS) policies ensuring strict tenant
--              isolation. Every authenticated user can only read/write data
--              belonging to their own tenant. Public storefront read access
--              is granted for tenants (by slug) and active products.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: get_auth_tenant_id()
-- Returns the tenant_id for the currently authenticated user by looking up
-- their profile. Cached within the transaction via SECURITY DEFINER.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM   profiles
  WHERE  id = auth.uid()
  LIMIT  1;
$$;

COMMENT ON FUNCTION get_auth_tenant_id() IS
  'Returns the tenant_id of the currently authenticated user. Used in RLS policies.';

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: get_auth_role()
-- Returns the role ('owner' | 'admin' | 'cashier') for the current user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   profiles
  WHERE  id = auth.uid()
  LIMIT  1;
$$;

COMMENT ON FUNCTION get_auth_role() IS
  'Returns the role of the currently authenticated user. Used for role-based RLS.';

-- =============================================================================
-- TABLE: tenants — RLS
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Public: anyone can look up a tenant by slug (needed for storefront routing)
CREATE POLICY "tenants_public_select_by_slug"
  ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);   -- Slug filter happens in the query; RLS opens the gate, app code narrows it

-- Authenticated owner/admin: UPDATE own tenant (settings, rate, etc.)
CREATE POLICY "tenants_owner_update"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (
    id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    id = get_auth_tenant_id()
  );

-- =============================================================================
-- TABLE: profiles — RLS
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see profiles in their own tenant
CREATE POLICY "profiles_select_own_tenant"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Users can update only their own profile record
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Owner/admin can insert new profiles (invite flow)
CREATE POLICY "profiles_insert_owner_admin"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- Owner can delete profiles (except their own — enforced in app layer)
CREATE POLICY "profiles_delete_owner"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() = 'owner'
  );

-- =============================================================================
-- TABLE: products — RLS
-- =============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public / anon: read-only access to active products (storefront catalog)
CREATE POLICY "products_public_select_active"
  ON products
  FOR SELECT
  TO anon
  USING (is_active = TRUE);

-- Authenticated: SELECT all products (including inactive) for own tenant
CREATE POLICY "products_authenticated_select_own_tenant"
  ON products
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Authenticated owner/admin: INSERT new products
CREATE POLICY "products_insert_owner_admin"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- Authenticated owner/admin: UPDATE products
CREATE POLICY "products_update_owner_admin"
  ON products
  FOR UPDATE
  TO authenticated
  USING  (tenant_id = get_auth_tenant_id() AND get_auth_role() IN ('owner', 'admin'))
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Authenticated owner/admin: DELETE (soft-delete preferred; hard delete allowed)
CREATE POLICY "products_delete_owner_admin"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- =============================================================================
-- TABLE: inventory_logs — RLS
-- =============================================================================
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated: SELECT own tenant logs
CREATE POLICY "inventory_logs_select_own_tenant"
  ON inventory_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Authenticated: INSERT own tenant logs (any role — cashiers trigger this via sales)
CREATE POLICY "inventory_logs_insert_own_tenant"
  ON inventory_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Inventory logs are append-only — NO UPDATE or DELETE policies
-- (historical accuracy must be preserved; corrections use new adjustment rows)

-- =============================================================================
-- TABLE: customers — RLS
-- =============================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Authenticated: SELECT customers in own tenant
CREATE POLICY "customers_select_own_tenant"
  ON customers
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Authenticated: INSERT customers (all roles)
CREATE POLICY "customers_insert_own_tenant"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Authenticated: UPDATE customers in own tenant
CREATE POLICY "customers_update_own_tenant"
  ON customers
  FOR UPDATE
  TO authenticated
  USING  (tenant_id = get_auth_tenant_id())
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Authenticated owner/admin: DELETE customers
CREATE POLICY "customers_delete_owner_admin"
  ON customers
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- =============================================================================
-- TABLE: orders — RLS
-- =============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Authenticated: SELECT orders in own tenant
CREATE POLICY "orders_select_own_tenant"
  ON orders
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Authenticated: INSERT orders (cashiers create sales)
CREATE POLICY "orders_insert_own_tenant"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Authenticated: UPDATE orders (e.g. status change, marking paid)
CREATE POLICY "orders_update_own_tenant"
  ON orders
  FOR UPDATE
  TO authenticated
  USING  (tenant_id = get_auth_tenant_id())
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Owner/admin: DELETE orders (cancellations — soft preferred via status='cancelled')
CREATE POLICY "orders_delete_owner_admin"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- =============================================================================
-- TABLE: order_items — RLS
-- =============================================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Authenticated: SELECT order items in own tenant
CREATE POLICY "order_items_select_own_tenant"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_auth_tenant_id());

-- Authenticated: INSERT order items
CREATE POLICY "order_items_insert_own_tenant"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Authenticated: UPDATE order items (e.g. quantity correction by owner)
CREATE POLICY "order_items_update_owner_admin"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING  (tenant_id = get_auth_tenant_id() AND get_auth_role() IN ('owner', 'admin'))
  WITH CHECK (tenant_id = get_auth_tenant_id());

-- Owner/admin: DELETE order items
CREATE POLICY "order_items_delete_owner_admin"
  ON order_items
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    AND get_auth_role() IN ('owner', 'admin')
  );

-- =============================================================================
-- GRANT USAGE to authenticated and anon roles
-- Supabase requires explicit grants even when RLS handles the row-level filter.
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT                         ON tenants         TO anon, authenticated;
GRANT INSERT, UPDATE                 ON tenants         TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles        TO authenticated;

GRANT SELECT                         ON products        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON products        TO authenticated;

GRANT SELECT, INSERT                 ON inventory_logs  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON customers       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items     TO authenticated;

-- Grant sequence usage (needed for UUID generation and order_number sequences)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

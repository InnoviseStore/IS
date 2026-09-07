-- ==============================================================================
-- Migration 07: Products Superadmin Access & Multi-Image Gallery
-- ==============================================================================

-- 1. Add 'images' JSONB column to products for multi-photo gallery support
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill existing image_url into images array if images is empty
UPDATE public.products
SET images = json_build_array(image_url)::jsonb
WHERE image_url IS NOT NULL 
  AND (images IS NULL OR images = '[]'::jsonb);

-- 3. Drop existing strict policies on products
DROP POLICY IF EXISTS "products_authenticated_select_own_tenant" ON public.products;
DROP POLICY IF EXISTS "products_insert_owner_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_owner_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner_admin" ON public.products;

-- 4. Recreate products policies with Superadmin full privileges
CREATE POLICY "products_authenticated_select_own_tenant"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY "products_insert_owner_admin"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  );

CREATE POLICY "products_update_owner_admin"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  );

CREATE POLICY "products_delete_owner_admin"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  );

-- 5. Update inventory_logs policies for superadmin
DROP POLICY IF EXISTS "inventory_logs_select_own_tenant" ON public.inventory_logs;
CREATE POLICY "inventory_logs_select_own_tenant"
  ON public.inventory_logs
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "inventory_logs_insert_own_tenant" ON public.inventory_logs;
CREATE POLICY "inventory_logs_insert_own_tenant"
  ON public.inventory_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

-- 6. Update customers policies for superadmin
DROP POLICY IF EXISTS "customers_select_own_tenant" ON public.customers;
CREATE POLICY "customers_select_own_tenant"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "customers_insert_own_tenant" ON public.customers;
CREATE POLICY "customers_insert_own_tenant"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "customers_update_own_tenant" ON public.customers;
CREATE POLICY "customers_update_own_tenant"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  )
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "customers_delete_owner_admin" ON public.customers;
CREATE POLICY "customers_delete_owner_admin"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  );

-- 7. Update orders policies for superadmin
DROP POLICY IF EXISTS "orders_select_own_tenant" ON public.orders;
CREATE POLICY "orders_select_own_tenant"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "orders_insert_own_tenant" ON public.orders;
CREATE POLICY "orders_insert_own_tenant"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "orders_update_own_tenant" ON public.orders;
CREATE POLICY "orders_update_own_tenant"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  )
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "orders_delete_owner_admin" ON public.orders;
CREATE POLICY "orders_delete_owner_admin"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND public.get_auth_role() IN ('owner', 'admin')
    )
  );

-- 8. Update order_items policies for superadmin
DROP POLICY IF EXISTS "order_items_select_own_tenant" ON public.order_items;
CREATE POLICY "order_items_select_own_tenant"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "order_items_insert_own_tenant" ON public.order_items;
CREATE POLICY "order_items_insert_own_tenant"
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
  );

-- ==============================================================================
-- Migration 06: Super Admin & Multi-Tenant Platform Master
-- ==============================================================================

-- 1. Expand profiles role check to include 'superadmin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('superadmin', 'owner', 'admin', 'cashier'));

-- 2. Add is_active, plan, and custom_domain columns to tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'pro',
ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- 3. Update get_auth_role helper to be reliable
CREATE OR REPLACE FUNCTION public.get_auth_role()
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

-- 4. Enable Superadmin to view and manage ALL tenants
DROP POLICY IF EXISTS "tenants_superadmin_full_access" ON public.tenants;
CREATE POLICY "tenants_superadmin_full_access"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR id = public.get_auth_tenant_id()
  )
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR id = public.get_auth_tenant_id()
  );

-- 5. Enable Superadmin to view and manage ALL profiles
DROP POLICY IF EXISTS "profiles_superadmin_all_access" ON public.profiles;
CREATE POLICY "profiles_superadmin_all_access"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
    OR id = auth.uid()
  )
  WITH CHECK (
    public.get_auth_role() = 'superadmin'
    OR tenant_id = public.get_auth_tenant_id()
    OR id = auth.uid()
  );

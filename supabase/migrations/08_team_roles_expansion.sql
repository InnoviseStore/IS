-- ==============================================================================
-- Migration 08: Team Roles Expansion (Cajero, Almacen, Vendedor, Admin)
-- ==============================================================================

-- 1. Expand profiles role check to include Venezuelan retail team roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('superadmin', 'owner', 'admin', 'cashier', 'cajero', 'almacen', 'vendedor'));

-- 2. Update get_auth_role helper to support new roles
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS 
  SELECT role
  FROM   public.profiles
  WHERE  id = auth.uid()
  LIMIT  1;
;

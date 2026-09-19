-- Migración 26: Monitoreo en Vivo y Registro de Inicios de Sesión
-- =============================================================

-- 1. Agregar columna last_active_at a profiles si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS profiles_last_active_at_idx ON public.profiles(last_active_at);

-- 2. Tabla de historial de inicios de sesión (para auditoría y monitoreo)
CREATE TABLE IF NOT EXISTS public.user_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  role TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_login_logs_tenant_idx ON public.user_login_logs(tenant_id, logged_at DESC);

-- 3. Habilitar RLS
ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_login_logs_select" ON public.user_login_logs;
CREATE POLICY "user_login_logs_select" ON public.user_login_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "user_login_logs_insert" ON public.user_login_logs;
CREATE POLICY "user_login_logs_insert" ON public.user_login_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

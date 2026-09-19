-- =============================================================================
-- MIGRACIÓN 27: Fortificación Financiera, Idempotencia y Trazabilidad Inmutable
-- Marco: OWASP ASVS v4.0 / PCI-DSS v4.0 / ISO 27001
-- =============================================================================

-- 1. Tabla de Llaves de Idempotencia (Prevención de Double-Spending y Race Conditions)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key               TEXT        NOT NULL,
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  response_payload  JSONB       NOT NULL,
  status_code       INTEGER     NOT NULL DEFAULT 200,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx 
  ON public.idempotency_keys(created_at DESC);

-- Habilitar RLS en idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_tenant_isolation" ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

-- 2. Tabla Inmutable de Auditoría Financiera (Trazabilidad y Cumplimiento Normativo)
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type            TEXT          NOT NULL, -- 'abono_created', 'credit_order_issued', 'debt_adjusted', 'order_annulled'
  order_id              UUID          REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id           UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  amount_usd            NUMERIC(12,4) NOT NULL DEFAULT 0,
  amount_ves            NUMERIC(16,2) NOT NULL DEFAULT 0,
  exchange_rate_applied NUMERIC(12,4) NOT NULL DEFAULT 1,
  previous_balance_usd  NUMERIC(12,4),
  new_balance_usd       NUMERIC(12,4),
  payment_method        TEXT,
  reference             TEXT,
  idempotency_key       TEXT,
  metadata              JSONB         DEFAULT '{}'::jsonb,
  created_by            UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_audit_logs_tenant_idx 
  ON public.financial_audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS financial_audit_logs_order_idx 
  ON public.financial_audit_logs(order_id);

CREATE INDEX IF NOT EXISTS financial_audit_logs_customer_idx 
  ON public.financial_audit_logs(customer_id);

-- Habilitar RLS en financial_audit_logs
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de solo lectura para el tenant respectivo
DROP POLICY IF EXISTS "financial_audit_logs_select" ON public.financial_audit_logs;
CREATE POLICY "financial_audit_logs_select" ON public.financial_audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

-- Inmutabilidad estricta: NO se permite UPDATE ni DELETE sobre logs financieros
REVOKE UPDATE, DELETE ON public.financial_audit_logs FROM authenticated, anon, public;

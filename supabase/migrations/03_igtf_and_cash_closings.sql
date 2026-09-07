-- ==============================================================================
-- Migration 03: IGTF and Cash Closing System (Sistema FINA Integration)
-- ==============================================================================

-- 1. Ensure `igtf_total` column exists on `orders` table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS igtf_total NUMERIC(12,4) DEFAULT 0;

-- 2. Create `cash_closings` table
CREATE TABLE IF NOT EXISTS public.cash_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'closed',
    summary_by_method JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    igtf_total NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_ves NUMERIC(16,2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    exchange_rate_used NUMERIC(12,4) NOT NULL,
    notes TEXT,
    closed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query by tenant and closing_date
CREATE INDEX IF NOT EXISTS idx_cash_closings_tenant_date 
ON public.cash_closings (tenant_id, closing_date);

-- Trigger to auto-update updated_at
CREATE OR REPLACE TRIGGER update_cash_closings_updated_at
    BEFORE UPDATE ON public.cash_closings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Row Level Security for cash_closings
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash closings of own tenant"
    ON public.cash_closings
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can insert cash closings for own tenant"
    ON public.cash_closings
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can update cash closings for own tenant"
    ON public.cash_closings
    FOR UPDATE
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

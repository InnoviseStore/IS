-- ==============================================================================
-- Migration 04: Expenses & Operative Costs (Sistema FINA Integration)
-- ==============================================================================

-- 1. Table for Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    amount_ves NUMERIC(16,2) NOT NULL DEFAULT 0,
    exchange_rate NUMERIC(12,4) NOT NULL,
    payment_method TEXT NOT NULL,
    supplier_name TEXT,
    receipt_url TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurrence_period TEXT CHECK (recurrence_period IN ('weekly', 'biweekly', 'monthly', 'yearly')),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index by tenant and date
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date 
ON public.expenses (tenant_id, expense_date);

-- Trigger to auto-update updated_at
CREATE OR REPLACE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses of own tenant"
    ON public.expenses
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can insert expenses for own tenant"
    ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can update expenses for own tenant"
    ON public.expenses
    FOR UPDATE
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can delete expenses for own tenant"
    ON public.expenses
    FOR DELETE
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

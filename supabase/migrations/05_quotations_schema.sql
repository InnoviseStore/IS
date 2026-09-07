-- ==============================================================================
-- Migration 05: Quotations & Presupuestos (Sistema FINA Integration)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    quotation_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'approved', 'expired', 'converted')) DEFAULT 'draft',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_ves NUMERIC(16,2) NOT NULL DEFAULT 0,
    exchange_rate NUMERIC(12,4) NOT NULL,
    valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days'),
    converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index by tenant
CREATE INDEX IF NOT EXISTS idx_quotations_tenant 
ON public.quotations (tenant_id, created_at DESC);

-- Sequence or trigger for quotation_number COT-YYYY-NNNN
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year TEXT;
    next_seq INT;
BEGIN
    current_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(COUNT(*), 0) + 1 INTO next_seq
    FROM public.quotations
    WHERE tenant_id = NEW.tenant_id
      AND TO_CHAR(created_at, 'YYYY') = current_year;
      
    NEW.quotation_number := 'COT-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_quotation_number
    BEFORE INSERT ON public.quotations
    FOR EACH ROW
    WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
    EXECUTE FUNCTION public.generate_quotation_number();

CREATE OR REPLACE TRIGGER update_quotations_updated_at
    BEFORE UPDATE ON public.quotations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotations of own tenant"
    ON public.quotations
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can insert quotations for own tenant"
    ON public.quotations
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can update quotations for own tenant"
    ON public.quotations
    FOR UPDATE
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can delete quotations for own tenant"
    ON public.quotations
    FOR DELETE
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

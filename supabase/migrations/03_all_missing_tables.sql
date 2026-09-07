-- ==============================================================================
-- INNOVISE STORE - MIGRACIÓN COMPLETA DE TABLAS Y COLUMNAS FALTANTES
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

DO \$\$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'images'
    ) THEN
        ALTER TABLE public.products ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'igtf_total'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN igtf_total NUMERIC(12,4) DEFAULT 0;
    END IF;
END \$\$;

CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    quotation_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_id_number TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_ves NUMERIC(16,2) NOT NULL DEFAULT 0,
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 36.50,
    valid_until TIMESTAMPTZ,
    status TEXT CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')) DEFAULT 'draft',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_usd NUMERIC(12,4) NOT NULL,
    amount_ves NUMERIC(16,2) NOT NULL,
    exchange_rate NUMERIC(12,4) NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cash_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    closing_number TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT now(),
    initial_cash_usd NUMERIC(12,4) DEFAULT 0,
    initial_cash_ves NUMERIC(16,2) DEFAULT 0,
    total_sales_usd NUMERIC(12,4) DEFAULT 0,
    total_sales_ves NUMERIC(16,2) DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    breakdown_by_method JSONB DEFAULT '{}'::jsonb,
    actual_cash_usd NUMERIC(12,4) DEFAULT 0,
    actual_cash_ves NUMERIC(16,2) DEFAULT 0,
    difference_usd NUMERIC(12,4) DEFAULT 0,
    difference_ves NUMERIC(16,2) DEFAULT 0,
    status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'closed',
    notes TEXT,
    closed_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Full access own tenant quotations'
    ) THEN
        CREATE POLICY " Full access own tenant quotations\ ON public.quotations
 FOR ALL TO authenticated
 USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
 WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
 END IF;

 IF NOT EXISTS (
 SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Full access own tenant expenses'
 ) THEN
 CREATE POLICY \Full access own tenant expenses\ ON public.expenses
 FOR ALL TO authenticated
 USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
 WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
 END IF;

 IF NOT EXISTS (
 SELECT 1 FROM pg_policies WHERE tablename = 'cash_closings' AND policyname = 'Full access own tenant cash_closings'
 ) THEN
 CREATE POLICY \Full access own tenant cash_closings\ ON public.cash_closings
 FOR ALL TO authenticated
 USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
 WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
 END IF;
END \$\$;

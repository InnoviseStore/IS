-- =============================================================================
-- Migration: 01_initial_schema.sql
-- Project:   Innovise Store — Multi-Tenant SaaS (Venezuelan Commerce)
-- Created:   2026-09-06
-- Description: Full schema definition including tables, indexes, and triggers.
--              All monetary values stored in USD as base currency.
--              VES amounts calculated at time of transaction using exchange rate.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: auto-update updated_at timestamp
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: tenants
-- Each row represents one merchant/store (a SaaS tenant).
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT          NOT NULL,
  slug                 TEXT          NOT NULL UNIQUE,           -- URL-safe identifier, e.g. "innovise"
  phone_whatsapp       TEXT,                                    -- WhatsApp contact number
  currency_rate_bcv    NUMERIC(12,4) NOT NULL DEFAULT 36.5,    -- BCV USD->VES exchange rate (updated periodically)
  settings             JSONB         NOT NULL DEFAULT '{}',     -- Flexible per-tenant config (logo_url, theme, etc.)
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  tenants                    IS 'Top-level SaaS tenant record — one per merchant store.';
COMMENT ON COLUMN tenants.currency_rate_bcv  IS 'BCV official USD->VES exchange rate snapshot; updated by tenant admin.';
COMMENT ON COLUMN tenants.settings           IS 'Arbitrary per-tenant config blob: logo_url, accent_color, timezone, etc.';

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);

-- =============================================================================
-- TABLE: profiles
-- Extends auth.users with tenant membership and role assignment.
-- One auth user belongs to exactly one tenant.
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'cashier')),
  full_name    TEXT        NOT NULL,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profiles       IS 'User profiles linked to auth.users; scoped to a tenant with a role.';
COMMENT ON COLUMN profiles.role  IS 'owner: full control | admin: manage products/customers | cashier: POS only';

CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON profiles(tenant_id);

-- =============================================================================
-- TABLE: products
-- Product catalog scoped per tenant.
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku              TEXT,                                       -- Stock-Keeping Unit (optional but recommended)
  name             TEXT          NOT NULL,
  description      TEXT,
  base_price_usd   NUMERIC(12,4) NOT NULL,                   -- Selling price in USD
  cost_usd         NUMERIC(12,4),                             -- Purchase cost in USD (for margin calc)
  stock            INTEGER       NOT NULL DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,       -- FALSE = archived/hidden from storefront
  image_url        TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  products              IS 'Product catalog per tenant; prices always in USD.';
COMMENT ON COLUMN products.stock        IS 'Current on-hand quantity; modified via inventory_logs.';
COMMENT ON COLUMN products.is_active    IS 'Soft-delete / storefront visibility flag.';

CREATE INDEX IF NOT EXISTS products_tenant_id_idx       ON products(tenant_id);
CREATE INDEX IF NOT EXISTS products_tenant_sku_idx      ON products(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_tenant_active_idx   ON products(tenant_id, is_active);

-- Trigger: keep updated_at current on every product update
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: inventory_logs
-- Append-only audit trail for every stock change.
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  change_type     TEXT        NOT NULL CHECK (change_type IN ('sale', 'purchase', 'adjustment', 'return')),
  quantity        INTEGER     NOT NULL,                        -- Positive = stock in, Negative = stock out
  previous_stock  INTEGER     NOT NULL,
  new_stock       INTEGER     NOT NULL,
  reference_id    UUID,                                        -- Optional FK to orders.id or purchase order id
  notes           TEXT,
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  inventory_logs              IS 'Immutable audit log of every inventory movement.';
COMMENT ON COLUMN inventory_logs.quantity     IS 'Net delta: positive = stock added, negative = stock consumed.';
COMMENT ON COLUMN inventory_logs.reference_id IS 'Pointer to the source document (order, PO, adjustment) UUID.';

CREATE INDEX IF NOT EXISTS inventory_logs_tenant_id_idx    ON inventory_logs(tenant_id);
CREATE INDEX IF NOT EXISTS inventory_logs_product_id_idx   ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS inventory_logs_reference_id_idx ON inventory_logs(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_logs_created_at_idx   ON inventory_logs(created_at DESC);

-- =============================================================================
-- TABLE: customers
-- Customer/buyer records scoped per tenant; supports credit accounts.
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name         TEXT          NOT NULL,
  id_number         TEXT,                                      -- Venezuelan cedula or RIF
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  credit_limit_usd  NUMERIC(12,4) NOT NULL DEFAULT 0,         -- Maximum credit extended to customer
  current_debt_usd  NUMERIC(12,4) NOT NULL DEFAULT 0,         -- Running balance owed (USD)
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  customers                  IS 'Customer directory per tenant with credit account tracking.';
COMMENT ON COLUMN customers.credit_limit_usd IS 'Hard cap for outstanding credit; enforced at order creation.';
COMMENT ON COLUMN customers.current_debt_usd IS 'Denormalized running total of unpaid credit; updated on order events.';

CREATE INDEX IF NOT EXISTS customers_tenant_id_idx     ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS customers_tenant_active_idx ON customers(tenant_id, is_active);

-- =============================================================================
-- TABLE: orders
-- Sales orders with multi-method payment support and optional 7-day credit.
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id             UUID          REFERENCES customers(id),
  order_number            TEXT          NOT NULL UNIQUE,       -- Human-readable: IS-2026-0001 (per tenant seq)
  status                  TEXT          NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'cancelled', 'credit')),
  payment_condition       TEXT          NOT NULL DEFAULT 'immediate'
                            CHECK (payment_condition IN ('immediate', 'credit_7d')),
  exchange_rate_at_sale   NUMERIC(12,4) NOT NULL,              -- BCV rate snapshot at time of sale
  subtotal_usd            NUMERIC(12,4),                       -- Pre-discount/pre-tax subtotal
  total_usd               NUMERIC(12,4) NOT NULL,
  total_ves               NUMERIC(16,2) NOT NULL,              -- total_usd * exchange_rate_at_sale
  -- Split payment breakdown array: [{method, amount_usd, amount_ves, reference}]
  -- Supported methods: 'zelle' | 'pago_movil' | 'cash_usd' | 'cash_ves' | 'bank_transfer_ves'
  payment_breakdown       JSONB         NOT NULL DEFAULT '[]',
  due_date                TIMESTAMPTZ,                         -- Populated when payment_condition = 'credit_7d'
  notes                   TEXT,
  created_by              UUID          REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  orders                       IS 'Sales orders; supports immediate and 7-day credit payment conditions.';
COMMENT ON COLUMN orders.order_number          IS 'Tenant-scoped sequential ID in format IS-YYYY-NNNN.';
COMMENT ON COLUMN orders.payment_breakdown     IS 'JSONB array of payment splits. Each element: {method, amount_usd, amount_ves, reference}.';
COMMENT ON COLUMN orders.exchange_rate_at_sale IS 'Frozen BCV rate at transaction time; used to derive total_ves.';
COMMENT ON COLUMN orders.due_date              IS 'For credit_7d orders: created_at + 7 days; NULL for immediate.';

CREATE INDEX IF NOT EXISTS orders_tenant_id_idx     ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx   ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_status_idx        ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS orders_order_number_idx  ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_due_date_idx      ON orders(due_date) WHERE due_date IS NOT NULL;

-- Trigger: keep updated_at current on every order update
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: order_items
-- Line items belonging to an order; denormalizes product name/sku at time of sale.
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID          REFERENCES products(id),      -- Nullable: product may be deleted post-sale
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_name     TEXT          NOT NULL,                     -- Snapshot at time of sale
  product_sku      TEXT,                                       -- Snapshot at time of sale
  unit_price_usd   NUMERIC(12,4) NOT NULL,
  quantity         INTEGER       NOT NULL CHECK (quantity > 0),
  subtotal_usd     NUMERIC(12,4) NOT NULL GENERATED ALWAYS AS (unit_price_usd * quantity) STORED
);

COMMENT ON TABLE  order_items              IS 'Individual line items per order; product fields are snapshots to survive catalog edits.';
COMMENT ON COLUMN order_items.product_name IS 'Name copied from products.name at order creation time.';
COMMENT ON COLUMN order_items.subtotal_usd IS 'Computed column: unit_price_usd * quantity.';

CREATE INDEX IF NOT EXISTS order_items_order_id_idx   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_tenant_id_idx  ON order_items(tenant_id);

-- =============================================================================
-- FUNCTION + TRIGGER: auto-generate order_number per tenant
-- Format: IS-<YYYY>-<NNNN> (zero-padded 4-digit sequential per tenant per year)
-- Example: IS-2026-0001
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS order_number_global_seq START 1;  -- fallback; real seq is per-tenant

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year       TEXT;
  v_seq_name   TEXT;
  v_next       BIGINT;
BEGIN
  v_year     := TO_CHAR(NOW(), 'YYYY');
  -- One sequence per tenant per year, e.g. "order_seq_a1b2c3d4_2026"
  v_seq_name := 'order_seq_' || REPLACE(NEW.tenant_id::TEXT, '-', '_') || '_' || v_year;

  -- Create the tenant-year sequence if it doesn't yet exist
  EXECUTE FORMAT(
    'CREATE SEQUENCE IF NOT EXISTS %I START 1 INCREMENT 1',
    v_seq_name
  );

  EXECUTE FORMAT('SELECT nextval(%L)', v_seq_name) INTO v_next;

  NEW.order_number := 'IS-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- =============================================================================
-- FUNCTION + TRIGGER: auto-set due_date for credit_7d orders
-- =============================================================================
CREATE OR REPLACE FUNCTION set_order_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_condition = 'credit_7d' AND NEW.due_date IS NULL THEN
    NEW.due_date := NEW.created_at + INTERVAL '7 days';
  END IF;
  -- Clear due_date if condition changed back to immediate
  IF NEW.payment_condition = 'immediate' THEN
    NEW.due_date := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_order_due_date
  BEFORE INSERT OR UPDATE OF payment_condition ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_due_date();

-- =============================================================================
-- FUNCTION: decrement_stock (used by POS upon completing sales)
-- =============================================================================
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_quantity)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

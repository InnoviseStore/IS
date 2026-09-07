-- =============================================================================
-- Seed File: seed.sql
-- Project:   Innovise Store — Multi-Tenant SaaS (Venezuelan Commerce)
-- Description: Sample data for development and testing.
--              Tenant: Innovise Store (@innovise.ve — tech/accessories)
--              Includes split payment order demo (Zelle + Pago Movil).
-- =============================================================================

SET session_replication_role = replica;  -- Bypasses RLS and FK checks during seed

-- =============================================================================
-- TENANT: Innovise Store
-- =============================================================================
INSERT INTO tenants (
  id,
  name,
  slug,
  phone_whatsapp,
  currency_rate_bcv,
  settings,
  created_at
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Innovise Store',
  'innovise',
  '584121234567',
  91.50,
  '{
    "logo_url": "/logo.png",
    "instagram_handle": "innovise.ve",
    "description": "Tienda oficial de tecnología y accesorios en Caracas",
    "currency_display": "USD",
    "show_ves_price": true
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRODUCTS: Tech accessories catalog (6 items)
-- Tenant: Innovise Store
-- =============================================================================
INSERT INTO products (
  id, tenant_id, sku, name, description,
  base_price_usd, cost_usd, stock, is_active, image_url, created_at, updated_at
)
VALUES
  -- 1. iPhone silicone case
  (
    'b0000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'CASE-IPH-SIL-001',
    'Funda Silicona iPhone 15 Pro',
    'Funda de silicona premium con acabado suave al tacto, compatible con iPhone 15 Pro. Proteccion contra caidas de hasta 1.5m. Colores: negro, azul marino, beige.',
    8.99, 3.50, 41, TRUE,
    'https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  ),
  -- 2. Samsung tempered glass screen protector
  (
    'b0000001-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'SCRN-SAM-TG-001',
    'Mica Vidrio Templado Samsung S24 Ultra',
    'Protector de pantalla en vidrio templado 9H, borde a borde con recubrimiento antihuellas. Pack de 2 unidades. Compatible con Samsung Galaxy S24 Ultra.',
    5.50, 1.80, 78, TRUE,
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  ),
  -- 3. USB-C braided cable 2m
  (
    'b0000001-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'CABLE-USBC-2M-001',
    'Cable USB-C Trenzado 2 Metros 100W',
    'Cable USB-C a USB-C de nylon trenzado. Soporte para carga rapida de hasta 100W (PD). Velocidad de datos USB 3.2 Gen 2 (10 Gbps). Longitud: 2 metros.',
    6.75, 2.20, 94, TRUE,
    'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  ),
  -- 4. 20W fast charger brick
  (
    'b0000001-0000-0000-0000-000000000004',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'CHRG-20W-PD-001',
    'Cargador Rapido 20W USB-C Power Delivery',
    'Adaptador de corriente compacto con puerto USB-C y soporte para Power Delivery 3.0 hasta 20W. Compatible con iPhone 12 y superior, Samsung, Xiaomi. Voltaje: 100-240V.',
    11.99, 4.50, 60, TRUE,
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  ),
  -- 5. Wireless earbuds TWS
  (
    'b0000001-0000-0000-0000-000000000005',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'TWS-EARBUD-001',
    'Audifonos Inalambricos TWS Bluetooth 5.3',
    'Audifonos tipo in-ear con cancelacion de ruido activa (ANC), latencia de 40ms, autonomia de 6h + 18h con estuche. Resistencia al agua IPX5. Bluetooth 5.3.',
    24.99, 10.00, 28, TRUE,
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  ),
  -- 6. 10000mAh power bank (inactive/out of stock — demo)
  (
    'b0000001-0000-0000-0000-000000000006',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'PWR-BANK-10K-001',
    'Power Bank 10000mAh Carga Rapida 22.5W',
    'Bateria portatil de 10000mAh con salida USB-C (22.5W) y USB-A (18W). Pantalla LED indicadora de carga. Peso: 215g. Color: negro.',
    18.50, 7.80, 0, FALSE,
    'https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=500&auto=format&fit=crop&q=60',
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CUSTOMERS: 3 sample buyers
-- =============================================================================
INSERT INTO customers (
  id, tenant_id, full_name, id_number, phone, email,
  address, credit_limit_usd, current_debt_usd, is_active, notes, created_at
)
VALUES
  -- Customer A: regular buyer, no credit
  (
    'c0000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Maria Fernandez',
    'V-18.542.310',
    '04241234567',
    'maria.fernandez@gmail.com',
    'Av. Francisco de Miranda, Chacao, Caracas 1060',
    0.00, 0.00,
    TRUE,
    'Cliente frecuente. Prefiere pago por Zelle.',
    NOW()
  ),
  -- Customer B: small business with credit line
  (
    'c0000001-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Tecno Express C.A.',
    'J-40.123.456-7',
    '02123456789',
    'compras@tecnoexpress.com.ve',
    'C.C. El Recreo, Local B-14, Sabana Grande, Caracas',
    200.00, 47.48,
    TRUE,
    'Revendedor. Credito a 7 dias aprobado hasta $200. Contacto: Luis Perez.',
    NOW()
  ),
  -- Customer C: walk-in / occasional
  (
    'c0000001-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Carlos Romero',
    'V-22.887.001',
    '04149876543',
    NULL,
    NULL,
    0.00, 0.00,
    TRUE,
    NULL,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ORDER: IS-2026-0001 — Completed sale with split payment (Zelle + Pago Movil)
-- =============================================================================
INSERT INTO orders (
  id,
  tenant_id,
  customer_id,
  order_number,
  status,
  payment_condition,
  exchange_rate_at_sale,
  subtotal_usd,
  total_usd,
  total_ves,
  payment_breakdown,
  due_date,
  notes,
  created_by,
  created_at,
  updated_at
)
VALUES (
  'd0000001-0000-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'c0000001-0000-0000-0000-000000000001',
  'IS-2026-0001',
  'completed',
  'immediate',
  91.50,
  15.74,
  15.74,
  1440.21,
  '[
    {
      "method": "zelle",
      "amount_usd": 10.00,
      "amount_ves": 915.00,
      "reference": "ZLL-20260901-8821",
      "notes": "Transferencia Zelle desde cuenta Bank of America"
    },
    {
      "method": "pago_movil",
      "amount_usd": 5.74,
      "amount_ves": 525.21,
      "reference": "PM-04241234567-20260901",
      "bank": "Banco de Venezuela",
      "phone": "04241234567",
      "notes": "Pago Movil confirmado al 04121234567 BDV"
    }
  ]'::jsonb,
  NULL,
  'Venta mostrador. Cliente satisfecha. Se entrego bolsa con garantia.',
  NULL,
  '2026-09-01 14:35:00-04',
  '2026-09-01 14:35:00-04'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ORDER ITEMS for IS-2026-0001
-- =============================================================================
INSERT INTO order_items (
  id, order_id, product_id, tenant_id,
  product_name, product_sku, unit_price_usd, quantity
)
VALUES
  (
    'e0000001-0000-0000-0000-000000000001',
    'd0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Funda Silicona iPhone 15 Pro',
    'CASE-IPH-SIL-001',
    8.99,
    1
  ),
  (
    'e0000001-0000-0000-0000-000000000002',
    'd0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Cable USB-C Trenzado 2 Metros 100W',
    'CABLE-USBC-2M-001',
    6.75,
    1
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- INVENTORY LOGS: Stock deduction for the completed order above
-- =============================================================================
INSERT INTO inventory_logs (
  id, tenant_id, product_id, change_type,
  quantity, previous_stock, new_stock,
  reference_id, notes, created_by, created_at
)
VALUES
  (
    'f0000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b0000001-0000-0000-0000-000000000001',
    'sale',
    -1,
    42,
    41,
    'd0000001-0000-0000-0000-000000000001',
    'Venta IS-2026-0001 — Funda Silicona iPhone 15 Pro x1',
    NULL,
    '2026-09-01 14:35:00-04'
  ),
  (
    'f0000001-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b0000001-0000-0000-0000-000000000003',
    'sale',
    -1,
    95,
    94,
    'd0000001-0000-0000-0000-000000000001',
    'Venta IS-2026-0001 — Cable USB-C Trenzado 2M x1',
    NULL,
    '2026-09-01 14:35:00-04'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROFILES / SUPERADMIN NOTE:
-- In Supabase Auth, when you register or create the first user, assign them
-- as 'superadmin' so they have Master privileges over all tenant stores:
--
-- UPDATE public.profiles
-- SET role = 'superadmin'
-- WHERE email = 'tu_correo_admin@innovise.ve';
-- =============================================================================

-- Re-enable standard row security
SET session_replication_role = DEFAULT;
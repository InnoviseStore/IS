-- Migración 30: Agregar columna de código de barras a products
-- Permite que los productos tengan un código SKU interno y un código de barras de empaque/fabricante

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Índice para acelerar búsquedas de productos por código de barras
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(tenant_id, barcode);

COMMENT ON COLUMN products.barcode IS 'Código de barras de empaque o fabricante (EAN-13, UPC, Code-128, etc.). Opcional.';

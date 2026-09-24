-- ==============================================================================
-- Migration 31: Add Delivery Tracking to Orders Table
-- Permite registrar el monto del servicio de delivery en USD y VES y la dirección
-- de entrega, asegurando que se refleje en la facturación y comprobantes.
-- ==============================================================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_amount_usd NUMERIC(12,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_amount_ves NUMERIC(16,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

COMMENT ON COLUMN public.orders.delivery_amount_usd IS 'Monto del servicio de delivery en USD cobrado al cliente. No entra como ingreso de venta de la tienda.';
COMMENT ON COLUMN public.orders.delivery_amount_ves IS 'Monto del servicio de delivery en VES a la tasa oficial del día de la venta.';
COMMENT ON COLUMN public.orders.delivery_address IS 'Dirección exacta de entrega o destino del delivery.';

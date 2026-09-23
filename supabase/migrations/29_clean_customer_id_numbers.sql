-- ============================================================
-- Migration 29: Normalizar y limpiar Cédulas / RIF de clientes
-- Elimina puntos, guiones extras, espacios y asegura formato estándar (V-12345678, J-123456789, E-12345678)
-- ============================================================

-- 1. Función para normalizar cédulas/RIF venezolanos
CREATE OR REPLACE FUNCTION public.normalize_customer_id_number(raw_id TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_str TEXT;
  digits TEXT;
  prefix TEXT;
BEGIN
  IF raw_id IS NULL OR TRIM(raw_id) = '' THEN
    RETURN NULL;
  END IF;

  clean_str := UPPER(TRIM(raw_id));
  -- Extraer solo dígitos
  digits := REGEXP_REPLACE(clean_str, '\D', '', 'g');

  IF digits IS NULL OR digits = '' THEN
    RETURN NULL;
  END IF;

  -- Determinar prefijo (V-, J-, E-, G-)
  IF clean_str ~* '^[J]' THEN
    prefix := 'J-';
  ELSIF clean_str ~* '^[E]' THEN
    prefix := 'E-';
  ELSIF clean_str ~* '^[G]' THEN
    prefix := 'G-';
  ELSE
    prefix := 'V-';
  END IF;

  RETURN prefix || digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Actualizar todos los clientes existentes en la base de datos
UPDATE public.customers
SET id_number = public.normalize_customer_id_number(id_number)
WHERE id_number IS NOT NULL AND id_number <> '';

-- 3. Trigger opcional para mantener id_number limpio en cualquier insert/update
CREATE OR REPLACE FUNCTION public.trg_clean_customer_id_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_number IS NOT NULL AND NEW.id_number <> '' THEN
    NEW.id_number := public.normalize_customer_id_number(NEW.id_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_clean_id_number ON public.customers;
CREATE TRIGGER trg_customers_clean_id_number
BEFORE INSERT OR UPDATE OF id_number ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.trg_clean_customer_id_number();

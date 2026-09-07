# Módulo 8: Presupuestos B2B, Cotizaciones y Ventas al Mayor

## 1. Visión General
Inspirado en el flujo de ventas corporativas de FINA. Facilita la elaboración de propuestas comerciales formales con vigencia delimitada, conversión con un clic hacia el Punto de Venta (POS) y envío estructurado por WhatsApp.

---

## 2. Flujo Operativo

1. **Elaboración de Propuesta (`src/app/admin/quotations/page.tsx`):**
   - Selección de cliente corporativo registrado o consumidor final.
   - Definición de días de vigencia (7, 15 o 30 días).
   - Selección rápida de productos desde el catálogo activo con agregación de cantidades.
2. **Generación de Secuencia Única:**
   - Cada cotización recibe un identificador correlativo anual generado por trigger en PostgreSQL: `COT-YYYY-NNNN`.
3. **Compartir por WhatsApp en 1 Clic:**
   - La función genera un mensaje preformateado con desglose de productos, total en USD, equivalente en Bolívares y tasa oficial del día aplicada.
4. **Conversión Rápida al POS:**
   - Botón directo para pasar al punto de venta para facturar de inmediato cuando el cliente aprueba la propuesta.

---

## 3. Esquema de Base de Datos (`quotations`)

```sql
CREATE TABLE public.quotations (
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
    valid_until DATE NOT NULL,
    converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

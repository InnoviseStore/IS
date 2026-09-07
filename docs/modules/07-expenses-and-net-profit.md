# Módulo 7: Gastos Operativos y Utilidad Neta Real

## 1. Visión General
Diseñado bajo los principios del sistema FINA para desmitificar la "ilusión de liquidez" en comercios venezolanos. Permite asentar de forma rigurosa y minimalista todos los egresos que no forman parte del costo de mercancía (nómina, alquileres, servicios, insumos, delivery y mantenimiento).

---

## 2. Fórmulas Financieras Clave

- **Conversión de Egresos según Tasa BCV Oficial:**
  $$\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$$
  $$\text{Monto VES} = \text{Monto USD} \times \text{Tasa BCV del Día}$$

- **Utilidad Neta Real Mensual:**
  $$\text{Utilidad Neta} = \text{Ventas Mensuales Completadas} - \text{Gastos Operativos del Mes}$$

---

## 3. Características del Módulo (`src/app/admin/expenses/page.tsx`)

1. **Gestión Minimalista de Gastos:**
   - Tabla limpia con clasificación por categorías predefinidas: *Nómina y Salarios*, *Alquiler de Local*, *Servicios Públicos*, *Telecomunicaciones*, *Insumos*, *Mantenimiento*, *Delivery*, *Publicidad*, *Impuestos* y *Otros*.
   - Resumen superior con 3 KPIs esenciales: Total Gastos en USD, Total Gastos en VES (a tasa BCV) y Cantidad de Gastos Recurrentes activos.
2. **Gastos Recurrentes Automáticos:**
   - Permite clasificar gastos con periodicidad semanal, quincenal, mensual o anual para facilitar la proyección presupuestaria.
3. **Comprobantes y Facturas Digitales:**
   - Campo para almacenar el enlace o número de referencia de la factura digital o comprobante bancario.
4. **Modal Reactivo (`src/components/admin/ExpenseModal.tsx`):**
   - Selector intuitivo de moneda de origen (USD / VES) con cálculo automático en vivo del monto equivalente.

---

## 4. Esquema de Base de Datos (`expenses`)

```sql
CREATE TABLE public.expenses (
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
```

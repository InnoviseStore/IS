# Módulo 4: Punto de Venta (POS) y Pagos Divididos (Split Payments)

## 1. Visión General
Diseñado para la velocidad y precisión requerida en mostradores y cajas físicas en Venezuela. Permite registrar ventas de alta concurrencia en USD con liquidación simultánea en múltiples métodos de pago (combinando divisas y bolívares) o financiamiento a crédito a 7 días.

---

## 2. Métodos de Pago Habilitados

| Método | Moneda de Ingreso | Fórmula de Conversión a USD | Referencia Requerida |
|---|---|---|---|
| **Zelle** | USD | $\text{Monto USD} = \text{Monto Ingresado}$ | Sí (código de confirmación) |
| **Pago Móvil** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Opcional (últimos 4 o 6 dígitos) |
| **Efectivo USD** | USD | $\text{Monto USD} = \text{Monto Ingresado}$ | No |
| **Efectivo VES** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | No |
| **Transferencia Bancaria** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Sí (número de recibo) |
| **Punto de Venta / Débito** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Sí (número de lote/voucher) |

---

## 3. Lógica de Pago Dividido (`src/components/admin/SplitPaymentModal.tsx`)

- **Cálculo Reactivo de Balance Restante:**
  El sistema totaliza en tiempo real todos los métodos agregados en el ticket:
  $$\text{Total Pagado USD} = \sum_{i=1}^n \text{Monto USD}_i$$
  $$\text{Restante USD} = \text{Total Orden USD} - \text{Total Pagado USD}$$
- **Candado de Seguridad:** El botón **"Confirmar y Facturar"** permanece deshabilitado hasta que $\text{Restante USD} = 0.00$ (tolerancia de precisión menor a \$0.01 por redondeo cambiario).
- **Estructura Inmutable `orders.payment_breakdown` (JSONB):**
  Cada transacción almacena el desglose auditable:
  ```json
  [
    {
      "method": "zelle",
      "amount_usd": 25.00,
      "amount_ves": 20343.40,
      "reference": "ZLL-982143"
    },
    {
      "method": "pago_movil",
      "amount_usd": 15.00,
      "amount_ves": 12206.04,
      "reference": "PM-4412"
    }
  ]
  ```

---

## 4. Gestión de Crédito a 7 Días

- **Condición de Venta:** Solo se activa al seleccionar un **Cliente Registrado** en la base de datos.
- **Validación de Límite Financiero:**
  $$\text{Crédito Disponible} = \text{Límite de Crédito USD} - \text{Deuda Actual USD}$$
  Si $\text{Total Orden USD} > \text{Crédito Disponible}$, el sistema bloquea la emisión e indica el exceso de línea al cajero.
- **Secuencia Transaccional al Confirmar:**
  1. Inserción de la orden en `orders` con `payment_condition = 'credit_7d'` y `status = 'pending'`.
  2. Trigger PostgreSQL asigna automáticamente `due_date = created_at + INTERVAL '7 days'`.
  3. Descuento atómico de existencias en `products.stock` y registro en `inventory_logs` tipo `sale`.
  4. Incremento del saldo deudor en `customers.current_debt_usd`.

---

## 5. Impuesto a las Grandes Transacciones Financieras (IGTF 3%)
- **Activación por Tenant:** Se configura en `tenants.settings -> is_igtf_agent = true`.
- **Aplicación Automática:** Todo pago efectuado en divisas (`zelle` o `cash_usd`) genera el 3% de IGTF sobre el monto del instrumento.
- **Transparencia en el Cobro:**
  - Desglose visual individual por cada método en divisas en el modal de cobro.
  - Almacenamiento en `orders.igtf_total` y en cada fila de `orders.payment_breakdown` (`igtf_amount`).
  - Integración en total general USD y bolívares.

---

## 6. Módulo de Cierre de Caja (`src/app/admin/cash-closing/page.tsx`)
Inspirado en la capacidad de cuadre en 30 segundos del sistema FINA:
- **Resumen Automático:** Agrupa transacciones completadas del día por método de pago (`count`, `total_usd`, `total_ves`).
- **Separación de IGTF:** Muestra el IGTF recaudado de forma aislada para facilitar la declaración tributaria.
- **Registro Inmutable:** Guarda el cierre en la tabla `cash_closings` con estado `closed`, timestamp, notas y usuario responsable (`closed_by`).
- **Widget en Dashboard:** El panel principal muestra un aviso en tiempo real de si la caja del día permanece **ABIERTA** o si ya fue **CERRADA**.

---

## 5. Diseño para Mostrador de Alto Tráfico
- Interfaz en dos columnas optimizada para pantallas táctiles o teclados de caja.
- Tecla rápida de limpieza de ticket.
- Contraste visual elevado para lectura veloz del monto total en Bolívares y Dólares.
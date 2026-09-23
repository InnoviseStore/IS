# Módulo 4: Punto de Venta (POS), Pagos Divididos, Seguridad y Pedidos Web

## 1. Visión General
Diseñado para la velocidad, control antifraude y precisión requerida en mostradores y cajas físicas de cualquier comercio en Venezuela (tecnología, ropa, calzado, supermercados, farmacias, ferreterías, cosméticos, repuestos, etc.).

Permite registrar ventas de alta concurrencia en USD con liquidación simultánea en múltiples métodos de pago (combinando divisas y bolívares), financiamiento a crédito a 7 días, auditoría de devoluciones/abonos y control estricto de eliminaciones mediante **Clave de Seguridad de Administrador**.

---

## 2. Métodos de Pago Habilitados

| Método | Moneda de Ingreso | Fórmula de Conversión a USD | Referencia Requerida |
|---|---|---|---|
| **Zelle** | USD | $\text{Monto USD} = \text{Monto Ingresado}$ | Sí (código de confirmación) |
| **Pago Móvil** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Opcional (últimos 4 o 6 dígitos) |
| **Efectivo USD** | USD | $\text{Monto USD} = \text{Monto Ingresado}$ | No (admite cálculo de cambio/vuelto) |
| **Efectivo VES** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | No (admite cálculo de cambio/vuelto) |
| **Transferencia Bancaria** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Sí (número de recibo) |
| **Punto de Venta / Débito** | VES | $\text{Monto USD} = \frac{\text{Monto VES}}{\text{Tasa BCV del Día}}$ | Sí (número de lote/voucher) |

---

## 3. Lógica de Pago Dividido (`src/components/admin/SplitPaymentModal.tsx`)

- **Cálculo Reactivo de Balance Restante:**
  El sistema totaliza en tiempo real todos los métodos agregados en el ticket:
  $$\text{Total Pagado USD} = \sum_{i=1}^n \text{Monto USD}_i$$
  $$\text{Restante USD} = \text{Total Orden USD} - \text{Total Pagado USD}$$
- **Candado de Seguridad:** El botón **"Confirmar y Facturar"** permanece deshabilitado hasta que $\text{Restante USD} = 0.00$ (tolerancia de precisión menor a \$0.01 por redondeo cambiario).
- **Cálculo de Efectivo Recibido y Cambio:**
  - En cobros en efectivo (USD o VES), el cajero ingresa el billete recibido (ej: \$50 para una cuenta de \$38) y el sistema calcula de inmediato el vuelto correspondiente en divisas y bolívares.
- **Estructura Inmutable `orders.payment_breakdown` (JSONB):**
  Cada transacción almacena el desglose auditable con tasa histórica congelada:
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

## 4. Búsqueda Rápida Dual en Mostrador: SKU + Código de Barras

Para atender filas rápidas en mostrador y puntos de cobro:
- **Compatibilidad con Lectores de Códigos de Barra:** Los cajeros pueden escanear con pistolas lectoras USB/Bluetooth el código EAN-13 o UPC del producto.
- **Búsqueda Unificada:** La barra de búsqueda del POS evalúa simultáneamente el nombre, el SKU interno y el código de barras registrado.
- **Adición Instantánea:** Si el lector emite el código exacto, el producto se agrega directamente al carrito con sonido/confirmación visual.

---

## 5. Seguridad de Administrador: Eliminación Protegida con PIN

Para prevenir fraude interno o borrado accidental de facturación y pedidos:
1. **Validación Obligatoria de Clave de Seguridad:**
   - La eliminación de cualquier pedido o factura en `/admin/orders` y `/admin/pos` requiere la **Clave de Administrador** (`admin_security_pin` configurada en el perfil del comercio o clave maestra autorizada).
   - Tanto la API backend (`DELETE /api/admin/orders`) como la interfaz de usuario bloquean solicitudes sin verificación de PIN.
2. **Modal de Autorización:**
   - Se despliega el componente `AdminAuthPinModal` solicitando el PIN antes de proceder.
   - En caso de código incorrecto, la transacción es rechazada con código `401 Unauthorized`.

---

## 6. Módulo de Pedidos Web (`/admin/orders`): Pestaña "Todos" y Filtro de Fechas

La vista administrativa de pedidos web centraliza todas las órdenes generadas en la vitrina pública y en el POS:
- **Pestaña "Todos":**
  - Muestra la totalidad de pedidos sin importar su estatus (`pending`, `completed`, `cancelled`, `credit`), facilitando auditorías globales con conteo en vivo.
- **Filtrado por Rango de Fechas:**
  - Selectores `Desde` y `Hasta` para consultar periodos específicos de facturación.
  - **Botones de Presets Rápidos:**
    - ⚡ *Hoy*
    - 📅 *Últimos 7 días*
    - 🗓️ *Últimos 30 días*
    - 📊 *Este Mes*
    - 🌐 *Todo el tiempo*
  - Los filtros operan de manera combinada en el servidor (SQL) y en memoria reactiva.

---

## 7. Gestión de Crédito a 7 Días y Abonos Parciales

- **Condición de Venta:** Solo se activa al seleccionar un **Cliente Registrado** en la base de datos.
- **Validación de Límite Financiero:**
  $$\text{Crédito Disponible} = \text{Límite de Crédito USD} - \text{Deuda Actual USD}$$
  Si $\text{Total Orden USD} > \text{Crédito Disponible}$, el sistema bloquea la emisión e indica el exceso de línea al cajero.
- **Abonos Parciales con Selección de Tasa BCV:**
  - Al registrar un abono a cuenta de deuda, el operador puede seleccionar entre la tasa oficial del día de hoy o la tasa histórica de la fecha original de la venta, garantizando precisión contable.
  - El sistema actualiza de inmediato el saldo deudor del cliente y genera un recibo digital.

---

## 8. Impuesto a las Grandes Transacciones Financieras (IGTF 3%)
- **Activación por Tenant:** Se configura en `tenants.settings -> is_igtf_agent = true`.
- **Aplicación Automática:** Todo pago efectuado en divisas (`zelle` o `cash_usd`) genera el 3% de IGTF sobre el monto del instrumento.
- **Transparencia en el Cobro:**
  - Desglose visual individual por cada método en divisas en el modal de cobro.
  - Almacenamiento en `orders.igtf_total` y en cada fila de `orders.payment_breakdown` (`igtf_amount`).

---

## 9. Cierre de Caja Diario en 30 Segundos (`src/app/admin/cash-closing/page.tsx`)
- **Resumen Automático:** Agrupa transacciones completadas del día por método de pago (`count`, `total_usd`, `total_ves`).
- **Separación de IGTF:** Muestra el IGTF recaudado de forma aislada para facilitar la declaración tributaria.
- **Registro Inmutable:** Guarda el cierre en la tabla `cash_closings` con estado `closed`, timestamp, notas y usuario responsable (`closed_by`).
- **Widget en Dashboard:** El panel principal muestra un aviso en tiempo real de si la caja del día permanece **ABIERTA** o si ya fue **CERRADA**.
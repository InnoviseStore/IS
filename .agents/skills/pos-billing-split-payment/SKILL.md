---
name: pos-billing-split-payment
description: Reglas operativas del Punto de Venta (POS), validación de pagos divididos combinando Zelle, Pago Móvil y efectivo, gestión de créditos a 7 días, búsqueda dual por código y seguridad con PIN para cualquier tipo de tienda.
---

# Skill: Facturación POS, Pagos Divididos y Crédito 7d

Esta habilidad guía el desarrollo, mantenimiento y resolución de incidencias en el módulo de facturación rápida de mostrador y cobro físico, adaptado para cualquier tipo de comercio.

## Cuándo usar esta habilidad
- Al modificar o depurar el flujo de cobro en [`src/components/admin/SplitPaymentModal.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/admin/SplitPaymentModal.tsx) o [`src/app/admin/pos/page.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/admin/pos/page.tsx).
- Al añadir o ajustar métodos de pago admitidos (Zelle, Pago Móvil, Efectivo USD/VES, Débito, Transferencia).
- Al verificar la exactitud del saldo restante y las conversiones cambiarias durante la cobranza.
- Al procesar órdenes con condición de pago a crédito de 7 días o auditar la deuda de clientes.
- Al depurar la búsqueda dual por SKU y Código de Barras o la autorización con Clave de Administrador.

## Directrices de Implementación
1. **Validación de Balance Restante:**
   - El botón de confirmación de venta debe permanecer bloqueado hasta que $\text{Restante} \le 0.01$ y $\ge -0.01$ (tolerancia por centavos cambiarios).
   - Para métodos en Bolívares (Pago Móvil, Transferencia, Débito, Efectivo VES), el monto ingresado en Bs. se divide entre la tasa aplicada para obtener su equivalente en USD:
     $$\text{Abono USD} = \frac{\text{Monto en VES}}{\text{Tasa Oficial Seleccionada}}$$
2. **Estructura Estricta de `orders.payment_breakdown` (JSONB):**
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
3. **Búsqueda Dual por Código Interno y Código de Barras:**
   - La barra de búsqueda del POS y los lectores de códigos de barras (pistolas USB/Bluetooth o escáner por cámara) emparejan automáticamente contra `products.sku` y `products.barcode`.
4. **Gestión de Crédito a 7 Días:**
   - Solo se permite si se ha seleccionado un cliente registrado (`customer_id` no nulo).
   - Se debe verificar antes de guardar que:
     $$\text{Deuda Actual USD} + \text{Total Orden USD} \le \text{Límite de Crédito USD}$$
   - Al registrar la venta con `payment_condition = 'credit_7d'`, la base de datos asigna `due_date = NOW() + INTERVAL '7 days'` y actualiza el saldo deudor `customers.current_debt_usd`.
5. **Seguridad y Auditoría con Clave de Administrador (PIN):**
   - Anular, eliminar o editar facturas completadas requiere obligatoriamente ingresar el PIN de administrador (`settings.admin_security_pin`).
   - El componente [`AdminAuthPinModal.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/admin/AdminAuthPinModal.tsx) resguarda la integridad de las ventas y previene eliminaciones no autorizadas por cajeros o vendedores.
6. **Operación Transaccional Atómica:**
   Al confirmar el cobro:
   - Se crea el registro en `orders` congelando `exchange_rate_at_sale`.
   - Se crean las líneas en `order_items`.
   - Se descuenta el stock de cada producto (`products.stock = stock - qty`).
   - Se genera una entrada en `inventory_logs` con `change_type = 'sale'`.
7. **Ergonomía y Alto Contraste en Mostrador:**
   - Casillas amplias de monto recibido para facilitar la digitación veloz.
   - En modo claro, utilizar `text-slate-900` sobre fondos limpios. En modo oscuro, contrastes marcados con `dark:text-slate-100`.
8. **Regulación IGTF (3% Divisas):**
   - Cuando el tenant esté configurado como agente IGTF (`tenants.settings -> is_igtf_agent = true`), los pagos en divisas (`zelle`, `cash_usd`) causan automáticamente el 3% de impuesto.
9. **Cierre de Caja Diario:**
   - Accesible en `/admin/cash-closing`. Cruza en tiempo real las órdenes completadas de la jornada y genera snapshots inmutables.
10. **Adaptabilidad para Todo Tipo de Tienda:**
   - La caja y facturación están preparadas para bodegones, ropa, tecnología, calzado, farmacias, ferreterías y repuestos automotrices.
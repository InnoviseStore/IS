---
name: bcv-multicurrency
description: Extracción en vivo y sincronización de la tasa oficial del Banco Central de Venezuela (bcv.org.ve) con Fecha Valor, snapshots en ventas, histórico multi-día y conversión dinámica USD/VES para cualquier tipo de tienda.
---

# Skill: Motor Multimoneda y Sincronización BCV Oficial

Esta habilidad define los procedimientos técnicos para interactuar con la tasa oficial del Banco Central de Venezuela obtenida directamente desde `https://www.bcv.org.ve/`, la gestión del histórico de tasas cambiarias de días previos y la conversión dual en cualquier rubro de comercio minorista.

## Cuándo usar esta habilidad
- Al depurar o actualizar la sincronización de tasas cambiarias.
- Al modificar o mantener los selectores y regex del scraper de `https://www.bcv.org.ve/`.
- Al alterar la forma en que se muestran la cotización y la Fecha Valor en el Storefront o POS.
- Al registrar ventas o abonos retroactivos que coincidan con la tasa oficial de pagos transferidos días anteriores.
- Al manejar inconsistencias de formato de números o fechas devueltas por el portal bancario.

## Arquitectura del Módulo
- **Scraper Central:** [`src/lib/bcv.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/lib/bcv.ts) (`fetchLiveBcvRate`).
- **Endpoint de Sincronización:** [`src/app/api/exchange-rate/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/exchange-rate/route.ts).
- **Campos en Base de Datos (`tenants`):**
  - `currency_rate_bcv`: Valor decimal de la tasa activa (ej. `813.7361`).
  - `settings.bcv_fecha_valor`: Texto oficial de vigencia (ej. `Lunes, 07 Septiembre 2026`).
  - `settings.bcv_last_sync`: Timestamp ISO de la última consulta exitosa.
  - `settings.bcv_source`: URL de origen (`https://www.bcv.org.ve/`).
  - `settings.bcv_historical_rates`: Array JSONB con el histórico de tasas de los últimos días `[{ date: 'YYYY-MM-DD', rate: 91.50, fecha_valor: '...' }]`.

## Reglas Operativas y de Implementación
1. **Bypass de Certificados SSL:**
   El scraping debe utilizar siempre `new https.Agent({ rejectUnauthorized: false })` en el cliente Node.js HTTPS para evitar fallos de conexión provocados por cadenas de certificados raíz no reconocidas del servidor estatal.
2. **Selectores de Extracción:**
   - Dólar: Buscar el bloque contenedor `id="dolar"` y dentro de él `<strong class="strong-tb">([0-9.,]+)</strong>`.
   - Fecha Valor: Buscar `<span class="date-display-single"[^>]*>([^<]+)</span>`.
   - Normalización: Reemplazar comas por puntos (`replace(',', '.')`) y parsear con `parseFloat`.
3. **Mecanismo de Resiliencia / Fallback:**
   Si la petición al BCV arroja timeout (>8s) o error de red, recurrir automáticamente a `dolarapi.com/v1/dolares/oficial` como mirror de respaldo, conservando la operatividad del SaaS.
4. **Congelamiento de Tasa en Ventas:**
   Toda venta generada en el POS o por vitrina debe registrar en `orders.exchange_rate_at_sale` el snapshot exacto de la tasa en el instante de la transacción.
5. **Histórico de Tasas para Pagos Anteriores (Ventas y Abonos):**
   Si un cliente transfirió ayer o en días recientes y la venta o abono se procesa posteriormente, el sistema permite seleccionar del selector histórico la tasa oficial del día de la transferencia, evitando descuadres entre los bolívares transferidos y los dólares a saldar.
6. **Transparencia y Enlace Público:**
   El frontend siempre debe mostrar un hipervínculo directo a `https://www.bcv.org.ve/` para que los clientes puedan verificar la veracidad de la tasa aplicada.
7. **Adaptabilidad para Cualquier Tipo de Comercio:**
   El motor multimoneda funciona universalmente para tiendas de tecnología, moda, farmacias, bodegones, calzado, ferreterías y repuestos, garantizando cumplimiento de la normativa cambiaria venezolana en todos los sectores.
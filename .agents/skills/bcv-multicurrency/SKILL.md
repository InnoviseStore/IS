---
name: bcv-multicurrency
description: Extracción en vivo y sincronización de la tasa oficial del Banco Central de Venezuela (bcv.org.ve) con Fecha Valor, snapshots en ventas y conversión dinámica USD/VES.
---

# Skill: Motor Multimoneda y Sincronización BCV Oficial

Esta habilidad define los procedimientos técnicos para interactuar con la tasa oficial del Banco Central de Venezuela obtenida directamente desde `https://www.bcv.org.ve/`.

## Cuándo usar esta habilidad
- Al depurar o actualizar la sincronización de tasas cambiarias.
- Al modificar o mantener los selectores y regex del scraper de `https://www.bcv.org.ve/`.
- Al alterar la forma en que se muestran la cotización y la Fecha Valor en el Storefront o POS.
- Al manejar inconsistencias de formato de números o fechas devueltas por el portal bancario.

## Arquitectura del Módulo
- **Scraper Central:** [`src/lib/bcv.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/lib/bcv.ts) (`fetchLiveBcvRate`).
- **Endpoint de Sincronización:** [`src/app/api/exchange-rate/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/exchange-rate/route.ts).
- **Campos en Base de Datos (`tenants`):**
  - `currency_rate_bcv`: Valor decimal (ej. `813.7361`).
  - `settings.bcv_fecha_valor`: Texto oficial de vigencia (ej. `Lunes, 07 Septiembre 2026`).
  - `settings.bcv_last_sync`: Timestamp ISO de la última consulta exitosa.
  - `settings.bcv_source`: URL de origen (`https://www.bcv.org.ve/`).

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
5. **Transparencia y Enlace Público:**
   El frontend siempre debe mostrar un hipervínculo directo a `https://www.bcv.org.ve/` para que los clientes puedan verificar la veracidad de la tasa aplicada.
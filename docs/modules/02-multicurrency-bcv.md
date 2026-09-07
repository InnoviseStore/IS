# Módulo 2: Motor Multimoneda y Conexión en Vivo con BCV (bcv.org.ve)

## 1. Visión General
El sistema está conectado directamente con el portal oficial del **Banco Central de Venezuela** ([https://www.bcv.org.ve/](https://www.bcv.org.ve/)).
Permite sincronizar de manera automatizada la tasa oficial de cambio del dólar estadounidense (USD) y su respectiva **Fecha Valor**, manteniendo actualizado el catálogo de la vitrina virtual, el Punto de Venta (POS) físico y los desgloses de pago en bolívares.

---

## 2. Motor de Extracción Oficial (`src/lib/bcv.ts`)

El scraper opera en el servidor Node.js mediante el cliente nativo `https`:
- **Bypass de Cadena de Certificados:** Se utiliza `new https.Agent({ rejectUnauthorized: false })` para garantizar conectividad ante los certificados SSL de los servidores del Estado venezolano.
- **Cabeceras HTTP de Simulación:** Envía cabeceras `User-Agent: Mozilla/5.0...` y `Accept-Language: es-VE,es;q=0.9` para recibir la estructura HTML idéntica a la vista de navegador.
- **Selectores y Expresiones Regulares de Extracción:**
  1. **Cotización USD:**
     ```regex
     /<div[^>]*id=["']dolar["'][^>]*>[\s\S]*?<strong[^>]*class=["'][^"']*strong-tb[^"']*["'][^>]*>\s*([0-9.,]+)\s*<\/strong>/i
     ```
     Extrae el valor numérico en formato venezolano (ej. `813,73610000`), normaliza las comas a puntos y lo castea a número decimal (`813.7361`).
  2. **Fecha Valor Oficial:**
     ```regex
     /<span[^>]*class=["'][^"']*date-display-single[^"']*["'][^>]*content=["']([^"']+)["']/i
     // o texto directo:
     /<span[^>]*class=["'][^"']*date-display-single[^"']*["'][^>]*>\s*([^<]+)\s*<\/span>/i
     ```
     Obtiene el texto de vigencia legal (ej. `Lunes, 07 Septiembre 2026`).
- **Mecanismo de Resiliencia / Fallback:** Si el portal del BCV experimenta latencia o caída temporal, el motor consulta automáticamente el mirror oficial de `dolarapi.com/v1/dolares/oficial` para garantizar que la tienda nunca interrumpa sus operaciones de facturación.

---

## 3. Endpoints y Sincronización Automática (`src/app/api/exchange-rate/route.ts`)

- **Caché y Verificación Temporal (30 minutos):**
  Al consultar `GET /api/exchange-rate?tenant=[slug]`:
  1. Si `settings.bcv_last_sync` es menor a 30 minutos y `sync != 'true'`, responde de inmediato con la tasa en base de datos.
  2. Si han pasado más de 30 minutos o se invoca con `sync=true`, ejecuta `fetchLiveBcvRate()` y actualiza `tenants.currency_rate_bcv` y `tenants.settings.bcv_fecha_valor`.
- **POST `/api/exchange-rate`:**
  - `{ "action": "sync_bcv" }`: Ejecuta una sincronización inmediata bajo demanda.
  - `{ "rate": 813.74 }`: Permite forzar un ajuste manual por parte del administrador en caso de contingencia.

---

## 4. Congelamiento de Tasa en Ventas (Snapshot)
Para cumplir con la legislación mercantil venezolana y proteger la tesorería del comercio:
- Toda orden generada en el POS o por vitrina registra en la columna `orders.exchange_rate_at_sale` el valor exacto de la tasa al momento de emitirse el ticket.
- De esta manera, si la tasa cambia posteriormente, las órdenes históricas o a crédito no alteran su total adeudado en bolívares.

---

## 5. Visualización en la Interfaz de Usuario
- **Vitrina Virtual (`ExchangeRateBanner.tsx`):** Muestra una píldora flotante con la cotización del día, la **Fecha Valor** oficial y un enlace directo a `https://www.bcv.org.ve/` para transparencia total con el comprador.
- **Panel Administrativo (`src/app/admin/layout.tsx`):** Botón de sincronización con indicador giratorio (`Loader2` de Lucide) que permite forzar la actualización con un clic y muestra retroalimentación visual al instante.
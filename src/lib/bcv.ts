import https from 'https'

export interface BcvRateResult {
  rate: number
  fechaValor: string
  source: string
  timestamp: string
}

/**
 * Scrapes the official exchange rate and effective date directly from the Banco Central de Venezuela (BCV).
 * URL: https://www.bcv.org.ve/
 */
export async function fetchLiveBcvRate(): Promise<BcvRateResult> {
  // First attempt: Direct fetch from official BCV website
  try {
    const directResult = await fetchFromBcvWebsite()
    if (directResult && directResult.rate > 0) {
      return directResult
    }
  } catch (err) {
    console.warn('Direct BCV fetch failed or timed out, attempting reliable BCV mirror fallback:', (err as Error).message)
  }

  // Second attempt: Fallback to official BCV mirror (dolarapi.com/v1/dolares/oficial)
  try {
    const mirrorResult = await fetchFromBcvMirror()
    if (mirrorResult && mirrorResult.rate > 0) {
      return mirrorResult
    }
  } catch (err) {
    console.error('BCV mirror fallback also failed:', (err as Error).message)
  }

  throw new Error('No se pudo obtener la tasa oficial del BCV en este momento.')
}

/**
 * Direct scraper for https://www.bcv.org.ve/
 */
function fetchFromBcvWebsite(): Promise<BcvRateResult> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false })
    const timeoutMs = 8000

    const req = https.get(
      'https://www.bcv.org.ve/',
      {
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`BCV HTTP Status: ${res.statusCode}`))
        }

        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            // Extract Dolar rate from <div id="dolar"> ... <strong class="strong-tb">813,73610000</strong>
            const dolarBlock = data.split('id="dolar"')[1]?.substring(0, 600)
            const rateMatch = dolarBlock?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)

            if (!rateMatch || !rateMatch[1]) {
              return reject(new Error('No se encontro el contenedor de tasa USD en el HTML del BCV'))
            }

            const cleanRateStr = rateMatch[1].trim().replace(/\s+/g, '').replace(',', '.')
            const rate = parseFloat(cleanRateStr)

            if (isNaN(rate) || rate <= 0) {
              return reject(new Error(`Tasa USD invalida extraida del BCV: "${cleanRateStr}"`))
            }

            // Extract Fecha Valor from <span class="date-display-single" ...>Lunes, 07 Septiembre 2026</span>
            const dateMatch =
              data.match(/class=["'][^"']*date-display-single[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
              data.match(/Fecha\s*Valor:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)

            const rawDate = dateMatch ? dateMatch[1].replace(/\s+/g, ' ').trim() : ''
            const fechaValor = rawDate || new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

            resolve({
              rate,
              fechaValor,
              source: 'https://www.bcv.org.ve/',
              timestamp: new Date().toISOString(),
            })
          } catch (e) {
            reject(e)
          }
        })
      }
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error(`Timeout de conexion al BCV tras ${timeoutMs / 1000}s`))
    })

    req.on('error', (err) => reject(err))
  })
}

/**
 * Fallback to official BCV mirror API
 */
async function fetchFromBcvMirror(): Promise<BcvRateResult> {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
    headers: { 'User-Agent': 'InnoviseStore/1.0' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Mirror HTTP status ${res.status}`)
  }

  const json = await res.json()
  const rate = Number(json.promedio)
  const fechaActualizacion = json.fechaActualizacion
    ? new Date(json.fechaActualizacion).toLocaleDateString('es-VE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return {
    rate,
    fechaValor: fechaActualizacion || 'Oficial BCV',
    source: 'Mirror Oficial BCV (dolarapi.com)',
    timestamp: new Date().toISOString(),
  }
}
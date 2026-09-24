import https from 'https'

export interface BcvRateResult {
  rate: number
  rateEur?: number
  fechaValor: string
  source: string
  timestamp: string
}

/**
 * Scrapes the official exchange rates (USD & EUR) and effective date directly from the Banco Central de Venezuela (BCV).
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

  // Second attempt: Fallback to official BCV mirror (dolarapi.com)
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
    const timeoutMs = 4000

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
            // Extract Dolar rate from <div id="dolar"> ... <strong class="strong-tb">854,46370000</strong>
            const dolarBlock = data.split('id="dolar"')[1]?.substring(0, 600)
            const dolarMatch = dolarBlock?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)

            // Extract Euro rate from <div id="euro"> ... <strong class="strong-tb">974,06298408</strong>
            const euroBlock = data.split('id="euro"')[1]?.substring(0, 600)
            const euroMatch = euroBlock?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)

            if (!dolarMatch || !dolarMatch[1]) {
              return reject(new Error('No se encontró el contenedor de tasa USD en el HTML del BCV'))
            }

            const cleanRateStr = dolarMatch[1].trim().replace(/\s+/g, '').replace(',', '.')
            const rate = parseFloat(cleanRateStr)

            const cleanEurStr = euroMatch?.[1] ? euroMatch[1].trim().replace(/\s+/g, '').replace(',', '.') : ''
            const rateEur = parseFloat(cleanEurStr) || parseFloat((rate * 1.08).toFixed(4))

            if (isNaN(rate) || rate <= 0) {
              return reject(new Error(`Tasa USD inválida extraída del BCV: "${cleanRateStr}"`))
            }

            // Extract Fecha Valor from <span class="date-display-single" ...>Jueves, 24 Septiembre 2026</span>
            const dateMatch =
              data.match(/class=["'][^"']*date-display-single[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
              data.match(/Fecha\s*Valor:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)

            const rawDate = dateMatch ? dateMatch[1].replace(/\s+/g, ' ').trim() : ''
            const fallbackDate = new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            const fechaValor = (rawDate || fallbackDate).charAt(0).toUpperCase() + (rawDate || fallbackDate).slice(1)

            resolve({
              rate,
              rateEur,
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
      reject(new Error(`Timeout de conexión al BCV tras ${timeoutMs / 1000}s`))
    })

    req.on('error', (err) => reject(err))
  })
}

/**
 * Fallback to official BCV mirror API (dolarapi.com) for both USD and EUR
 */
async function fetchFromBcvMirror(): Promise<BcvRateResult> {
  const [usdRes, eurRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { 'User-Agent': 'InnoviseStore/1.0' },
      cache: 'no-store',
    }),
    fetch('https://ve.dolarapi.com/v1/euros/oficial', {
      headers: { 'User-Agent': 'InnoviseStore/1.0' },
      cache: 'no-store',
    }).catch(() => null),
  ])

  if (!usdRes.ok) {
    throw new Error(`Mirror HTTP status ${usdRes.status}`)
  }

  const jsonUsd = await usdRes.json()
  const rate = Number(jsonUsd.promedio)

  let rateEur = rate * 1.08
  if (eurRes && eurRes.ok) {
    try {
      const jsonEur = await eurRes.json()
      if (jsonEur.promedio) {
        rateEur = Number(jsonEur.promedio)
      }
    } catch {}
  }

  const dateObj = jsonUsd.fechaActualizacion ? new Date(jsonUsd.fechaActualizacion) : new Date()
  const formattedDate = dateObj.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fechaActualizacion = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

  return {
    rate,
    rateEur,
    fechaValor: fechaActualizacion,
    source: 'Mirror Oficial BCV (dolarapi.com)',
    timestamp: new Date().toISOString(),
  }
}
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits recomendado por NIST para GCM
const TAG_LENGTH = 16

/**
 * Deriva una clave de 256 bits a partir de la variable de entorno o genera una de respaldo segura.
 */
function getMasterKey(): Buffer {
  const secret = process.env.PII_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'innovise-master-pii-key-fallback-32b-seed'
  return crypto.scryptSync(secret, 'innovise-pii-kdf-salt-v1', 32)
}

/**
 * Cifra un dato personal sensible usando AES-256-GCM.
 * Formato de salida: ivHex:tagHex:cipherHex
 */
export function encryptPii(plainText: string | null | undefined): string {
  if (!plainText) return ''
  const str = String(plainText).trim()
  if (!str) return ''

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv)

  let encrypted = cipher.update(str, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/**
 * Descifra un dato protegido con AES-256-GCM validando su integridad criptográfica con el Auth Tag.
 * Si el texto no está cifrado (legacy), lo retorna intacto sin arrojar error.
 */
export function decryptPii(cipherPayload: string | null | undefined): string {
  if (!cipherPayload) return ''
  const str = String(cipherPayload).trim()
  if (!str) return ''

  // Verificar si tiene el formato iv:tag:ciphertext
  const parts = str.split(':')
  if (parts.length !== 3) {
    // Dato en texto claro existente previo al cifrado
    return str
  }

  const [ivHex, tagHex, encryptedHex] = parts
  if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== TAG_LENGTH * 2) {
    return str
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getMasterKey(),
      Buffer.from(ivHex, 'hex')
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    // Si falla la verificación de autenticidad del Tag o la clave
    console.warn('[CryptoPII] Fallo de integridad al descifrar campo protegido')
    return str
  }
}

/**
 * Genera un índice ciego (Blind Index) determinista con HMAC-SHA256 para permitir búsquedas
 * exactas y evitar duplicados sin exponer el dato en texto plano en la base de datos.
 */
export function generateBlindIndex(plainText: string | null | undefined): string {
  if (!plainText) return ''
  const pepper = process.env.BLIND_INDEX_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'innovise-blind-index-pepper-seed'
  return crypto
    .createHmac('sha256', pepper)
    .update(String(plainText).trim().toLowerCase())
    .digest('hex')
}

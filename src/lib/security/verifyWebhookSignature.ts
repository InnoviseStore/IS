import crypto from 'crypto'

export interface WebhookVerificationOptions {
  rawPayload: string
  signatureHeader: string
  secret: string
  timestampHeader?: string
  toleranceSeconds?: number // Ventana de tolerancia por defecto 300 segundos (5 minutos)
}

/**
 * Valida la firma criptográfica HMAC-SHA256 de webhooks entrantes (pasarelas de pago, WhatsApp, etc.)
 * utilizando comparación en tiempo constante para mitigar ataques de temporización (Timing Attacks)
 * e inspección de timestamp contra ataques de repetición (Replay Attacks).
 */
export function verifyWebhookSignature({
  rawPayload,
  signatureHeader,
  secret,
  timestampHeader,
  toleranceSeconds = 300,
}: WebhookVerificationOptions): { valid: boolean; reason?: string } {
  if (!signatureHeader || !secret) {
    return { valid: false, reason: 'Cabecera de firma o secreto ausente' }
  }

  // 1. Verificación de tolerancia de marca de tiempo (Anti-Replay)
  if (timestampHeader) {
    const timestamp = parseInt(timestampHeader, 10)
    const now = Math.floor(Date.now() / 1000)
    if (isNaN(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) {
      return { valid: false, reason: 'Timestamp fuera de la ventana de tolerancia (posible replay attack)' }
    }
  }

  // 2. Cálculo de firma esperada
  const payloadToSign = timestampHeader ? `${timestampHeader}.${rawPayload}` : rawPayload
  const cleanReceivedSig = signatureHeader.replace(/^(sha256=|v1=)/, '').trim()

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex')

  const expectedBuffer = Buffer.from(computedSig, 'hex')
  const actualBuffer = Buffer.from(cleanReceivedSig, 'hex')

  if (expectedBuffer.length !== actualBuffer.length) {
    return { valid: false, reason: 'Longitud de firma incorrecta' }
  }

  // 3. Comparación en tiempo constante (protección contra timing attacks)
  const isMatch = crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  if (!isMatch) {
    return { valid: false, reason: 'Firma criptográfica inválida' }
  }

  return { valid: true }
}

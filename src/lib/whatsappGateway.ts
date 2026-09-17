/**
 * WhatsApp Gateway Service (Multi-tenant Evolution API / Baileys Gateway)
 * Diseñado para enviar mensajes automáticos y gestionar instancias aisladas por tienda en el Plan Enterprise.
 */

import { normalizeWhatsAppPhone } from './whatsapp'

export interface WhatsAppInstanceStatus {
  instanceName: string
  status: 'connected' | 'connecting' | 'disconnected'
  qrcode?: string | null
  pairingCode?: string | null
  phone?: string | null
  updatedAt: string
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
  simulated?: boolean
}

/**
 * Obtiene la configuración del Gateway desde variables de entorno o defaults
 */
function getGatewayConfig() {
  const apiUrl = process.env.WHATSAPP_GATEWAY_URL || process.env.EVOLUTION_API_URL || ''
  const apiKey = process.env.WHATSAPP_GATEWAY_API_KEY || process.env.EVOLUTION_API_KEY || ''
  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    isConfigured: Boolean(apiUrl),
  }
}

/**
 * Genera un código QR SVG / DataURL simulado o real para emparejar
 */
function generateSimulatedQrDataUrl(instanceName: string): string {
  // Código QR mockup con SVG de alta calidad para cuando el gateway no tiene servidor externo levantado
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#ffffff" rx="16"/>
    <g fill="#0f172a">
      <!-- Outer anchors -->
      <rect x="25" y="25" width="60" height="60" rx="10"/>
      <rect x="35" y="35" width="40" height="40" rx="6" fill="#ffffff"/>
      <rect x="45" y="45" width="20" height="20" rx="4"/>

      <rect x="215" y="25" width="60" height="60" rx="10"/>
      <rect x="225" y="35" width="40" height="40" rx="6" fill="#ffffff"/>
      <rect x="235" y="45" width="20" height="20" rx="4"/>

      <rect x="25" y="215" width="60" height="60" rx="10"/>
      <rect x="35" y="225" width="40" height="40" rx="6" fill="#ffffff"/>
      <rect x="45" y="235" width="20" height="20" rx="4"/>

      <!-- Matrix pattern simulated -->
      <rect x="100" y="30" width="15" height="15" rx="3"/>
      <rect x="125" y="30" width="25" height="15" rx="3"/>
      <rect x="160" y="30" width="15" height="15" rx="3"/>
      <rect x="185" y="30" width="15" height="15" rx="3"/>

      <rect x="100" y="55" width="25" height="15" rx="3"/>
      <rect x="135" y="55" width="15" height="15" rx="3"/>
      <rect x="160" y="55" width="40" height="15" rx="3"/>

      <rect x="30" y="100" width="15" height="25" rx="3"/>
      <rect x="55" y="100" width="30" height="15" rx="3"/>
      <rect x="30" y="135" width="20" height="15" rx="3"/>
      <rect x="60" y="135" width="25" height="25" rx="3"/>
      <rect x="30" y="170" width="15" height="30" rx="3"/>
      <rect x="55" y="170" width="30" height="15" rx="3"/>

      <!-- Center cluster -->
      <rect x="105" y="105" width="90" height="90" rx="12" fill="#25d366" opacity="0.15"/>
      <circle cx="150" cy="150" r="28" fill="#25d366"/>
      <path d="M142 142h16v16h-16z" fill="#ffffff"/>
      <path d="M140 148c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10h-2l-5 3 1-5c-2.5-2-4-5-4-8z" fill="#ffffff"/>

      <rect x="215" y="100" width="20" height="25" rx="3"/>
      <rect x="245" y="100" width="30" height="15" rx="3"/>
      <rect x="225" y="135" width="50" height="15" rx="3"/>
      <rect x="215" y="160" width="20" height="30" rx="3"/>
      <rect x="245" y="160" width="30" height="15" rx="3"/>

      <rect x="100" y="215" width="30" height="15" rx="3"/>
      <rect x="140" y="215" width="20" height="25" rx="3"/>
      <rect x="170" y="215" width="30" height="15" rx="3"/>
      <rect x="100" y="240" width="15" height="35" rx="3"/>
      <rect x="125" y="250" width="35" height="15" rx="3"/>
      <rect x="170" y="240" width="20" height="35" rx="3"/>
      <rect x="200" y="215" width="45" height="15" rx="3"/>
      <rect x="255" y="215" width="20" height="25" rx="3"/>
      <rect x="220" y="240" width="55" height="15" rx="3"/>
      <rect x="235" y="265" width="40" height="15" rx="3"/>
    </g>
  </svg>`

  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Consulta el estado de conexión o crea una instancia para el tenant
 */
export async function getTenantGatewayStatus(
  instanceName: string,
  configuredPhone?: string | null
): Promise<WhatsAppInstanceStatus> {
  const { apiUrl, apiKey, isConfigured } = getGatewayConfig()

  if (!isConfigured) {
    // Si no hay un servidor externo de Evolution API configurado en .env,
    // operamos en modo sincronizado con el teléfono oficial configurado de la tienda
    const isInnovise = instanceName.includes('innovise')
    const phone = configuredPhone || (isInnovise ? '584245259193' : null)

    return {
      instanceName,
      status: phone ? 'connected' : 'disconnected',
      phone: phone || null,
      qrcode: phone ? null : generateSimulatedQrDataUrl(instanceName),
      updatedAt: new Date().toISOString(),
    }
  }

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      // Intentar crear instancia si no existe
      const createRes = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })
      const createData = await createRes.json()
      return {
        instanceName,
        status: 'connecting',
        qrcode: createData?.qrcode?.base64 || null,
        phone: null,
        updatedAt: new Date().toISOString(),
      }
    }

    const data = await res.json()
    const state = data?.instance?.state || data?.state || 'disconnected'

    if (state === 'open') {
      return {
        instanceName,
        status: 'connected',
        phone: configuredPhone || null,
        updatedAt: new Date().toISOString(),
      }
    }

    // Solicitar QR de reconexión
    const qrRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    })
    const qrData = await qrRes.json()

    return {
      instanceName,
      status: 'connecting',
      qrcode: qrData?.base64 || qrData?.qrcode?.base64 || null,
      phone: null,
      updatedAt: new Date().toISOString(),
    }
  } catch (err: any) {
    console.warn('[WhatsAppGateway] Error connecting to gateway server:', err.message)
    return {
      instanceName,
      status: 'disconnected',
      qrcode: generateSimulatedQrDataUrl(instanceName),
      phone: configuredPhone || null,
      updatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Envía un mensaje de texto automático a un destinatario
 */
export async function sendWhatsAppTextMessage(
  instanceName: string,
  toPhone: string,
  text: string
): Promise<SendMessageResult> {
  const cleanPhone = normalizeWhatsAppPhone(toPhone)
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Número de teléfono destinatario inválido.' }
  }

  const { apiUrl, apiKey, isConfigured } = getGatewayConfig()

  // Si hay servidor Evolution API conectado
  if (isConfigured) {
    try {
      const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: text,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false,
          },
        }),
      })

      const data = await res.json()
      if (res.ok && (data?.key || data?.id || data?.status === 'PENDING' || data?.status === 'SUCCESS')) {
        return { success: true, messageId: data?.key?.id || data?.id }
      }
      return { success: false, error: data?.message || data?.error || 'Error del Gateway de WhatsApp' }
    } catch (e: any) {
      console.error('[WhatsAppGateway] Error sending text message:', e)
      return { success: false, error: e.message }
    }
  }

  // Si opera sin servidor externo (Modo simulado / Sandbox activo)
  console.log(`[WhatsAppGateway Simulado] Enviando a +${cleanPhone} desde instancia [${instanceName}]:\n`, text)
  return {
    success: true,
    messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    simulated: true,
  }
}

/**
 * Envía un documento (como factura PDF) a un destinatario
 */
export async function sendWhatsAppDocument(
  instanceName: string,
  toPhone: string,
  base64Data: string,
  fileName: string = 'Factura.pdf',
  caption: string = ''
): Promise<SendMessageResult> {
  const cleanPhone = normalizeWhatsAppPhone(toPhone)
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Número de teléfono destinatario inválido.' }
  }

  const { apiUrl, apiKey, isConfigured } = getGatewayConfig()

  // Limpiar encabezado data:application/pdf;base64, si viene con prefijo DataURL
  const rawBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '').trim()

  if (isConfigured) {
    try {
      const res = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
          mediatype: 'document',
          mimetype: 'application/pdf',
          media: rawBase64,
          fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
          caption: caption || '',
        }),
      })

      const data = await res.json()
      if (res.ok && (data?.key || data?.id || data?.status === 'PENDING' || data?.status === 'SUCCESS')) {
        return { success: true, messageId: data?.key?.id || data?.id }
      }
      return { success: false, error: data?.message || data?.error || 'Error al enviar documento PDF por WhatsApp' }
    } catch (e: any) {
      console.error('[WhatsAppGateway] Error sending document message:', e)
      return { success: false, error: e.message }
    }
  }

  console.log(`[WhatsAppGateway Simulado] Enviando documento ${fileName} a +${cleanPhone} desde instancia [${instanceName}]`)
  return {
    success: true,
    messageId: `sim_doc_${Date.now()}`,
    simulated: true,
  }
}

export interface WhatsAppButtonOption {
  id: string
  displayText: string
}

/**
 * Envía un mensaje con botones interactivos de selección rápida
 */
export async function sendWhatsAppButtons(
  instanceName: string,
  toPhone: string,
  title: string,
  description: string,
  buttons: WhatsAppButtonOption[],
  footer?: string
): Promise<SendMessageResult> {
  const cleanPhone = normalizeWhatsAppPhone(toPhone)
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Número de teléfono destinatario inválido.' }
  }

  const { apiUrl, apiKey, isConfigured } = getGatewayConfig()

  if (isConfigured) {
    try {
      const res = await fetch(`${apiUrl}/message/sendButtons/${instanceName}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
          title: title,
          description: description,
          footer: footer || '',
          buttons: buttons.map((b) => ({
            type: 'reply',
            displayText: b.displayText,
            id: b.id,
          })),
        }),
      })

      const data = await res.json()
      if (res.ok && (data?.key || data?.id || data?.status === 'PENDING' || data?.status === 'SUCCESS')) {
        return { success: true, messageId: data?.key?.id || data?.id }
      }

      // Si el cliente de WhatsApp no soporta botones nativos en este momento, hacer fallback a texto
      console.warn('[WhatsAppGateway] Fallback sendButtons to sendText:', data?.message || data?.error)
      const fallbackText = `${title ? `*${title}*\n\n` : ''}${description}\n\n` +
        buttons.map((b, i) => `${i + 1}️⃣ Escribe *${b.displayText.replace(/^[^\w]+/, '')}*`).join('\n')
      return sendWhatsAppTextMessage(instanceName, cleanPhone, fallbackText)
    } catch (e: any) {
      console.error('[WhatsAppGateway] Error sending buttons:', e)
      return { success: false, error: e.message }
    }
  }

  console.log(`[WhatsAppGateway Simulado] Enviando botones a +${cleanPhone}:`, { title, description, buttons })
  return {
    success: true,
    messageId: `sim_btn_${Date.now()}`,
    simulated: true,
  }
}

/**
 * Configura el Webhook de Evolution API para una instancia
 */
export async function configureTenantWebhook(
  instanceName: string,
  webhookUrl: string
): Promise<boolean> {
  const { apiUrl, apiKey, isConfigured } = getGatewayConfig()
  if (!isConfigured || !webhookUrl) return false

  try {
    const res = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    })

    return res.ok
  } catch (err) {
    console.warn('[WhatsAppGateway] Error setting webhook:', err)
    return false
  }
}


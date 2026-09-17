import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppTextMessage, sendWhatsAppButtons } from '@/lib/whatsappGateway'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Mapa para evitar duplicidad de procesamiento en ráfagas de webhooks (id de mensaje con TTL 2 minutos)
const processedMessageIds = new Map<string, number>()

function isAlreadyProcessed(msgId: string): boolean {
  const now = Date.now()
  // Limpieza periódica
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 120000) processedMessageIds.delete(id)
  }
  if (processedMessageIds.has(msgId)) return true
  processedMessageIds.set(msgId, now)
  return false
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ status: 'invalid_body' }, { status: 400 })
    }

    const instanceName: string = body.instance || ''
    // Evolution API v2 envía la data en body.data (objeto o array)
    const rawData = Array.isArray(body.data) ? body.data[0] : body.data
    if (!rawData || !rawData.key) {
      return NextResponse.json({ status: 'no_message_data' })
    }

    const key = rawData.key
    // 1. Ignorar mensajes salientes enviados por el propio bot/comercio
    if (key.fromMe) {
      return NextResponse.json({ status: 'ignored_from_me' })
    }

    // 2. Ignorar mensajes de grupos o estados
    const remoteJid: string = key.remoteJid || ''
    if (remoteJid.includes('@g.us') || remoteJid.includes('status@broadcast')) {
      return NextResponse.json({ status: 'ignored_group_or_broadcast' })
    }

    // 3. Prevenir duplicados
    const messageId: string = key.id || ''
    if (messageId && isAlreadyProcessed(messageId)) {
      return NextResponse.json({ status: 'already_processed' })
    }

    // 4. Extraer teléfono del remitente (número limpio en dígitos)
    const senderDigits = remoteJid.replace(/@s\.whatsapp\.net/, '').replace(/\D/g, '')
    if (!senderDigits || senderDigits.length < 7) {
      return NextResponse.json({ status: 'invalid_phone' })
    }

    // 5. Extraer texto o ID de botón presionado
    let text = ''
    let buttonId = ''

    const msg = rawData.message || {}

    if (msg.conversation) {
      text = msg.conversation
    } else if (msg.extendedTextMessage?.text) {
      text = msg.extendedTextMessage.text
    } else if (msg.buttonsResponseMessage) {
      buttonId = msg.buttonsResponseMessage.selectedButtonId || ''
      text = msg.buttonsResponseMessage.selectedDisplayText || buttonId
    } else if (msg.templateButtonReplyMessage) {
      buttonId = msg.templateButtonReplyMessage.selectedId || ''
      text = buttonId
    } else if (msg.listResponseMessage) {
      buttonId = msg.listResponseMessage.singleSelectReply?.selectedRowId || ''
      text = buttonId
    } else if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
        buttonId = parsed.id || ''
        text = buttonId
      } catch {}
    }

    const normalized = (text || buttonId).toLowerCase().trim()
    if (!normalized) {
      // Mensaje sin texto ni botón (imagen, sticker, audio no solicitado)
      return NextResponse.json({ status: 'no_text_or_button' })
    }

    // 6. Clasificar la intención del cliente
    const isBalanceQuery =
      buttonId === 'btn_saldo' ||
      buttonId === 'consultar_saldo' ||
      normalized.includes('saldo') ||
      normalized.includes('deuda') ||
      normalized.includes('debo') ||
      normalized.includes('abono') ||
      normalized.includes('abonar') ||
      normalized.includes('pendiente') ||
      normalized.includes('estado de cuenta') ||
      normalized === '1'

    const isPaymentInfoQuery =
      buttonId === 'btn_datos_pago' ||
      buttonId === 'btn_pago' ||
      buttonId === 'datos_pago' ||
      normalized.includes('pago movil') ||
      normalized.includes('pagomovil') ||
      normalized.includes('cuenta') ||
      normalized.includes('banco') ||
      normalized.includes('zelle') ||
      normalized.includes('transferir') ||
      normalized.includes('transferencia') ||
      normalized.includes('datos de pago') ||
      normalized.includes('como pago') ||
      normalized === '2'

    const isCatalogQuery =
      buttonId === 'btn_catalogo' ||
      normalized.includes('catalogo') ||
      normalized.includes('catálogo') ||
      normalized.includes('producto') ||
      normalized.includes('tienda') ||
      normalized.includes('precio') ||
      normalized === '3'

    const isGreetingOrHelp =
      buttonId === 'btn_menu' ||
      buttonId === 'btn_asesor' ||
      normalized === 'hola' ||
      normalized.startsWith('hola ') ||
      normalized.includes('buenos dias') ||
      normalized.includes('buenos días') ||
      normalized.includes('buenas tardes') ||
      normalized.includes('buenas noches') ||
      normalized.includes('buenas') ||
      normalized.includes('menu') ||
      normalized.includes('menú') ||
      normalized.includes('ayuda')

    // Si no coincide con ninguna intención relevante, no interrumpir el chat orgánico
    if (!isBalanceQuery && !isPaymentInfoQuery && !isCatalogQuery && !isGreetingOrHelp) {
      return NextResponse.json({ status: 'no_matching_intent' })
    }

    // 7. Cargar Tenant desde Supabase
    const supabase = getAdminClient()
    const slugCandidate = instanceName.replace(/^tenant_/, '').toLowerCase()

    let { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .ilike('slug', slugCandidate)
      .maybeSingle()

    // Fallback: si no se encuentra por slug exacto, buscar por phone_whatsapp o primer tenant activo
    if (!tenant) {
      const { data: fallbackTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      tenant = fallbackTenant
    }

    if (!tenant) {
      return NextResponse.json({ status: 'tenant_not_found' }, { status: 404 })
    }

    const tenantSettings = (tenant.settings || {}) as Record<string, any>
    const exchangeRate = Number(tenant.currency_rate_bcv || 36.5)

    // Formatear cuentas bancarias registradas en la tienda
    const paymentAccounts = Array.isArray(tenantSettings.payment_accounts)
      ? tenantSettings.payment_accounts.filter((a: any) => a.enabled !== false)
      : []

    let paymentMethodsFormatted = ''
    if (paymentAccounts.length > 0) {
      paymentMethodsFormatted = paymentAccounts
        .map((acc: any) => {
          if (acc.method === 'pago_movil') {
            return `🏦 *Pago Móvil:*\n• Banco: *${acc.bank_name || 'Banesco'}*\n• Cédula/RIF: *${acc.id_number || 'V-XXXXXXXX'}*\n• Teléfono: *${acc.phone || tenant?.phone_whatsapp || ''}*`
          } else if (acc.method === 'zelle') {
            return `💵 *Zelle:*\n• Correo: *${acc.email || ''}*\n• Titular: *${acc.account_holder || ''}*`
          } else if (acc.method === 'transferencia') {
            return `🏛️ *Transferencia Bancaria:*\n• Banco: *${acc.bank_name || ''}*\n• Cuenta: *${acc.account_number || ''}*\n• Titular: *${acc.account_holder || ''}*\n• Cédula/RIF: *${acc.id_number || ''}*`
          } else if (acc.method === 'binance_pay') {
            return `🟡 *Binance Pay:*\n• Pay ID / Email: *${acc.email || acc.account_holder || ''}*`
          }
          return `💳 *${acc.label || 'Método de Pago'}:*\n• ${acc.instructions || ''}`
        })
        .join('\n\n')
    } else {
      paymentMethodsFormatted = `🏦 *Pago Móvil Oficial:*\n• Teléfono: *${tenant.phone_whatsapp || senderDigits}*\n• Banco: *A consultar con administración*`
    }

    // 8. Buscar cliente en la tienda por su número telefónico
    // Comparamos los últimos 7 a 10 dígitos para evitar inconsistencias de formato (+58, 0424, 424)
    const last7 = senderDigits.slice(-7)
    const last10 = senderDigits.slice(-10)

    const { data: customerCandidates } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .or(`phone.ilike.%${last7}%,phone.ilike.%${last10}%`)
      .limit(5)

    const customer = customerCandidates?.[0]

    // 9. Ejecutar la respuesta según la intención detectada

    // A) CONSULTA DE SALDO O ABONO
    if (isBalanceQuery) {
      if (!customer) {
        // Cliente no registrado
        const msgText =
          `👋 ¡Hola! Gracias por comunicarte con *${tenant.name}*.\n\n` +
          `🔍 Consultamos en nuestro sistema pero no encontramos una cuenta de cliente registrada con este número telefónico (*+${senderDigits}*).\n\n` +
          `📌 Si eres cliente y tienes compras pendientes o deseas registrarte, por favor indícanos tu *Nombre completo* y *Cédula/RIF* y con gusto te asistiremos.`

        await sendWhatsAppButtons(
          instanceName,
          senderDigits,
          `Atención al Cliente • ${tenant.name}`,
          msgText,
          [
            { id: 'btn_catalogo', displayText: '🛍️ Ver Catálogo' },
            { id: 'btn_datos_pago', displayText: '🏦 Cuentas de Pago' },
          ]
        )
        return NextResponse.json({ status: 'customer_not_found_responded' })
      }

      const debtUsd = Number(customer.current_debt_usd || 0)

      if (debtUsd <= 0.01) {
        // Cliente AL DÍA
        const alDiaText =
          `🎉 *¡Hola ${customer.full_name}!* ✨\n\n` +
          `Te confirmamos que en *${tenant.name}* te encuentras **completamente al día**.\n\n` +
          `✅ *Saldo pendiente:* **$0.00 USD (Bs. 0,00)**\n\n` +
          `¡Muchas gracias por tu puntualidad y preferencia constante! Si deseas realizar un nuevo pedido, visita nuestro catálogo virtual.`

        await sendWhatsAppButtons(
          instanceName,
          senderDigits,
          `Estado de Cuenta • ${tenant.name}`,
          alDiaText,
          [
            { id: 'btn_catalogo', displayText: '🛍️ Ver Catálogo' },
            { id: 'btn_datos_pago', displayText: '🏦 Cuentas de Pago' },
          ]
        )
        return NextResponse.json({ status: 'balance_al_dia_responded' })
      }

      // Cliente con SALDO PENDIENTE
      const debtVes = (debtUsd * exchangeRate).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      const debtText =
        `👋 ¡Hola *${customer.full_name}*!\n\n` +
        `Aquí tienes el estado actualizado de tu cuenta en *${tenant.name}*:\n\n` +
        `💰 *Saldo pendiente:* **$${debtUsd.toFixed(2)} USD**\n` +
        `🇻🇪 *Equivalente en Bolívares:* **Bs. ${debtVes}**\n` +
        `📊 *Tasa Oficial BCV del día:* **Bs. ${exchangeRate.toFixed(4)}/USD**\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💳 *DATOS PARA ABONAR O CANCELAR:*\n\n` +
        `${paymentMethodsFormatted}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📎 *Importante:* Al realizar tu abono o pago total, por favor envía la captura o número de referencia por este mismo chat para procesarlo y rebajarlo de tu saldo de inmediato.`

      await sendWhatsAppButtons(
        instanceName,
        senderDigits,
        `Cobranza & Abonos • ${tenant.name}`,
        debtText,
        [
          { id: 'btn_datos_pago', displayText: '🏦 Datos de Pago' },
          { id: 'btn_catalogo', displayText: '🛍️ Ver Catálogo' },
        ]
      )

      return NextResponse.json({ status: 'balance_debt_responded' })
    }

    // B) CONSULTA DE DATOS DE PAGO
    if (isPaymentInfoQuery) {
      const paymentMsg =
        `💳 *Métodos y Cuentas de Pago Oficiales*\n*${tenant.name}*\n\n` +
        `📊 *Tasa Oficial BCV del día:* **Bs. ${exchangeRate.toFixed(4)}/USD**\n\n` +
        `${paymentMethodsFormatted}\n\n` +
        `📎 *Nota:* Puedes realizar pagos completos o abonos parciales. No olvides enviar tu comprobante para validarlo en el sistema.`

      await sendWhatsAppButtons(
        instanceName,
        senderDigits,
        `Cuentas Bancarias • ${tenant.name}`,
        paymentMsg,
        [
          { id: 'btn_saldo', displayText: '💰 Consultar Mi Saldo' },
          { id: 'btn_catalogo', displayText: '🛍️ Ver Catálogo' },
        ]
      )

      return NextResponse.json({ status: 'payment_methods_responded' })
    }

    // C) CONSULTA DE CATÁLOGO
    if (isCatalogQuery) {
      const catalogUrl = `https://system-is.netlify.app/${tenant.slug}`
      const catalogMsg =
        `🛍️ *Catálogo Virtual • ${tenant.name}*\n\n` +
        `Explora todos nuestros productos con disponibilidad en tiempo real y precios actualizados en USD y Bolívares:\n\n` +
        `👉 *${catalogUrl}*\n\n` +
        `¡Arma tu pedido directamente en la vitrina web sin necesidad de escribir la lista a mano!`

      await sendWhatsAppButtons(
        instanceName,
        senderDigits,
        `Vitrina Virtual • ${tenant.name}`,
        catalogMsg,
        [
          { id: 'btn_saldo', displayText: '💰 Consultar Saldo' },
          { id: 'btn_datos_pago', displayText: '🏦 Cuentas de Pago' },
        ]
      )

      return NextResponse.json({ status: 'catalog_responded' })
    }

    // D) MENÚ O BIENVENIDA AUTOMÁTICA
    if (isGreetingOrHelp) {
      const greetingMsg =
        `👋 ¡Hola! Bienvenido a la atención automatizada de *${tenant.name}*.\n\n` +
        `¿En qué podemos ayudarte el día de hoy?\n\n` +
        `1️⃣ Escribe *SALDO* para consultar tu monto pendiente y conversión en Bs.\n` +
        `2️⃣ Escribe *PAGO* para ver los datos bancarios y Pago Móvil.\n` +
        `3️⃣ Escribe *CATALOGO* para ingresar a nuestra tienda virtual.\n\n` +
        `También puedes tocar directamente cualquiera de los botones abajo 👇 o dejar tu mensaje y un asesor te atenderá pronto.`

      await sendWhatsAppButtons(
        instanceName,
        senderDigits,
        `Menú de Opciones • ${tenant.name}`,
        greetingMsg,
        [
          { id: 'btn_saldo', displayText: '💰 Consultar Saldo' },
          { id: 'btn_datos_pago', displayText: '🏦 Cuentas de Pago' },
          { id: 'btn_catalogo', displayText: '🛍️ Ver Catálogo' },
        ]
      )

      return NextResponse.json({ status: 'greeting_responded' })
    }

    return NextResponse.json({ status: 'unhandled' })
  } catch (error: any) {
    console.error('[WhatsAppWebhook] Error handling message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
    const rawRemoteJid: string = key.remoteJid || ''
    if (rawRemoteJid.includes('@g.us') || rawRemoteJid.includes('status@broadcast')) {
      return NextResponse.json({ status: 'ignored_group_or_broadcast' })
    }

    // 3. Prevenir duplicados
    const messageId: string = key.id || ''
    if (messageId && isAlreadyProcessed(messageId)) {
      return NextResponse.json({ status: 'already_processed' })
    }

    // 4. Extraer teléfono del remitente (número limpio en dígitos)
    // En WhatsApp con privacidad/dispositivos vinculados, key.remoteJidAlt contiene el número real (@s.whatsapp.net)
    // mientras que remoteJid puede ser un identificador interno (@lid).
    const realJid = (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net'))
      ? key.remoteJidAlt
      : (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net'))
        ? key.remoteJid
        : (rawData.sender && rawData.sender.includes('@s.whatsapp.net'))
          ? rawData.sender
          : (key.remoteJidAlt || key.remoteJid || '')

    const senderDigits = realJid.replace(/@s\.whatsapp\.net/, '').replace(/@lid/, '').replace(/\D/g, '')
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
      normalized === 'pago' ||
      normalized === 'pagos' ||
      normalized.includes('pago') ||
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
            const payUrl = acc.payment_url || (tenant?.slug === 'innovise' ? 'https://app.binance.com/uni-qr/J1UsGBdp' : '')
            const lines = [`🟡 *Binance Pay (USDT):*`]
            if (payUrl) {
              lines.push(`• 📲 *Pagar con 1 Clic (App/Web):* ${payUrl}`)
            }
            if (acc.email || acc.account_holder) {
              lines.push(`• Pay ID / Email: *${acc.email || acc.account_holder}*`)
            }
            if (acc.instructions) {
              lines.push(`• ℹ️ _${acc.instructions}_`)
            }
            return lines.join('\n')
          }
          return `💳 *${acc.label || 'Método de Pago'}:*\n• ${acc.instructions || ''}`
        })
        .join('\n\n')
    } else {
      paymentMethodsFormatted = `🏦 *Pago Móvil Oficial:*\n• Teléfono: *${tenant.phone_whatsapp || senderDigits}*\n• Banco: *A consultar con administración*`
    }

    // 8. Buscar cliente en la tienda por su número telefónico
    // Obtenemos los clientes del tenant y comparamos eliminando guiones, espacios y códigos de país
    const { data: tenantCustomers } = await supabase
      .from('customers')
      .select('id, full_name, phone, current_debt_usd, is_active')
      .eq('tenant_id', tenant.id)

    const customer = tenantCustomers?.find((c) => {
      if (!c.phone) return false
      const cleanDbPhone = c.phone.replace(/\D/g, '')
      if (!cleanDbPhone || cleanDbPhone.length < 7) return false

      // 1. Coincidencia exacta de dígitos
      if (cleanDbPhone === senderDigits) return true

      // 2. Coincidencia de los últimos 7 a 10 dígitos (ignora si tiene 0424, 58424, etc.)
      const dbLast7 = cleanDbPhone.slice(-7)
      const senderLast7 = senderDigits.slice(-7)
      if (dbLast7 === senderLast7) return true

      const dbLast10 = cleanDbPhone.slice(-10)
      const senderLast10 = senderDigits.slice(-10)
      if (dbLast10.length === 10 && senderLast10.length === 10 && dbLast10 === senderLast10) return true

      return false
    })

    // 9. Ejecutar la respuesta según la intención detectada

    // A) SALUDO / MENSAJE DE BIENVENIDA ("HOLA", "BUENAS", ETC.)
    // La tienda responde únicamente con el catálogo virtual para invitar a comprar
    if (isGreetingOrHelp) {
      const catalogUrl = `https://system-is.netlify.app/${tenant.slug}`
      const greetingMsg =
        `👋 ¡Hola! Bienvenido a *${tenant.name}* ✨\n\n` +
        `Te invitamos a explorar nuestra vitrina virtual con todos nuestros productos disponibles y precios actualizados en USD y Bolívares:\n\n` +
        `👉 *${catalogUrl}*\n\n` +
        `¡Puedes armar tu pedido directamente en línea de forma rápida y sencilla!`

      await sendWhatsAppTextMessage(instanceName, senderDigits, greetingMsg)
      return NextResponse.json({ status: 'greeting_catalog_responded' })
    }

    // B) VALIDACIÓN DE SEGURIDAD: CONSULTA DE SALDO O DATOS DE PAGO
    // Si el cliente NO está registrado en el sistema, NO se le envía información bancaria ni de saldos
    if ((isBalanceQuery || isPaymentInfoQuery) && !customer) {
      const catalogUrl = `https://system-is.netlify.app/${tenant.slug}`
      const unregisteredMsg =
        `👋 ¡Hola! Gracias por comunicarte con *${tenant.name}*.\n\n` +
        `🔒 La consulta de estados de cuenta y cuentas bancarias oficiales está reservada para clientes registrados que hayan realizado al menos una compra en nuestra tienda.\n\n` +
        `🛍️ Si deseas realizar tu primera compra, te invitamos a explorar nuestro catálogo virtual y hacer tu pedido en línea:\n` +
        `👉 *${catalogUrl}*\n\n` +
        `Si ya realizaste una compra previamente y necesitas asistencia con tu cuenta, por favor indícanos tu *Nombre completo* y *Cédula/RIF* y un asesor te atenderá con gusto.`

      await sendWhatsAppTextMessage(instanceName, senderDigits, unregisteredMsg)
      return NextResponse.json({ status: 'unregistered_customer_blocked' })
    }

    // C) CONSULTA DE SALDO O ABONO (CLIENTE REGISTRADO)
    if (isBalanceQuery && customer) {
      const debtUsd = Number(customer.current_debt_usd || 0)

      if (debtUsd <= 0.01) {
        // Cliente AL DÍA
        const alDiaText =
          `🎉 *¡Hola ${customer.full_name}!* ✨\n\n` +
          `Te confirmamos que en *${tenant.name}* te encuentras **completamente al día**.\n\n` +
          `✅ *Saldo pendiente:* **$0.00 USD (Bs. 0,00)**\n\n` +
          `¡Muchas gracias por tu puntualidad y preferencia constante! 🙌\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📌 *Opciones Disponibles:*\n` +
          `• Escribe *CATALOGO* para ver novedades y productos.\n` +
          `• Escribe *PAGOS* para consultar cuentas bancarias.`

        await sendWhatsAppTextMessage(instanceName, senderDigits, alDiaText)
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
        `📎 *Importante:* Al realizar tu abono o pago total, por favor envía la captura o número de referencia por este mismo chat para procesarlo y rebajarlo de tu saldo de inmediato. ¡Muchas gracias!`

      await sendWhatsAppTextMessage(instanceName, senderDigits, debtText)
      return NextResponse.json({ status: 'balance_debt_responded' })
    }

    // D) CONSULTA DE DATOS DE PAGO (CLIENTE REGISTRADO)
    if (isPaymentInfoQuery && customer) {
      const paymentMsg =
        `💳 *Métodos y Cuentas de Pago Oficiales*\n*${tenant.name}*\n\n` +
        `📊 *Tasa Oficial BCV del día:* **Bs. ${exchangeRate.toFixed(4)}/USD**\n\n` +
        `${paymentMethodsFormatted}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📎 *Nota:* Puedes realizar pagos completos o abonos parciales. Envía tu comprobante por este chat para validarlo en el sistema.\n\n` +
        `• Escribe *SALDO* para consultar tu deuda pendiente.`

      await sendWhatsAppTextMessage(instanceName, senderDigits, paymentMsg)
      return NextResponse.json({ status: 'payment_methods_responded' })
    }

    // E) CONSULTA DE CATÁLOGO
    if (isCatalogQuery) {
      const catalogUrl = `https://system-is.netlify.app/${tenant.slug}`
      const catalogMsg =
        `🛍️ *Catálogo Virtual • ${tenant.name}*\n\n` +
        `Explora todos nuestros productos con disponibilidad en tiempo real y precios actualizados en USD y Bolívares:\n\n` +
        `👉 *${catalogUrl}*\n\n` +
        `¡Arma tu pedido directamente en la vitrina web sin necesidad de escribir la lista a mano!` +
        (customer ? `\n\n• Escribe *SALDO* para consultar tu estado de cuenta.` : '')

      await sendWhatsAppTextMessage(instanceName, senderDigits, catalogMsg)
      return NextResponse.json({ status: 'catalog_responded' })
    }

    return NextResponse.json({ status: 'unhandled' })
  } catch (error: any) {
    console.error('[WhatsAppWebhook] Error handling message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

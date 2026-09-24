import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Tenant, Order, Quotation, Customer } from '@/types/database'
import { extractDeliveryInfo, cleanNotesFromDeliveryTag } from '@/lib/delivery'

// ─── Formatters ──────────────────────────────────────────────────────────────
function formatUsd(val: number | string | null | undefined): string {
  const n = Number(val) || 0
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatVes(val: number | string | null | undefined): string {
  const n = Number(val) || 0
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${day}-${month}-${year} ${hour}:${minute}`
  } catch {
    return dateStr
  }
}

function formatCreditDueDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return dateStr
  }
}

async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !imageUrl) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.setAttribute('crossOrigin', 'anonymous')
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 240
        const MAX_HEIGHT = 160
        let width = img.width || 200
        let height = img.height || 100

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Fondo blanco en caso de transparencias en JPEG
          ctx.drawImage(img, 0, 0, width, height)
          // Usar JPEG comprimido al 75% para reducir el peso drásticamente
          const dataURL = canvas.toDataURL('image/jpeg', 0.75)
          resolve(dataURL)
          return
        }
      } catch {
        // Cross-origin canvas security or error
      }
      resolve(null)
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

export interface GenerateOrderPdfOptions {
  action?: 'download' | 'print'
  tenant?: Tenant | null
  order: (Omit<Partial<Order>, 'payment_condition'> & {
    order_number: string
    status: string
    total_usd: number
    total_ves: number
    exchange_rate_at_sale: number
    subtotal_usd?: number
    created_at?: string
    notes?: string | null
    payment_breakdown?: any[]
    payment_condition?: string
  }) & {
    customer?: Partial<Customer> | null
    order_items?: Array<{
      product_name: string
      product_sku?: string | null
      quantity: number
      unit_price_usd: number
      subtotal_usd?: number
    }>
  }
}

export async function buildOrderJsPdfDoc({
  order,
  tenant,
}: {
  order: GenerateOrderPdfOptions['order']
  tenant?: Tenant | null
}): Promise<{ doc: jsPDF; orderNumber: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const logoUrl =
    (settings.imagotype_url as string) ||
    (settings.logo_url as string) ||
    tenant?.logo_url ||
    null

  const exchangeRate = Number(order.exchange_rate_at_sale) || Number(tenant?.currency_rate_bcv) || 91.5
  const storeName = tenant?.name || 'Innovise Store'
  const storePhone = tenant?.phone_whatsapp || ''
  const storeInstagram = (settings.instagram_handle as string) || ''
  const orderNumber = order.order_number || `ORD-${order.id?.slice(0, 8)}`

  // 1. Header Banner & Logo
  let currentY = 16

  if (logoUrl) {
    try {
      const base64Logo = await getBase64ImageFromUrl(logoUrl)
      if (base64Logo) {
        doc.addImage(base64Logo, 'JPEG', 14, currentY, 24, 24, undefined, 'FAST')
      }
    } catch {
      // Fallback without image
    }
  }

  // Store & Doc Info (Right aligned or beside logo)
  const textStartX = logoUrl ? 42 : 14
  const maxStoreNameWidth = 122 - textStartX

  // Dynamic store name font size based on length
  const nameLen = storeName.length
  const storeFontSize = nameLen > 24 ? 12 : nameLen > 18 ? 13.5 : 15.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(storeFontSize)
  doc.setTextColor(30, 41, 59) // slate-800
  const storeNameLines = doc.splitTextToSize(storeName, maxStoreNameWidth)
  doc.text(storeNameLines, textStartX, currentY + 5)
  const storeNameHeight = storeNameLines.length * (storeFontSize * 0.38)

  let contactY = currentY + 5 + storeNameHeight + 1.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139) // slate-500
  let contactLine = ''
  if (storePhone) contactLine += `WhatsApp: +${storePhone.replace(/\D/g, '')}  `
  if (storeInstagram) contactLine += `Instagram: @${storeInstagram.replace('@', '')}`
  let contactHeight = 0
  if (contactLine) {
    const contactLines = doc.splitTextToSize(contactLine, maxStoreNameWidth)
    doc.text(contactLines, textStartX, contactY)
    contactHeight = contactLines.length * 4
  }

  const leftBlockHeight = Math.max(logoUrl ? 26 : 0, (contactY + contactHeight) - currentY)

  // Document Title & Number Badge (Right Side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(37, 99, 235) // blue-600
  doc.text('FACTURA / NOTA DE VENTA', 196, currentY + 4, { align: 'right' })

  doc.setFont('courier', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text(orderNumber, 196, currentY + 9.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Fecha: ${formatDate(order.created_at)}`, 196, currentY + 14.5, { align: 'right' })
  doc.text(`Tasa Oficial BCV: ${formatVes(exchangeRate)}/USD`, 196, currentY + 18.5, { align: 'right' })

  const rightBlockHeight = 22
  currentY += Math.max(leftBlockHeight, rightBlockHeight) + 5

  // Divider line
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.setLineWidth(0.4)
  doc.line(14, currentY, 196, currentY)

  currentY += 6

  // 2. Customer & Condition Block
  const customerName = order.customer?.full_name || 'Cliente Particular / Mostrador'
  const customerIdNumber = order.customer?.id_number ? `CI/RIF: ${order.customer.id_number}` : ''
  const customerPhone = order.customer?.phone ? `Teléfono: ${order.customer.phone}` : ''

  const deliveryInfo = extractDeliveryInfo(order.notes, exchangeRate)
  const deliveryAddress = deliveryInfo.address || order.customer?.address || ''
  const hasDeliveryAddress = Boolean(deliveryAddress && deliveryAddress.trim())
  const custBoxHeight = hasDeliveryAddress ? 26 : 20

  doc.setFillColor(248, 250, 252) // slate-50
  doc.roundedRect(14, currentY, 182, custBoxHeight, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, 182, custBoxHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text('DATOS DEL CLIENTE:', 18, currentY + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(customerName, 18, currentY + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  const custDetails = [customerIdNumber, customerPhone].filter(Boolean).join('   |   ')
  if (custDetails) {
    doc.text(custDetails, 18, currentY + 16)
  }

  if (hasDeliveryAddress) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(37, 99, 235) // blue-600
    const truncatedAddress = deliveryAddress.length > 70 ? deliveryAddress.slice(0, 67) + '...' : deliveryAddress
    doc.text(`Direccion de Entrega: ${truncatedAddress}`, 18, currentY + 21.5)
  }

  // Condition Badge (Contado / Crédito)
  let creditDays = 0
  if (order.due_date && order.created_at) {
    const diffMs = new Date(order.due_date).getTime() - new Date(order.created_at).getTime()
    creditDays = Math.max(1, Math.round(diffMs / 86400000))
  }
  const isCreditOrder = order.payment_condition === 'credit_7d' || order.status === 'credit'
  const conditionText = isCreditOrder
    ? `Condición: Crédito (${creditDays > 0 ? `${creditDays} días` : 'Pendiente'})`
    : 'Condición: De Contado'
  const statusBadge =
    order.status === 'completed'
      ? 'PAGADA'
      : order.status === 'pending'
      ? 'PENDIENTE'
      : order.status.toUpperCase()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(37, 99, 235)
  doc.text(conditionText, 192, currentY + 6.5, { align: 'right' })

  if (isCreditOrder && order.due_date) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 83, 9)
    doc.text(`Vence: ${formatCreditDueDate(order.due_date)}`, 192, currentY + 11.5, { align: 'right' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(order.status === 'completed' ? 16 : 217, order.status === 'completed' ? 185 : 119, order.status === 'completed' ? 129 : 6)
  doc.text(`Estado: ${statusBadge}`, 192, currentY + (isCreditOrder && order.due_date ? 16.5 : 13.5), { align: 'right' })

  currentY += (hasDeliveryAddress ? 32 : 26)

  // 3. Products Table
  const items = order.order_items || []
  const tableRows = items.map((item, idx) => {
    const qty = item.quantity || 1
    const priceUsd = Number(item.unit_price_usd) || 0
    const lineUsd = item.subtotal_usd ?? qty * priceUsd
    const lineVes = lineUsd * exchangeRate

    return [
      idx + 1,
      `${item.product_name}${item.product_sku ? ` (${item.product_sku})` : ''}`,
      qty,
      formatUsd(priceUsd),
      formatUsd(lineUsd),
      formatVes(lineVes),
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Producto / Descripción', 'Cant.', 'Precio USD', 'Total USD', 'Total Bs. (BCV)']],
    body: tableRows,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // Blue-600
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = ((doc as any).lastAutoTable?.finalY ?? currentY + 40) + 8

  // 4. Totals & Payment Summary (Bottom Right Box)
  const summaryBoxWidth = 84
  const summaryBoxX = 196 - summaryBoxWidth
  const hasDeliveryFee = deliveryInfo.hasDelivery && deliveryInfo.amountUsd > 0
  const summaryBoxHeight = hasDeliveryFee ? 36 : 28

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, summaryBoxHeight, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, summaryBoxHeight, 2, 2, 'S')

  const totalUsd = Number(order.total_usd) || 0
  const totalVes = Number(order.total_ves) || totalUsd * exchangeRate
  const productsSubtotalUsd = (order.subtotal_usd !== undefined && Number(order.subtotal_usd) > 0)
    ? Number(order.subtotal_usd)
    : (hasDeliveryFee ? Math.max(0, totalUsd - deliveryInfo.amountUsd) : totalUsd)

  if (hasDeliveryFee) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Subtotal Productos:', summaryBoxX + 6, finalY + 6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(formatUsd(productsSubtotalUsd), 190, finalY + 6.5, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('Servicio de Delivery:', summaryBoxX + 6, finalY + 13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 99, 235)
    doc.text(formatUsd(deliveryInfo.amountUsd), 190, finalY + 13, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(37, 99, 235)
    doc.text('TOTAL FACTURADO:', summaryBoxX + 6, finalY + 22)
    doc.text(formatUsd(totalUsd), 190, finalY + 22, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text(`Total en Bolívares:`, summaryBoxX + 6, finalY + 30)
    doc.text(formatVes(totalVes), 190, finalY + 30, { align: 'right' })
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Subtotal:', summaryBoxX + 6, finalY + 7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(formatUsd(totalUsd), 190, finalY + 7, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(37, 99, 235)
    doc.text('TOTAL FACTURADO:', summaryBoxX + 6, finalY + 16)
    doc.text(formatUsd(totalUsd), 190, finalY + 16, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text(`Total en Bolívares:`, summaryBoxX + 6, finalY + 23)
    doc.text(formatVes(totalVes), 190, finalY + 23, { align: 'right' })
  }

  // Payment Breakdown (Bottom Left Box if available)
  const payments = Array.isArray(order.payment_breakdown) ? order.payment_breakdown : []
  if (payments.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    doc.text('MÉTODOS DE PAGO:', 14, finalY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    let pY = finalY + 12

    payments.forEach((p: any) => {
      const methodLabel =
        p.method === 'binance_pay'
          ? 'Binance Pay (USDT)'
          : p.method === 'pago_movil'
          ? 'Pago Móvil'
          : p.method === 'zelle'
          ? 'Zelle (USD)'
          : p.method === 'cash_usd'
          ? 'Efectivo (USD)'
          : p.method === 'cash_ves'
          ? 'Efectivo (VES)'
          : p.method === 'transfer_ves'
          ? 'Transferencia Bancaria'
          : p.method === 'credit_7d'
          ? 'Crédito Otorgado'
          : p.method || 'Pago'
      const refStr = p.reference ? ` [Ref: ${p.reference}]` : ''
      const amountStr = p.amount_ves ? `Bs. ${Number(p.amount_ves).toFixed(2)}` : `$${Number(p.amount_usd).toFixed(2)} USD`
      doc.text(`• ${methodLabel}: ${amountStr}${refStr}`, 14, pY)
      pY += 5
    })
  }

  // 5. Notes / Footer Note
  const cleanedNotes = cleanNotesFromDeliveryTag(order.notes)
  if (cleanedNotes && cleanedNotes.trim()) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    const noteLines = doc.splitTextToSize(`Nota: ${cleanedNotes.trim()}`, 182)
    doc.text(noteLines.slice(0, 2), 14, 268)
  }

  const footerY = 278
  doc.setDrawColor(226, 232, 240)
  doc.line(14, footerY - 6, 196, footerY - 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Documento digital generado por ${storeName} a través de la plataforma comercial Innovise Store.`,
    105,
    footerY - 1,
    { align: 'center' }
  )
  doc.text('¡Gracias por su compra y preferencia!', 105, footerY + 3, { align: 'center' })

  return { doc, orderNumber }
}

export async function generateOrderPdf({
  order,
  tenant,
  action = 'download',
}: GenerateOrderPdfOptions): Promise<void> {
  const { doc, orderNumber } = await buildOrderJsPdfDoc({ order, tenant })

  if (action === 'print') {
    doc.autoPrint()
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  } else {
    doc.save(`Factura_${orderNumber}.pdf`)
  }
}

export async function getOrderPdfBase64({
  order,
  tenant,
}: {
  order: GenerateOrderPdfOptions['order']
  tenant?: Tenant | null
}): Promise<{ base64: string; fileName: string }> {
  const { doc, orderNumber } = await buildOrderJsPdfDoc({ order, tenant })
  const dataUri = doc.output('datauristring')
  const base64 = dataUri.includes(';base64,')
    ? dataUri.split(';base64,')[1].trim()
    : dataUri.replace(/^data:[^,]+,/, '').trim()

  return {
    base64,
    fileName: `Factura_${orderNumber}.pdf`,
  }
}

// ─── Cotización / Presupuesto PDF ─────────────────────────────────────────────
export interface GenerateQuotationPdfOptions {
  action?: 'download' | 'print'
  tenant?: Tenant | null
  quotation: Quotation
  showVesPrices?: boolean
}

export async function buildQuotationJsPdfDoc({
  quotation,
  tenant,
  showVesPrices,
}: {
  quotation: Quotation
  tenant?: Tenant | null
  showVesPrices?: boolean
}): Promise<{ doc: jsPDF; quoteNumber: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const shouldShowVes =
    typeof showVesPrices === 'boolean'
      ? showVesPrices
      : !quotation.notes?.includes('SHOW_VES:false')

  const cleanNotes = (quotation.notes || '')
    .replace(/<!--SHOW_VES:[^>]+-->/gi, '')
    .replace(/<!--[^>]+-->/g, '')
    .replace(/\(?Cliente Ref:\s*[a-f0-9-]+\)?/gi, '')
    .trim()

  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const logoUrl =
    (settings.imagotype_url as string) ||
    (settings.logo_url as string) ||
    tenant?.logo_url ||
    null

  const exchangeRate = Number(quotation.exchange_rate) || Number(tenant?.currency_rate_bcv) || 91.5
  const storeName = tenant?.name || 'Innovise Store'
  const storePhone = tenant?.phone_whatsapp || ''
  const storeInstagram = (settings.instagram_handle as string) || ''
  const quoteNumber = quotation.quotation_number || `COT-${quotation.id?.slice(0, 8)}`

  // 1. Header Banner & Logo
  let currentY = 16

  if (logoUrl) {
    try {
      const base64Logo = await getBase64ImageFromUrl(logoUrl)
      if (base64Logo) {
        doc.addImage(base64Logo, 'JPEG', 14, currentY, 24, 24, undefined, 'FAST')
      }
    } catch {
      // Fallback
    }
  }

  // Store & Doc Info (Dynamic spacing so long store names do not collide)
  const textStartX = logoUrl ? 42 : 14
  const maxStoreNameWidth = 120 - textStartX

  // Dynamic store name font size based on length
  const nameLen = storeName.length
  const storeFontSize = nameLen > 24 ? 12 : nameLen > 18 ? 13.5 : 15.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(storeFontSize)
  doc.setTextColor(30, 41, 59)
  const storeNameLines = doc.splitTextToSize(storeName, maxStoreNameWidth)
  doc.text(storeNameLines, textStartX, currentY + 5)
  const storeNameHeight = storeNameLines.length * (storeFontSize * 0.38)

  let contactY = currentY + 5 + storeNameHeight + 1.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  let contactLine = ''
  if (storePhone) contactLine += `WhatsApp: +${storePhone.replace(/\D/g, '')}  `
  if (storeInstagram) contactLine += `Instagram: @${storeInstagram.replace('@', '')}`
  let contactHeight = 0
  if (contactLine) {
    const contactLines = doc.splitTextToSize(contactLine, maxStoreNameWidth)
    doc.text(contactLines, textStartX, contactY)
    contactHeight = contactLines.length * 4
  }

  const leftBlockHeight = Math.max(logoUrl ? 26 : 0, (contactY + contactHeight) - currentY)

  // Document Title & Number Badge (Right Side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(16, 185, 129) // emerald-600
  doc.text('COTIZACIÓN / PRESUPUESTO', 196, currentY + 4, { align: 'right' })

  doc.setFont('courier', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(15, 23, 42)
  doc.text(quoteNumber, 196, currentY + 9.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  let rightY = currentY + 14.5
  doc.text(`Fecha: ${formatDate(quotation.created_at)}`, 196, rightY, { align: 'right' })
  if (quotation.valid_until) {
    rightY += 4
    doc.text(`Válido hasta: ${formatDate(quotation.valid_until)}`, 196, rightY, { align: 'right' })
  }
  if (shouldShowVes) {
    rightY += 4
    doc.text(`Tasa Oficial BCV: ${formatVes(exchangeRate)}/USD`, 196, rightY, { align: 'right' })
  }

  const rightBlockHeight = rightY - currentY + 2
  currentY += Math.max(leftBlockHeight, rightBlockHeight) + 5

  // Divider line
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(14, currentY, 196, currentY)

  currentY += 6

  // 2. Customer Block
  const customerName = quotation.customer_name || 'Cliente Solicitante'
  const customerIdNumber = quotation.customer_id_number ? `CI/RIF: ${quotation.customer_id_number}` : ''
  const customerPhone = quotation.customer_phone ? `Teléfono: ${quotation.customer_phone}` : ''
  const customerEmail = quotation.customer_email ? `Email: ${quotation.customer_email}` : ''

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, currentY, 182, 19, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, 182, 19, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text('PRESUPUESTO PREPARADO PARA:', 18, currentY + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(customerName, 18, currentY + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  const custDetails = [customerIdNumber, customerPhone, customerEmail].filter(Boolean).join('   |   ')
  if (custDetails) {
    doc.text(custDetails, 18, currentY + 15.5)
  }

  currentY += 25

  // 3. Products Table
  const items = quotation.items || []
  const tableRows = items.map((item, idx) => {
    const qty = item.quantity || 1
    const priceUsd = Number(item.unit_price_usd) || 0
    const lineUsd = item.subtotal_usd ?? qty * priceUsd
    const lineVes = lineUsd * exchangeRate

    const prodName = (item.name || 'Producto').trim()
    const prodSku = item.sku ? ` [SKU: ${item.sku}]` : ''
    const prodDesc = (item.description && typeof item.description === 'string' && item.description.trim())
      ? item.description.trim()
      : ''

    const fullProductCell = prodDesc
      ? `${prodName}${prodSku}\n${prodDesc}`
      : `${prodName}${prodSku}`

    if (shouldShowVes) {
      return [
        idx + 1,
        fullProductCell,
        qty,
        formatUsd(priceUsd),
        formatUsd(lineUsd),
        formatVes(lineVes),
      ]
    } else {
      return [
        idx + 1,
        fullProductCell,
        qty,
        formatUsd(priceUsd),
        formatUsd(lineUsd),
      ]
    }
  })

  const tableHead = shouldShowVes
    ? [['#', 'Descripción del Producto', 'Cant.', 'Precio USD', 'Subtotal USD', 'Subtotal Bs. (BCV)']]
    : [['#', 'Descripción del Producto', 'Cant.', 'Precio USD', 'Subtotal USD']]

  const tableColumnStyles: Record<number, any> = shouldShowVes
    ? {
        0: { cellWidth: 8, halign: 'center', valign: 'top' },
        1: { cellWidth: 'auto', valign: 'top' },
        2: { cellWidth: 14, halign: 'center', valign: 'top' },
        3: { cellWidth: 23, halign: 'right', valign: 'top' },
        4: { cellWidth: 25, halign: 'right', fontStyle: 'bold', valign: 'top' },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold', valign: 'top' },
      }
    : {
        0: { cellWidth: 8, halign: 'center', valign: 'top' },
        1: { cellWidth: 'auto', valign: 'top' },
        2: { cellWidth: 16, halign: 'center', valign: 'top' },
        3: { cellWidth: 28, halign: 'right', valign: 'top' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold', valign: 'top' },
      }

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableRows,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    styles: {
      overflow: 'linebreak',
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [16, 185, 129], // Emerald-600
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: tableColumnStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.cellPadding = { top: 2.5, bottom: 2.5, left: 3, right: 3 }
      }
    },
  })

  let finalY = ((doc as any).lastAutoTable?.finalY ?? currentY + 40) + 8

  // Si la tabla ocupó gran parte de la página, pasar caja de totales a la siguiente página
  if (finalY + 34 > 270) {
    doc.addPage()
    finalY = 20
  }

  // 4. Totals Summary Box
  const summaryBoxWidth = shouldShowVes ? 84 : 76
  const summaryBoxHeight = shouldShowVes ? 26 : 18
  const summaryBoxX = 196 - summaryBoxWidth

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, summaryBoxHeight, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, summaryBoxHeight, 2, 2, 'S')

  const totalUsd = Number(quotation.total_usd) || 0
  const totalVes = Number(quotation.total_ves) || totalUsd * exchangeRate

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(16, 185, 129)
  doc.text('TOTAL ESTIMADO:', summaryBoxX + 6, finalY + (shouldShowVes ? 10 : 11))
  doc.text(formatUsd(totalUsd), 190, finalY + (shouldShowVes ? 10 : 11), { align: 'right' })

  if (shouldShowVes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text('Total en Bolívares:', summaryBoxX + 6, finalY + 18)
    doc.text(formatVes(totalVes), 190, finalY + 18, { align: 'right' })
  }

  // Notes left box (cleaned from technical UUIDs and tags)
  if (cleanNotes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    doc.text('NOTAS Y CONDICIONES:', 14, finalY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    const noteLines = doc.splitTextToSize(cleanNotes, summaryBoxX - 20)
    doc.text(noteLines.slice(0, 3), 14, finalY + 11)
  }

  // 5. Footer Note
  const footerY = 278
  doc.setDrawColor(226, 232, 240)
  doc.line(14, footerY - 6, 196, footerY - 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  const footerText = shouldShowVes
    ? `Cotización formal emitida por ${storeName}. Precios sujetos a disponibilidad y tasa oficial BCV del día.`
    : `Cotización formal emitida por ${storeName}. Precios expresados en Dólares Americanos (USD) sujetos a disponibilidad.`
  doc.text(footerText, 105, footerY - 1, { align: 'center' })
  doc.text('¡Estamos a su entera disposición para cualquier consulta!', 105, footerY + 3, { align: 'center' })

  return { doc, quoteNumber }
}

export async function generateQuotationPdf({
  quotation,
  tenant,
  action = 'download',
  showVesPrices,
}: GenerateQuotationPdfOptions): Promise<void> {
  const { doc, quoteNumber } = await buildQuotationJsPdfDoc({ quotation, tenant, showVesPrices })
  if (action === 'print') {
    doc.autoPrint()
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  } else {
    doc.save(`Cotizacion_${quoteNumber}.pdf`)
  }
}

export async function getQuotationPdfBase64({
  quotation,
  tenant,
  showVesPrices,
}: {
  quotation: Quotation
  tenant?: Tenant | null
  showVesPrices?: boolean
}): Promise<{ base64: string; fileName: string }> {
  const { doc, quoteNumber } = await buildQuotationJsPdfDoc({ quotation, tenant, showVesPrices })
  const dataUri = doc.output('datauristring')
  const base64 = dataUri.includes(';base64,')
    ? dataUri.split(';base64,')[1].trim()
    : dataUri.replace(/^data:[^,]+,/, '').trim()

  return {
    base64,
    fileName: `Cotizacion_${quoteNumber}.pdf`,
  }
}

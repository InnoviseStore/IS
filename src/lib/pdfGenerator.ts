import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Tenant, Order, Quotation, Customer } from '@/types/database'

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
  if (!dateStr) return new Date().toLocaleDateString('es-VE')
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const dataURL = canvas.toDataURL('image/png')
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

export async function generateOrderPdf({
  order,
  tenant,
  action = 'download',
}: GenerateOrderPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
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
        doc.addImage(base64Logo, 'PNG', 14, currentY, 24, 24)
      }
    } catch {
      // Fallback without image
    }
  }

  // Store & Doc Info (Right aligned or beside logo)
  const textStartX = logoUrl ? 42 : 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 41, 59) // slate-800
  doc.text(storeName, textStartX, currentY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139) // slate-500
  let contactLine = ''
  if (storePhone) contactLine += `WhatsApp: +${storePhone.replace(/\D/g, '')}  `
  if (storeInstagram) contactLine += `Instagram: @${storeInstagram.replace('@', '')}`
  if (contactLine) {
    doc.text(contactLine, textStartX, currentY + 12)
  }

  // Document Title & Number Badge (Right Side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(37, 99, 235) // blue-600
  doc.text('FACTURA / NOTA DE VENTA', 196, currentY + 5, { align: 'right' })

  doc.setFont('courier', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text(orderNumber, 196, currentY + 11, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Fecha: ${formatDate(order.created_at)}`, 196, currentY + 16, { align: 'right' })
  doc.text(`Tasa Oficial BCV: ${formatVes(exchangeRate)}/USD`, 196, currentY + 20, { align: 'right' })

  currentY += 28

  // Divider line
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.setLineWidth(0.4)
  doc.line(14, currentY, 196, currentY)

  currentY += 6

  // 2. Customer & Condition Block
  const customerName = order.customer?.full_name || 'Cliente Particular / Mostrador'
  const customerIdNumber = order.customer?.id_number ? `CI/RIF: ${order.customer.id_number}` : ''
  const customerPhone = order.customer?.phone ? `Teléfono: ${order.customer.phone}` : ''

  doc.setFillColor(248, 250, 252) // slate-50
  doc.roundedRect(14, currentY, 182, 20, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, 182, 20, 2, 2, 'S')

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

  // Condition Badge (Contado / Crédito)
  const conditionText =
    order.payment_condition === 'credit_7d'
      ? 'Condición: Crédito'
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
  doc.text(conditionText, 192, currentY + 7.5, { align: 'right' })

  doc.setTextColor(order.status === 'completed' ? 16 : 217, order.status === 'completed' ? 185 : 119, order.status === 'completed' ? 129 : 6)
  doc.text(`Estado: ${statusBadge}`, 192, currentY + 13.5, { align: 'right' })

  currentY += 26

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

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 28, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 28, 2, 2, 'S')

  const totalUsd = Number(order.total_usd) || 0
  const totalVes = Number(order.total_ves) || totalUsd * exchangeRate

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
        p.method === 'pago_movil'
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

  // Output
  if (action === 'print') {
    doc.autoPrint()
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  } else {
    doc.save(`Factura_${orderNumber}.pdf`)
  }
}

// ─── Cotización / Presupuesto PDF ─────────────────────────────────────────────
export interface GenerateQuotationPdfOptions {
  action?: 'download' | 'print'
  tenant?: Tenant | null
  quotation: Quotation
}

export async function generateQuotationPdf({
  quotation,
  tenant,
  action = 'download',
}: GenerateQuotationPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

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
        doc.addImage(base64Logo, 'PNG', 14, currentY, 24, 24)
      }
    } catch {
      // Fallback
    }
  }

  const textStartX = logoUrl ? 42 : 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 41, 59)
  doc.text(storeName, textStartX, currentY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  let contactLine = ''
  if (storePhone) contactLine += `WhatsApp: +${storePhone.replace(/\D/g, '')}  `
  if (storeInstagram) contactLine += `Instagram: @${storeInstagram.replace('@', '')}`
  if (contactLine) {
    doc.text(contactLine, textStartX, currentY + 12)
  }

  // Document Title & Number Badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(16, 185, 129) // emerald-600
  doc.text('COTIZACIÓN / PRESUPUESTO', 196, currentY + 5, { align: 'right' })

  doc.setFont('courier', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(quoteNumber, 196, currentY + 11, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Fecha: ${formatDate(quotation.created_at)}`, 196, currentY + 16, { align: 'right' })
  if (quotation.valid_until) {
    doc.text(`Válido hasta: ${formatDate(quotation.valid_until)}`, 196, currentY + 20, { align: 'right' })
  }
  doc.text(`Tasa Oficial BCV: ${formatVes(exchangeRate)}/USD`, 196, currentY + 24, { align: 'right' })

  currentY += 30

  // Divider line
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(14, currentY, 196, currentY)

  currentY += 6

  // 2. Customer Block
  const customerName = quotation.customer_name || 'Cliente Solicitante'
  const customerPhone = quotation.customer_phone ? `Teléfono: ${quotation.customer_phone}` : ''
  const customerEmail = quotation.customer_email ? `Email: ${quotation.customer_email}` : ''

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, currentY, 182, 18, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, 182, 18, 2, 2, 'S')

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
  const custDetails = [customerPhone, customerEmail].filter(Boolean).join('   |   ')
  if (custDetails) {
    doc.text(custDetails, 18, currentY + 15)
  }

  currentY += 24

  // 3. Products Table
  const items = quotation.items || []
  const tableRows = items.map((item, idx) => {
    const qty = item.quantity || 1
    const priceUsd = Number(item.unit_price_usd) || 0
    const lineUsd = item.subtotal_usd ?? qty * priceUsd
    const lineVes = lineUsd * exchangeRate

    return [
      idx + 1,
      item.name || 'Producto',
      qty,
      formatUsd(priceUsd),
      formatUsd(lineUsd),
      formatVes(lineVes),
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Descripción del Producto', 'Cant.', 'Precio USD', 'Subtotal USD', 'Subtotal Bs. (BCV)']],
    body: tableRows,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    headStyles: {
      fillColor: [16, 185, 129], // Emerald-600
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

  // 4. Totals Summary Box
  const summaryBoxWidth = 84
  const summaryBoxX = 196 - summaryBoxWidth

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 26, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 26, 2, 2, 'S')

  const totalUsd = Number(quotation.total_usd) || 0
  const totalVes = Number(quotation.total_ves) || totalUsd * exchangeRate

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(16, 185, 129)
  doc.text('TOTAL ESTIMADO:', summaryBoxX + 6, finalY + 10)
  doc.text(formatUsd(totalUsd), 190, finalY + 10, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text('Total en Bolívares:', summaryBoxX + 6, finalY + 18)
  doc.text(formatVes(totalVes), 190, finalY + 18, { align: 'right' })

  // Notes left box
  if (quotation.notes && quotation.notes.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    doc.text('NOTAS Y CONDICIONES:', 14, finalY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(quotation.notes.trim(), 14, finalY + 12, { maxWidth: 90 })
  }

  // 5. Footer Note
  const footerY = 278
  doc.setDrawColor(226, 232, 240)
  doc.line(14, footerY - 6, 196, footerY - 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Cotización formal emitida por ${storeName}. Precios sujetos a disponibilidad y tasa oficial BCV del día.`,
    105,
    footerY - 1,
    { align: 'center' }
  )
  doc.text('¡Estamos a su entera disposición para cualquier consulta!', 105, footerY + 3, { align: 'center' })

  // Output
  if (action === 'print') {
    doc.autoPrint()
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  } else {
    doc.save(`Cotizacion_${quoteNumber}.pdf`)
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  unit_price_usd: number;
  quantity: number;
  image_url?: string | null;
}

export type DeliveryMethod = 'delivery_bqto' | 'envio_nacional' | 'retiro_sitio';
export type ShippingAgency = 'Zoom' | 'Tealca' | 'MRW';

export interface CustomerInfo {
  fullName: string;
  phone: string;
  idNumber?: string;
  address?: string;
  notes?: string;
  orderNumber?: string;
  deliveryMethod?: DeliveryMethod;
  deliveryCoords?: { lat: number; lng: number };
  shippingAgency?: ShippingAgency;
  agencyAddress?: string;
}

export interface WhatsAppConfig {
  phone: string;
  storeName: string;
}

export interface WhatsAppOrderPayload {
  items: CartItem[];
  customer: CustomerInfo;
  totalUsd: number;
  totalVes: number;
  exchangeRate: number;
  config: WhatsAppConfig;
  discountTotalUsd?: number;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/** Format a number as Venezuelan Bolívares with dot-thousands, comma-decimal */
function formatVes(amount: number): string {
  return amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a USD amount with 2 decimal places */
function formatUsd(amount: number): string {
  return amount.toFixed(2);
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Generates a structured WhatsApp order message in Spanish.
 */
export function generateWhatsAppMessage(
  items: CartItem[],
  customer: CustomerInfo,
  totalUsd: number,
  totalVes: number,
  exchangeRate: number,
  storeName: string,
  discountTotalUsd?: number,
): string {
  const lines: string[] = [];

  // Header
  if (customer.orderNumber) {
    lines.push(`🛒 *Nuevo Pedido #${customer.orderNumber} - ${storeName}*`);
  } else {
    lines.push(`🛒 *Nuevo Pedido - ${storeName}*`);
  }
  lines.push('');

  // Order identifier if available
  if (customer.orderNumber) {
    lines.push(`🔖 *N° de Orden:* #${customer.orderNumber}`);
  }

  // Customer info
  lines.push(`👤 *Cliente:* ${customer.fullName}`);
  if (customer.idNumber && customer.idNumber.trim().length > 0) {
    lines.push(`🆔 *Cédula / RIF:* ${customer.idNumber.trim()}`);
  }
  lines.push(`📱 *WhatsApp:* ${customer.phone}`);

  // Método y datos de Entrega
  if (customer.deliveryMethod === 'delivery_bqto') {
    lines.push(`🛵 *Método de Entrega:* Delivery en Barquisimeto`);
    if (customer.address && customer.address.trim().length > 0) {
      lines.push(`📍 *Dirección exacta:* ${customer.address.trim()}`);
    }
    if (customer.deliveryCoords) {
      lines.push(`🗺️ *Ubicación GPS:* https://maps.google.com/?q=${customer.deliveryCoords.lat},${customer.deliveryCoords.lng}`);
    }
  } else if (customer.deliveryMethod === 'envio_nacional') {
    lines.push(`📦 *Método de Entrega:* Envío Nacional (Cobro a Destino)`);
    if (customer.shippingAgency) {
      lines.push(`🏢 *Agencia de Envío:* ${customer.shippingAgency}`);
    }
    if (customer.agencyAddress && customer.agencyAddress.trim().length > 0) {
      lines.push(`📍 *Dirección de Agencia:* ${customer.agencyAddress.trim()}`);
    }
  } else if (customer.deliveryMethod === 'retiro_sitio') {
    lines.push(`🏪 *Método de Entrega:* Retiro en Sitio (Acordar con el vendedor)`);
  } else if (customer.address && customer.address.trim().length > 0) {
    lines.push(`📍 *Dirección de Entrega:* ${customer.address.trim()}`);
  }
  lines.push('');

  // Order detail
  lines.push('📦 *Detalle del Pedido:*');
  for (const item of items) {
    const subtotalUsd = item.unit_price_usd * item.quantity;
    const subtotalVes = subtotalUsd * exchangeRate;
    lines.push(
      `• ${item.quantity}x ${item.name} — $${formatUsd(subtotalUsd)} USD | Bs. ${formatVes(subtotalVes)}`,
    );
  }
  lines.push('');

  // Descuento si aplica
  if (discountTotalUsd && discountTotalUsd > 0) {
    lines.push(`🎉 *Descuento Especial:* -$${formatUsd(discountTotalUsd)} USD`);
  }

  // Totals
  lines.push(
    `💰 *Total a Pagar: $${formatUsd(totalUsd)} USD | Bs. ${formatVes(totalVes)}*`,
  );
  lines.push(`📊 Tasa BCV aplicada: Bs. ${formatVes(exchangeRate)}/USD`);

  // Advertencia de abonos con tasa BCV del día
  lines.push('');
  lines.push(`💡 *Nota de Pago / Abonos:* Si realizas un abono o pago parcial en Bolívares, este se calcula a la *tasa oficial del BCV del día* en que efectúes el abono.`);

  // Optional notes
  if (customer.notes && customer.notes.trim().length > 0) {
    lines.push('');
    lines.push(`📝 *Notas / Indicaciones:* ${customer.notes.trim()}`);
  }

  lines.push('');
  lines.push(`_Pedido registrado en la plataforma ${storeName}_`);

  return lines.join('\n');
}

/**
 * Encodes a WhatsApp message into a wa.me deep-link URL.
 * @param phone  - E.164 digits only, e.g. "584121234567"
 * @param message - Plain text message to pre-fill
 */
export function createWhatsAppUrl(phone: string, message: string): string {
  // Strip any non-digit characters from phone
  const cleanPhone = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * Convenience wrapper — builds message + URL from a single payload object.
 */
export function buildWhatsAppCheckoutUrl(payload: WhatsAppOrderPayload): string {
  const message = generateWhatsAppMessage(
    payload.items,
    payload.customer,
    payload.totalUsd,
    payload.totalVes,
    payload.exchangeRate,
    payload.config.storeName,
    payload.discountTotalUsd,
  );
  return createWhatsAppUrl(payload.config.phone, message);
}

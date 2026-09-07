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

export interface CustomerInfo {
  fullName: string;
  phone: string;
  notes?: string;
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
): string {
  const lines: string[] = [];

  // Header
  lines.push(`🛒 *Nuevo Pedido - ${storeName}*`);
  lines.push('');

  // Customer info
  lines.push(`👤 Cliente: ${customer.fullName}`);
  lines.push(`📱 Teléfono: ${customer.phone}`);
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

  // Totals
  lines.push(
    `💰 *Total: $${formatUsd(totalUsd)} USD | Bs. ${formatVes(totalVes)}*`,
  );
  lines.push(`📊 Tasa BCV aplicada: Bs. ${formatVes(exchangeRate)}/USD`);

  // Optional notes
  if (customer.notes && customer.notes.trim().length > 0) {
    lines.push('');
    lines.push(`📝 Notas: ${customer.notes.trim()}`);
  }

  lines.push('');
  lines.push(`_Mensaje generado desde ${storeName}_`);

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
  );
  return createWhatsAppUrl(payload.config.phone, message);
}

// ─── Payment Methods & Credit Plans ───────────────────────────────────────────
export type PaymentMethodType =
  | 'zelle'
  | 'pago_movil'
  | 'cash_usd'
  | 'cash_ves'
  | 'transfer_ves'
  | 'debit_ves'
  | 'credit_7d'
  | 'binance_pay'

export type CreditPlanFrequency = 'semanal' | 'quincenal' | 'mensual' | 'custom_days'

export interface InstallmentScheduleItem {
  installment_number: number
  due_date: string // ISO string
  amount_usd: number
  amount_ves: number
  status: 'pending' | 'paid'
}

export interface InstallmentsPlan {
  mode?: 'single_due' | 'installments'
  type?: 'single_due' | 'installments'
  frequency: CreditPlanFrequency
  frequency_days: number
  total_installments: number
  installments_count?: number
  down_payment_usd?: number
  financed_amount_usd?: number
  installment_amount_usd?: number
  amount_per_installment_usd?: number
  schedule: InstallmentScheduleItem[]
}

export interface PaymentMethod {
  method: PaymentMethodType
  amount_usd: number
  amount_ves: number
  reference?: string
  igtf_amount?: number // IGTF (3%) aplicado a pagos en divisas cuando el comercio es agente especial
  installments_plan?: InstallmentsPlan
}

// ─── Storefront Checkout & Payment Accounts ─────────────────────────────────
export type StorefrontPaymentType = 'pago_movil' | 'transferencia' | 'zelle' | 'binance_pay'

export type CheckoutMode = 'whatsapp_only' | 'direct_payment'

export interface StorefrontPaymentAccount {
  id: string
  method: StorefrontPaymentType
  enabled: boolean
  label: string
  bank_name?: string
  account_holder?: string
  id_number?: string
  phone?: string
  account_number?: string
  email?: string
  qr_image_url?: string
  instructions?: string
}

// ─── WhatsApp Automation (Enterprise) ────────────────────────────────────────
export interface WhatsAppAutomationSettings {
  enabled: boolean
  instance_name: string
  status: 'disconnected' | 'connecting' | 'connected'
  auto_send_invoice: boolean
  auto_send_abono: boolean
  auto_send_web_order: boolean
  auto_send_credit_reminders: boolean
  connected_phone?: string | null
  last_connected_at?: string | null
}

// ─── Tenant ────────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string
  name: string
  slug: string
  phone_whatsapp: string | null
  logo_url: string | null
  currency_rate_bcv: number
  is_active?: boolean
  plan?: 'basic' | 'pro' | 'enterprise'
  custom_domain?: string | null
  settings: Record<string, unknown> | null
  created_at: string
}

export interface BcvRateHistoryItem {
  date: string // YYYY-MM-DD
  rate: number
  fecha_valor?: string
  label?: string
  source?: 'bcv_sync' | 'manual'
  updated_at?: string
}


// ─── Profile & Team Roles ──────────────────────────────────────────────────
export type UserRole =
  | 'superadmin'
  | 'owner'
  | 'admin'
  | 'cashier'
  | 'cajero'
  | 'almacen'
  | 'vendedor'

export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  email: string | null
  role: UserRole
  created_at: string
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'superadmin':
      return 'Super Administrador (SaaS Global)'
    case 'owner':
      return 'Usuario Admin'
    case 'admin':
      return 'Administrador de Tienda'
    case 'cashier':
    case 'cajero':
      return 'Cajero / Facturación'
    case 'almacen':
      return 'Almacén / Logística'
    case 'vendedor':
      return 'Vendedor / Asesor'
    default:
      return role || 'Colaborador'
  }
}

// ─── Product ──────────────────────────────────────────────────────────────────
export interface Product {
  id: string
  tenant_id: string
  sku: string | null
  name: string
  description: string | null
  base_price_usd: number
  cost_usd: number | null
  stock: number
  is_active: boolean
  image_url: string | null
  images?: string[] | null
  created_at: string
  updated_at: string
}

export interface ColorVariantItem {
  name: string
  hex?: string
  image_url?: string
  stock?: number
}

// ─── Inventory Log ────────────────────────────────────────────────────────────
export interface InventoryLog {
  id: string
  tenant_id: string
  product_id: string
  change_type: 'sale' | 'purchase' | 'adjustment' | 'return'
  quantity: number
  previous_stock: number
  new_stock: number
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: string
  tenant_id: string
  full_name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  credit_limit_usd: number
  current_debt_usd: number
  is_active: boolean
  notes: string | null
  created_at: string
}

// ─── Order ────────────────────────────────────────────────────────────────────
export interface Order {
  id: string
  tenant_id: string
  customer_id: string | null
  order_number: string
  status: 'pending' | 'completed' | 'cancelled' | 'credit'
  payment_condition: 'immediate' | 'credit_7d'
  exchange_rate_at_sale: number
  subtotal_usd: number
  igtf_total: number   // Total IGTF cobrado en esta venta (0 si no aplica)
  total_usd: number
  total_ves: number
  payment_breakdown: PaymentMethod[]
  due_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderRecord = Order

// ─── Order Item ───────────────────────────────────────────────────────────────
export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  tenant_id: string
  product_name: string
  product_sku: string | null
  unit_price_usd: number
  quantity: number
  subtotal_usd: number
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  product_id: string
  name: string
  sku: string | null
  unit_price_usd: number
  quantity: number
  image_url: string | null
  discount_percent?: number
  discount_usd?: number
}

// ─── Supabase Database Types ───────────────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: Omit<Tenant, 'id' | 'created_at'>
        Update: Partial<Omit<Tenant, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at'>>
      }
      inventory_logs: {
        Row: InventoryLog
        Insert: Omit<InventoryLog, 'id' | 'created_at'>
        Update: never
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at'>
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Order, 'id' | 'created_at'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id'>
        Update: never
      }
      cash_closings: {
        Row: CashClosing
        Insert: Omit<CashClosing, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CashClosing, 'id' | 'created_at'>>
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>
      }
      quotations: {
        Row: Quotation
        Insert: Omit<Quotation, 'id' | 'quotation_number' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Quotation, 'id' | 'created_at'>>
      }
    }
  }
}

// ─── Cash Closing ─────────────────────────────────────────────────────────────
export interface CashClosingSummaryItem {
  method: PaymentMethodType
  label: string
  total_usd: number
  total_ves: number
  count: number
}

export interface CashClosing {
  id: string
  tenant_id: string
  closing_number?: string
  opened_at?: string
  closed_at?: string
  closing_date?: string              // YYYY-MM-DD
  status: 'open' | 'closed'
  breakdown_by_method?: CashClosingSummaryItem[] | Record<string, unknown>
  summary_by_method?: CashClosingSummaryItem[]
  total_sales_usd?: number
  total_sales_ves?: number
  sales_count?: number
  subtotal_usd?: number              // Ventas brutas sin IGTF
  igtf_total?: number                // Total IGTF del día
  total_usd?: number                 // subtotal_usd + igtf_total
  total_ves?: number
  order_count?: number
  exchange_rate_used?: number
  notes: string | null
  closed_by: string | null
  created_at: string
  updated_at?: string
}

// ─── Expense ──────────────────────────────────────────────────────────────────
export interface Expense {
  id: string
  tenant_id: string
  category: string
  description: string
  amount_usd: number
  amount_ves: number
  exchange_rate: number
  payment_method: string
  supplier_name: string | null
  receipt_url: string | null
  is_recurring: boolean
  recurrence_period: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null
  expense_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Quotation ────────────────────────────────────────────────────────────────
export interface QuotationItem {
  product_id: string
  name: string
  sku: string | null
  unit_price_usd: number
  quantity: number
  discount_percent?: number
  subtotal_usd: number
}

export interface Quotation {
  id: string
  tenant_id: string
  customer_id: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_id_number?: string | null
  quotation_number: string
  status: 'draft' | 'sent' | 'approved' | 'expired' | 'converted'
  items: QuotationItem[]
  subtotal_usd: number
  total_usd: number
  total_ves: number
  exchange_rate: number
  valid_until: string
  converted_order_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

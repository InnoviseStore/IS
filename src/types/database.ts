// ─── Payment Methods ───────────────────────────────────────────────────────────
export type PaymentMethodType =
  | 'zelle'
  | 'pago_movil'
  | 'cash_usd'
  | 'cash_ves'
  | 'transfer_ves'
  | 'debit_ves'

export interface PaymentMethod {
  method: PaymentMethodType
  amount_usd: number
  amount_ves: number
  reference?: string
  igtf_amount?: number // IGTF (3%) aplicado a pagos en divisas cuando el comercio es agente especial
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

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  email: string | null
  role: 'superadmin' | 'owner' | 'admin' | 'cashier'
  created_at: string
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
  closing_date: string              // YYYY-MM-DD
  status: 'open' | 'closed'
  summary_by_method: CashClosingSummaryItem[]
  subtotal_usd: number              // Ventas brutas sin IGTF
  igtf_total: number                // Total IGTF del día
  total_usd: number                 // subtotal_usd + igtf_total
  total_ves: number
  order_count: number
  exchange_rate_used: number
  notes: string | null
  closed_by: string | null
  created_at: string
  updated_at: string
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
  subtotal_usd: number
}

export interface Quotation {
  id: string
  tenant_id: string
  customer_id: string | null
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

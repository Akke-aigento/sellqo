import type { Json } from '@/integrations/supabase/types';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
  phone?: string;
}

// Helper type for JSON fields from database
export type JsonAddress = Json | null;

export interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  customer_type: string | null;
  vat_number: string | null;
  default_shipping_address: JsonAddress;
  default_billing_address: JsonAddress;
  total_orders: number;
  total_spent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: JsonAddress;
  billing_address: JsonAddress;
  notes: string | null;
  internal_notes: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  order_items?: OrderItem[];
  customer?: Customer;
}

export interface OrderFilters {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

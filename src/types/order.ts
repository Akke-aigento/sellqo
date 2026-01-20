import type { Json } from '@/integrations/supabase/types';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type DeliveryType = 'home_delivery' | 'service_point';

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

export type MarketplaceSource = 'bol_com' | 'amazon' | 'sellqo_webshop' | null;

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
  // Shipping & tracking fields
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  // Marketplace integration fields
  marketplace_source?: MarketplaceSource;
  marketplace_order_id?: string | null;
  marketplace_connection_id?: string | null;
  sync_status?: string | null;
  fulfillment_status?: string | null;
  raw_marketplace_data?: Json | null;
  // Service point / pickup fields
  delivery_type?: DeliveryType | string;
  service_point_id?: string | null;
  service_point_data?: Json | null;
  // Joined data
  order_items?: OrderItem[];
  customer?: Customer;
}

export interface OrderFilters {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  marketplace_source?: MarketplaceSource;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

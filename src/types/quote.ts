import type { Customer } from './order';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total_price: number;
  sort_order: number;
  created_at: string;
}

export interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  quote_number: string;
  status: QuoteStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  internal_notes: string | null;
  payment_link: string | null;
  converted_order_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  quote_items?: QuoteItem[];
  customer?: Customer;
}

export interface QuoteFilters {
  status?: QuoteStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface QuoteItemInput {
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
}

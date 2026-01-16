export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  tenant_id: string;
  order_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  pdf_url: string | null;
  ubl_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceFormat = 'pdf' | 'ubl' | 'both';

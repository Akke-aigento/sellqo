export type CreditNoteType = 'full' | 'partial' | 'correction';
export type CreditNoteStatus = 'draft' | 'sent' | 'processed';

export interface CreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  original_invoice_id: string;
  customer_id: string | null;
  type: CreditNoteType;
  reason: string;
  subtotal: number;
  tax_amount: number | null;
  total: number;
  status: CreditNoteStatus;
  issue_date: string;
  ogm_reference: string | null;
  pdf_url: string | null;
  ubl_url: string | null;
  peppol_required: boolean;
  peppol_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditNoteLine {
  id: string;
  credit_note_id: string;
  original_invoice_line_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  line_type: 'product' | 'shipping' | 'discount';
  created_at: string;
}

export interface CreditNoteWithRelations extends CreditNote {
  original_invoice?: {
    id: string;
    invoice_number: string;
    total: number;
    customer_id: string | null;
  };
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    company_name: string | null;
  };
  lines?: CreditNoteLine[];
}

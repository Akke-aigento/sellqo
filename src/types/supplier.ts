import type { Database } from "@/integrations/supabase/types";

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'shipped' | 'partially_received' | 'received' | 'cancelled';
export type SupplierDocumentType = 'invoice' | 'quote' | 'delivery_note' | 'credit_note' | 'contract' | 'other';
export type SupplierPaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  vat_number: string | null;
  chamber_of_commerce: string | null;
  iban: string | null;
  bic: string | null;
  payment_terms_days: number | null;
  contact_person: string | null;
  notes: string | null;
  tags: string[];
  rating: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductSupplier {
  id: string;
  tenant_id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  purchase_price: number;
  currency: string;
  minimum_order_quantity: number;
  lead_time_days: number | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    stock_quantity: number | null;
    price: number;
  };
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id: string;
  order_number: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
  currency: string;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  product_supplier_id: string | null;
  product_name: string;
  supplier_sku: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  notes: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
  };
}

export interface SupplierDocument {
  id: string;
  tenant_id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  document_type: SupplierDocumentType;
  document_number: string | null;
  document_date: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string;
  due_date: string | null;
  payment_status: SupplierPaymentStatus;
  paid_at: string | null;
  paid_amount: number;
  extracted_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  purchase_order?: PurchaseOrder;
}

// Form data interfaces
export interface SupplierFormData {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
  chamber_of_commerce?: string;
  iban?: string;
  bic?: string;
  payment_terms_days?: number;
  contact_person?: string;
  notes?: string;
  tags?: string[];
  rating?: number;
  is_active?: boolean;
}

export interface ProductSupplierFormData {
  product_id: string;
  supplier_id: string;
  supplier_sku?: string;
  purchase_price: number;
  currency?: string;
  minimum_order_quantity?: number;
  lead_time_days?: number;
  is_primary?: boolean;
  notes?: string;
}

export interface PurchaseOrderFormData {
  supplier_id: string;
  order_date?: string;
  expected_delivery_date?: string;
  shipping_cost?: number;
  notes?: string;
  internal_notes?: string;
  items: PurchaseOrderItemFormData[];
}

export interface PurchaseOrderItemFormData {
  product_id: string;
  product_supplier_id?: string;
  product_name: string;
  supplier_sku?: string;
  quantity_ordered: number;
  unit_price: number;
  tax_rate?: number;
  notes?: string;
}

export interface SupplierDocumentFormData {
  supplier_id: string;
  purchase_order_id?: string;
  document_type: SupplierDocumentType;
  document_number?: string;
  document_date?: string;
  amount?: number;
  tax_amount?: number;
  total_amount?: number;
  due_date?: string;
  notes?: string;
}

// Display info
export const purchaseOrderStatusInfo: Record<PurchaseOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Concept', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Verzonden', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  confirmed: { label: 'Bevestigd', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  shipped: { label: 'Onderweg', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  partially_received: { label: 'Deels ontvangen', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  received: { label: 'Ontvangen', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  cancelled: { label: 'Geannuleerd', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
};

export const documentTypeInfo: Record<SupplierDocumentType, { label: string; icon: string }> = {
  invoice: { label: 'Factuur', icon: 'FileText' },
  quote: { label: 'Offerte', icon: 'FileCheck' },
  delivery_note: { label: 'Pakbon', icon: 'Package' },
  credit_note: { label: 'Creditnota', icon: 'FileX' },
  contract: { label: 'Contract', icon: 'FileSignature' },
  other: { label: 'Overig', icon: 'File' },
};

export const paymentStatusInfo: Record<SupplierPaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Openstaand', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  partial: { label: 'Deels betaald', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  paid: { label: 'Betaald', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  overdue: { label: 'Achterstallig', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  cancelled: { label: 'Geannuleerd', color: 'bg-muted text-muted-foreground' },
};

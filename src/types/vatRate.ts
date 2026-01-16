export type VatCategory = 'standard' | 'reduced' | 'super_reduced' | 'zero' | 'exempt';

export interface VatRate {
  id: string;
  tenant_id: string | null;
  country_code: string;
  rate: number;
  category: VatCategory;
  name_nl: string | null;
  name_en: string | null;
  name_fr: string | null;
  name_de: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface VatRateFormData {
  country_code: string;
  rate: number;
  category: VatCategory;
  name_nl: string;
  name_en: string;
  name_fr: string;
  name_de: string;
  is_default: boolean;
  is_active: boolean;
}

export interface TaxBreakdownLine {
  vatRate: number;
  vatCategory: VatCategory;
  taxableAmount: number;
  vatAmount: number;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  line_type: 'product' | 'shipping' | 'discount';
  product_id?: string;
  shipping_method_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_category: VatCategory;
  vat_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

/**
 * Calculates tax breakdown from invoice lines grouped by VAT rate
 */
export function calculateTaxBreakdown(lines: InvoiceLine[]): TaxBreakdownLine[] {
  const breakdown = new Map<string, TaxBreakdownLine>();
  
  for (const line of lines) {
    const key = `${line.vat_rate}-${line.vat_category}`;
    const existing = breakdown.get(key) || {
      vatRate: line.vat_rate,
      vatCategory: line.vat_category,
      taxableAmount: 0,
      vatAmount: 0
    };
    
    existing.taxableAmount += line.line_total - line.vat_amount;
    existing.vatAmount += line.vat_amount;
    
    breakdown.set(key, existing);
  }
  
  return Array.from(breakdown.values()).sort((a, b) => b.vatRate - a.vatRate);
}

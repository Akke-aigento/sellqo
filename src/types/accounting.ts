// Accounting / VAT regime resolution types
// Used by edge function `resolve-vat-regime` and admin UI.

export type VatRegimeCode =
  | 'domestic_standard'
  | 'domestic_reduced_6'
  | 'domestic_reduced_12'
  | 'domestic_zero'
  | 'ic_supply_goods'
  | 'ic_supply_services'
  | 'ic_supply_triangulation'
  | 'export_outside_eu'
  | 'oss_b2c_eu'
  | 'reverse_charge_construction'
  | 'marketplace_deemed_supplier'
  | 'exempt_article_44';

export type VatBoxCode = string; // '00','01','02','03','44','45','46','47','48' etc.

export type ProductCategory =
  | 'goods'
  | 'digital_service'
  | 'professional_service'
  | 'book'
  | 'food'
  | 'medicine';

export type LineType = 'product' | 'shipping' | 'discount';

export type SalesChannel =
  | 'webshop'
  | 'marketplace_bolcom'
  | 'pos'
  | 'b2b_direct';

export interface RegimeInputLine {
  product_id?: string;
  line_type: LineType;
  amount: number;
  product_category?: ProductCategory;
}

export interface RegimeInput {
  tenant_id: string;
  customer_id: string;
  invoice_lines: RegimeInputLine[];
  sales_channel?: SalesChannel;
  override_regime?: VatRegimeCode;
}

export interface RegimeInvoiceLevel {
  vat_regime: VatRegimeCode;
  reporting_country: string;
  vat_number_validated_value?: string;
  vat_number_validated_at?: string;
}

export interface RegimePerLine {
  line_index: number;
  vat_regime: VatRegimeCode;
  vat_box_code: VatBoxCode;
  vat_rate: number;
  gl_account_code: string;
  invoice_text_required?: string;
}

export interface RegimeResolution {
  invoice_level: RegimeInvoiceLevel;
  per_line: RegimePerLine[];
  warnings: string[];
}
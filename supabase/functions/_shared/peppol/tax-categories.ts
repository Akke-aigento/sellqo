/**
 * UBL Tax Category mapping based on `invoices.vat_regime`.
 *
 * Maps each SellQo vat_regime to the BIS Billing 3.0 ClassifiedTaxCategory ID
 * (UNTDID 5305) plus the human-readable "exemption reason text" required when
 * the rate is 0 % (BR-E, BR-AE, BR-Z, BR-O, BR-IC, …).
 *
 * Reference: https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL5305/
 */

export type UblTaxCategoryId =
  | 'S'   // Standard rate
  | 'Z'   // Zero rated goods
  | 'E'   // Exempt from tax
  | 'AE'  // VAT reverse charge
  | 'K'   // Intra-community supply
  | 'G'   // Free export item, tax not charged
  | 'O'   // Services outside scope of tax
  | 'L'   // Canary Islands general indirect tax (not used)
  | 'M';  // Tax for production, services, and importation in Ceuta/Melilla (not used)

export interface TaxCategoryMapping {
  id: UblTaxCategoryId;
  /** Required for non-standard categories (BR-CO-19 et al.) */
  exemptionReason?: string;
}

const MAP: Record<string, TaxCategoryMapping> = {
  domestic_standard:            { id: 'S' },
  domestic_reduced_6:           { id: 'S' },
  domestic_reduced_12:          { id: 'S' },
  domestic_zero:                { id: 'Z', exemptionReason: 'Zero rated supply' },

  ic_supply_goods:              { id: 'K', exemptionReason: 'Intra-Community supply — Art. 138 Directive 2006/112/EC' },
  ic_supply_services:           { id: 'K', exemptionReason: 'Intra-Community supply of services — Art. 44 Directive 2006/112/EC' },
  ic_triangulation:             { id: 'K', exemptionReason: 'Intra-Community triangulation — Art. 141 Directive 2006/112/EC' },
  ic_supply_triangulation:      { id: 'K', exemptionReason: 'Intra-Community triangulation — Art. 141 Directive 2006/112/EC' },

  export_outside_eu:            { id: 'G', exemptionReason: 'Export outside EU — Art. 146 Directive 2006/112/EC' },

  oss_b2c_eu:                   { id: 'S' }, // OSS: standard category, rate of destination country

  reverse_charge_construction:  { id: 'AE', exemptionReason: 'Reverse charge — Art. 199 Directive 2006/112/EC (construction services)' },
  marketplace_deemed_supplier:  { id: 'AE', exemptionReason: 'Reverse charge — deemed supplier (marketplace)' },

  exempt_article_44:            { id: 'E', exemptionReason: 'Exempt — Art. 44 Belgian VAT Code' },
};

export function taxCategoryFor(regime: string | null | undefined): TaxCategoryMapping {
  if (!regime) return { id: 'S' };
  return MAP[regime] ?? { id: 'S' };
}
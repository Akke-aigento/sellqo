// Maps a (vat_regime, vat_rate) pair to Belgian VAT declaration boxes.
// Returns the base box (turnover side) and optional VAT box (output VAT side).

import type { DeclarationBoxCode, VatRegimeCode } from './types.ts';

export interface RegimeMapping {
  base_box: DeclarationBoxCode | null; // null => not reported (oss / exempt)
  vat_box: DeclarationBoxCode | null;  // null => no output VAT box
  // For credit-note compensation (negative side):
  credit_base_box: DeclarationBoxCode | null;
  credit_vat_box: DeclarationBoxCode | null;
}

/**
 * Resolve declaration box mapping for a regime.
 * domestic_reduced_* derive base box from regime, not vat_rate, to keep
 * a single source of truth.
 */
export function mapRegimeToBoxes(
  regime: string,
  vatRate: number,
): RegimeMapping {
  const r = regime as VatRegimeCode;
  switch (r) {
    case 'domestic_standard':
      return { base_box: '03', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
    case 'domestic_reduced_6':
      return { base_box: '01', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
    case 'domestic_reduced_12':
      return { base_box: '02', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
    case 'domestic_zero':
      return { base_box: '00', vat_box: null, credit_base_box: '49', credit_vat_box: null };
    case 'ic_supply_services':
      return { base_box: '44', vat_box: null, credit_base_box: '48', credit_vat_box: null };
    case 'ic_supply_goods':
    case 'ic_supply_triangulation':
    case 'ic_triangulation':
      return { base_box: '46', vat_box: null, credit_base_box: '48', credit_vat_box: null };
    case 'reverse_charge_construction':
      return { base_box: '45', vat_box: null, credit_base_box: '48', credit_vat_box: null };
    case 'export_outside_eu':
    case 'marketplace_deemed_supplier':
      return { base_box: '47', vat_box: null, credit_base_box: '49', credit_vat_box: null };
    case 'oss_b2c_eu':
      // OSS turnover is NOT reported in the BE boxes; tracked in oss_by_country.
      return { base_box: null, vat_box: null, credit_base_box: null, credit_vat_box: null };
    case 'exempt_article_44':
      return { base_box: null, vat_box: null, credit_base_box: null, credit_vat_box: null };
    default:
      // Unknown regime: fall back to domestic standard but rate-driven.
      if (vatRate === 6)  return { base_box: '01', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
      if (vatRate === 12) return { base_box: '02', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
      if (vatRate === 21) return { base_box: '03', vat_box: '54', credit_base_box: '49', credit_vat_box: '64' };
      return { base_box: null, vat_box: null, credit_base_box: null, credit_vat_box: null };
  }
}

export const ALL_BOXES: DeclarationBoxCode[] = [
  '00','01','02','03',
  '44','45','46','47','48','49',
  '54','55','56','57','59',
  '61','62','63','64',
  '71','72',
  '81','82','83','84','85','86','87','88',
];

export function emptyBoxes(): Record<DeclarationBoxCode, { amount: number; vat: number; source_invoice_count: number; source_line_count: number }> {
  const out = {} as Record<DeclarationBoxCode, { amount: number; vat: number; source_invoice_count: number; source_line_count: number }>;
  for (const code of ALL_BOXES) {
    out[code] = { amount: 0, vat: 0, source_invoice_count: 0, source_line_count: 0 };
  }
  return out;
}
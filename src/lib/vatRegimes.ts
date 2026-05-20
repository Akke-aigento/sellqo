// Canonical VAT regime constants and helpers for SellQo Accounting.
// Shared between admin UI and edge functions.
// NOTE: Edge functions cannot import from this file directly (they run in Deno
// without `@/` resolution); they should mirror these constants. Keep in sync
// with supabase/functions/resolve-vat-regime/index.ts.

import type { ProductCategory, VatBoxCode, VatRegimeCode } from '@/types/accounting';

export const EU_COUNTRIES = [
  'BE','NL','DE','FR','IT','ES','LU','DK','SE','FI','IE','AT','PT','EL','GR',
  'CY','MT','SK','SI','EE','LV','LT','PL','CZ','HU','RO','BG','HR',
] as const;

export function isEuCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return (EU_COUNTRIES as readonly string[]).includes(code.toUpperCase());
}

// Output VAT box per regime (Belgian VAT return boxes).
export const REGIME_TO_BOX: Record<VatRegimeCode, VatBoxCode> = {
  domestic_standard: '03',
  domestic_reduced_6: '01',
  domestic_reduced_12: '02',
  domestic_zero: '00',
  ic_supply_goods: '46',
  ic_supply_services: '44',
  ic_supply_triangulation: '46',
  export_outside_eu: '47',
  oss_b2c_eu: '47',
  reverse_charge_construction: '45',
  marketplace_deemed_supplier: '47',
  exempt_article_44: '00',
};

// Default GL account per regime (Odoo-style chart of accounts).
export const REGIME_TO_GL: Record<VatRegimeCode, string> = {
  domestic_standard: '700000',
  domestic_reduced_6: '700100',
  domestic_reduced_12: '700200',
  domestic_zero: '700000',
  ic_supply_goods: '700300',
  ic_supply_services: '706000',
  ic_supply_triangulation: '700300',
  export_outside_eu: '700400',
  oss_b2c_eu: '700500',
  reverse_charge_construction: '700600',
  marketplace_deemed_supplier: '700700',
  exempt_article_44: '700000',
};

// OSS B2C destination-country rates (standard rate).
export const OSS_RATES: Record<string, number> = {
  NL: 21, DE: 19, FR: 20, IT: 22, ES: 21, AT: 20, PT: 23, IE: 23,
  DK: 25, SE: 25, FI: 25.5, EL: 24, GR: 24, LU: 17, PL: 23, RO: 19,
  CZ: 21, SK: 23, HU: 27, BG: 20, HR: 25, SI: 22, EE: 22, LV: 21,
  LT: 21, MT: 18, CY: 19,
};

export function rateForRegime(regime: VatRegimeCode, destCountry?: string): number {
  switch (regime) {
    case 'domestic_standard': return 21;
    case 'domestic_reduced_6': return 6;
    case 'domestic_reduced_12': return 12;
    case 'oss_b2c_eu':
      return destCountry ? (OSS_RATES[destCountry.toUpperCase()] ?? 21) : 21;
    default: return 0;
  }
}

// Map a product category to a domestic reduced regime (BE).
export function domesticRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  switch (cat) {
    case 'book':
    case 'food':
    case 'medicine':
      return 'domestic_reduced_6';
    default:
      return 'domestic_standard';
  }
}

// Map a product category to an EU IC-supply regime variant.
export function icRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  if (cat === 'digital_service' || cat === 'professional_service') {
    return 'ic_supply_services';
  }
  return 'ic_supply_goods';
}
// Canonical VAT-regime resolver — single source of truth for invoice creation,
// backfill and the resolve-vat-regime HTTP wrapper. Pure TS, no HTTP self-call.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type VatRegimeCode =
  | 'domestic_standard' | 'domestic_reduced_6' | 'domestic_reduced_12'
  | 'domestic_zero' | 'ic_supply_goods' | 'ic_supply_services'
  | 'ic_supply_triangulation' | 'export_outside_eu' | 'oss_b2c_eu'
  | 'reverse_charge_construction' | 'marketplace_deemed_supplier'
  | 'exempt_article_44';

export type ProductCategory =
  | 'goods' | 'digital_service' | 'professional_service'
  | 'book' | 'food' | 'medicine';

export type LineType = 'product' | 'shipping' | 'discount';
export type SalesChannel = 'webshop' | 'marketplace_bolcom' | 'pos' | 'b2b_direct';

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
  vat_box_code: string;
  vat_rate: number;
  gl_account_code: string;
  invoice_text_required?: string;
}

export interface RegimeResolution {
  invoice_level: RegimeInvoiceLevel;
  per_line: RegimePerLine[];
  warnings: string[];
}

export const EU_COUNTRIES = new Set([
  'BE','NL','DE','FR','IT','ES','LU','DK','SE','FI','IE','AT','PT','EL','GR',
  'CY','MT','SK','SI','EE','LV','LT','PL','CZ','HU','RO','BG','HR',
]);

export const REGIME_TO_BOX: Record<VatRegimeCode, string> = {
  domestic_standard: '03', domestic_reduced_6: '01', domestic_reduced_12: '02',
  domestic_zero: '00', ic_supply_goods: '46', ic_supply_services: '44',
  ic_supply_triangulation: '46', export_outside_eu: '47', oss_b2c_eu: '47',
  reverse_charge_construction: '45', marketplace_deemed_supplier: '47',
  exempt_article_44: '00',
};

export const REGIME_TO_GL: Record<VatRegimeCode, string> = {
  domestic_standard: '700000', domestic_reduced_6: '700100', domestic_reduced_12: '700200',
  domestic_zero: '700000', ic_supply_goods: '700300', ic_supply_services: '706000',
  ic_supply_triangulation: '700300', export_outside_eu: '700400', oss_b2c_eu: '700500',
  reverse_charge_construction: '700600', marketplace_deemed_supplier: '700700',
  exempt_article_44: '700000',
};

export const OSS_RATES: Record<string, number> = {
  NL:21,DE:19,FR:20,IT:22,ES:21,AT:20,PT:23,IE:23,DK:25,SE:25,FI:25.5,
  EL:24,GR:24,LU:17,PL:23,RO:19,CZ:21,SK:23,HU:27,BG:20,HR:25,SI:22,
  EE:22,LV:21,LT:21,MT:18,CY:19,
};

export function isEu(code: string | null | undefined): boolean {
  return !!code && EU_COUNTRIES.has(code.toUpperCase());
}

export function domesticRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  if (cat === 'book' || cat === 'food' || cat === 'medicine') return 'domestic_reduced_6';
  return 'domestic_standard';
}

export function icRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  if (cat === 'digital_service' || cat === 'professional_service') return 'ic_supply_services';
  return 'ic_supply_goods';
}

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

async function validateViesWithTimeout(
  supabase: SupabaseClient,
  vatNumber: string,
  countryCode: string,
  timeoutMs = 5000,
): Promise<{ valid: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const { data, error } = await supabase.functions.invoke('validate-vat', {
      body: { vat_number: `${countryCode}${vatNumber.replace(/^[A-Z]{2}/i, '')}` },
    });
    clearTimeout(timer);
    if (error) return { valid: false, error: error.message };
    const valid = data && (data as { valid?: boolean }).valid === true;
    return { valid: !!valid };
  } catch (e) {
    clearTimeout(timer);
    if (ctrl.signal.aborted) return { valid: false, error: 'timeout' };
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Resolve invoice- and line-level VAT regime + box + GL account.
 * Pure async function — uses an admin-scoped Supabase client (caller provides
 * one with service-role rights, e.g. inside another edge function).
 * VIES is skipped when `override_regime` is set.
 */
export async function resolveVatRegime(
  supabase: SupabaseClient,
  input: RegimeInput,
): Promise<RegimeResolution> {
  const warnings: string[] = [];

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, tenant_id, customer_type, billing_country, vat_number')
    .eq('id', input.customer_id)
    .eq('tenant_id', input.tenant_id)
    .maybeSingle();
  if (custErr) throw new Error(`Customer lookup failed: ${custErr.message}`);
  if (!customer) throw new Error('Customer not found');

  const { data: tenant } = await supabase
    .from('tenants').select('id, country, oss_enabled, simplified_vat_mode').eq('id', input.tenant_id).maybeSingle();
  const tenantCountry = ((tenant?.country as string | null) || 'BE').toUpperCase();
  const ossEnabled = (tenant as { oss_enabled?: boolean } | null)?.oss_enabled === true;
  const simplifiedVat = (tenant as { simplified_vat_mode?: boolean } | null)?.simplified_vat_mode === true;
  const customerCountry = ((customer.billing_country as string | null) || tenantCountry).toUpperCase();
  const isB2B = ((customer.customer_type as string | null) || '').toLowerCase() === 'b2b';

  const invoiceLevel: RegimeInvoiceLevel = {
    vat_regime: 'domestic_standard',
    reporting_country: customerCountry,
  };

  if (input.override_regime) {
    // Override short-circuits the decision tree AND skips VIES.
    invoiceLevel.vat_regime = input.override_regime;
  } else {
    let viesValid = false;
    if (isB2B && customer.vat_number && isEu(customerCountry) && customerCountry !== tenantCountry) {
      const vies = await validateViesWithTimeout(supabase, customer.vat_number as string, customerCountry);
      if (vies.valid) {
        viesValid = true;
        invoiceLevel.vat_number_validated_value = customer.vat_number as string;
        invoiceLevel.vat_number_validated_at = new Date().toISOString();
      } else {
        warnings.push(
          vies.error === 'timeout'
            ? 'VIES validation timeout — fallback to domestic_standard'
            : `VIES validation failed (${vies.error || 'invalid'}) — fallback to domestic_standard`,
        );
      }
    }

    if (customerCountry === tenantCountry) {
      invoiceLevel.vat_regime = 'domestic_standard';
    } else if (isEu(customerCountry)) {
      if (input.sales_channel === 'marketplace_bolcom' && !isB2B) {
        invoiceLevel.vat_regime = 'marketplace_deemed_supplier';
      } else if (isB2B && viesValid) {
        const hasGoods = input.invoice_lines.some(
          (l) => !l.product_category || ['goods','book','food','medicine'].includes(l.product_category),
        );
        const hasService = input.invoice_lines.some(
          (l) => l.product_category === 'digital_service' || l.product_category === 'professional_service',
        );
        invoiceLevel.vat_regime = hasGoods ? 'ic_supply_goods' : (hasService ? 'ic_supply_services' : 'ic_supply_goods');
      } else if (!isB2B && simplifiedVat) {
        // PRIORITY 1: simplified VAT mode overrides cross-border complexity
        invoiceLevel.vat_regime = 'domestic_standard';
      } else if (!isB2B && ossEnabled) {
        // PRIORITY 2: OSS B2C EU
        invoiceLevel.vat_regime = 'oss_b2c_eu';
      } else {
        // PRIORITY 3: fallback domestic_standard (tenant home country rate)
        invoiceLevel.vat_regime = 'domestic_standard';
        if (isB2B) {
          warnings.push('EU B2B customer without valid VIES — treated as B2C (domestic_standard)');
        } else {
          warnings.push('Cross-border EU B2C zonder OSS — controleer of jaaromzet onder €10k drempel blijft');
        }
      }
    } else {
      invoiceLevel.vat_regime = 'export_outside_eu';
    }
  }

  const { data: regimeRows } = await supabase
    .from('vat_regimes')
    .select('code, invoice_text_nl, output_vat_box');
  const regimeMap = new Map<string, { invoice_text_nl?: string | null; output_vat_box?: string | null }>();
  for (const r of regimeRows || []) {
    regimeMap.set((r as { code: string }).code, r as { invoice_text_nl?: string | null; output_vat_box?: string | null });
  }

  const perLine: RegimePerLine[] = input.invoice_lines.map((line, idx) => {
    let lineRegime: VatRegimeCode = invoiceLevel.vat_regime;
    if (invoiceLevel.vat_regime === 'domestic_standard') {
      lineRegime = domesticRegimeForCategory(line.product_category);
    } else if (invoiceLevel.vat_regime === 'ic_supply_goods' || invoiceLevel.vat_regime === 'ic_supply_services') {
      lineRegime = icRegimeForCategory(line.product_category);
    }

    const lookup = regimeMap.get(lineRegime);
    const vat_box_code = lookup?.output_vat_box ?? REGIME_TO_BOX[lineRegime] ?? '00';
    const vat_rate = rateForRegime(lineRegime, customerCountry);
    const gl_account_code = REGIME_TO_GL[lineRegime] ?? '700000';
    const invoice_text_required = lookup?.invoice_text_nl || undefined;

    return {
      line_index: idx,
      vat_regime: lineRegime,
      vat_box_code,
      vat_rate,
      gl_account_code,
      ...(invoice_text_required ? { invoice_text_required } : {}),
    };
  });

  return { invoice_level: invoiceLevel, per_line: perLine, warnings };
}

/**
 * Convenience: build a service-role client and resolve. Safe fallback caller —
 * returns null on any failure so invoice creation never breaks.
 */
export async function resolveVatRegimeSafe(
  input: RegimeInput,
): Promise<{ resolution: RegimeResolution | null; error?: string }> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const resolution = await resolveVatRegime(supabase, input);
    return { resolution };
  } catch (e) {
    return { resolution: null, error: e instanceof Error ? e.message : String(e) };
  }
}
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

// ---------- Types (mirror of src/types/accounting.ts) ----------
type VatRegimeCode =
  | 'domestic_standard' | 'domestic_reduced_6' | 'domestic_reduced_12'
  | 'domestic_zero' | 'ic_supply_goods' | 'ic_supply_services'
  | 'ic_supply_triangulation' | 'export_outside_eu' | 'oss_b2c_eu'
  | 'reverse_charge_construction' | 'marketplace_deemed_supplier'
  | 'exempt_article_44';

type ProductCategory =
  | 'goods' | 'digital_service' | 'professional_service'
  | 'book' | 'food' | 'medicine';

type LineType = 'product' | 'shipping' | 'discount';
type SalesChannel = 'webshop' | 'marketplace_bolcom' | 'pos' | 'b2b_direct';

interface InputLine {
  product_id?: string;
  line_type: LineType;
  amount: number;
  product_category?: ProductCategory;
}

interface RegimeInput {
  tenant_id: string;
  customer_id: string;
  invoice_lines: InputLine[];
  sales_channel?: SalesChannel;
  override_regime?: VatRegimeCode;
}

// ---------- Constants (mirror of src/lib/vatRegimes.ts) ----------
const EU_COUNTRIES = new Set([
  'BE','NL','DE','FR','IT','ES','LU','DK','SE','FI','IE','AT','PT','EL','GR',
  'CY','MT','SK','SI','EE','LV','LT','PL','CZ','HU','RO','BG','HR',
]);

const REGIME_TO_BOX: Record<VatRegimeCode, string> = {
  domestic_standard: '03', domestic_reduced_6: '01', domestic_reduced_12: '02',
  domestic_zero: '00', ic_supply_goods: '46', ic_supply_services: '44',
  ic_supply_triangulation: '46', export_outside_eu: '47', oss_b2c_eu: '47',
  reverse_charge_construction: '45', marketplace_deemed_supplier: '47',
  exempt_article_44: '00',
};

const REGIME_TO_GL: Record<VatRegimeCode, string> = {
  domestic_standard: '700000', domestic_reduced_6: '700100', domestic_reduced_12: '700200',
  domestic_zero: '700000', ic_supply_goods: '700300', ic_supply_services: '706000',
  ic_supply_triangulation: '700300', export_outside_eu: '700400', oss_b2c_eu: '700500',
  reverse_charge_construction: '700600', marketplace_deemed_supplier: '700700',
  exempt_article_44: '700000',
};

const OSS_RATES: Record<string, number> = {
  NL:21,DE:19,FR:20,IT:22,ES:21,AT:20,PT:23,IE:23,DK:25,SE:25,FI:25.5,
  EL:24,GR:24,LU:17,PL:23,RO:19,CZ:21,SK:23,HU:27,BG:20,HR:25,SI:22,
  EE:22,LV:21,LT:21,MT:18,CY:19,
};

function isEu(code: string | null | undefined): boolean {
  if (!code) return false;
  return EU_COUNTRIES.has(code.toUpperCase());
}

function domesticRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  if (cat === 'book' || cat === 'food' || cat === 'medicine') return 'domestic_reduced_6';
  return 'domestic_standard';
}

function icRegimeForCategory(cat?: ProductCategory): VatRegimeCode {
  if (cat === 'digital_service' || cat === 'professional_service') return 'ic_supply_services';
  return 'ic_supply_goods';
}

function rateForRegime(regime: VatRegimeCode, destCountry?: string): number {
  switch (regime) {
    case 'domestic_standard': return 21;
    case 'domestic_reduced_6': return 6;
    case 'domestic_reduced_12': return 12;
    case 'oss_b2c_eu':
      return destCountry ? (OSS_RATES[destCountry.toUpperCase()] ?? 21) : 21;
    default: return 0;
  }
}

function log(step: string, details?: Record<string, unknown>) {
  console.log(`[resolve-vat-regime] ${step}`, details ? JSON.stringify(details) : '');
}

// ---------- VIES validation with 5s timeout ----------
async function validateViesWithTimeout(
  supabase: ReturnType<typeof createClient>,
  vatNumber: string,
  countryCode: string,
): Promise<{ valid: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
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
    const msg = e instanceof Error ? e.message : String(e);
    if (ctrl.signal.aborted) return { valid: false, error: 'timeout' };
    return { valid: false, error: msg };
  }
}

// ---------- Handler ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    let body: RegimeInput;
    try {
      body = await req.json() as RegimeInput;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!body?.tenant_id || !body?.customer_id || !Array.isArray(body?.invoice_lines)) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: tenant_id, customer_id, invoice_lines',
      }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Admin-only auth, scoped to this tenant
    try {
      await authenticateRequest(req, body.tenant_id);
    } catch (e) {
      if (e instanceof AuthError) return authErrorResponse(e, cors);
      throw e;
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const warnings: string[] = [];

    // STEP 2: load customer (tenant-scoped)
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, tenant_id, customer_type, billing_country, vat_number')
      .eq('id', body.customer_id)
      .eq('tenant_id', body.tenant_id)
      .maybeSingle();

    if (custErr) {
      console.error('[resolve-vat-regime] customer query failed', {
        tenant_id: body.tenant_id, customer_id: body.customer_id, error: custErr.message,
      });
      return new Response(JSON.stringify({ error: 'Customer lookup failed' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // STEP 3: load tenant for home country
    const { data: tenant } = await supabase
      .from('tenants').select('id, country').eq('id', body.tenant_id).maybeSingle();
    const tenantCountry = (tenant?.country || 'BE').toUpperCase();

    // STEP 5
    const customerCountry = (customer.billing_country || tenantCountry).toUpperCase();
    // STEP 4
    const isB2B = (customer.customer_type || '').toLowerCase() === 'b2b';

    // Default invoice-level fields
    const invoiceLevel: {
      vat_regime: VatRegimeCode;
      reporting_country: string;
      vat_number_validated_value?: string;
      vat_number_validated_at?: string;
    } = { vat_regime: 'domestic_standard', reporting_country: customerCountry };

    // STEP 1: override short-circuit
    if (body.override_regime) {
      invoiceLevel.vat_regime = body.override_regime;
    } else {
      // STEP 6: VIES validation for EU B2B
      let viesValid = false;
      if (isB2B && customer.vat_number && isEu(customerCountry) && customerCountry !== tenantCountry) {
        const vies = await validateViesWithTimeout(supabase, customer.vat_number, customerCountry);
        if (vies.valid) {
          viesValid = true;
          invoiceLevel.vat_number_validated_value = customer.vat_number;
          invoiceLevel.vat_number_validated_at = new Date().toISOString();
        } else {
          warnings.push(
            vies.error === 'timeout'
              ? 'VIES validation timeout — fallback to domestic_standard'
              : `VIES validation failed (${vies.error || 'invalid'}) — fallback to domestic_standard`,
          );
        }
      }

      // STEP 7: invoice-level regime
      if (customerCountry === tenantCountry) {
        invoiceLevel.vat_regime = 'domestic_standard';
      } else if (isEu(customerCountry)) {
        if (body.sales_channel === 'marketplace_bolcom' && !isB2B) {
          invoiceLevel.vat_regime = 'marketplace_deemed_supplier';
        } else if (isB2B && viesValid) {
          // pick a representative IC regime from the lines (goods wins by default)
          const hasService = body.invoice_lines.some(
            (l) => l.product_category === 'digital_service' || l.product_category === 'professional_service',
          );
          const hasGoods = body.invoice_lines.some(
            (l) => !l.product_category || ['goods','book','food','medicine'].includes(l.product_category),
          );
          invoiceLevel.vat_regime = hasGoods ? 'ic_supply_goods' : (hasService ? 'ic_supply_services' : 'ic_supply_goods');
        } else {
          invoiceLevel.vat_regime = 'domestic_standard';
          if (isB2B) warnings.push('EU B2B customer without valid VIES — treated as B2C (domestic_standard)');
        }
      } else {
        invoiceLevel.vat_regime = 'export_outside_eu';
      }
    }

    // STEP 8: per-line resolution
    // Fetch invoice texts from vat_regimes lookup table (single query for all distinct regimes)
    const { data: regimeRows } = await supabase
      .from('vat_regimes')
      .select('code, invoice_text_nl, output_vat_box');
    const regimeMap = new Map<string, { invoice_text_nl?: string | null; output_vat_box?: string | null }>();
    for (const r of regimeRows || []) {
      regimeMap.set((r as { code: string }).code, r as { invoice_text_nl?: string | null; output_vat_box?: string | null });
    }

    const perLine = body.invoice_lines.map((line, idx) => {
      let lineRegime: VatRegimeCode = invoiceLevel.vat_regime;

      if (body.override_regime) {
        // STEP 1 continuation: lines inherit unless category dictates a domestic-reduced variant
        if (invoiceLevel.vat_regime === 'domestic_standard') {
          lineRegime = domesticRegimeForCategory(line.product_category);
        }
      } else if (invoiceLevel.vat_regime === 'domestic_standard') {
        lineRegime = domesticRegimeForCategory(line.product_category);
      } else if (invoiceLevel.vat_regime === 'ic_supply_goods' || invoiceLevel.vat_regime === 'ic_supply_services') {
        lineRegime = icRegimeForCategory(line.product_category);
      }

      const lookup = regimeMap.get(lineRegime);
      const vat_box_code = (lookup?.output_vat_box ?? REGIME_TO_BOX[lineRegime] ?? '00');
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

    const result = { invoice_level: invoiceLevel, per_line: perLine, warnings };
    log('resolved', {
      tenant_id: body.tenant_id, customer_id: body.customer_id,
      regime: invoiceLevel.vat_regime, lines: perLine.length, warnings: warnings.length,
    });

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[resolve-vat-regime] unhandled error', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
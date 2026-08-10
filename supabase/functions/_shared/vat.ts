// Shared VAT calculation helpers for order creation.
// Used by storefront-api, stripe-connect-webhook, create-bank-transfer-order,
// and marketplace sync functions.

import { isEuCountry } from "./vies.ts";

export interface LineVatResolution {
  vat_rate: number;
  vat_rate_id: string | null;
}

/**
 * Batch-resolve VAT rates for a list of product IDs.
 * Returns a Map of productId -> { vat_rate, vat_rate_id }.
 * Products without a vat_rate_id fall back to tenantDefaultRate.
 *
 * Single DB query regardless of how many products, to avoid N+1.
 */
export async function resolveLineVatBatch(
  supabase: any,
  productIds: (string | null | undefined)[],
  tenantDefaultRate: number
): Promise<Map<string, LineVatResolution>> {
  const result = new Map<string, LineVatResolution>();
  const validIds = productIds.filter((id): id is string => !!id);
  if (validIds.length === 0) return result;

  const { data: products, error } = await supabase
    .from('products')
    .select('id, vat_rate_id, vat_rates:vat_rate_id(id, rate)')
    .in('id', validIds);

  if (error) {
    console.warn('[vat] resolveLineVatBatch failed, falling back to tenant default:', error.message);
    // Graceful fallback: return empty map so callers use tenant default
    return result;
  }

  for (const p of products || []) {
    const joined = (p as any).vat_rates;
    if (p.vat_rate_id && joined && typeof joined.rate === 'number') {
      result.set(p.id, {
        vat_rate: Number(joined.rate),
        vat_rate_id: p.vat_rate_id,
      });
    } else {
      result.set(p.id, {
        vat_rate: tenantDefaultRate,
        vat_rate_id: null,
      });
    }
  }

  return result;
}

/**
 * Resolves a single product's VAT. Uses the batch map when available,
 * falls back to tenant default otherwise. Safe for items without a product_id.
 */
export function resolveLineVatSync(
  productId: string | null | undefined,
  batchMap: Map<string, LineVatResolution>,
  tenantDefaultRate: number
): LineVatResolution {
  if (productId && batchMap.has(productId)) {
    return batchMap.get(productId)!;
  }
  return { vat_rate: tenantDefaultRate, vat_rate_id: null };
}

/**
 * Extracts the VAT amount from a VAT-inclusive gross amount.
 * Example: gross=121, vatRate=21 → returns 21.00
 * Returns 0 for zero or negative rates.
 */
export function extractVatFromGross(grossAmount: number, vatRate: number): number {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round(grossAmount * (vatRate / (100 + vatRate)) * 100) / 100;
}

/**
 * B2B-2b — SINGLE source of truth for the reverse-charge decision.
 * True ONLY for a validated EU VAT number from a country other than the
 * tenant's own country (intracommunautaire levering, art. 39bis WBTW).
 * Domestic B2B (BE -> BE) keeps normal VAT.
 */
export function isReverseCharged(opts: {
  is_b2b: boolean;
  vat_verified: boolean;
  vat_country: string | null;
  tenant_country: string;
}): boolean {
  if (!opts.is_b2b) return false;
  if (!opts.vat_verified) return false;
  const c = (opts.vat_country || '').trim().toUpperCase();
  if (!c || !isEuCountry(c)) return false;
  const t = (opts.tenant_country || '').trim().toUpperCase();
  if (!t) return false;
  return c !== t;
}

/**
 * B2B-2b — SINGLE source of truth for the reverse-charge arithmetic.
 * Strips VAT out of a VAT-inclusive gross amount. rate <= 0 → unchanged.
 */
export function netFromGross(grossAmount: number, vatRate: number): number {
  if (!vatRate || vatRate <= 0) return grossAmount;
  return Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100;
}
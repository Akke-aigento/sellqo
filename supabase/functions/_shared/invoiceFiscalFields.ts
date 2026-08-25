// BILL-2 — canonieke afleiding van de fiscale velden op een factuur.
//
// Bestaansreden: `resolveVatRegime` berekent `isB2B` intern (regimeResolver.ts:233)
// maar geeft het NIET terug — `RegimeInvoiceLevel` kent alleen `vat_regime`,
// `reporting_country` en de twee `vat_number_validated_*`. Elke aanroeper moet
// `is_b2b` dus zelf uit de customer halen, en drie van de vier deden dat verkeerd
// of niet. Deze helper zet die afleiding op één plek.
//
// Contract: geeft ALTIJD een object terug. Nooit `null`, nooit een throw. Een
// fiscale fout mag nooit een factuur-creatie of een Stripe-webhook laten klappen.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  resolveVatRegime,
  type RegimeInputLine,
  type RegimePerLine,
  type SalesChannel,
  type VatRegimeCode,
} from "./regimeResolver.ts";

/**
 * Structureel client-type: accepteert zowel de `SupabaseClient` van
 * generate-subscription-invoices als het lichtere `SupabaseLike` uit
 * subscriptionCharge.ts. `.functions` is optioneel — ontbreekt het, dan slaat de
 * resolver de VIES-validatie over en valt terug op domestic_standard.
 */
export interface FiscalSupabaseLike {
  // `any` is hier bewust: de fluent query-builder van supabase-js is niet
  // structureel te typeren zonder de generics mee te slepen. Identiek aan het
  // bestaande SupabaseLike in subscriptionCharge.ts:13-17.
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functions?: { invoke: (name: string, opts?: Record<string, unknown>) => any };
}

export interface InvoiceFiscalInput {
  tenant_id: string;
  /** Mag null zijn (billing_cycles.customer_id is nullable) — geeft dan een degraded resultaat. */
  customer_id: string | null | undefined;
  /** Eén entry per factuurregel, in DEZELFDE volgorde als de te inserten regels: per_line[i] hoort bij regel i. */
  invoice_lines: RegimeInputLine[];
  /** ISO yyyy-mm-dd — de issue_date van de factuur. Verplicht: zonder deze waarde valt de
   *  resolver stil terug op vandaag (regimeResolver.ts:230) en is een re-run niet reproduceerbaar. */
  order_date: string;
  sales_channel?: SalesChannel;
  override_regime?: VatRegimeCode;
}

/** Precies de kolommen die op `invoices` gezet worden. Optionele velden worden
 *  weggelaten uit de insert wanneer ze onbekend zijn, zodat de DB-default geldt. */
export interface InvoiceFiscalFields {
  is_b2b?: boolean;
  vat_regime: VatRegimeCode;
  reporting_country?: string;
  peppol_status: "pending" | "not_applicable";
  vat_number_validated_at?: string;
  vat_number_validated_value?: string;
}

export interface InvoiceFiscalResult {
  /** Spread dit direct in de invoices-insert. */
  fields: InvoiceFiscalFields;
  /** [] wanneer de resolver faalde; anders één entry per invoice_lines-element. */
  per_line: RegimePerLine[];
  /** true zodra iets is teruggevallen. Caller logt dit en zet metadata.fiscal_resolution_degraded. */
  degraded: boolean;
  warnings: string[];
  error?: string;
}

/** Regimes waarbij het tarief uit de PRODUCTCATEGORIE volgt in plaats van uit het regime.
 *  Abonnementsregels dragen geen product_category, dus de resolver kan daar alleen 21%
 *  zeggen — de opgeslagen regel is dan de betere informatie. Zie generate-subscription-invoices. */
const DOMESTIC_FAMILY: ReadonlySet<VatRegimeCode> = new Set<VatRegimeCode>([
  "domestic_standard",
  "domestic_reduced_6",
  "domestic_reduced_12",
]);

export function isDomesticFamilyRegime(regime: VatRegimeCode): boolean {
  return DOMESTIC_FAMILY.has(regime);
}

/** Peppol wordt vanaf deze datum verplicht voor Belgische B2B. Overgenomen uit
 *  generate-invoice/index.ts:1429, waar hij eveneens inline hardcoded staat. */
const PEPPOL_MANDATORY_FROM = "2026-01-01";

export async function resolveInvoiceFiscalFields(
  supabase: FiscalSupabaseLike,
  input: InvoiceFiscalInput,
): Promise<InvoiceFiscalResult> {
  const warnings: string[] = [];

  const degradedResult = (reason: string, extra?: Partial<InvoiceFiscalFields>): InvoiceFiscalResult => ({
    fields: { vat_regime: "domestic_standard", peppol_status: "not_applicable", ...extra },
    per_line: [],
    degraded: true,
    warnings: [...warnings, reason],
    error: reason,
  });

  try {
    if (!input.customer_id) {
      // Spiegelt de guard op generate-invoice/index.ts:1479. Geen customer = geen
      // klantfeiten; niets raden, alles op de DB-defaults laten.
      return degradedResult("no customer_id");
    }

    // ---- 1. Klantfeiten voor is_b2b ----
    let isB2B: boolean | undefined;
    let customerCountry: string | undefined;
    let customerFetchFailed = false;
    try {
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("customer_type, billing_country")
        .eq("id", input.customer_id)
        .eq("tenant_id", input.tenant_id)
        .maybeSingle();
      if (custErr) throw new Error(custErr.message);
      if (!customer) throw new Error("customer not found");
      // Mét .toLowerCase(), gelijk aan regimeResolver.ts:233 — niet de strikte
      // variant van generate-invoice:1346. Twee plekken die hetzelfde beweren
      // mogen niet uiteenlopen bij een afwijkend gecased record.
      isB2B = String((customer as { customer_type?: string | null }).customer_type ?? "")
        .toLowerCase() === "b2b";
      const bc = (customer as { billing_country?: string | null }).billing_country;
      customerCountry = bc ? String(bc).toUpperCase() : undefined;
    } catch (e) {
      customerFetchFailed = true;
      warnings.push(`customer lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ---- 2. Tenantland, alleen wanneer het de Peppol-uitkomst kan beïnvloeden ----
    // Voor B2C is isBelgianB2B per definitie false; die query overslaan scheelt
    // een round-trip per iteratie in de cron-loop van pad 1.
    let tenantCountry: string | undefined;
    if (isB2B === true) {
      try {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("country")
          .eq("id", input.tenant_id)
          .maybeSingle();
        const tc = (tenant as { country?: string | null } | null)?.country;
        tenantCountry = tc ? String(tc).toUpperCase() : undefined;
      } catch (e) {
        warnings.push(`tenant lookup failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ---- 3. Regime via de canonieke resolver ----
    let vatRegime: VatRegimeCode = "domestic_standard";
    let reportingCountry: string | undefined = customerCountry;
    let perLine: RegimePerLine[] = [];
    let validatedAt: string | undefined;
    let validatedValue: string | undefined;
    let resolverFailed = false;
    try {
      const resolution = await resolveVatRegime(supabase as unknown as SupabaseClient, {
        tenant_id: input.tenant_id,
        customer_id: input.customer_id,
        invoice_lines: input.invoice_lines,
        sales_channel: input.sales_channel ?? "b2b_direct",
        order_date: input.order_date,
        ...(input.override_regime ? { override_regime: input.override_regime } : {}),
      });
      vatRegime = resolution.invoice_level.vat_regime;
      reportingCountry = resolution.invoice_level.reporting_country || customerCountry;
      validatedAt = resolution.invoice_level.vat_number_validated_at;
      validatedValue = resolution.invoice_level.vat_number_validated_value;
      perLine = resolution.per_line;
      warnings.push(...resolution.warnings);
    } catch (e) {
      resolverFailed = true;
      warnings.push(`regime resolution failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ---- 4. Peppol-status ----
    // Overgenomen uit generate-invoice/index.ts:1428-1429 + 1456, met één bewuste
    // afwijking: de datumgate leest `order_date` in plaats van new Date(). Pad 1 kan
    // tot `generate_days_before` dagen vooraf draaien; een factuur met issue_date
    // 2025-12-30 hoort niet Peppol-plichtig te zijn omdat de cron op 2026-01-02 liep.
    // Voor order_date === vandaag is het gedrag identiek aan generate-invoice.
    const isBelgianB2B = isB2B === true && (customerCountry === "BE" || tenantCountry === "BE");
    const peppolRequired = isBelgianB2B && input.order_date >= PEPPOL_MANDATORY_FROM;
    // peppol_required (de kolom) wordt bewust NIET gezet — generate-invoice doet dat
    // evenmin. Zie BILL-2 besluit 2.

    const fields: InvoiceFiscalFields = {
      vat_regime: vatRegime,
      peppol_status: peppolRequired ? "pending" : "not_applicable",
      ...(isB2B !== undefined ? { is_b2b: isB2B } : {}),
      ...(reportingCountry ? { reporting_country: reportingCountry } : {}),
      ...(validatedAt ? { vat_number_validated_at: validatedAt } : {}),
      ...(validatedValue ? { vat_number_validated_value: validatedValue } : {}),
    };

    const degraded = customerFetchFailed || resolverFailed;
    return {
      fields,
      per_line: perLine,
      degraded,
      warnings,
      ...(degraded ? { error: warnings[warnings.length - 1] } : {}),
    };
  } catch (e) {
    // Vangnet: het contract is "throwt nooit". Ook een onverwachte fout in de
    // bovenstaande logica mag geen factuur of webhook laten klappen.
    return degradedResult(`unexpected: ${e instanceof Error ? e.message : String(e)}`);
  }
}

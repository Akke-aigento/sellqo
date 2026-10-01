// HOTFIX-BILLING-TENANT-1 — de tenant waaronder SellQo zijn eigen klanten factureert.
//
// Vier functies zochten hem met `.eq("is_internal_tenant", true).maybeSingle()`:
// dat werkt alleen zolang er precies één interne winkel bestaat. Sinds 28/29-09
// stonden er vijf op intern (SellQo, VanXcel, Loveke, The Fonske Crawl, Studio
// Akke); `maybeSingle` gaf dan een fout, en de facturatiepagina, planwijzigingen,
// machtigingen en het downloaden van facturen braken voor elke winkel.
//
// `is_internal_tenant` betekent ook "Stripe via het platformaccount"
// (getStripeContext) en "geen facturatie" — geen goede sleutel om dé
// facturatietenant aan te wijzen. De slug wel: uniek, en die van SellQo verandert
// niet. Live 01-10: slug `sellqo` = d03c63fe-…, de tenant van alle billing_cycles
// en van elke billing_customer_id in tenant_subscriptions.

export const BILLING_TENANT_SLUG = "sellqo";

/**
 * De facturatietenant, of null als hij niet bestaat. `columns` zoals bij een
 * gewone select; `id` zit er altijd in. Een fout wordt doorgegeven.
 */
export async function loadBillingTenant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  columns = "id",
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const cols = columns.split(",").map((c) => c.trim()).includes("id") ? columns : `id, ${columns}`;
  return await supabase
    .from("tenants")
    .select(cols)
    .eq("slug", BILLING_TENANT_SLUG)
    .maybeSingle();
}

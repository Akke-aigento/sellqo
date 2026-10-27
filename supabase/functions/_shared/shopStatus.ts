// BILLING-LOCK-2 — staat de webshop van deze winkel open?
//
// Eén bron voor elke frontend (eigen Lovable-frontends én de gehoste storefront):
// storefront-api `get_shop_status` → { open: boolean }. Tot 27-10 zette een winkel
// zichzelf offline met een schakelaar in de code van zijn eigen frontend; die wist
// niets van betalingen (Astra Sleep bleef 6 dagen dicht na betaling).
//
// Dicht als:
//   1. de winkel zichzelf offline zette (tenant_theme_settings.storefront_status = 'offline',
//      Instellingen → Webshop → Status; dezelfde vlag die de ingebouwde winkel al volgde), of
//   2. SellQo de winkel opschortte wegens een openstaande betaling: de opgeslagen toestand
//      (tenant_subscriptions.status, gezet door de cron van 07:45 die dan ook meldt) is
//      `suspended` ÉN de live berekening zegt nog steeds `suspended`. Zo gaat een winkel
//      nooit stil dicht vóór de melding, en meteen open zodra er betaald is (ook als de
//      webhook de opgeslagen toestand nog niet bijwerkte). `canceled` e.d. nooit.
// Nooit dicht door facturatie voor demo-, interne, vrijgestelde of "gratis tot
// omschakeling"-winkels (billing_on_hold).
//
// De reden gaat bewust niet naar buiten: de bezoeker ziet enkel "even dicht".
// Fail-open: kan de status niet bepaald worden, dan blijft de winkel open.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele client */
import { loadBillingState } from "./billingGuard.ts";
import { isBillingExempt } from "./billingExempt.ts";

type Client = { from: (table: string) => any };

export interface ShopStatus {
  open: boolean;
}

export interface ShopStatusInternal extends ShopStatus {
  reason: "open" | "maintenance" | "suspended" | "error";
}

export async function resolveShopStatus(
  client: Client,
  tenantId: string,
  loadState: (c: Client, id: string) => Promise<string> = loadBillingState as any,
): Promise<ShopStatusInternal> {
  try {
    const [{ data: tenant, error: tErr }, { data: theme, error: thErr }] = await Promise.all([
      client.from("tenants").select("is_demo, is_internal_tenant, billing_exempt, billing_on_hold").eq("id", tenantId).maybeSingle(),
      client.from("tenant_theme_settings").select("storefront_status").eq("tenant_id", tenantId).maybeSingle(),
    ]);
    if (tErr) throw new Error(tErr.message);
    if (thErr) throw new Error(thErr.message);
    if (theme?.storefront_status === "offline") return { open: false, reason: "maintenance" };
    if (!tenant) return { open: true, reason: "open" };
    if (tenant.is_demo === true || isBillingExempt(tenant) || tenant.billing_on_hold === true) {
      return { open: true, reason: "open" };
    }
    const { data: sub, error: sErr } = await client
      .from("tenant_subscriptions").select("status").eq("tenant_id", tenantId).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (sub?.status !== "suspended") return { open: true, reason: "open" };
    const state = await loadState(client, tenantId);
    if (state === "suspended") return { open: false, reason: "suspended" };
    return { open: true, reason: "open" };
  } catch (e) {
    console.warn("[shop-status] fail-open", e instanceof Error ? e.message : String(e));
    return { open: true, reason: "error" };
  }
}

// Korte cache per isolate: elke paginaweergave van een frontend vraagt dit op.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: ShopStatusInternal }>();

export async function cachedShopStatus(client: Client, tenantId: string, now = Date.now()): Promise<ShopStatusInternal> {
  const hit = cache.get(tenantId);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = await resolveShopStatus(client, tenantId);
  // Een fout niet cachen: de volgende aanvraag probeert opnieuw.
  if (value.reason !== "error") cache.set(tenantId, { at: now, value });
  return value;
}

/** Enkel voor tests. */
export function clearShopStatusCache(): void {
  cache.clear();
}

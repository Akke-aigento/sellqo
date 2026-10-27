// PAYMENT-ALERT-1 / BILLING-LOCK-2 — meteen weer open na betaling, en het ook zeggen.
//
// Tot 27-10 herberekende de webhook na een betaling de toestand van de winkel
// (refreshBillingStateForCustomer in billingGuard.ts), maar meldde niets: de klant wist niet
// dat zijn winkel weer open stond, en SellQo (Akke) evenmin. Astra Sleep bleef zo 6 dagen
// dicht na betaling (toen nog via een schakelaar in zijn eigen frontend).
//
// Deze module doet hetzelfde als refreshBillingStateForCustomer en meldt een wissel:
//   - aan de winkel zelf (hoog = ook per mail): "Je winkel is weer volledig open";
//   - aan SellQo: "Winkel heropend: <naam>".
// Bewust een eigen bestand: billingGuard.ts wordt door een twintigtal functies
// geïmporteerd; dit raakt enkel de betaalpaden (subscriptionCharge.ts).
//
// Best effort: een fout hier mag de betaalafhandeling nooit breken.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele client */
import { loadBillingState } from "./billingGuard.ts";
import { loadBillingTenant } from "./billingTenant.ts";
import { notifyOnce } from "./billingAlerts.ts";
import { notificationRoute } from "./notificationRoutes.ts";

type Client = { from: (table: string) => any };

const LOCKED = new Set(["past_due", "restricted", "suspended"]);
const MANAGED = new Set(["trialing", "active", "past_due", "restricted", "suspended"]);

export const STATE_LABEL: Record<string, string> = {
  trialing: "proefperiode",
  active: "actief",
  past_due: "betaling achterstallig",
  restricted: "leesmodus",
  suspended: "opgeschort (webshop offline)",
};

export interface StateChange {
  tenantId: string;
  tenantName: string;
  from: string;
  to: string;
}

/** Herbereken de toestand van de winkel van deze facturatieklant; geef de wissel terug. */
export async function refreshStateForCustomer(client: Client, customerId: string | null | undefined): Promise<StateChange | null> {
  if (!customerId) return null;
  try {
    const { data: sub } = await client
      .from("tenant_subscriptions")
      .select("tenant_id, status")
      .eq("billing_customer_id", customerId)
      .maybeSingle();
    if (!sub?.tenant_id || !MANAGED.has(String(sub.status))) return null;
    const state = await loadBillingState(client as any, sub.tenant_id as string);
    if (state === sub.status) return null;
    // Voorwaardelijk: wijzigde iemand anders (cron, tweede betaling) de status intussen, dan
    // is dat zijn wissel en meldt hij die; wij schrijven en melden niets.
    const { data: upd, error } = await client
      .from("tenant_subscriptions")
      .update({ status: state, updated_at: new Date().toISOString() })
      .eq("tenant_id", sub.tenant_id)
      .eq("status", sub.status)
      .select("tenant_id");
    if (error) throw new Error(error.message);
    if (!upd || upd.length === 0) return null;
    const { data: t } = await client.from("tenants").select("name").eq("id", sub.tenant_id).maybeSingle();
    console.log("[billing] state refreshed", { tenant_id: sub.tenant_id, from: sub.status, to: state });
    return { tenantId: sub.tenant_id as string, tenantName: String(t?.name ?? sub.tenant_id), from: String(sub.status), to: state };
  } catch (e) {
    console.warn("[billing] state refresh failed", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Meld een heropening (van achterstallig/leesmodus/opgeschort naar actief) aan winkel en SellQo. */
export async function announceReopen(client: Client, change: StateChange | null): Promise<void> {
  if (!change || change.to !== "active" || !LOCKED.has(change.from)) return;
  const hour = new Date().toISOString().slice(0, 13);
  const data = { tenant_id: change.tenantId, tenant_name: change.tenantName, from: change.from, to: change.to };
  try {
    await notifyOnce(client as any, {
      tenantId: change.tenantId,
      category: "subscriptions",
      type: "subscription_reactivated",
      priority: "high",
      title: "Je winkel is weer volledig open",
      // Neutraal over de webshop: bij een bundelbetaling ziet de laatste post enkel
      // "achterstallig → actief", ook als de winkel daarvoor opgeschort was.
      message: "We ontvingen je betaling. Je winkel, webshop inbegrepen, werkt weer volledig. Dank je!",
      dedupeKey: `reopen:${change.tenantId}:${hour}`,
      actionUrl: notificationRoute({ category: "subscriptions", type: "subscription_state_changed", data }),
      data,
    });
  } catch (e) {
    console.warn("[billing] reopen notice (tenant) failed", e instanceof Error ? e.message : String(e));
  }
  await announceReopenToSellqo(client, change, true);
}

/** Meld een heropening aan SellQo. `viaPayment`: de webhook zag de betaling; anders de dagelijkse cron. */
export async function announceReopenToSellqo(client: Client, change: StateChange, viaPayment: boolean): Promise<void> {
  if (change.to !== "active" || !LOCKED.has(change.from)) return;
  await notifySellqo(client, {
    type: "subscription_reactivated",
    priority: "high",
    title: `Winkel heropend: ${change.tenantName}`,
    message: `${viaPayment ? "Betaling ontvangen; " : ""}${change.tenantName} staat weer op actief (was: ${STATE_LABEL[change.from] ?? change.from}). De webshop is open.`,
    dedupeKey: `reopen-sellqo:${change.tenantId}:${new Date().toISOString().slice(0, 13)}`,
    data: { tenant_id: change.tenantId, tenant_name: change.tenantName, from: change.from, to: change.to },
  });
}

/** Meld een wissel naar leesmodus of opgeschort aan SellQo (de winkel krijgt zijn eigen melding). */
export async function announceBlockToSellqo(client: Client, change: StateChange): Promise<void> {
  if (change.to !== "restricted" && change.to !== "suspended") return;
  await notifySellqo(client, {
    type: "subscription_state_changed",
    priority: "urgent",
    title: change.to === "suspended" ? `Winkel opgeschort: ${change.tenantName}` : `Winkel in leesmodus: ${change.tenantName}`,
    message: change.to === "suspended"
      ? `${change.tenantName} is opgeschort wegens een openstaande betaling. Hun webshop staat offline tot de betaling binnen is.`
      : `${change.tenantName} staat in leesmodus wegens een openstaande betaling. Hun webshop blijft online.`,
    dedupeKey: `block-sellqo:${change.tenantId}:${change.to}:${new Date().toISOString().slice(0, 10)}`,
    data: { tenant_id: change.tenantId, tenant_name: change.tenantName, from: change.from, to: change.to },
  });
}

async function notifySellqo(client: Client, n: {
  type: string; priority: "high" | "urgent"; title: string; message: string; dedupeKey: string; data: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: billing } = await loadBillingTenant(client);
    const sellqoId = billing?.id as string | undefined;
    if (!sellqoId || sellqoId === n.data.tenant_id) return;
    await notifyOnce(client as any, { tenantId: sellqoId, category: "subscriptions", ...n });
  } catch (e) {
    console.warn("[billing] SellQo notice failed", e instanceof Error ? e.message : String(e));
  }
}

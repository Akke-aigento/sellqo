// BILLING-ENFORCE-1 — serverkant van de leesmodus.
//
// De app verbergt knoppen (useCan), maar dat is cosmetisch: wie de edge-functie
// rechtstreeks aanroept, schrijft gewoon door. Deze guard staat naast
// `requireRole` in _shared/auth.ts en hanteert dezelfde bypasses.
//
// Bewust GEEN guard in `authenticateRequest` zelf: de betaalfuncties
// (get-platform-billing-status, create-cycle-payment-link,
// create-platform-mandate-setup) gebruiken die ook — een blanket-guard zou een
// winkel die wil betalen buitensluiten, en dan komt hij er nooit meer uit.
//
// De webshop van de klant raakt dit nooit: storefront-api, storefront-customer-api
// en storefront-resolve importeren _shared/auth.ts niet en dus deze guard ook niet.

import { AuthError, type AuthResult } from "./auth.ts";
import { billingAllows, resolveBillingState, type BillingState } from "./billingState.ts";

/** 402: "betaal om verder te gaan" — te onderscheiden van 403 (rol). */
export const BILLING_BLOCKED_STATUS = 402;

export interface BillingGuardClient {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/**
 * De toestand van één winkel, uit de database. Leest alleen; de dagelijkse
 * `sync-billing-state` schrijft. Zo klopt de guard ook tussen twee cron-runs in.
 */
export async function loadBillingState(
  client: BillingGuardClient,
  tenantId: string,
  now: Date = new Date(),
): Promise<BillingState> {
  const { data: sub } = await client
    .from("tenant_subscriptions")
    .select("status, trial_end, plan_id, billing_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!sub) return "active"; // geen abonnement = niets af te dwingen

  const customerId = sub.billing_customer_id as string | null;
  if (!customerId) {
    return resolveBillingState({ subscription: sub, now }).state;
  }

  const [{ data: cycles }, { data: invoices }] = await Promise.all([
    client
      .from("billing_cycles")
      .select("id, status, due_date, grace_until, total, invoice_id, checkout_session_url, payment_request_number")
      .eq("customer_id", customerId)
      .in("status", ["awaiting_payment", "reopened", "expired"]),
    client
      .from("invoices")
      .select("id, status, dunning_level, due_date, last_reminder_at, total, invoice_number")
      .eq("customer_id", customerId)
      .in("status", ["unpaid", "sent"]),
  ]);

  return resolveBillingState({ subscription: sub, cycles: cycles ?? [], invoices: invoices ?? [], now }).state;
}

/**
 * Blokkeert een schrijfactie wanneer de winkel in leesmodus staat. `resource`
 * volgt dezelfde sleutels als de permissiematrix in src/hooks/useCan.ts, zodat
 * app en server dezelfde uitzonderingen kennen.
 */
export async function requireBillingState(
  client: BillingGuardClient,
  auth: AuthResult,
  tenantId: string,
  resource: string,
  action: string = "write",
): Promise<void> {
  if (auth.user_id === "service_role") return; // cron, webhooks, marketplace-syncs
  if (auth.is_platform_admin) return;

  const state = await loadBillingState(client, tenantId);
  const decision = billingAllows(state, action, resource);
  if (!decision.allowed) {
    throw new AuthError(
      `Abonnement ${state}: deze actie is pas weer beschikbaar na betaling`,
      BILLING_BLOCKED_STATUS,
    );
  }
}

/**
 * BILLING-ENFORCE-1 — meteen weer open na betaling.
 *
 * De dagelijkse `sync-billing-state` is het vangnet; dit is het directe pad:
 * zodra een cyclus settled of een factuur betaald is, herberekent de webhook de
 * toestand van die winkel. Zonder dit zou een klant die vanavond betaalt tot de
 * volgende ochtend 07:45 in leesmodus blijven zitten.
 *
 * Best effort: een fout hier mag de betaalafhandeling nooit breken.
 */
export async function refreshBillingStateForCustomer(
  client: BillingGuardClient,
  customerId: string | null | undefined,
): Promise<void> {
  if (!customerId) return;
  try {
    const { data: sub } = await client
      .from("tenant_subscriptions")
      .select("tenant_id, status")
      .eq("billing_customer_id", customerId)
      .maybeSingle();
    if (!sub?.tenant_id) return;
    // `canceled` en onbekende statussen laat de machine met rust.
    if (!["trialing", "active", "past_due", "restricted", "suspended"].includes(String(sub.status))) return;

    const state = await loadBillingState(client, sub.tenant_id as string);
    if (state === sub.status) return;
    await client
      .from("tenant_subscriptions")
      .update({ status: state, updated_at: new Date().toISOString() })
      .eq("tenant_id", sub.tenant_id);
    console.log("[billing] state refreshed", { tenant_id: sub.tenant_id, from: sub.status, to: state });
  } catch (e) {
    console.warn("[billing] state refresh failed", e instanceof Error ? e.message : String(e));
  }
}

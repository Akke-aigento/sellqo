// BILL-FIX-1 (11-10-2026) — wat gebeurt er als een proefperiode afloopt?
//
// Tot nu toe pakte check-expired-trials alleen rijen met status 'trialing' en
// zette die op het free-plan. Klantwinkels met status 'active' + trial_end
// (Mancini, Benny Rich, Loveke) vielen erbuiten: na de trial bleven ze gratis
// op hun betaalde plan, zonder abonnement en zonder betaalverzoek. Astra Sleep
// betaalde alleen omdat er handmatig een abonnement was aangemaakt.
//
// Keuze van Akke (11-10-2026): bij trial-einde automatisch een pay-first
// abonnement op het huidige plan + eerste betaalverzoek. Uitzonderingen:
//   - demo-winkels: niet aanraken;
//   - eigen winkels (billing_exempt / is_internal_tenant): trial wissen, nooit factureren;
//   - "gratis tot omschakeling" (billing_on_hold): wachten tot de schakelaar uit gaat;
//   - free-plan of al een abonnement: niets te doen.
//
// Puur en getest (src/test/trialEnd.test.ts); de functie doet alleen de I/O.

export type TrialEndTenant = {
  is_demo?: boolean | null;
  is_internal_tenant?: boolean | null;
  billing_exempt?: boolean | null;
  billing_on_hold?: boolean | null;
};

export type TrialEndSubscription = {
  plan_id?: string | null;
  status?: string | null;
  trial_end?: string | null;
  billing_subscription_id?: string | null;
};

export type TrialEndDecision =
  | "not_expired"
  | "skip_demo"
  | "clear_exempt"
  | "hold"
  | "skip_free"
  | "skip_has_billing"
  | "skip_status"
  | "activate";

const OPEN_STATUSES = new Set(["trialing", "active"]);

export function decideTrialEnd(
  tenant: TrialEndTenant | null | undefined,
  sub: TrialEndSubscription,
  now: Date = new Date(),
): TrialEndDecision {
  if (!sub.trial_end || new Date(sub.trial_end).getTime() > now.getTime()) return "not_expired";
  if (!tenant || tenant.is_demo) return "skip_demo";
  if (tenant.is_internal_tenant || tenant.billing_exempt) return "clear_exempt";
  if (!OPEN_STATUSES.has(String(sub.status ?? ""))) return "skip_status";
  if (!sub.plan_id || sub.plan_id === "free") return "skip_free";
  if (sub.billing_subscription_id) return "skip_has_billing";
  if (tenant.billing_on_hold) return "hold";
  return "activate";
}

export function normalizeInterval(value: unknown): "monthly" | "yearly" {
  return value === "yearly" ? "yearly" : "monthly";
}

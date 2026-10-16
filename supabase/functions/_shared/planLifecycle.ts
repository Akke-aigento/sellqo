// SUB-UNIFY-2A (16-10-2026) — levenscyclus van een SellQo-abonnement: opzeggen en
// het einde van de betaalde periode.
//
// Het gat (docs/prepared/2026-10-16-billing-batchplannen.md §3.3):
//   L1  opzeggen liet het betaalde plan staan, en niets zette het ooit op Free;
//   L2  Free kiezen ging meteen in: de betaalde resttermijn was weg;
//   L3  een rechtstreeks geannuleerd facturatie-abonnement gaf gratis toegang voor altijd.
//
// Keuze van Akke (16-10): opzeggen en Free kiezen gaan in op het EINDE van de betaalde
// periode. Tot dan blijft het plan actief. Een dagelijkse sweep
// (subscription-lifecycle-sweep) zet de winkel daarna op Free, en draait eerst als dry-run.
//
// Puur en zonder imports: gedeeld door sync-tenant-plan en de sweep, getest door
// planLifecycle.test.ts (deno test). De functies doen alleen de I/O.

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'JJJJ-MM-DD' + n dagen (UTC). */
export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function ts(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

// ---------------------------------------------------------------------------
// 1. Opzeggen / Free kiezen (sync-tenant-plan)
// ---------------------------------------------------------------------------

export type CancelInput = {
  /** tenant_subscriptions.plan_id vóór de opzegging. */
  currentPlanId?: string | null;
  /** Kost het huidige plan iets per periode? (false voor free en Events Flex.) */
  currentPlanIsPaid: boolean;
  /** tenant_subscriptions.current_period_end: tot wanneer is er betaald. */
  currentPeriodEnd?: string | null;
  billingSubscriptionId?: string | null;
  /** subscriptions.status van het facturatie-abonnement. */
  billingSubscriptionStatus?: string | null;
  /** subscriptions.next_invoice_date: start van de volgende, nog niet aangemaakte periode. */
  nextInvoiceDate?: string | null;
};

export type CancelDecision =
  | {
    mode: "at_period_end";
    /** Tot dit moment blijft het huidige plan actief (= current_period_end). */
    accessUntil: string;
    /**
     * subscriptions.end_date: de laatste dag van de periode. De runner
     * (generate-subscription-invoices) slaat een abonnement over zodra
     * end_date < next_invoice_date, dus er komt geen nieuwe cyclus. Zelfde
     * patroon als mail-billing-api cancelSubscription.
     */
    billingEndDate: string;
  }
  | {
    mode: "immediate";
    reason:
      | "not_paid_plan"
      | "no_billing_subscription"
      | "billing_subscription_inactive"
      | "no_running_period";
  };

export function decideCancel(input: CancelInput, now: Date = new Date()): CancelDecision {
  if (!input.currentPlanId || !input.currentPlanIsPaid) return { mode: "immediate", reason: "not_paid_plan" };
  if (!input.billingSubscriptionId) return { mode: "immediate", reason: "no_billing_subscription" };
  if (input.billingSubscriptionStatus !== "active") {
    return { mode: "immediate", reason: "billing_subscription_inactive" };
  }
  const end = ts(input.currentPeriodEnd);
  if (end === null || end <= now.getTime()) return { mode: "immediate", reason: "no_running_period" };

  // Laatste dag = dag vóór de volgende factuurdatum. Ontbreekt die, dan de dag vóór
  // het periode-einde. Nooit vóór vandaag: een end_date in het verleden is hetzelfde
  // signaal voor de runner, maar leest verwarrend.
  const base = input.nextInvoiceDate ?? String(input.currentPeriodEnd).slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  let billingEndDate = addDaysISO(base, -1);
  if (billingEndDate < today) billingEndDate = today;
  return { mode: "at_period_end", accessUntil: String(input.currentPeriodEnd), billingEndDate };
}

// ---------------------------------------------------------------------------
// 2. Opzegging ongedaan maken (sync-tenant-plan, switch naar het huidige plan)
// ---------------------------------------------------------------------------

export type PendingCancellation = {
  cancel_at_period_end?: boolean | null;
  pending_plan_id?: string | null;
  current_period_end?: string | null;
};

/** Staat er een opzegging tegen het einde van de periode open? */
export function hasPendingCancellation(sub: PendingCancellation | null | undefined): boolean {
  return !!sub && sub.cancel_at_period_end === true && sub.pending_plan_id === "free";
}

export type ResumeDecision =
  | { resume: true }
  | { resume: false; reason: "nothing_to_resume" | "billing_subscription_inactive" | "period_ended" };

/**
 * Mag een openstaande opzegging nog teruggedraaid worden? Alleen zolang het
 * facturatie-abonnement nog loopt en de periode niet voorbij is; anders kiest de
 * winkel gewoon opnieuw een plan (activate) na de overgang naar Free.
 */
export function decideResume(
  sub: PendingCancellation | null | undefined,
  billingSubscriptionStatus: string | null | undefined,
  now: Date = new Date(),
): ResumeDecision {
  if (!hasPendingCancellation(sub)) return { resume: false, reason: "nothing_to_resume" };
  if (billingSubscriptionStatus !== "active") return { resume: false, reason: "billing_subscription_inactive" };
  const end = ts(sub!.current_period_end);
  if (end === null || end <= now.getTime()) return { resume: false, reason: "period_ended" };
  return { resume: true };
}

// ---------------------------------------------------------------------------
// 3. De dagelijkse sweep (subscription-lifecycle-sweep)
// ---------------------------------------------------------------------------

/** Statussen van tenant_subscriptions die "gestopt" betekenen. */
export const ENDED_TS_STATUSES = new Set(["canceled", "cancelled", "expired"]);
/** Statussen van subscriptions (facturatie) die "gestopt" betekenen. */
export const ENDED_BILLING_STATUSES = new Set(["cancelled", "canceled", "ended", "expired"]);

export const BILLING_TENANT_SLUG = "sellqo";

export type SweepRow = {
  tenant_id: string;
  tenant_name?: string | null;
  slug?: string | null;
  is_demo?: boolean | null;
  is_internal_tenant?: boolean | null;
  billing_exempt?: boolean | null;
  billing_on_hold?: boolean | null;
  plan_id?: string | null;
  /** Kost het plan iets per periode (maand- of jaarprijs > 0)? */
  plan_is_paid: boolean;
  status?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean | null;
  pending_plan_id?: string | null;
  billing_subscription_id?: string | null;
  billing_subscription_status?: string | null;
};

export type SweepTrigger = "cancelled_at_period_end" | "status_ended" | "billing_subscription_ended";

export type SweepDecision =
  | { action: "ignore"; reason: "free_or_usage_plan" | "not_ended" }
  | { action: "scheduled"; triggers: SweepTrigger[]; reason: "period_running" }
  | {
    action: "excluded";
    triggers: SweepTrigger[];
    reason: "billing_tenant" | "exempt" | "on_hold" | "demo" | "no_period_end" | "trial_running";
  }
  | { action: "downgrade"; triggers: SweepTrigger[] };

/**
 * Wat doet de sweep met deze winkel? Volgorde:
 *  1. alleen betaalde plannen (free en Events Flex: niets te doen);
 *  2. er moet een stopsignaal zijn (opzegging, gestopte status of gestopt facturatie-abonnement);
 *  3. de betaalde periode moet voorbij zijn;
 *  4. uitsluitingen: de facturatietenant, eigen winkels (billing_exempt /
 *     is_internal_tenant), "gratis tot omschakeling" (billing_on_hold: Sander's winkels),
 *     demo's, een lopende proef, of geen periode-einde (handmatig bekijken);
 *  5. anders: naar Free.
 * Uitsluitingen komen ná 2 en 3, zodat de dry-run ook toont wie er zonder die
 * uitsluiting geraakt zou worden.
 */
export function decidePlanEnding(row: SweepRow, now: Date = new Date()): SweepDecision {
  if (!row.plan_id || row.plan_id === "free" || !row.plan_is_paid) {
    return { action: "ignore", reason: "free_or_usage_plan" };
  }

  const triggers: SweepTrigger[] = [];
  if (row.cancel_at_period_end === true || row.pending_plan_id === "free") triggers.push("cancelled_at_period_end");
  if (ENDED_TS_STATUSES.has(String(row.status ?? ""))) triggers.push("status_ended");
  if (row.billing_subscription_id && ENDED_BILLING_STATUSES.has(String(row.billing_subscription_status ?? ""))) {
    triggers.push("billing_subscription_ended");
  }
  if (triggers.length === 0) return { action: "ignore", reason: "not_ended" };

  const end = ts(row.current_period_end);
  if (end !== null && end > now.getTime()) return { action: "scheduled", triggers, reason: "period_running" };

  if (row.slug === BILLING_TENANT_SLUG) return { action: "excluded", triggers, reason: "billing_tenant" };
  if (row.is_internal_tenant === true || row.billing_exempt === true) return { action: "excluded", triggers, reason: "exempt" };
  if (row.billing_on_hold === true) return { action: "excluded", triggers, reason: "on_hold" };
  if (row.is_demo === true) return { action: "excluded", triggers, reason: "demo" };
  if (end === null) return { action: "excluded", triggers, reason: "no_period_end" };
  const trialEnd = ts(row.trial_end);
  if (trialEnd !== null && trialEnd > now.getTime()) return { action: "excluded", triggers, reason: "trial_running" };

  return { action: "downgrade", triggers };
}

/**
 * Een rij uit `tenant_subscriptions` (met embeds `tenants(...)` en
 * `pricing_plan:pricing_plans!plan_id(...)`) plus het facturatie-abonnement →
 * SweepRow. Gedeeld door de sweep en de read-only dry-run-proef, zodat beide
 * exact dezelfde invoer zien.
 */
export function buildSweepRow(
  s: Record<string, unknown>,
  billing: { status?: string | null } | null | undefined,
): SweepRow {
  const t = (s.tenants ?? {}) as Record<string, unknown>;
  const plan = (s.pricing_plan ?? null) as { monthly_price?: unknown; yearly_price?: unknown } | null;
  const billingId = (s.billing_subscription_id as string | null) ?? null;
  return {
    tenant_id: s.tenant_id as string,
    tenant_name: (t.name as string) ?? null,
    slug: (t.slug as string) ?? null,
    is_demo: (t.is_demo as boolean | null) ?? null,
    is_internal_tenant: (t.is_internal_tenant as boolean | null) ?? null,
    billing_exempt: (t.billing_exempt as boolean | null) ?? null,
    billing_on_hold: (t.billing_on_hold as boolean | null) ?? null,
    plan_id: (s.plan_id as string) ?? null,
    plan_is_paid: !!plan && (Number(plan.monthly_price) > 0 || Number(plan.yearly_price) > 0),
    status: (s.status as string) ?? null,
    current_period_end: (s.current_period_end as string) ?? null,
    trial_end: (s.trial_end as string) ?? null,
    cancel_at_period_end: (s.cancel_at_period_end as boolean | null) ?? null,
    pending_plan_id: (s.pending_plan_id as string) ?? null,
    billing_subscription_id: billingId,
    // Verwijst de rij naar een abonnement dat niet (meer) bestaat: als gestopt behandelen.
    billing_subscription_status: billingId ? (billing?.status ?? "ended") : null,
  };
}

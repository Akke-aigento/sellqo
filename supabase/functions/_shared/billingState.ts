// BILLING-ENFORCE-1 — één waarheid over de abonnementsstatus van een winkel.
//
// Tot 24 sep 2026 dwong niets betaling af: `process-cycle-reminders` zette een
// cyclus op 'expired' en stopte daar, met de opmerking "suspension is LOCK-1".
// LOCK-1 is nooit gebouwd. Een winkel kon maanden doorwerken zonder te betalen.
//
// De twee faalsignalen staan in verschillende tabellen en geen van beide raakte
// het abonnement:
//   - pay-first (platformabonnement): `billing_cycles.status = 'expired'`;
//   - invoice-first (domeinfacturen):  `invoices.dunning_level = 3`.
// Deze module weegt ze samen tot één toestand, en dezelfde toestand bepaalt wat
// er nog mag — in de app (useCan) en op de server (requireBillingState).
//
// Wat NOOIT afhangt van deze toestand: de webshop van de klant. Storefront-api,
// checkout en betalingen van eindklanten importeren dit bestand niet.
//
// Puur en zonder imports: gedeeld met src/ en getest door vitest.

export type BillingState = "trialing" | "active" | "past_due" | "restricted" | "suspended";

/** Pay-first betaaltermijn in dagen (keuze Akke 24-09; domeinfacturen houden payment_term_days). */
export const PAY_FIRST_TERM_DAYS = 7;
/** Respijt na de vervaldatum voor een betalingsverzoek. */
export const GRACE_DAYS = 14;
/** Dagen na een dunning-3-domeinfactuur voordat de winkel in leesmodus gaat. */
export const DOMAIN_DUNNING_GRACE_DAYS = 14;
/** Dagen in leesmodus voordat alleen facturatie overblijft. */
export const RESTRICTED_TO_SUSPENDED_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: string | Date): Date =>
  value instanceof Date ? value : new Date(`${value.length <= 10 ? `${value}T00:00:00Z` : value}`);

export const toISODate = (value: string | Date): string => toDate(value).toISOString().slice(0, 10);

export function addDays(value: string | Date, days: number): string {
  const d = toDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

const daysBetween = (from: string | Date, to: string | Date): number =>
  Math.floor((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);

/**
 * Vervaldatum en respijt van een nieuwe cyclus.
 *
 * De bug die dit repareert: `due_date` kwam uit `period_start`, dus een cyclus
 * die met terugwerkende kracht werd aangemaakt (inhaalrun, handmatige run, de
 * sweep) was bij zijn geboorte al over zijn respijt heen. De eerstvolgende
 * herinneringsronde sprong dan meteen naar niveau 3 en zette hem op 'expired',
 * zonder dat de klant ooit een eerste herinnering had gezien. Met enforcement
 * eraan vast zou dat een stille afsluiting zijn geweest.
 */
export function cycleDueDates(opts: {
  periodStart: string;
  today: string | Date;
  termDays?: number;
  graceDays?: number;
}): { dueDate: string; graceUntil: string } {
  const start = toISODate(opts.periodStart);
  const today = toISODate(opts.today);
  const base = start > today ? start : today; // nooit een vervaldatum in het verleden
  const dueDate = addDays(base, opts.termDays ?? PAY_FIRST_TERM_DAYS);
  return { dueDate, graceUntil: addDays(dueDate, opts.graceDays ?? GRACE_DAYS) };
}

// ── Statusmachine ────────────────────────────────────────────────────

export interface CycleInput {
  id?: string;
  status: string;
  due_date?: string | null;
  grace_until?: string | null;
  total?: number | string | null;
  invoice_id?: string | null;
  checkout_session_url?: string | null;
  payment_request_number?: string | null;
}

export interface InvoiceInput {
  id?: string;
  status: string;
  dunning_level?: number | null;
  due_date?: string | null;
  last_reminder_at?: string | null;
  total?: number | string | null;
  invoice_number?: string | null;
}

export interface SubscriptionInput {
  status?: string | null;
  trial_end?: string | null;
  plan_id?: string | null;
}

export type BillingReason = "none" | "trial" | "cycle_overdue" | "cycle_expired" | "domain_dunning";

export interface BillingStateResult {
  state: BillingState;
  /** Sinds wanneer deze toestand geldt (datum van het oudste openstaande signaal). */
  since: string | null;
  reason: BillingReason;
  /** Totaal openstaand bedrag dat de toestand veroorzaakt. */
  openAmount: number;
  /** Betaallink van het oudste openstaande verzoek, als die er is. */
  payUrl: string | null;
}

const amount = (value: number | string | null | undefined): number => {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? Number(n) : 0;
};

const OPEN_CYCLE_STATUSES = new Set(["awaiting_payment", "reopened", "expired"]);
const OPEN_INVOICE_STATUSES = new Set(["unpaid", "sent"]);

/**
 * De toestand van één winkel, uit alles wat er openstaat.
 *
 * Volgorde: suspended > restricted > past_due > trialing > active. Een winkel
 * die alles betaald heeft, komt altijd op `active` uit — daarmee opent hij
 * vanzelf weer zodra een cyclus settled is.
 */
export function resolveBillingState(input: {
  subscription?: SubscriptionInput | null;
  cycles?: readonly CycleInput[];
  invoices?: readonly InvoiceInput[];
  now: string | Date;
}): BillingStateResult {
  const today = toISODate(input.now);
  const cycles = (input.cycles ?? []).filter((c) => OPEN_CYCLE_STATUSES.has(c.status) && !c.invoice_id);
  const invoices = (input.invoices ?? []).filter((i) => OPEN_INVOICE_STATUSES.has(i.status));

  let state: BillingState = "active";
  let reason: BillingReason = "none";
  let since: string | null = null;
  let payUrl: string | null = null;
  let openAmount = 0;

  const escalate = (next: BillingState, nextReason: BillingReason, nextSince: string | null) => {
    const order: BillingState[] = ["trialing", "active", "past_due", "restricted", "suspended"];
    if (order.indexOf(next) > order.indexOf(state)) {
      state = next;
      reason = nextReason;
      since = nextSince;
    } else if (next === state && nextSince && (!since || nextSince < since)) {
      since = nextSince; // het oudste signaal bepaalt sinds wanneer
    }
  };

  for (const cycle of cycles) {
    openAmount += amount(cycle.total);
    if (!payUrl && cycle.checkout_session_url) payUrl = cycle.checkout_session_url;

    const graceOver = cycle.status === "expired"
      || (cycle.grace_until != null && daysBetween(cycle.grace_until, today) > 0);
    if (graceOver) {
      const restrictedSince = cycle.grace_until ? addDays(cycle.grace_until, 1) : today;
      escalate("restricted", "cycle_expired", restrictedSince);
      if (daysBetween(restrictedSince, today) >= RESTRICTED_TO_SUSPENDED_DAYS) {
        escalate("suspended", "cycle_expired", restrictedSince);
      }
      continue;
    }
    if (cycle.due_date != null && daysBetween(cycle.due_date, today) > 0) {
      escalate("past_due", "cycle_overdue", cycle.due_date);
    }
  }

  for (const invoice of invoices) {
    const level = Number(invoice.dunning_level ?? 0);
    if (level <= 0) continue;
    openAmount += amount(invoice.total);

    if (level >= 3) {
      const marker = invoice.last_reminder_at ? toISODate(invoice.last_reminder_at) : invoice.due_date;
      const restrictedSince = marker ? addDays(marker, DOMAIN_DUNNING_GRACE_DAYS) : null;
      if (restrictedSince && daysBetween(restrictedSince, today) >= 0) {
        escalate("restricted", "domain_dunning", restrictedSince);
        if (daysBetween(restrictedSince, today) >= RESTRICTED_TO_SUSPENDED_DAYS) {
          escalate("suspended", "domain_dunning", restrictedSince);
        }
        continue;
      }
    }
    if (level >= 2) escalate("past_due", "domain_dunning", invoice.due_date ?? null);
  }

  if (state === "active") {
    const trialEnd = input.subscription?.trial_end;
    const trialing = input.subscription?.status === "trialing" && trialEnd != null
      && daysBetween(today, trialEnd) >= 0;
    if (trialing) return { state: "trialing", since: null, reason: "trial", openAmount: 0, payUrl: null };
  }

  return { state, since, reason, openAmount: Math.round(openAmount * 100) / 100, payUrl };
}

// ── Wat mag er nog in deze toestand ──────────────────────────────────

/** Toegang die ook een niet-betalende winkel houdt: kijken, exporteren, betalen. */
export const BILLING_EXEMPT_RESOURCES = [
  "profile",
  "platform_billing",
  "reports_financial",
  "reports_analytics",
] as const;

/** AI kost geld per gebruik en gaat daarom al bij de eerste achterstand uit. */
export const AI_RESOURCES = ["ai_assistant", "ai_coach"] as const;

export type BillingDecision = { allowed: true } | { allowed: false; reason: "billing" };

/**
 * Mag deze actie nog? `read` altijd; `write`/`correct` niet meer zodra de winkel
 * in leesmodus staat, behalve op de facturatie- en profielpaden — anders kan een
 * winkel niet meer betalen, en dan komt hij er nooit meer uit.
 */
export function billingAllows(
  state: BillingState,
  action: string,
  resource: string,
): BillingDecision {
  const denied = { allowed: false as const, reason: "billing" as const };
  if (action === "read") return { allowed: true };
  if ((BILLING_EXEMPT_RESOURCES as readonly string[]).includes(resource)) return { allowed: true };

  if ((state === "past_due") && (AI_RESOURCES as readonly string[]).includes(resource)) return denied;
  if (state === "restricted" || state === "suspended") return denied;
  return { allowed: true };
}

/** Kortere vorm voor de server: welke toestanden mogen schrijven. */
export const WRITE_BLOCKED_STATES: readonly BillingState[] = ["restricted", "suspended"];

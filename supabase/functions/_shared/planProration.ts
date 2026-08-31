// UPGRADE-PF-1: shared pro-rata maths for pay-first plan upgrades.
//
// Two laws: upgrade = immediate (after payment), downgrade = period boundary.
// The delta ALWAYS starts from the real subscription_lines price — the line is
// the truth about what the customer pays — so the already-paid pay-first cycle
// of the running period is implicitly settled and never re-invoiced.

import {
  advanceDate as advanceDateShared,
  retreatDate as retreatDateShared,
} from "./billingDates.ts";

export type Interval = "monthly" | "yearly";

export interface ProrationPeriod {
  period_start: string; // ISO date
  period_end: string; // ISO date
  period_days: number;
  remaining_days: number;
  source: "settled_cycle" | "next_invoice_date";
}

export interface ProrationResult extends ProrationPeriod {
  current_net: number;
  new_net: number;
  delta_net: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  interval_swap: boolean;
  /** New period start/end once the swap takes effect (interval swap only). */
  new_period_start: string;
  new_period_end: string;
}

const MS_DAY = 86400000;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

// BILLING-1: de rekenkunde staat nu in _shared/billingDates.ts (clamp op de
// doelmaand in plaats van de setUTCMonth-overloop). De signature blijft bewust
// tweeledig, zodat planEffectuate.ts en subscriptionCharge.ts ongewijzigd
// blijven; die geven geen anchor mee en dat is voor proratie en interval-swap
// ook correct — daar telt de dag van `from`, niet de bedoelde factuurdag.
//
// De .slice(0, 10) is geen slordigheid maar het bewaren van bestaand gedrag:
// dit pad krijgt waarden uit tenant_subscriptions.current_period_start, een
// timestamptz. De oude `utc()` sneed die al af. In generate-subscription-invoices
// staat wél de strikte assert, want daar zijn de bronkolommen van type DATE en
// duidt een timestamp op een echte fout.

export function advanceDate(fromISO: string, interval: Interval): string {
  return advanceDateShared(String(fromISO).slice(0, 10), interval);
}

function retreatDate(fromISO: string, interval: Interval): string {
  return retreatDateShared(String(fromISO).slice(0, 10), interval);
}

export function nlDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Snap a raw VAT percentage to the Belgian rates the platform uses. */
export function snapVatRate(raw: number): number {
  for (const common of [0, 6, 12, 21]) {
    if (Math.abs(raw - common) <= 0.05) return common;
  }
  return +raw.toFixed(2);
}

type SupabaseLike = { from: (table: string) => any };

/**
 * Resolve the running period of a billing subscription.
 * Truth: the newest settled/processing billing cycle. Fallback:
 * subscriptions.next_invoice_date as the period END, minus one interval.
 */
export async function resolveRunningPeriod(
  supabase: SupabaseLike,
  subscriptionId: string,
  interval: Interval,
  nextInvoiceDate: string | null,
  todayISO: string,
): Promise<ProrationPeriod> {
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let source: ProrationPeriod["source"] = "next_invoice_date";

  const { data: cycles } = await supabase
    .from("billing_cycles")
    .select("period_start, period_end, status, created_at")
    .eq("subscription_id", subscriptionId)
    .eq("cycle_type", "recurring")
    .in("status", ["settled", "processing"])
    .order("period_start", { ascending: false })
    .limit(1);

  const cycle = cycles?.[0];
  if (cycle?.period_start && cycle?.period_end) {
    periodStart = String(cycle.period_start).slice(0, 10);
    periodEnd = String(cycle.period_end).slice(0, 10);
    source = "settled_cycle";
  } else if (nextInvoiceDate) {
    periodEnd = String(nextInvoiceDate).slice(0, 10);
    periodStart = retreatDate(periodEnd, interval);
  }

  if (!periodStart || !periodEnd) {
    periodStart = todayISO;
    periodEnd = advanceDate(todayISO, interval);
  }

  const periodDays = Math.max(1, Math.round((utc(periodEnd) - utc(periodStart)) / MS_DAY));
  const remainingDays = Math.min(
    periodDays,
    Math.max(0, Math.round((utc(periodEnd) - utc(todayISO)) / MS_DAY)),
  );

  return { period_start: periodStart, period_end: periodEnd, period_days: periodDays, remaining_days: remainingDays, source };
}

export interface ProrationLine {
  quantity: number | string | null;
  unit_price: number | string | null;
  vat_rate?: number | string | null;
  sort_order?: number | null;
}

/**
 * Compute the pro-rata delta for an upgrade.
 *
 * Same interval: delta = (newNet - currentNet) * remaining / periodDays.
 * Interval swap: the new interval starts today, so the full new price is due
 * minus a credit for the unused remainder of the old period.
 */
export function computeProration(params: {
  period: ProrationPeriod;
  lines: ProrationLine[];
  newNet: number;
  currentInterval: Interval;
  targetInterval: Interval;
  todayISO: string;
}): ProrationResult {
  const { period, lines, newNet, currentInterval, targetInterval, todayISO } = params;

  const sorted = [...lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const currentNet = +sorted
    .reduce((sum, ln) => sum + Number(ln.quantity ?? 1) * Number(ln.unit_price ?? 0), 0)
    .toFixed(2);

  // VAT from line 0 — the platform line is the source of truth.
  const rawVat = Number(sorted[0]?.vat_rate ?? 21);
  const vatRate = snapVatRate(Number.isFinite(rawVat) ? rawVat : 21);

  const intervalSwap = targetInterval !== currentInterval;
  const ratio = period.remaining_days / period.period_days;

  let deltaNet: number;
  if (intervalSwap) {
    const credit = currentNet * ratio;
    deltaNet = +(newNet - credit).toFixed(2);
  } else {
    deltaNet = +((newNet - currentNet) * ratio).toFixed(2);
  }
  if (deltaNet < 0) deltaNet = 0;

  const vatAmount = +(deltaNet * (vatRate / 100)).toFixed(2);
  const total = +(deltaNet + vatAmount).toFixed(2);

  const newPeriodStart = intervalSwap ? todayISO : period.period_start;
  const newPeriodEnd = intervalSwap ? advanceDate(todayISO, targetInterval) : period.period_end;

  return {
    ...period,
    current_net: currentNet,
    new_net: +Number(newNet).toFixed(2),
    delta_net: deltaNet,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
    interval_swap: intervalSwap,
    new_period_start: newPeriodStart,
    new_period_end: newPeriodEnd,
  };
}

/** Human line description, shown on the payment request PDF/mail and the invoice. */
export function prorationDescription(params: {
  fromPlanName: string;
  toPlanName: string;
  remainingDays: number;
  periodDays: number;
  fromISO: string;
  toISO: string;
  intervalSwap?: boolean;
  targetInterval?: Interval;
}): string {
  const suffix = params.intervalSwap ? ` - ${params.targetInterval === "yearly" ? "jaarlijks" : "maandelijks"}` : "";
  return (
    `Upgrade ${params.fromPlanName} -> ${params.toPlanName}${suffix} ` +
    `(pro rata ${params.remainingDays}/${params.periodDays} d, ${nlDate(params.fromISO)} t/m ${nlDate(params.toISO)})`
  );
}
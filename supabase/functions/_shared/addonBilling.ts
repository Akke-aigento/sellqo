// BILL-ADDON-1 + BILL-TERM-1 — pure helpers voor add-ons, kassa-ticketfees en de
// minimale looptijd op het platform-facturatieabonnement. Geen imports, geen I/O:
// sync-tenant-plan, generate-subscription-invoices en subscriptionCharge gebruiken ze.

export type LineKind = "plan" | "addon";

export interface BillingLine {
  id?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  vat_rate?: number | string | null;
  sort_order?: number | null;
  kind?: LineKind | string | null;
  addon_id?: string | null;
  end_date?: string | null;
}

/** De planregel(s): alleen die herschrijft een planwissel. Oude rijen zonder soort = plan. */
export function planLines<T extends BillingLine>(lines: T[] | null | undefined): T[] {
  return (lines ?? []).filter((l) => (l.kind ?? "plan") === "plan");
}

export function addonLines<T extends BillingLine>(lines: T[] | null | undefined): T[] {
  return (lines ?? []).filter((l) => l.kind === "addon");
}

/**
 * Regels die in een cyclus vanaf `periodStartISO` meetellen: een add-on met een
 * einddatum vóór de start van de periode is gestopt (opgezegd tegen het einde van de
 * vorige periode) en telt niet meer.
 */
export function linesForPeriod<T extends BillingLine>(lines: T[] | null | undefined, periodStartISO: string): T[] {
  return (lines ?? []).filter((l) => !(l.kind === "addon" && l.end_date && l.end_date < periodStartISO));
}

/** Add-ons die vanaf deze periode niet meer meedoen (om op te ruimen). */
export function endedAddonLines<T extends BillingLine>(lines: T[] | null | undefined, periodStartISO: string): T[] {
  return addonLines(lines).filter((l) => !!l.end_date && (l.end_date as string) < periodStartISO);
}

export interface AddonRow {
  id: string;
  name: string;
  track: string;
  monthly_price: number | string;
  yearly_price: number | string;
  ticket_fee?: number | string | null;
  active?: boolean | null;
}

export function addonPrice(addon: AddonRow, interval: "monthly" | "yearly"): number {
  return +Number(interval === "yearly" ? addon.yearly_price : addon.monthly_price).toFixed(2);
}

/** Een add-on zonder vaste prijs (events: alleen ticketfee) komt nooit op de factuur. */
export function addonIsBilled(addon: AddonRow): boolean {
  return Number(addon.monthly_price) > 0 || Number(addon.yearly_price) > 0;
}

export function addonLineDescription(addon: AddonRow, interval: "monthly" | "yearly"): string {
  return `${addon.name} (${interval})`;
}

/** Winkels die SellQo nooit factureert: alleen business_modules aanpassen, geen regel. */
export function tenantIsNotBilled(t: {
  billing_exempt?: boolean | null;
  is_internal_tenant?: boolean | null;
  is_demo?: boolean | null;
  billing_on_hold?: boolean | null;
} | null | undefined): boolean {
  return !!t && (t.billing_exempt === true || t.is_internal_tenant === true || t.is_demo === true || t.billing_on_hold === true);
}

// ---------------------------------------------------------------------------
// Kassa-ticketfees (platform_ticket_fees met collected_via = 'invoice')
// ---------------------------------------------------------------------------

export interface FeeRow { order_id: string; tickets: number; fee_cents: number }

/** Minimum voor een verbruiksfactuur zonder maandabonnement (keuze Akke: €5). */
export const USAGE_MIN_CENTS = 500;

export function sumFees(rows: FeeRow[] | null | undefined): { cents: number; tickets: number } {
  return (rows ?? []).reduce((a, r) => ({ cents: a.cents + Number(r.fee_cents || 0), tickets: a.tickets + Number(r.tickets || 0) }), { cents: 0, tickets: 0 });
}

/** Factuurregel voor de openstaande kassa-ticketfees (bedragen excl. btw, zoals alle SellQo-prijzen). */
export function feeLine(rows: FeeRow[] | null | undefined, vatRate = 21): BillingLine | null {
  const { cents, tickets } = sumFees(rows);
  if (cents <= 0) return null;
  return {
    description: `Ticketkosten verkoop buiten de webshop (${tickets} ${tickets === 1 ? "ticket" : "tickets"})`,
    quantity: 1,
    unit_price: +(cents / 100).toFixed(2),
    vat_rate: vatRate,
    sort_order: 900,
    kind: null,
  };
}

/**
 * Moet een cyclus de fees meenemen, of overslaan? Met andere regels: altijd meenemen.
 * Zonder andere regels (alleen verbruik): pas vanaf USAGE_MIN_CENTS, anders doorschuiven.
 */
export function usageDecision(otherLineCount: number, feeCents: number): "include" | "skip_roll_over" | "nothing" {
  if (otherLineCount > 0) return feeCents > 0 ? "include" : "nothing";
  if (feeCents <= 0) return "nothing";
  return feeCents >= USAGE_MIN_CENTS ? "include" : "skip_roll_over";
}

/** Snapshot van de regels op een cyclus (billing_cycles.lines), voor een gespecificeerde factuur. */
export function cycleLinesSnapshot(lines: BillingLine[]): { description: string; quantity: number; unit_price: number; vat_rate: number; kind: string | null }[] {
  return [...lines]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((l) => ({
      description: String(l.description ?? ""),
      quantity: Number(l.quantity ?? 1),
      unit_price: +Number(l.unit_price ?? 0).toFixed(2),
      vat_rate: Number(l.vat_rate ?? 21),
      kind: (l.kind as string | null) ?? null,
    }));
}

/**
 * Factuurregels uit de snapshot, met de btw per regel zo verdeeld dat de som exact
 * gelijk is aan de btw van de cyclus (die is wat er echt geïnd werd).
 */
export function invoiceLinesFromSnapshot(
  snapshot: { description: string; quantity: number; unit_price: number; vat_rate: number }[],
  cycleVat: number,
): { description: string; quantity: number; unit_price: number; net: number; vat_rate: number; vat_amount: number; gross: number }[] {
  const rows = snapshot.map((s) => {
    const net = +(Number(s.quantity) * Number(s.unit_price)).toFixed(2);
    return { description: s.description, quantity: Number(s.quantity), unit_price: Number(s.unit_price), net, vat_rate: Number(s.vat_rate), vat_amount: +(net * Number(s.vat_rate) / 100).toFixed(2), gross: 0 };
  });
  const sumVat = +rows.reduce((a, r) => a + r.vat_amount, 0).toFixed(2);
  const diff = +(Number(cycleVat) - sumVat).toFixed(2);
  if (rows.length && diff !== 0) {
    // Afrondingsverschil op de grootste regel zetten.
    const i = rows.reduce((best, r, idx) => (r.net > rows[best].net ? idx : best), 0);
    rows[i].vat_amount = +(rows[i].vat_amount + diff).toFixed(2);
  }
  for (const r of rows) r.gross = +(r.net + r.vat_amount).toFixed(2);
  return rows;
}

// ---------------------------------------------------------------------------
// Minimale looptijd (Events Vast)
// ---------------------------------------------------------------------------

/** Contracteinde: start + n maanden (zelfde dag). */
export function commitmentEnd(startISO: string, months: number): string {
  const d = new Date(`${startISO.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/**
 * Opzeggen tijdens een lopend contract: het plan blijft tot het contracteinde en de
 * facturatie loopt tot de dag ervoor. Na het contract (of zonder contract) verandert er niets.
 */
export function applyCommitmentToCancel(
  decision: { accessUntil: string; billingEndDate: string },
  commitmentEndAt: string | null | undefined,
): { accessUntil: string; billingEndDate: string; extendedByCommitment: boolean } {
  if (!commitmentEndAt) return { ...decision, extendedByCommitment: false };
  const commit = String(commitmentEndAt).slice(0, 10);
  const access = String(decision.accessUntil).slice(0, 10);
  if (commit <= access) return { ...decision, extendedByCommitment: false };
  const d = new Date(`${commit}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return { accessUntil: `${commit}T00:00:00Z`, billingEndDate: d.toISOString().slice(0, 10), extendedByCommitment: true };
}

/**
 * Plan wisselen tijdens een lopend contract: alleen naar een plan van hetzelfde spoor
 * met minstens dezelfde maandprijs (een upgrade). Anders 'commitment_running'.
 */
export function commitmentBlocksSwitch(
  commitmentEndAt: string | null | undefined,
  todayISO: string,
  current: { monthly_price: number | string; track?: string | null } | null | undefined,
  target: { monthly_price: number | string; track?: string | null },
): boolean {
  if (!commitmentEndAt || String(commitmentEndAt).slice(0, 10) <= todayISO.slice(0, 10) || !current) return false;
  const sameTrack = (current.track ?? "webshop") === (target.track ?? "webshop");
  return !(sameTrack && Number(target.monthly_price) >= Number(current.monthly_price));
}

/**
 * Mag de runner een geplande planwijziging op deze periodegrens toepassen? Niet als ze pas
 * later ingaat (opzegging binnen het contract: pending_effective_at = contracteinde).
 */
export function pendingAppliesAt(pendingEffectiveAt: string | null | undefined, periodStartISO: string): boolean {
  if (!pendingEffectiveAt) return true;
  return String(pendingEffectiveAt).slice(0, 10) <= periodStartISO.slice(0, 10);
}

// BILL-FIX-1 (11-10-2026) — tenant_subscriptions volgt de betaalde periode.
//
// Een afgerekende recurring cycle schoof current_period_* van de tenant niet op:
// Astra Sleep stond op 1/10 terwijl oktober al gefactureerd werd. Dat raakt meer
// dan de UI: de pro-rata-berekening bij een upgrade (sync-tenant-plan,
// subscriptionCharge) leest die velden. Pay-first: betaald = de periode loopt.
// Alleen vooruit, nooit terug (een late betaling van een oude periode verschuift
// niets).

export type CycleForPeriod = {
  cycle_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

export function tenantPeriodAfterSettle(
  existingEnd: string | null | undefined,
  cycle: CycleForPeriod,
): { current_period_start: string; current_period_end: string } | null {
  if (cycle.cycle_type && cycle.cycle_type !== "recurring") return null;
  if (!cycle.period_start || !cycle.period_end) return null;
  const end = String(cycle.period_end).slice(0, 10);
  const start = String(cycle.period_start).slice(0, 10);
  const current = existingEnd ? String(existingEnd).slice(0, 10) : null;
  if (current && current >= end) return null;
  return {
    current_period_start: `${start}T00:00:00Z`,
    current_period_end: `${end}T00:00:00Z`,
  };
}

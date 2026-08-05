// UPGRADE-PF-1: single implementation of "make the target plan the live plan".
// Called from sync-tenant-plan (mandate mode: right after the charge intent is
// accepted) and from the CYCLE-3 webhook (manual mode: on settlement of the
// proration cycle). Idempotent — a no-op when the plan is already the target.

import { advanceDate, type Interval } from "./planProration.ts";

type SupabaseLike = { from: (table: string) => any };

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PLAN-EFFECTUATE] ${step}${suffix}`);
};

export interface EffectuateParams {
  tenantId: string;
  billingSubscriptionId: string;
  targetPlanId: string;
  targetInterval: Interval;
  /** Period the tenant is entitled to after the switch. */
  periodStart: string;
  periodEnd: string;
  /** True when the billing interval itself changed (new period starts today). */
  intervalSwap: boolean;
  /** Prefix for the billing subscription name, e.g. the company name. */
  billingNamePrefix?: string | null;
}

export async function effectuatePlanSwitch(
  supabase: SupabaseLike,
  params: EffectuateParams,
): Promise<{ applied: boolean; reason?: string }> {
  const {
    tenantId,
    billingSubscriptionId,
    targetPlanId,
    targetInterval,
    periodStart,
    periodEnd,
    intervalSwap,
    billingNamePrefix,
  } = params;

  const { data: ts, error: tsErr } = await supabase
    .from("tenant_subscriptions")
    .select("id, plan_id, billing_interval")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (tsErr) throw tsErr;

  // No-op guard — explicitly logged so the mandate path (already applied) is
  // distinguishable from the manual path (applied here, on settlement).
  if (ts && ts.plan_id === targetPlanId && ts.billing_interval === targetInterval) {
    log("No-op: plan already effectuated (mandate path applied it earlier)", {
      tenantId,
      targetPlanId,
      targetInterval,
    });
    return { applied: false, reason: "already_effectuated" };
  }

  const { data: plan, error: pErr } = await supabase
    .from("pricing_plans")
    .select("id, name, slug, monthly_price, yearly_price")
    .eq("id", targetPlanId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!plan) throw new Error(`Target plan ${targetPlanId} not found`);

  const unit = Number(targetInterval === "yearly" ? plan.yearly_price : plan.monthly_price);

  // 1. Recurring line 0 → the new plan. Extra lines are left untouched.
  const { data: lines, error: lnErr } = await supabase
    .from("subscription_lines")
    .select("id, vat_rate")
    .eq("subscription_id", billingSubscriptionId)
    .order("sort_order", { ascending: true });
  if (lnErr) throw lnErr;

  if (lines && lines.length > 0) {
    const { error: updLnErr } = await supabase
      .from("subscription_lines")
      .update({
        description: `${plan.name} (${targetInterval})`,
        quantity: 1,
        unit_price: unit,
      })
      .eq("id", lines[0].id);
    if (updLnErr) throw updLnErr;
  } else {
    const { error: insLnErr } = await supabase.from("subscription_lines").insert({
      subscription_id: billingSubscriptionId,
      description: `${plan.name} (${targetInterval})`,
      quantity: 1,
      unit_price: unit,
      vat_rate: 21,
      sort_order: 0,
    });
    if (insLnErr) throw insLnErr;
  }

  // 2. Billing subscription: name always, interval/period only on a swap.
  const subPatch: Record<string, unknown> = {
    name: `${billingNamePrefix || "Tenant"} - ${plan.name} (${targetInterval})`,
  };
  if (intervalSwap) {
    subPatch.interval = targetInterval;
    subPatch.start_date = periodStart;
    subPatch.next_invoice_date = periodEnd;
  }
  const { error: subErr } = await supabase
    .from("subscriptions")
    .update(subPatch)
    .eq("id", billingSubscriptionId);
  if (subErr) throw subErr;

  // 3. Entitlement + clear the pending upgrade markers.
  const { error: entErr } = await supabase
    .from("tenant_subscriptions")
    .update({
      plan_id: targetPlanId,
      billing_interval: targetInterval,
      status: "active",
      current_period_start: `${periodStart}T00:00:00Z`,
      current_period_end: `${periodEnd}T00:00:00Z`,
      pending_plan_id: null,
      pending_interval: null,
      pending_effective_at: null,
      pending_billing_cycle_id: null,
    })
    .eq("tenant_id", tenantId);
  if (entErr) throw entErr;

  // 4. Tenant feature gate.
  const { error: tErr } = await supabase
    .from("tenants")
    .update({ subscription_plan: plan.slug || targetPlanId })
    .eq("id", tenantId);
  if (tErr) throw tErr;

  log("Plan effectuated", {
    tenantId,
    targetPlanId,
    targetInterval,
    periodStart,
    periodEnd,
    intervalSwap,
  });
  return { applied: true };
}

/** Fallback period end when no explicit period is known. */
export function fallbackPeriodEnd(startISO: string, interval: Interval): string {
  return advanceDate(startISO, interval);
}
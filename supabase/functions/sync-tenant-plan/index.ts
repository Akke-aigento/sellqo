// ONBOARD-1: single writer that bridges tenant plan management to the
// native billing engine. Handles activate / switch (upgrade or downgrade) /
// cancel by mutating both tenant_subscriptions and the internal SellQo
// subscription that generates the invoices.
//
// Auth: platform_admin, or the tenant's own tenant_admin on the same tenant.
//
// Downgrades / interval-decreases are deferred to the next period boundary
// via pending_plan_id / pending_interval; the invoice runner applies the
// pending change before generating the period invoice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  computeProration,
  prorationDescription,
  resolveRunningPeriod,
  toISODate as isoDate,
} from "../_shared/planProration.ts";
// BILLING-1: één gedeelde datumhelper. De lokale kopie hier gebruikte
// setUTCMonth en liet 2026-01-31 doorrollen naar 2026-03-03.
import { advanceDate } from "../_shared/billingDates.ts";
import { effectuatePlanSwitch } from "../_shared/planEffectuate.ts";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "activate" | "switch" | "cancel";
type Interval = "monthly" | "yearly";

interface SyncBody {
  tenant_id?: string;
  plan_id?: string;
  billing_interval?: Interval;
  action?: Action;
}

const VAT_RATE = 21;
const GENERATE_DAYS_BEFORE = 5;
// UPGRADE-PF-1: same grace window as a regular pay-first cycle, so the existing
// reminder cadence (due / midpoint / expiry) works on it unchanged.
const PRORATION_GRACE_DAYS = 7;
const STALE_PENDING_MS = 60 * 60 * 1000;

function errMsg(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const anyErr = err as { message?: string };
    if (anyErr.message) return anyErr.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function log(step: string, details?: unknown) {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-TENANT-PLAN] ${step}${suffix}`);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function priceForPlan(plan: any, interval: Interval): number {
  return Number(interval === "yearly" ? plan.yearly_price : plan.monthly_price);
}

function rankPlan(plan: any, interval: Interval): number {
  // Compare on a normalised monthly equivalent so interval swaps also rank.
  const monthly =
    interval === "yearly"
      ? Number(plan.yearly_price) / 12
      : Number(plan.monthly_price);
  return monthly;
}

function isDowngrade(
  currentPlan: any,
  currentInterval: Interval,
  targetPlan: any,
  targetInterval: Interval,
): boolean {
  return rankPlan(targetPlan, targetInterval) < rankPlan(currentPlan, currentInterval);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // ---- Auth: platform_admin OR tenant_admin of the target tenant ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Missing Authorization" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ success: false, error: "Invalid session" }, 401);
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const tenantId = body.tenant_id;
    const planId = body.plan_id;
    const interval = (body.billing_interval ?? "monthly") as Interval;
    const action = body.action as Action;

    if (!tenantId || !planId || !action) {
      return jsonResponse(
        { success: false, error: "tenant_id, plan_id, action are required" },
        400,
      );
    }
    if (!["monthly", "yearly"].includes(interval)) {
      return jsonResponse({ success: false, error: "billing_interval invalid" }, 400);
    }
    if (!["activate", "switch", "cancel"].includes(action)) {
      return jsonResponse({ success: false, error: "action invalid" }, 400);
    }

    // Authorization: platform admin OR tenant_admin for this tenant
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);
    if (rolesErr) throw rolesErr;
    const isPlatformAdmin = (roles ?? []).some((r: any) => r.role === "platform_admin");
    const isTenantAdmin = (roles ?? []).some(
      (r: any) => r.role === "tenant_admin" && r.tenant_id === tenantId,
    );
    if (!isPlatformAdmin && !isTenantAdmin) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    // ---- Load supporting rows ----
    const { data: targetPlan, error: planErr } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!targetPlan) return jsonResponse({ success: false, error: "Plan not found" }, 404);

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name, billing_company_name, billing_email, owner_email, subscription_plan")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) return jsonResponse({ success: false, error: "Tenant not found" }, 404);

    const { data: internalTenant, error: itErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("is_internal_tenant", true)
      .maybeSingle();
    if (itErr) throw itErr;
    if (!internalTenant) {
      return jsonResponse(
        { success: false, error: "Internal SellQo tenant not configured" },
        500,
      );
    }
    const internalTenantId = internalTenant.id;

    const { data: currentSub, error: csErr } = await supabase
      .from("tenant_subscriptions")
      .select("*, pricing_plan:pricing_plans!plan_id(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (csErr) throw csErr;

    // =====================================================================
    // Helper: ensure customer on internal SellQo tenant
    // =====================================================================
    async function ensureBillingCustomer(existingCustomerId: string | null): Promise<string> {
      if (existingCustomerId) return existingCustomerId;
      const billingEmail =
        ((tenant as any).billing_email as string | null) ||
        ((tenant as any).owner_email as string | null) ||
        "";
      if (!billingEmail) {
        throw new Error("Tenant has no billing email configured");
      }
      const companyName =
        ((tenant as any).billing_company_name as string | null) ||
        ((tenant as any).name as string) ||
        "Tenant";

      // Try find by email within internal tenant
      const { data: existing, error: findErr } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", internalTenantId)
        .eq("email", billingEmail)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing) return existing.id as string;

      const { data: inserted, error: insErr } = await supabase
        .from("customers")
        .insert({
          tenant_id: internalTenantId,
          email: billingEmail,
          company_name: companyName,
          customer_type: "b2b",
          external_id: `tenant:${tenant.id}`,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      return inserted.id as string;
    }

    // =====================================================================
    // Helper: create native billing subscription + single line
    // =====================================================================
    async function createBillingSubscription(
      customerId: string,
      plan: any,
      iv: Interval,
      startISO: string,
    ): Promise<{ id: string }> {
      const unit = priceForPlan(plan, iv);
      const subName = `${(tenant as any).billing_company_name || tenant.name} — ${plan.name} (${iv})`;
      const { data: sub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          tenant_id: internalTenantId,
          customer_id: customerId,
          name: subName,
          interval: iv,
          interval_count: 1,
          start_date: startISO,
          next_invoice_date: startISO,
          status: "active",
          auto_send: true,
          generate_days_before: GENERATE_DAYS_BEFORE,
        })
        .select("id")
        .single();
      if (subErr) throw subErr;

      const { error: lineErr } = await supabase.from("subscription_lines").insert({
        subscription_id: sub.id,
        description: `${plan.name} (${iv})`,
        quantity: 1,
        unit_price: unit,
        vat_rate: VAT_RATE,
        sort_order: 0,
      });
      if (lineErr) throw lineErr;

      return { id: sub.id as string };
    }

    // ================================= CANCEL / FREE =====================
    const isFreePlan = (targetPlan.slug === "free") || Number(targetPlan.monthly_price) === 0;
    if (action === "cancel" || (action !== "activate" && isFreePlan) || (action === "activate" && isFreePlan)) {
      // Cancel billing subscription (if any), mark tenant_subscription as canceled at period end.
      if (currentSub?.billing_subscription_id) {
        const { error: subUpdErr } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", currentSub.billing_subscription_id);
        if (subUpdErr) throw subUpdErr;
      }
      const nowISO = new Date().toISOString();
      const effectiveEnd = currentSub?.current_period_end || nowISO;
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            plan_id: isFreePlan ? "free" : currentSub?.plan_id ?? null,
            billing_interval: currentSub?.billing_interval ?? interval,
            status: "canceled",
            canceled_at: nowISO,
            cancel_at_period_end: true,
            current_period_end: effectiveEnd,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
          },
          { onConflict: "tenant_id" },
        );
      if (tsErr) throw tsErr;

      log("Cancelled", { tenantId, effectiveEnd });
      return jsonResponse({
        success: true,
        action: "cancel",
        effective_at: effectiveEnd,
      });
    }

    // ================================= ACTIVATE ==========================
    if (action === "activate") {
      // Idempotency: already active on same plan+interval?
      if (
        currentSub &&
        currentSub.status === "active" &&
        currentSub.plan_id === planId &&
        currentSub.billing_interval === interval &&
        currentSub.billing_subscription_id
      ) {
        log("Activate no-op", { tenantId, planId });
        return jsonResponse({
          success: true,
          action: "activate",
          noop: true,
          billing_subscription_id: currentSub.billing_subscription_id,
        });
      }

      const todayISO = toISODate(new Date());
      const customerId = await ensureBillingCustomer(currentSub?.billing_customer_id ?? null);

      let billingSubId = currentSub?.billing_subscription_id as string | null;
      if (!billingSubId) {
        const created = await createBillingSubscription(customerId, targetPlan, interval, todayISO);
        billingSubId = created.id;
      } else {
        // Reuse: reset line + plan
        await supabase.from("subscription_lines").delete().eq("subscription_id", billingSubId);
        await supabase.from("subscription_lines").insert({
          subscription_id: billingSubId,
          description: `${targetPlan.name} (${interval})`,
          quantity: 1,
          unit_price: priceForPlan(targetPlan, interval),
          vat_rate: VAT_RATE,
          sort_order: 0,
        });
        await supabase
          .from("subscriptions")
          .update({
            interval,
            start_date: todayISO,
            next_invoice_date: todayISO,
            status: "active",
            name: `${(tenant as any).billing_company_name || tenant.name} — ${targetPlan.name} (${interval})`,
          })
          .eq("id", billingSubId);
      }

      const periodEndISO = advanceDate(todayISO, interval);
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            plan_id: planId,
            billing_interval: interval,
            status: "active",
            current_period_start: `${todayISO}T00:00:00Z`,
            current_period_end: `${periodEndISO}T00:00:00Z`,
            billing_customer_id: customerId,
            billing_subscription_id: billingSubId,
            canceled_at: null,
            cancel_at_period_end: false,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
          },
          { onConflict: "tenant_id" },
        );
      if (tsErr) throw tsErr;

      // Invoke generate-subscription-invoices for immediate first invoice
      let invoked = false;
      try {
        const { error: invErr } = await supabase.functions.invoke(
          "generate-subscription-invoices",
          { body: { subscription_id: billingSubId } },
        );
        if (invErr) throw invErr;
        invoked = true;
      } catch (e) {
        const msg = errMsg(e);
        console.error(`[SYNC-TENANT-PLAN] generate invoke failed: ${msg}`);
      }

      log("Activated", { tenantId, planId, interval, billingSubId, invoked });
      return jsonResponse({
        success: true,
        action: "activate",
        billing_subscription_id: billingSubId,
        billing_customer_id: customerId,
        invoice_generation_invoked: invoked,
      });
    }

    // ================================= SWITCH ============================
    if (action === "switch") {
      if (!currentSub || !currentSub.billing_subscription_id || !currentSub.plan_id) {
        // Fall back to activate — no live billing sub yet
        return jsonResponse(
          { success: false, error: "No active billing subscription to switch — use action=activate" },
          400,
        );
      }

      const currentInterval = (currentSub.billing_interval as Interval) || "monthly";
      // Fetch current plan detail
      const { data: currentPlan, error: cpErr } = await supabase
        .from("pricing_plans")
        .select("*")
        .eq("id", currentSub.plan_id)
        .maybeSingle();
      if (cpErr) throw cpErr;
      if (!currentPlan) return jsonResponse({ success: false, error: "Current plan missing" }, 500);

      // Idempotency: same plan + interval + no pending
      if (
        currentSub.plan_id === planId &&
        currentInterval === interval &&
        !currentSub.pending_plan_id
      ) {
        return jsonResponse({ success: true, action: "switch", noop: true });
      }

      const downgrade = isDowngrade(currentPlan, currentInterval, targetPlan, interval);
      const billingSubId = currentSub.billing_subscription_id as string;

      if (downgrade) {
        // Defer to period boundary
        const { error: pErr } = await supabase
          .from("tenant_subscriptions")
          .update({
            pending_plan_id: planId,
            pending_interval: interval,
            pending_effective_at: currentSub.current_period_end,
          })
          .eq("tenant_id", tenantId);
        if (pErr) throw pErr;
        log("Downgrade scheduled", {
          tenantId,
          from: currentSub.plan_id,
          to: planId,
          effective_at: currentSub.current_period_end,
        });
        return jsonResponse({
          success: true,
          action: "switch",
          downgrade: true,
          effective_at: currentSub.current_period_end,
          pending_plan_id: planId,
          pending_interval: interval,
        });
      }

      // ================= UPGRADE (pay-first, UPGRADE-PF-1) =================
      // No invoice is ever created here. A proration billing_cycle is created;
      // the Stripe webhook (CYCLE-3) remains the only place that invoices.
      const todayISO = isoDate(new Date());

      // Load the native billing subscription (period + payment mode + lines).
      const { data: billingSub, error: bsErr } = await supabase
        .from("subscriptions")
        .select("id, customer_id, interval, next_invoice_date, payment_mode, billing_model, status")
        .eq("id", billingSubId)
        .maybeSingle();
      if (bsErr) throw bsErr;
      if (!billingSub) {
        return jsonResponse({ success: false, error: "Billing subscription not found" }, 500);
      }

      // ---- Guard: at most one open proration cycle per subscription ----
      const { data: openProrations, error: opErr } = await supabase
        .from("billing_cycles")
        .select("id, status, created_at, payment_request_number, checkout_session_url")
        .eq("subscription_id", billingSubId)
        .eq("cycle_type", "proration")
        .in("status", ["pending", "awaiting_payment", "processing", "reopened"])
        .order("created_at", { ascending: false });
      if (opErr) throw opErr;

      const openProration = openProrations?.[0];
      if (openProration) {
        const isStalePending =
          openProration.status === "pending" &&
          Date.now() - new Date(openProration.created_at as string).getTime() > STALE_PENDING_MS;
        if (isStalePending) {
          // Crashed between insert and charge — release it so the tenant is not stuck.
          await supabase
            .from("billing_cycles")
            .update({ status: "cancelled" })
            .eq("id", openProration.id)
            .is("invoice_id", null);
          log("Stale pending proration cycle cancelled", { billing_cycle_id: openProration.id });
        } else {
          return jsonResponse(
            {
              success: false,
              error: "Er staat al een upgrade open die nog niet betaald is",
              code: "proration_cycle_open",
              billing_cycle_id: openProration.id,
              payment_request_number: openProration.payment_request_number,
              checkout_session_url: openProration.checkout_session_url,
            },
            409,
          );
        }
      }

      // ---- Pro-rata maths: the subscription line is the truth ----
      const { data: subLines, error: slErr } = await supabase
        .from("subscription_lines")
        .select("id, quantity, unit_price, vat_rate, sort_order")
        .eq("subscription_id", billingSubId)
        .order("sort_order", { ascending: true });
      if (slErr) throw slErr;

      const period = await resolveRunningPeriod(
        supabase,
        billingSubId,
        currentInterval,
        (billingSub.next_invoice_date as string | null) ?? null,
        todayISO,
      );

      const proration = computeProration({
        period,
        lines: (subLines ?? []) as any[],
        newNet: priceForPlan(targetPlan, interval),
        currentInterval,
        targetInterval: interval,
        todayISO,
      });

      log("Proration computed", {
        tenantId,
        period_source: proration.source,
        period: `${proration.period_start}..${proration.period_end}`,
        remaining_days: proration.remaining_days,
        period_days: proration.period_days,
        current_net: proration.current_net,
        new_net: proration.new_net,
        delta_net: proration.delta_net,
        total: proration.total,
        interval_swap: proration.interval_swap,
      });

      const billingNamePrefix =
        ((tenant as any).billing_company_name as string | null) || tenant.name;

      // Delta 0 (upgrade exactly on the period boundary, or equal price):
      // nothing to collect — apply at the boundary through the pending path.
      if (proration.delta_net <= 0) {
        const { error: pErr } = await supabase
          .from("tenant_subscriptions")
          .update({
            pending_plan_id: planId,
            pending_interval: interval,
            pending_effective_at: `${proration.period_end}T00:00:00Z`,
            pending_billing_cycle_id: null,
          })
          .eq("tenant_id", tenantId);
        if (pErr) throw pErr;
        log("Upgrade with zero delta — scheduled at boundary", {
          tenantId,
          effective_at: proration.period_end,
        });
        return jsonResponse({
          success: true,
          action: "switch",
          downgrade: false,
          pending: true,
          pro_rata_total: 0,
          effective_at: `${proration.period_end}T00:00:00Z`,
        });
      }

      const description = prorationDescription({
        fromPlanName: currentPlan.name,
        toPlanName: targetPlan.name,
        remainingDays: proration.remaining_days,
        periodDays: proration.period_days,
        fromISO: todayISO,
        toISO: proration.period_end,
        intervalSwap: proration.interval_swap,
        targetInterval: interval,
      });

      const customerId = (currentSub.billing_customer_id as string | null) ??
        (billingSub.customer_id as string | null);
      if (!customerId) {
        return jsonResponse({ success: false, error: "No billing customer for tenant" }, 500);
      }

      const requestedMode = ((billingSub.payment_mode as string | null) ?? "mandate") as
        | "mandate"
        | "manual";

      // Mandate mode falls back to manual when there is no usable mandate.
      let mandate: any = null;
      if (requestedMode === "mandate") {
        const { data: mRows, error: mErr } = await supabase
          .from("customer_payment_mandates")
          .select("stripe_customer_id, stripe_payment_method_id, method_type, status, created_at")
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (mErr) throw mErr;
        mandate = mRows?.[0] ?? null;
      }
      const useMandate = requestedMode === "mandate" && !!mandate && mandate.status === "active";
      const cycleMode: "mandate" | "manual" = useMandate ? "mandate" : "manual";

      // ---- Create the proration cycle ----
      const graceUntilISO = (() => {
        const dt = new Date(`${todayISO}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() + PRORATION_GRACE_DAYS);
        return isoDate(dt);
      })();

      let prNumber: string | null = null;
      if (cycleMode === "manual") {
        const { data: prData, error: prErr } = await supabase.rpc(
          "generate_payment_request_number",
          { _tenant_id: internalTenantId },
        );
        if (prErr) throw prErr;
        prNumber = (prData as string) ?? null;
      }

      const { data: cycle, error: cycleErr } = await supabase
        .from("billing_cycles")
        .insert({
          subscription_id: billingSubId,
          tenant_id: internalTenantId,
          customer_id: customerId,
          cycle_type: "proration",
          target_plan_id: planId,
          target_interval: interval,
          description,
          period_start: todayISO,
          period_end: proration.period_end,
          subtotal: proration.delta_net,
          vat_amount: proration.vat_amount,
          total: proration.total,
          mode: cycleMode,
          model: "pay_first",
          status: "pending",
          due_date: todayISO,
          grace_until: graceUntilISO,
          ...(prNumber ? { payment_request_number: prNumber } : {}),
        })
        .select("id")
        .single();
      if (cycleErr) {
        if ((cycleErr as any).code === "23505") {
          return jsonResponse(
            {
              success: false,
              error: "Er staat al een upgrade open die nog niet betaald is",
              code: "proration_cycle_open",
            },
            409,
          );
        }
        throw cycleErr;
      }
      const cycleId = cycle.id as string;
      log("Proration cycle created", { billing_cycle_id: cycleId, mode: cycleMode, total: proration.total });

      // ---- Mandate mode: charge now; plan goes live on an accepted intent ----
      if (cycleMode === "mandate") {
        let intentStatus: string | null = null;
        try {
          const { data: itFull } = await supabase
            .from("tenants")
            .select("id, is_demo, is_internal_tenant, stripe_account_id")
            .eq("id", internalTenantId)
            .maybeSingle();
          const ctx = getStripeContext(itFull as any);
          const intent = await ctx.stripe.paymentIntents.create(
            {
              amount: Math.round(proration.total * 100),
              currency: "eur",
              customer: mandate.stripe_customer_id,
              payment_method: mandate.stripe_payment_method_id,
              payment_method_types: [mandate.method_type],
              confirm: true,
              off_session: true,
              metadata: {
                billing_cycle_id: cycleId,
                tenant_id: internalTenantId,
                proration: "1",
              },
            },
            { ...ctx.requestOptions, idempotencyKey: `cycle:${cycleId}` },
          );
          intentStatus = intent.status;

          if (intent.status === "succeeded" || intent.status === "processing") {
            // Deliberately NOT 'settled' — the webhook creates the invoice.
            await supabase
              .from("billing_cycles")
              .update({ status: "processing", stripe_payment_intent_id: intent.id })
              .eq("id", cycleId);

            await effectuatePlanSwitch(supabase, {
              tenantId,
              billingSubscriptionId: billingSubId,
              targetPlanId: planId,
              targetInterval: interval,
              periodStart: proration.new_period_start,
              periodEnd: proration.new_period_end,
              intervalSwap: proration.interval_swap,
              billingNamePrefix,
            });

            log("Upgrade charged and effectuated", {
              tenantId,
              billing_cycle_id: cycleId,
              intent: intent.id,
              status: intent.status,
            });
            return jsonResponse({
              success: true,
              action: "switch",
              downgrade: false,
              pending: false,
              billing_cycle_id: cycleId,
              pro_rata_total: proration.total,
              remaining_days: proration.remaining_days,
              period_days: proration.period_days,
              interval_swap: proration.interval_swap,
            });
          }
        } catch (chargeErr) {
          const msg = errMsg(chargeErr);
          console.error(`[SYNC-TENANT-PLAN] Proration charge failed for ${cycleId}: ${msg}`);
        }

        // Declined / requires_action / creation error → NEVER silently upgrade.
        // Fall through to the manual path: payment request + pending switch.
        log("Proration charge not confirmed — switching to payment request", {
          billing_cycle_id: cycleId,
          intent_status: intentStatus,
        });
        try {
          const { data: prData, error: prErr } = await supabase.rpc(
            "generate_payment_request_number",
            { _tenant_id: internalTenantId },
          );
          if (prErr) throw prErr;
          prNumber = (prData as string) ?? null;
        } catch (e) {
          console.error(`[SYNC-TENANT-PLAN] PR number generation failed: ${errMsg(e)}`);
        }
        await supabase
          .from("billing_cycles")
          .update({
            status: "awaiting_payment",
            mode: "manual",
            ...(prNumber ? { payment_request_number: prNumber } : {}),
          })
          .eq("id", cycleId)
          .is("invoice_id", null);
      } else {
        await supabase
          .from("billing_cycles")
          .update({ status: "awaiting_payment" })
          .eq("id", cycleId)
          .is("invoice_id", null);
      }

      // ---- Manual path: payment request + PENDING plan switch ----
      const { error: pendErr } = await supabase
        .from("tenant_subscriptions")
        .update({
          pending_plan_id: planId,
          pending_interval: interval,
          pending_effective_at: null,
          pending_billing_cycle_id: cycleId,
        })
        .eq("tenant_id", tenantId);
      if (pendErr) throw pendErr;

      let dispatched = false;
      try {
        const { error: dErr } = await supabase.functions.invoke("dispatch-payment-request", {
          body: { billing_cycle_id: cycleId },
        });
        if (dErr) throw dErr;
        dispatched = true;
      } catch (e) {
        console.error(`[SYNC-TENANT-PLAN] Payment request dispatch failed: ${errMsg(e)}`);
      }

      const { data: freshCycle } = await supabase
        .from("billing_cycles")
        .select("checkout_session_url, payment_request_number")
        .eq("id", cycleId)
        .maybeSingle();

      log("Upgrade pending payment", {
        tenantId,
        billing_cycle_id: cycleId,
        total: proration.total,
        dispatched,
      });
      return jsonResponse({
        success: true,
        action: "switch",
        downgrade: false,
        pending: true,
        awaiting_payment: true,
        billing_cycle_id: cycleId,
        payment_request_number: freshCycle?.payment_request_number ?? prNumber,
        checkout_session_url: freshCycle?.checkout_session_url ?? null,
        pro_rata_total: proration.total,
        remaining_days: proration.remaining_days,
        period_days: proration.period_days,
        interval_swap: proration.interval_swap,
        payment_request_dispatched: dispatched,
      });
    }

    return jsonResponse({ success: false, error: "Unhandled action" }, 400);
  } catch (err) {
    const message = errMsg(err);
    console.error(`[SYNC-TENANT-PLAN] ERROR: ${message}`);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
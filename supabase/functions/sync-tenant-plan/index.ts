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
  nlDate,
  toISODate as isoDate,
} from "../_shared/planProration.ts";
// BILLING-1: één gedeelde datumhelper. De lokale kopie hier gebruikte
// setUTCMonth en liet 2026-01-31 doorrollen naar 2026-03-03.
import { advanceDate } from "../_shared/billingDates.ts";
import { effectuatePlanSwitch } from "../_shared/planEffectuate.ts";
import { getStripeContext } from "../_shared/stripe.ts";
import { loadBillingTenant } from "../_shared/billingTenant.ts";
import { isAuthorizedCronRequest } from "../_shared/cronAuth.ts";
import { decideCancel, decideResume, hasPendingCancellation } from "../_shared/planLifecycle.ts";
import {
  addonIsBilled, addonLineDescription, addonPrice, applyCommitmentToCancel, commitmentBlocksSwitch, commitmentEnd, tenantIsNotBilled,
  type AddonRow,
} from "../_shared/addonBilling.ts";
import { activateAddonLine, addonsNetFor, clearBilledModules, endAddonLines, hasAddonLines, setTenantModule } from "../_shared/addonLines.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "activate" | "switch" | "cancel" | "addon" | "ensure_usage";
type Interval = "monthly" | "yearly";

interface SyncBody {
  tenant_id?: string;
  plan_id?: string;
  billing_interval?: Interval;
  action?: Action;
  /** BILL-ADDON-1: action 'addon' — welke add-on, aan of uit. */
  addon_id?: string;
  enabled?: boolean;
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
  // Versiestempel om een deploy zonder neveneffect na te meten (geen auth, geen data).
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: "BILL-ADDON-1" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    // BILL-FIX-1: of een systeemaanroep (check-expired-trials bij trial-einde) met
    // de service-key of het cron-secret — zelfde check als de cron-functies.
    const isSystemCall = await isAuthorizedCronRequest(req, supabase);
    let userId: string | null = null;
    if (!isSystemCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, error: "Missing Authorization" }, 401);
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) {
        return jsonResponse({ success: false, error: "Invalid session" }, 401);
      }
      userId = userData.user.id;
    }

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const tenantId = body.tenant_id;
    const action = body.action as Action;
    // BILL-ADDON-1: 'addon' en 'ensure_usage' raken het plan niet; ze werken op het huidige plan.
    const isAddonAction = action === "addon" || action === "ensure_usage";
    let planId = body.plan_id;
    if (isAddonAction && !planId && tenantId) {
      const { data: tsRow } = await supabase.from("tenant_subscriptions").select("plan_id").eq("tenant_id", tenantId).maybeSingle();
      planId = (tsRow?.plan_id as string | undefined) ?? "free";
    }
    const interval = (body.billing_interval ?? "monthly") as Interval;

    if (!tenantId || !planId || !action) {
      return jsonResponse(
        { success: false, error: "tenant_id, plan_id, action are required" },
        400,
      );
    }
    if (!["monthly", "yearly"].includes(interval)) {
      return jsonResponse({ success: false, error: "billing_interval invalid" }, 400);
    }
    if (!["activate", "switch", "cancel", "addon", "ensure_usage"].includes(action)) {
      return jsonResponse({ success: false, error: "action invalid" }, 400);
    }
    // ensure_usage is alleen voor de runner (systeemaanroep).
    if (action === "ensure_usage" && !isSystemCall) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    // Authorization: platform admin OR tenant_admin for this tenant (of systeem)
    if (!isSystemCall) {
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
      // BILL-ADDON-1: add-ons zet voorlopig alleen SellQo aan of uit (TRACKS-1).
      if (action === "addon" && !isPlatformAdmin) {
        return jsonResponse({ success: false, error: "Forbidden" }, 403);
      }
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
      .select("id, name, billing_company_name, billing_email, owner_email, subscription_plan, business_modules, billing_exempt, is_internal_tenant, is_demo, billing_on_hold")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) return jsonResponse({ success: false, error: "Tenant not found" }, 404);

    // HOTFIX-BILLING-TENANT-1: op slug, niet op is_internal_tenant (zie _shared/billingTenant.ts).
    const { data: internalTenant, error: itErr } = await loadBillingTenant(supabase, "id");
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
          external_id: `tenant:${tenantId}`, // BUILD-GREEN-1: = tenant.id (opgehaald op tenantId)
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
      const subName = `${(tenant as any).billing_company_name || tenant?.name} — ${plan.name} (${iv})`; // BUILD-GREEN-1: guard op r. 171, closure verliest hem
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
        kind: "plan",
        description: `${plan.name} (${iv})`,
        quantity: 1,
        unit_price: unit,
        vat_rate: VAT_RATE,
        sort_order: 0,
      });
      if (lineErr) throw lineErr;

      return { id: sub.id as string };
    }

    /**
     * BILL-ADDON-1: maandelijks facturatieabonnement zonder planregel, voor een €0-plan
     * (Free, Flex) met kassa-ticketfees of een betaalde add-on. Koppelt het aan de winkel.
     */
    async function createBareBillingSubscription(label: string): Promise<{ id: string; customerId: string }> {
      const customerId = await ensureBillingCustomer((currentSub?.billing_customer_id as string | null) ?? null);
      const todayISO = toISODate(new Date());
      const { data: sub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          tenant_id: internalTenantId,
          customer_id: customerId,
          name: `${(tenant as any).billing_company_name || tenant?.name} — ${label}`,
          interval: "monthly",
          interval_count: 1,
          start_date: todayISO,
          next_invoice_date: todayISO,
          status: "active",
          auto_send: true,
          generate_days_before: GENERATE_DAYS_BEFORE,
        })
        .select("id")
        .single();
      if (subErr) throw subErr;
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .update({ billing_customer_id: customerId, billing_subscription_id: sub.id, billing_interval: "monthly" })
        .eq("tenant_id", tenantId);
      if (tsErr) throw tsErr;
      return { id: sub.id as string, customerId };
    }

    // =====================================================================
    // BILL-ADDON-1: gedeelde pro-rata-stappen (upgrade én add-on halverwege)
    // =====================================================================
    /** Hoogstens één open pro-rata-cyclus per abonnement. Geeft een 409-antwoord of null. */
    async function guardOpenProration(billingSubId: string): Promise<Response | null> {
      const { data: openProrations, error: opErr } = await supabase
        .from("billing_cycles")
        .select("id, status, created_at, payment_request_number, checkout_session_url")
        .eq("subscription_id", billingSubId)
        .eq("cycle_type", "proration")
        .in("status", ["pending", "awaiting_payment", "processing", "reopened"])
        .order("created_at", { ascending: false });
      if (opErr) throw opErr;

      const openProration = openProrations?.[0];
      if (!openProration) return null;
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
        return null;
      }
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

    type ProrationCharge =
      | { conflict: true }
      | { conflict: false; cycleId: string; charged: boolean; intentId: string | null; prNumber: string | null };

    /**
     * Maakt de pro-rata-cyclus aan en probeert meteen te innen via het mandaat.
     * Lukt dat niet (geen mandaat, geweigerd, fout): de cyclus wacht op betaling
     * (manueel). Nooit een factuur hier — de webhook factureert.
     * targetPlanId null = add-on: de webhook wisselt dan geen plan.
     */
    async function createAndChargeProration(p: {
      billingSubId: string;
      paymentMode: string | null;
      customerId: string;
      targetPlanId: string | null;
      targetInterval: Interval;
      description: string;
      todayISO: string;
      periodEnd: string;
      deltaNet: number;
      vatAmount: number;
      total: number;
      vatRate: number;
      kind: "upgrade" | "addon";
      addonId?: string | null;
    }): Promise<ProrationCharge> {
      const requestedMode = (p.paymentMode ?? "mandate") as "mandate" | "manual";

      // Mandate mode falls back to manual when there is no usable mandate.
      // deno-lint-ignore no-explicit-any
      let mandate: any = null;
      if (requestedMode === "mandate") {
        const { data: mRows, error: mErr } = await supabase
          .from("customer_payment_mandates")
          .select("stripe_customer_id, stripe_payment_method_id, method_type, status, created_at")
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", p.customerId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (mErr) throw mErr;
        mandate = mRows?.[0] ?? null;
      }
      const useMandate = requestedMode === "mandate" && !!mandate && mandate.status === "active";
      const cycleMode: "mandate" | "manual" = useMandate ? "mandate" : "manual";

      const graceUntilISO = (() => {
        const dt = new Date(`${p.todayISO}T00:00:00Z`);
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
          subscription_id: p.billingSubId,
          tenant_id: internalTenantId,
          customer_id: p.customerId,
          cycle_type: "proration",
          target_plan_id: p.targetPlanId,
          target_interval: p.targetPlanId ? p.targetInterval : null,
          description: p.description,
          period_start: p.todayISO,
          period_end: p.periodEnd,
          subtotal: p.deltaNet,
          vat_amount: p.vatAmount,
          total: p.total,
          mode: cycleMode,
          model: "pay_first",
          status: "pending",
          due_date: p.todayISO,
          grace_until: graceUntilISO,
          // BILL-ADDON-1: de webhook leest hieruit welke add-on hij na betaling aanzet.
          lines: [{
            description: p.description, quantity: 1, unit_price: p.deltaNet, vat_rate: p.vatRate,
            kind: p.kind === "addon" ? "addon" : "plan",
            ...(p.addonId ? { addon_id: p.addonId } : {}),
          }],
          ...(prNumber ? { payment_request_number: prNumber } : {}),
        })
        .select("id")
        .single();
      if (cycleErr) {
        // deno-lint-ignore no-explicit-any
        if ((cycleErr as any).code === "23505") return { conflict: true };
        throw cycleErr;
      }
      const cycleId = cycle.id as string;
      log("Proration cycle created", { billing_cycle_id: cycleId, mode: cycleMode, total: p.total, kind: p.kind });

      // ---- Mandate mode: charge now ----
      if (cycleMode === "mandate") {
        let intentStatus: string | null = null;
        try {
          const { data: itFull } = await supabase
            .from("tenants")
            .select("id, is_demo, is_internal_tenant, stripe_account_id")
            .eq("id", internalTenantId)
            .maybeSingle();
          // deno-lint-ignore no-explicit-any
          const ctx = getStripeContext(itFull as any);
          const intent = await ctx.stripe.paymentIntents.create(
            {
              amount: Math.round(p.total * 100),
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
                ...(p.kind === "addon" ? { addon: "1" } : {}),
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
            return { conflict: false, cycleId, charged: true, intentId: intent.id, prNumber };
          }
        } catch (chargeErr) {
          console.error(`[SYNC-TENANT-PLAN] Proration charge failed for ${cycleId}: ${errMsg(chargeErr)}`);
        }

        // Declined / requires_action / creation error → NEVER silently upgrade.
        // Fall through to the manual path: payment request.
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
      return { conflict: false, cycleId, charged: false, intentId: null, prNumber };
    }

    async function sendPaymentRequest(cycleId: string): Promise<{ dispatched: boolean; checkoutUrl: string | null; prNumber: string | null }> {
      let sent = false;
      try {
        const { error: dErr } = await supabase.functions.invoke("dispatch-payment-request", {
          body: { billing_cycle_id: cycleId },
        });
        if (dErr) throw dErr;
        sent = true;
      } catch (e) {
        console.error(`[SYNC-TENANT-PLAN] Payment request dispatch failed: ${errMsg(e)}`);
      }
      const { data: fresh } = await supabase
        .from("billing_cycles")
        .select("checkout_session_url, payment_request_number")
        .eq("id", cycleId)
        .maybeSingle();
      return {
        dispatched: sent,
        checkoutUrl: (fresh?.checkout_session_url as string | null) ?? null,
        prNumber: (fresh?.payment_request_number as string | null) ?? null,
      };
    }

    const setBusinessModule = (track: string, on: boolean) => setTenantModule(supabase, tenantId, track, on);
    const clearModules = () => clearBilledModules(supabase, tenantId);

    // ================================= ADD-ON (BILL-ADDON-1) =============
    if (action === "addon") {
      const addonId = body.addon_id;
      const enabled = body.enabled === true;
      if (!addonId) return jsonResponse({ success: false, error: "addon_id required" }, 400);
      const { data: addon, error: aErr } = await supabase
        .from("platform_addons")
        .select("id, name, track, monthly_price, yearly_price, ticket_fee, active")
        .eq("id", addonId)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!addon) return jsonResponse({ success: false, error: "Add-on not found" }, 404);
      const a = addon as AddonRow;
      const planTrack = ((currentSub as { pricing_plan?: { track?: string | null } | null } | null)?.pricing_plan?.track) ?? "webshop";
      if (enabled && a.track === planTrack) {
        return jsonResponse({ success: false, error: "Dit spoor zit al in je plan", code: "addon_in_plan" }, 409);
      }
      const notBilled = tenantIsNotBilled(tenant as Record<string, boolean | null>) || !addonIsBilled(a);
      const billingSubId = (currentSub?.billing_subscription_id as string | null) ?? null;
      const todayISO = toISODate(new Date());

      // ---- UIT: tot het einde van de betaalde periode (keuze Akke 17-10) ----
      if (!enabled) {
        if (billingSubId) {
          // Een nog niet betaalde pro rata voor deze add-on vervalt (anders zet de webhook
          // hem bij betaling weer aan).
          const { data: openCycles, error: ocErr } = await supabase
            .from("billing_cycles")
            .select("id, lines")
            .eq("subscription_id", billingSubId)
            .eq("cycle_type", "proration")
            .is("target_plan_id", null)
            .is("invoice_id", null)
            .in("status", ["pending", "awaiting_payment", "reopened"]);
          if (ocErr) throw ocErr;
          for (const c of (openCycles ?? []) as { id: string; lines: unknown }[]) {
            const first = Array.isArray(c.lines) ? (c.lines[0] as { addon_id?: string } | undefined) : undefined;
            if (first?.addon_id !== a.id) continue;
            const { error: cErr } = await supabase.from("billing_cycles").update({ status: "cancelled" }).eq("id", c.id).is("invoice_id", null);
            if (cErr) throw cErr;
            log("Open add-on pro rata cancelled", { tenantId, addon: a.id, billing_cycle_id: c.id });
          }
          const { data: line } = await supabase
            .from("subscription_lines")
            .select("id, end_date")
            .eq("subscription_id", billingSubId)
            .eq("kind", "addon")
            .eq("addon_id", a.id)
            .maybeSingle();
          if (line && !notBilled) {
            const { data: bs } = await supabase.from("subscriptions").select("next_invoice_date, status").eq("id", billingSubId).maybeSingle();
            const next = (bs?.next_invoice_date as string | null) ?? null;
            if (bs?.status === "active" && next && next > todayISO) {
              // Laatste betaalde dag = de dag vóór de volgende factuurdatum. De runner ruimt op.
              const d = new Date(`${next}T00:00:00Z`);
              d.setUTCDate(d.getUTCDate() - 1);
              const endDate = d.toISOString().slice(0, 10);
              const { error: eErr } = await supabase.from("subscription_lines").update({ end_date: endDate }).eq("id", line.id);
              if (eErr) throw eErr;
              log("Add-on stops at period end", { tenantId, addon: a.id, end_date: endDate });
              return jsonResponse({ success: true, action: "addon", enabled: false, effective_at: `${next}T00:00:00Z` });
            }
          }
          if (line) {
            const { error: dErr } = await supabase.from("subscription_lines").delete().eq("id", line.id);
            if (dErr) throw dErr;
          }
        }
        await setBusinessModule(a.track, false);
        log("Add-on off", { tenantId, addon: a.id });
        return jsonResponse({ success: true, action: "addon", enabled: false, effective_at: new Date().toISOString() });
      }

      // ---- AAN ----
      // Gratis (events: alleen ticketfee) of niet-gefactureerde winkel: alleen de module.
      if (notBilled) {
        await setBusinessModule(a.track, true);
        log("Add-on on (not billed)", { tenantId, addon: a.id });
        return jsonResponse({ success: true, action: "addon", enabled: true, billed: false });
      }
      if (!currentSub) {
        return jsonResponse(
          { success: false, error: "Kies eerst een plan; een add-on komt bovenop je plan.", code: "addon_needs_plan" },
          409,
        );
      }
      let liveBillingSubId = billingSubId;
      if (liveBillingSubId) {
        const { data: chk } = await supabase.from("subscriptions").select("status").eq("id", liveBillingSubId).maybeSingle();
        if (chk?.status !== "active") liveBillingSubId = null;
      }
      if (!liveBillingSubId) {
        // Free of Flex zonder facturatieabonnement: maandabonnement met alleen de add-on,
        // eerste maand meteen aangerekend (zoals een plan activeren).
        if (Number(targetPlan.monthly_price) > 0 || Number(targetPlan.yearly_price) > 0) {
          return jsonResponse({ success: false, error: "Geen actief facturatieabonnement", code: "addon_needs_plan" }, 409);
        }
        const bare = await createBareBillingSubscription(a.name);
        await activateAddonLine(supabase, { subscriptionId: bare.id, tenantId: tenantId as string, addon: a, interval: "monthly", vatRate: VAT_RATE });
        let invoked = false;
        try {
          const { error: invErr } = await supabase.functions.invoke("generate-subscription-invoices", { body: { subscription_id: bare.id } });
          if (invErr) throw invErr;
          invoked = true;
        } catch (e) {
          console.error(`[SYNC-TENANT-PLAN] generate invoke failed: ${errMsg(e)}`);
        }
        log("Add-on on with new billing subscription", { tenantId, addon: a.id, billing_subscription_id: bare.id, invoked });
        return jsonResponse({ success: true, action: "addon", enabled: true, billing_subscription_id: bare.id, invoice_generation_invoked: invoked });
      }
      const { data: billingSub, error: bsErr } = await supabase
        .from("subscriptions")
        .select("id, customer_id, interval, next_invoice_date, payment_mode, status")
        .eq("id", liveBillingSubId)
        .maybeSingle();
      if (bsErr) throw bsErr;
      if (!billingSub || billingSub.status !== "active") {
        return jsonResponse({ success: false, error: "Geen actief facturatieabonnement", code: "addon_needs_plan" }, 409);
      }
      // Het interval van het facturatieabonnement zelf (tenant_subscriptions kan achterlopen).
      const iv = (billingSub.interval === "yearly" ? "yearly" : "monthly") as Interval;
      const unit = addonPrice(a, iv);
      const subId = liveBillingSubId;

      // De volgende periode is al aangemaakt (de runner werkt 5 dagen vooruit): die cyclus
      // kent de add-on niet, dus aanzetten (of een stop intrekken) zou die periode missen.
      const { data: nextCycles, error: ncErr } = await supabase
        .from("billing_cycles")
        .select("id, period_start")
        .eq("subscription_id", subId)
        .eq("cycle_type", "recurring")
        .gt("period_start", todayISO)
        .neq("status", "cancelled")
        .limit(1);
      if (ncErr) throw ncErr;
      const renewalFrom = (nextCycles ?? []).length > 0 ? String(nextCycles![0].period_start) : null;
      const renewalPending = () =>
        jsonResponse(
          {
            success: false,
            error: `Je volgende periode is al aangerekend. Zet de add-on aan vanaf ${nlDate(renewalFrom!)}.`,
            code: "renewal_pending",
            available_from: renewalFrom,
          },
          409,
        );

      const { data: existing } = await supabase
        .from("subscription_lines")
        .select("id, end_date")
        .eq("subscription_id", subId)
        .eq("kind", "addon")
        .eq("addon_id", a.id)
        .maybeSingle();
      if (existing) {
        // Al betaald voor deze periode: een geplande stop intrekken, niets aanrekenen —
        // behalve als de volgende cyclus al zonder de add-on aangemaakt is.
        if (existing.end_date && renewalFrom && renewalFrom > String(existing.end_date)) return renewalPending();
        if (existing.end_date) {
          const { error: rErr } = await supabase.from("subscription_lines").update({ end_date: null }).eq("id", existing.id);
          if (rErr) throw rErr;
        }
        await setBusinessModule(a.track, true);
        return jsonResponse({ success: true, action: "addon", enabled: true, noop: true, resumed: !!existing.end_date });
      }

      const guard = await guardOpenProration(subId);
      if (guard) return guard;
      if (renewalFrom) return renewalPending();

      // Pro rata zoals een upgrade. De add-on gaat pas aan na betaling: meteen bij een
      // geslaagd mandaat, anders in de webhook zodra het betaalverzoek betaald is.
      const { data: subLines, error: slErr } = await supabase
        .from("subscription_lines")
        .select("id, quantity, unit_price, vat_rate, sort_order, kind, end_date")
        .eq("subscription_id", subId)
        .order("sort_order", { ascending: true });
      if (slErr) throw slErr;
      const period = await resolveRunningPeriod(supabase, subId, iv, (billingSub.next_invoice_date as string | null) ?? null, todayISO);
      // deno-lint-ignore no-explicit-any
      const liveLines = ((subLines ?? []) as any[]).filter((l) => !l.end_date);
      const currentNet = liveLines.reduce((sum: number, l) => sum + Number(l.quantity ?? 1) * Number(l.unit_price ?? 0), 0);
      const proration = computeProration({
        period,
        lines: liveLines,
        newNet: +(currentNet + unit).toFixed(2),
        currentInterval: iv,
        targetInterval: iv,
        todayISO,
      });
      const shopTenantId = tenantId as string;

      if (proration.delta_net <= 0) {
        // Precies op de grens: niets te innen, de volgende cyclus rekent de add-on aan.
        await activateAddonLine(supabase, { subscriptionId: subId, tenantId: shopTenantId, addon: a, interval: iv, vatRate: VAT_RATE });
        log("Add-on on at period boundary (no pro rata)", { tenantId, addon: a.id });
        return jsonResponse({ success: true, action: "addon", enabled: true, pro_rata_total: 0 });
      }

      const description =
        `${a.name}: pro rata ${proration.remaining_days}/${proration.period_days} d ` +
        `(${nlDate(todayISO)} t/m ${nlDate(proration.period_end)})`;
      const customerId = (currentSub.billing_customer_id as string | null) ?? (billingSub.customer_id as string | null);
      if (!customerId) return jsonResponse({ success: false, error: "No billing customer for tenant" }, 500);

      const charge = await createAndChargeProration({
        billingSubId: subId,
        paymentMode: (billingSub.payment_mode as string | null) ?? null,
        customerId,
        targetPlanId: null,
        targetInterval: iv,
        description,
        todayISO,
        periodEnd: proration.period_end,
        deltaNet: proration.delta_net,
        vatAmount: proration.vat_amount,
        total: proration.total,
        vatRate: proration.vat_rate,
        kind: "addon",
        addonId: a.id,
      });
      if (charge.conflict) {
        return jsonResponse(
          { success: false, error: "Er staat al een betaling open. Rond die eerst af.", code: "proration_cycle_open" },
          409,
        );
      }
      if (charge.charged) {
        await activateAddonLine(supabase, { subscriptionId: subId, tenantId: shopTenantId, addon: a, interval: iv, vatRate: VAT_RATE });
        log("Add-on charged and on", { tenantId, addon: a.id, cycle: charge.cycleId, total: proration.total });
        return jsonResponse({
          success: true,
          action: "addon",
          enabled: true,
          billing_cycle_id: charge.cycleId,
          pro_rata_total: proration.total,
          awaiting_payment: false,
        });
      }
      const sent = await sendPaymentRequest(charge.cycleId);
      log("Add-on awaiting payment", { tenantId, addon: a.id, cycle: charge.cycleId, total: proration.total });
      return jsonResponse({
        success: true,
        action: "addon",
        enabled: false,
        pending: true,
        billing_cycle_id: charge.cycleId,
        pro_rata_total: proration.total,
        awaiting_payment: true,
        payment_request_number: sent.prNumber ?? charge.prNumber,
        checkout_session_url: sent.checkoutUrl,
      });
    }

    // ================================= ENSURE USAGE (BILL-ADDON-1) =======
    // Alleen de runner: een Flex-winkel zonder facturatieabonnement met ≥ €5 kassa-ticketfees
    // krijgt een abonnement zonder regels, zodat de runner een verbruiksfactuur kan maken.
    if (action === "ensure_usage") {
      if (tenantIsNotBilled(tenant as Record<string, boolean | null>)) {
        return jsonResponse({ success: true, action: "ensure_usage", skipped: "not_billed" });
      }
      // Alleen voor Free en verbruiksplannen (Flex). Een betaald plan zonder lopend
      // facturatieabonnement is een zaak voor de sweep, niet voor een verbruiksabonnement.
      if (Number(targetPlan.monthly_price) > 0 || Number(targetPlan.yearly_price) > 0) {
        return jsonResponse({ success: true, action: "ensure_usage", skipped: "paid_plan" });
      }
      if (currentSub?.billing_subscription_id) {
        const { data: bs } = await supabase.from("subscriptions").select("id, status").eq("id", currentSub.billing_subscription_id).maybeSingle();
        if (bs && bs.status === "active") {
          return jsonResponse({ success: true, action: "ensure_usage", billing_subscription_id: bs.id, noop: true });
        }
      }
      if (!currentSub) return jsonResponse({ success: true, action: "ensure_usage", skipped: "no_plan" });
      const sub = await createBareBillingSubscription("verbruik");
      log("Usage billing subscription created", { tenantId, billing_subscription_id: sub.id });
      return jsonResponse({ success: true, action: "ensure_usage", billing_subscription_id: sub.id });
    }

    // ================================= CONTRACT (BILL-TERM-1) ============
    // Binnen de minimale looptijd (Events Vast): alleen upgraden binnen hetzelfde spoor.
    if (action === "switch" || action === "activate") {
      const commitAt = (currentSub as { commitment_end_at?: string | null } | null)?.commitment_end_at ?? null;
      const curPlan = (currentSub as { pricing_plan?: { monthly_price: number; track?: string | null } | null } | null)?.pricing_plan ?? null;
      // Free kiezen = opzeggen: dat loopt via het opzegpad (contract loopt door tot het einde).
      if (currentSub?.plan_id !== planId && targetPlan.slug !== "free" &&
        commitmentBlocksSwitch(commitAt, toISODate(new Date()), curPlan, targetPlan as { monthly_price: number; track?: string | null })) {
        return jsonResponse(
          {
            success: false,
            error: "Je contract loopt nog. Tot het einde kan je alleen upgraden binnen hetzelfde pakket.",
            code: "commitment_running",
            commitment_end_at: commitAt,
          },
          409,
        );
      }
    }

    // ================================= €0 + GEBRUIK (FLEX-1) =============
    // Een plan zonder maandprijs maar met een kost per ticket (events_flex): geen
    // facturatie-abonnement (de ticketkost loopt via de Stripe application fee), maar
    // het plan blijft wél het gekozen plan en staat actief — niet terugvallen op 'free'.
    const isUsagePlan = targetPlan.slug !== "free" && Number(targetPlan.monthly_price) === 0 && Number(targetPlan.ticket_fee ?? 0) > 0;
    if (action !== "cancel" && isUsagePlan) {
      // BILL-ADDON-1: met add-ons blijft het facturatieabonnement bestaan; alleen de planregel gaat eraf.
      let keepBillingSubId: string | null = null;
      let keptInterval: Interval | null = null;
      if (currentSub?.billing_subscription_id) {
        if (await hasAddonLines(supabase, currentSub.billing_subscription_id)) {
          keepBillingSubId = currentSub.billing_subscription_id as string;
          const { data: keptSub } = await supabase.from("subscriptions").select("interval").eq("id", keepBillingSubId).maybeSingle();
          keptInterval = keptSub?.interval === "yearly" ? "yearly" : "monthly";
          const { error: plErr } = await supabase
            .from("subscription_lines")
            .delete()
            .eq("subscription_id", keepBillingSubId)
            .eq("kind", "plan");
          if (plErr) throw plErr;
        } else {
          const { error: subUpdErr } = await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("id", currentSub.billing_subscription_id);
          if (subUpdErr) throw subUpdErr;
        }
      }
      const { error: usageErr } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            plan_id: targetPlan.id,
            // Het interval van het behouden facturatieabonnement (de add-ons lopen daarop).
            billing_interval: keptInterval ?? interval,
            status: "active",
            canceled_at: null,
            cancel_at_period_end: false,
            billing_subscription_id: keepBillingSubId,
            commitment_end_at: null,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
          },
          { onConflict: "tenant_id" },
        );
      if (usageErr) throw usageErr;
      log("Usage plan active", { tenantId, plan: targetPlan.id });
      return jsonResponse({ success: true, action: "activate", plan_id: targetPlan.id, usage_based: true });
    }

    // ================================= CANCEL / FREE =====================
    // SUB-UNIFY-2A: opzeggen en Free kiezen gaan in op het EINDE van de betaalde
    // periode (keuze Akke 16-10). Tot dan blijft het huidige plan actief; het
    // facturatie-abonnement krijgt een end_date zodat de runner geen nieuwe cyclus
    // maakt, en subscription-lifecycle-sweep zet de winkel na de grens op Free.
    // Geen Stripe-call, geen cyclus, geen factuur in dit pad.
    const isFreePlan = (targetPlan.slug === "free") || Number(targetPlan.monthly_price) === 0;
    if (action === "cancel" || (action !== "activate" && isFreePlan) || (action === "activate" && isFreePlan)) {
      const nowISO = new Date().toISOString();
      const currentPlan = ((currentSub as { pricing_plan?: { monthly_price?: unknown; yearly_price?: unknown } | null } | null)?.pricing_plan) ?? null;
      const currentPlanIsPaid = !!currentPlan &&
        (Number(currentPlan.monthly_price) > 0 || Number(currentPlan.yearly_price) > 0);

      type BillingSubRow = { id: string; status: string | null; next_invoice_date: string | null };
      let billingSub: BillingSubRow | null = null;
      if (currentSub?.billing_subscription_id) {
        const { data: bs, error: bsErr } = await supabase
          .from("subscriptions")
          .select("id, status, next_invoice_date")
          .eq("id", currentSub.billing_subscription_id)
          .maybeSingle();
        if (bsErr) throw bsErr;
        billingSub = (bs as BillingSubRow | null) ?? null;
      }

      const baseDecision = decideCancel({
        currentPlanId: currentSub?.plan_id ?? null,
        currentPlanIsPaid,
        currentPeriodEnd: currentSub?.current_period_end ?? null,
        billingSubscriptionId: billingSub?.id ?? null,
        billingSubscriptionStatus: billingSub?.status ?? null,
        nextInvoiceDate: billingSub?.next_invoice_date ?? null,
      });
      // BILL-TERM-1: binnen de minimale looptijd loopt het contract door tot het einde (maandelijks verder gefactureerd).
      const commitAt = (currentSub as { commitment_end_at?: string | null } | null)?.commitment_end_at ?? null;
      const commitRunning = !!commitAt && new Date(commitAt).getTime() > Date.now();
      // Ook als er (nog) geen lopende betaalde periode is (maandcyclus nog niet betaald):
      // binnen het contract nooit meteen stoppen zolang het facturatieabonnement loopt.
      const forceContract = baseDecision.mode === "immediate" && commitRunning && billingSub?.status === "active";
      const decision = forceContract
        ? {
          mode: "at_period_end" as const,
          ...applyCommitmentToCancel({ accessUntil: nowISO, billingEndDate: toISODate(new Date()) }, commitAt),
          reason: "commitment_running",
        }
        : baseDecision.mode === "at_period_end"
        ? { ...baseDecision, ...applyCommitmentToCancel(baseDecision, commitAt) }
        : { ...baseDecision, extendedByCommitment: false };

      if (decision.mode === "at_period_end") {
        // Een openstaande pro-rata-upgrade eerst afhandelen (betalen of annuleren).
        const { data: openProrations, error: opErr } = await supabase
          .from("billing_cycles")
          .select("id")
          .eq("subscription_id", billingSub!.id)
          .eq("cycle_type", "proration")
          .in("status", ["pending", "awaiting_payment", "processing", "reopened"])
          .limit(1);
        if (opErr) throw opErr;
        if ((openProrations ?? []).length > 0) {
          return jsonResponse(
            {
              success: false,
              error: "Er staat nog een upgrade open. Betaal of annuleer die eerst.",
              code: "proration_cycle_open",
            },
            409,
          );
        }

        // Status blijft 'active' tot de grens; alleen de einddatum komt erop.
        const { error: endErr } = await supabase
          .from("subscriptions")
          .update({ end_date: decision.billingEndDate })
          .eq("id", billingSub!.id)
          .eq("status", "active");
        if (endErr) throw endErr;

        const { error: pendErr } = await supabase
          .from("tenant_subscriptions")
          .update({
            pending_plan_id: "free",
            pending_interval: null,
            pending_effective_at: decision.accessUntil,
            cancel_at_period_end: true,
            canceled_at: nowISO,
          })
          .eq("tenant_id", tenantId);
        if (pendErr) throw pendErr;

        log("Cancellation scheduled at period end", {
          tenantId,
          plan: currentSub?.plan_id,
          access_until: decision.accessUntil,
          billing_end_date: decision.billingEndDate,
          commitment: decision.extendedByCommitment,
        });
        return jsonResponse({
          success: true,
          action: "cancel",
          at_period_end: true,
          effective_at: decision.accessUntil,
          commitment_running: decision.extendedByCommitment,
        });
      }

      // BILL-ADDON-1: een Flex-/Free-winkel met betaalde add-ons. Het plan gaat meteen naar
      // Free, maar de add-ons lopen tot het einde van hun betaalde periode (keuze Akke 17-10);
      // de runner zet ze daarna uit. Het facturatieabonnement blijft daarvoor bestaan.
      let keepForAddons = false;
      if (billingSub && billingSub.status === "active" && decision.reason === "not_paid_plan" &&
        (await hasAddonLines(supabase, billingSub.id))) {
        const next = billingSub.next_invoice_date;
        if (next && next > toISODate(new Date())) {
          const d = new Date(`${next}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          await endAddonLines(supabase, billingSub.id, d.toISOString().slice(0, 10));
          keepForAddons = true;
        }
      }

      // Meteen naar Free: geen betaald plan, geen lopend facturatie-abonnement of
      // geen lopende periode — er is niets betaald om uit te dienen.
      if (billingSub && billingSub.status === "active" && !keepForAddons) {
        const { error: subUpdErr } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", billingSub.id);
        if (subUpdErr) throw subUpdErr;
      }
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            // SUB-UNIFY-2A: altijd Free. Voorheen bleef bij action 'cancel' het
            // betaalde plan staan (gat L1).
            plan_id: "free",
            billing_interval: currentSub?.billing_interval ?? interval,
            status: "canceled",
            canceled_at: nowISO,
            cancel_at_period_end: false,
            current_period_end: nowISO,
            commitment_end_at: null,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
          },
          { onConflict: "tenant_id" },
        );
      if (tsErr) throw tsErr;

      // Gedenormaliseerd planlabel gelijk trekken (service_role: mag sinds SEC-BILL-1).
      const { error: labelErr } = await supabase
        .from("tenants")
        .update({ subscription_plan: "free" })
        .eq("id", tenantId);
      if (labelErr) throw labelErr;
      // BILL-ADDON-1: zonder betaald plan geen betaalde add-ons meer (behalve wat nog betaald is).
      if (!keepForAddons) await clearModules();

      log("Cancelled immediately", { tenantId, reason: decision.reason });
      return jsonResponse({
        success: true,
        action: "cancel",
        at_period_end: false,
        effective_at: nowISO,
      });
    }

    // BILL-ADDON-1: activeren terwijl het facturatieabonnement nog loopt (bv. Flex met
    // betaalde add-ons → een betaald plan) is een planwissel met pro rata. Activeren met
    // hergebruik zou de periode op vandaag herstarten en de al betaalde add-ons dubbel aanrekenen.
    let flowAction: Action = action;
    if (action === "activate" && currentSub?.billing_subscription_id && currentSub.plan_id) {
      const { data: liveSub } = await supabase.from("subscriptions").select("status").eq("id", currentSub.billing_subscription_id).maybeSingle();
      if (liveSub?.status === "active") flowAction = "switch";
    }

    // ================================= ACTIVATE ==========================
    if (flowAction === "activate") {
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
        // Reuse van een gestopt abonnement: alle regels opnieuw. BILL-ADDON-1: de add-ons zijn
        // bij het stoppen uitgezet (business_modules), dus hun oude regels mogen niet mee.
        await supabase.from("subscription_lines").delete().eq("subscription_id", billingSubId);
        await supabase.from("subscription_lines").insert({
          subscription_id: billingSubId,
          kind: "plan",
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
            // SUB-UNIFY-2A: een einddatum van een eerdere opzegging mag een nieuwe
            // activatie niet stil laten overslaan door de runner.
            end_date: null,
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
            // BILL-TERM-1: contracteinde vanaf de start van dit plan.
            commitment_end_at: Number((targetPlan as { min_term_months?: number | null }).min_term_months ?? 0) > 0
              ? `${commitmentEnd(todayISO, Number((targetPlan as { min_term_months?: number }).min_term_months))}T00:00:00Z`
              : null,
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
    if (flowAction === "switch") {
      if (!currentSub || !currentSub.billing_subscription_id || !currentSub.plan_id) {
        // Fall back to activate — no live billing sub yet
        return jsonResponse(
          { success: false, error: "No active billing subscription to switch — use action=activate" },
          400,
        );
      }

      // SUB-UNIFY-2A: een openstaande opzegging (pending Free aan het einde van de
      // periode) wordt eerst ingetrokken. Een switch naar hetzelfde plan + interval is
      // daarna een no-op: zo maakt de knop "Heractiveer abonnement" de opzegging
      // ongedaan. Een switch naar een ander plan gaat daarna gewoon verder.
      if (hasPendingCancellation(currentSub)) {
        const { data: cancelledSub, error: csubErr } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("id", currentSub.billing_subscription_id)
          .maybeSingle();
        if (csubErr) throw csubErr;
        const resume = decideResume(currentSub, (cancelledSub as { status?: string | null } | null)?.status ?? null);
        if (!resume.resume) {
          return jsonResponse(
            {
              success: false,
              error: "Je abonnement is al gestopt. Kies opnieuw een plan zodra je op Free staat.",
              code: "cancellation_final",
              reason: resume.reason,
            },
            409,
          );
        }
        const { error: unEndErr } = await supabase
          .from("subscriptions")
          .update({ end_date: null })
          .eq("id", currentSub.billing_subscription_id)
          .eq("status", "active");
        if (unEndErr) throw unEndErr;
        const { error: unCancelErr } = await supabase
          .from("tenant_subscriptions")
          .update({
            cancel_at_period_end: false,
            canceled_at: null,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
          })
          .eq("tenant_id", tenantId);
        if (unCancelErr) throw unCancelErr;
        log("Cancellation revoked", { tenantId, plan: currentSub.plan_id });
        currentSub.cancel_at_period_end = false;
        currentSub.canceled_at = null;
        currentSub.pending_plan_id = null;
        currentSub.pending_interval = null;
        currentSub.pending_effective_at = null;
        if (currentSub.plan_id === planId && ((currentSub.billing_interval as Interval) || "monthly") === interval) {
          return jsonResponse({ success: true, action: "switch", noop: true, resumed: true });
        }
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
      const guard = await guardOpenProration(billingSubId);
      if (guard) return guard;

      // ---- Pro-rata maths: the subscription line is the truth ----
      const { data: subLines, error: slErr } = await supabase
        .from("subscription_lines")
        .select("id, quantity, unit_price, vat_rate, sort_order, kind, end_date")
        .eq("subscription_id", billingSubId)
        .order("sort_order", { ascending: true });
      if (slErr) throw slErr;
      // BILL-ADDON-1: een add-on die aan het einde van de periode stopt, telt niet mee.
      // deno-lint-ignore no-explicit-any
      const liveLines = ((subLines ?? []) as any[]).filter((l) => !l.end_date);

      const period = await resolveRunningPeriod(
        supabase,
        billingSubId,
        currentInterval,
        (billingSub.next_invoice_date as string | null) ?? null,
        todayISO,
      );

      const proration = computeProration({
        period,
        lines: liveLines,
        // BILL-ADDON-1: nieuw bedrag = plan + lopende add-ons tegen het doelinterval.
        // Een add-on van het spoor van het nieuwe plan valt weg (zit in het plan).
        newNet: +(priceForPlan(targetPlan, interval) +
          (await addonsNetFor(supabase, billingSubId, interval, (targetPlan as { track?: string | null }).track ?? null))).toFixed(2),
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

      const charge = await createAndChargeProration({
        billingSubId,
        paymentMode: (billingSub.payment_mode as string | null) ?? null,
        customerId,
        targetPlanId: planId,
        targetInterval: interval,
        description,
        todayISO,
        periodEnd: proration.period_end,
        deltaNet: proration.delta_net,
        vatAmount: proration.vat_amount,
        total: proration.total,
        vatRate: proration.vat_rate,
        kind: "upgrade",
      });
      if (charge.conflict) {
        return jsonResponse(
          {
            success: false,
            error: "Er staat al een upgrade open die nog niet betaald is",
            code: "proration_cycle_open",
          },
          409,
        );
      }
      const cycleId = charge.cycleId;

      // ---- Mandate accepted: plan goes live now ----
      if (charge.charged) {
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
        log("Upgrade charged and effectuated", { tenantId, billing_cycle_id: cycleId, intent: charge.intentId });
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

      const { dispatched, checkoutUrl, prNumber: freshPr } = await sendPaymentRequest(cycleId);

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
        payment_request_number: freshPr ?? charge.prNumber,
        checkout_session_url: checkoutUrl,
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
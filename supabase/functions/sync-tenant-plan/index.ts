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

function advanceDate(fromISO: string, interval: Interval): string {
  const [y, m, d] = fromISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  if (interval === "yearly") dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  else dt.setUTCMonth(dt.getUTCMonth() + 1);
  return toISODate(dt);
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
        const msg = e instanceof Error ? e.message : String(e);
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

      // ---- Upgrade: immediate entitlement + pro-rata one-off invoice ----
      const todayISO = toISODate(new Date());
      const periodStartISO = currentSub.current_period_start
        ? String(currentSub.current_period_start).slice(0, 10)
        : todayISO;
      const periodEndISO = currentSub.current_period_end
        ? String(currentSub.current_period_end).slice(0, 10)
        : advanceDate(periodStartISO, currentInterval);

      const msDay = 86400000;
      const periodDays = Math.max(
        1,
        Math.round(
          (Date.UTC(
            ...periodEndISO.split("-").map(Number) as [number, number, number],
          ) -
            Date.UTC(
              ...periodStartISO.split("-").map(Number) as [number, number, number],
            )) / msDay,
        ),
      );
      const remainingDays = Math.max(
        0,
        Math.round(
          (Date.UTC(
            ...periodEndISO.split("-").map(Number) as [number, number, number],
          ) -
            Date.UTC(
              ...todayISO.split("-").map(Number) as [number, number, number],
            )) / msDay,
        ),
      );

      const priceDiff = Math.max(
        0,
        priceForPlan(targetPlan, interval) - priceForPlan(currentPlan, currentInterval),
      );
      const proRata = +(priceDiff * (remainingDays / periodDays)).toFixed(2);

      // Update recurring line on billing subscription to new plan (for future periods).
      const { data: lines, error: lnErr } = await supabase
        .from("subscription_lines")
        .select("id")
        .eq("subscription_id", billingSubId)
        .order("sort_order", { ascending: true });
      if (lnErr) throw lnErr;
      if (lines && lines.length > 0) {
        await supabase
          .from("subscription_lines")
          .update({
            description: `${targetPlan.name} (${interval})`,
            unit_price: priceForPlan(targetPlan, interval),
            vat_rate: VAT_RATE,
            quantity: 1,
          })
          .eq("id", lines[0].id);
      }
      await supabase
        .from("subscriptions")
        .update({
          interval,
          name: `${(tenant as any).billing_company_name || tenant.name} — ${targetPlan.name} (${interval})`,
        })
        .eq("id", billingSubId);

      // Update entitlement immediately
      const newPeriodEndISO = interval !== currentInterval ? advanceDate(todayISO, interval) : periodEndISO;
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .update({
          plan_id: planId,
          billing_interval: interval,
          current_period_start: interval !== currentInterval ? `${todayISO}T00:00:00Z` : currentSub.current_period_start,
          current_period_end: `${newPeriodEndISO}T00:00:00Z`,
          pending_plan_id: null,
          pending_interval: null,
          pending_effective_at: null,
        })
        .eq("tenant_id", tenantId);
      if (tsErr) throw tsErr;

      // Create pro-rata one-off invoice on the internal SellQo tenant
      let proRataInvoiceId: string | null = null;
      if (proRata > 0) {
        const customerId = currentSub.billing_customer_id as string;
        const { data: invNumData, error: invNumErr } = await supabase.rpc(
          "generate_invoice_number",
          { _tenant_id: internalTenantId },
        );
        if (invNumErr) throw invNumErr;
        const invoiceNumber = invNumData as string;

        const net = proRata;
        const vat = +(net * (VAT_RATE / 100)).toFixed(2);
        const total = +(net + vat).toFixed(2);

        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            tenant_id: internalTenantId,
            customer_id: customerId,
            invoice_number: invoiceNumber,
            status: "sent",
            subtotal: net,
            tax_amount: vat,
            total,
            subscription_id: billingSubId,
            issue_date: todayISO,
            due_date: todayISO,
          })
          .select("id")
          .single();
        if (invErr) throw invErr;
        proRataInvoiceId = invoice.id as string;

        const { error: lineErr } = await supabase.from("invoice_lines").insert({
          invoice_id: invoice.id,
          line_type: "product",
          description: `Upgrade proration ${currentPlan.name} → ${targetPlan.name} (${remainingDays}/${periodDays} d)`,
          quantity: 1,
          unit_price: net,
          vat_rate: VAT_RATE,
          vat_amount: vat,
          line_total: total,
          net_amount: net,
          gross_amount: total,
          sort_order: 0,
        });
        if (lineErr) throw lineErr;

        // Off-session collect via mandate (best-effort — same pattern as runner)
        try {
          const { data: mandate } = await supabase
            .from("customer_payment_mandates")
            .select("stripe_customer_id, stripe_payment_method_id, method_type, status")
            .eq("tenant_id", internalTenantId)
            .eq("customer_id", customerId)
            .maybeSingle();
          if (mandate && mandate.status === "active") {
            const { getStripeContext } = await import("../_shared/stripe.ts");
            const { data: itFull } = await supabase
              .from("tenants")
              .select("id, is_demo, is_internal_tenant, stripe_account_id")
              .eq("id", internalTenantId)
              .maybeSingle();
            const ctx = getStripeContext(itFull as any);
            const intent = await ctx.stripe.paymentIntents.create(
              {
                amount: Math.round(total * 100),
                currency: "eur",
                customer: mandate.stripe_customer_id,
                payment_method: mandate.stripe_payment_method_id,
                payment_method_types: [mandate.method_type],
                confirm: true,
                off_session: true,
                metadata: {
                  invoice_id: invoice.id,
                  tenant_id: internalTenantId,
                  subscription_id: billingSubId,
                  proration: "1",
                },
              },
              ctx.requestOptions,
            );
            if (intent.status === "succeeded") {
              await supabase
                .from("invoices")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", invoice.id);
            } else if (intent.status === "processing") {
              await supabase.from("invoices").update({ status: "processing" }).eq("id", invoice.id);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[SYNC-TENANT-PLAN] Pro-rata charge failed: ${msg}`);
        }
      }

      log("Upgrade applied", {
        tenantId,
        from: currentSub.plan_id,
        to: planId,
        proRata,
        remainingDays,
        periodDays,
        proRataInvoiceId,
      });
      return jsonResponse({
        success: true,
        action: "switch",
        downgrade: false,
        pro_rata_amount: proRata,
        pro_rata_invoice_id: proRataInvoiceId,
        remaining_days: remainingDays,
        period_days: periodDays,
      });
    }

    return jsonResponse({ success: false, error: "Unhandled action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SYNC-TENANT-PLAN] ERROR: ${message}`);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
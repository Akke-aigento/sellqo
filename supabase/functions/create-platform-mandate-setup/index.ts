// 2a·1: Self-service SEPA mandate entry for a tenant's own SellQo platform
// subscription. The caller is a tenant_admin of the requesting tenant; the
// mandate itself lives on the INTERNAL SellQo tenant (platform Stripe account).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PLATFORM-MANDATE-SETUP] ${step}${suffix}`);
};

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenant_id;
    if (typeof tenantId !== "string" || !tenantId) {
      return json({ success: false, error: "tenant_id is required" }, 400);
    }
    // UX-UNIFY-1 (optional): plan context so the mandate page is never a blank cheque.
    const planId = typeof body?.plan_id === "string" && body.plan_id ? body.plan_id : null;
    const billingInterval = body?.billing_interval === "yearly" ? "yearly" : "monthly";

    // The caller must be tenant_admin of exactly this tenant (platform_admin
    // bypasses via requireRole for support purposes).
    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin"]);

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name, billing_company_name, billing_email, owner_email")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) return json({ success: false, error: "Tenant not found" }, 404);

    // Internal SellQo tenant resolution — same mechanism as sync-tenant-plan.
    const { data: internalTenant, error: itErr } = await supabase
      .from("tenants")
      .select("id, is_demo, is_internal_tenant, stripe_account_id")
      .eq("is_internal_tenant", true)
      .maybeSingle();
    if (itErr) throw itErr;
    if (!internalTenant) {
      return json({ success: false, error: "Internal SellQo tenant not configured" }, 500);
    }
    const internalTenantId = internalTenant.id as string;

    const { data: currentSub, error: csErr } = await supabase
      .from("tenant_subscriptions")
      .select(
        "id, billing_customer_id, plan_id, billing_interval, pending_plan_id, pending_interval, pending_effective_at",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (csErr) throw csErr;

    // ensureBillingCustomer — same logic as sync-tenant-plan.
    async function ensureBillingCustomer(existingCustomerId: string | null): Promise<string> {
      if (existingCustomerId) return existingCustomerId;
      const billingEmail =
        ((tenant as any).billing_email as string | null) ||
        ((tenant as any).owner_email as string | null) ||
        "";
      if (!billingEmail) throw new Error("Tenant has no billing email configured");
      const companyName =
        ((tenant as any).billing_company_name as string | null) ||
        ((tenant as any).name as string) ||
        "Tenant";

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

    const billingCustomerId = await ensureBillingCustomer(
      (currentSub?.billing_customer_id as string | null) ?? null,
    );

    // Persist the ensured customer back onto tenant_subscriptions when empty.
    if (currentSub?.id && !currentSub.billing_customer_id) {
      const { error: updErr } = await supabase
        .from("tenant_subscriptions")
        .update({ billing_customer_id: billingCustomerId })
        .eq("id", currentSub.id)
        .select("id");
      if (updErr) log("WARN could not persist billing_customer_id", { message: errMsg(updErr) });
    }

    const { data: billingCustomer, error: bcErr } = await supabase
      .from("customers")
      .select("id, email, first_name, last_name, company_name")
      .eq("id", billingCustomerId)
      .maybeSingle();
    if (bcErr) throw bcErr;
    if (!billingCustomer) throw new Error("Billing customer not found");

    // Stripe context = internal tenant → platform account.
    const ctx = getStripeContext(internalTenant as any);

    let stripeCustomerId: string | null = null;
    const { data: existingMandate } = await supabase
      .from("customer_payment_mandates")
      .select("stripe_customer_id")
      .eq("tenant_id", internalTenantId)
      .eq("customer_id", billingCustomerId)
      .maybeSingle();
    if (existingMandate?.stripe_customer_id) {
      stripeCustomerId = existingMandate.stripe_customer_id as string;
    }

    if (!stripeCustomerId) {
      const displayName =
        billingCustomer.company_name ||
        [billingCustomer.first_name, billingCustomer.last_name].filter(Boolean).join(" ").trim() ||
        billingCustomer.email ||
        undefined;
      const stripeCustomer = await ctx.stripe.customers.create(
        {
          email: billingCustomer.email ?? undefined,
          name: displayName,
          metadata: {
            tenant_id: internalTenantId,
            customer_id: billingCustomerId,
            platform_tenant_id: tenantId,
          },
        },
        ctx.requestOptions,
      );
      stripeCustomerId = stripeCustomer.id;
      log("Created Stripe customer", {
        stripeCustomerId,
        onPlatform: ctx.onPlatformAccount,
      });
    }

    const token = randomToken();

    // UX-POLISH-1 (bevinding B) — context volgorde: expliciet gevraagd plan,
    // dan een eventuele PENDING planwissel (downgrade per periode-einde), dan
    // het lopende plan. Zonder match -> NULL.
    let mandateContext: Record<string, unknown> | null = null;
    const pendingPlanId = ((currentSub as any)?.pending_plan_id as string | null) ?? null;
    const usePending = !planId && !!pendingPlanId;
    const ctxPlanId =
      planId ?? (usePending ? pendingPlanId : ((currentSub as any)?.plan_id as string | null)) ?? null;
    const ctxInterval = planId
      ? billingInterval
      : usePending
        ? ((currentSub as any)?.pending_interval === "yearly"
            ? "yearly"
            : (currentSub as any)?.pending_interval === "monthly"
              ? "monthly"
              : (currentSub as any)?.billing_interval === "yearly"
                ? "yearly"
                : "monthly")
        : ((currentSub as any)?.billing_interval === "yearly" ? "yearly" : "monthly");

    // effective_from voor de pending-variant: de eerstvolgende incassodatum.
    let effectiveFrom: string | null = null;
    if (usePending) {
      effectiveFrom = ((currentSub as any)?.pending_effective_at as string | null) ?? null;
      if (!effectiveFrom) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("next_invoice_date")
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", billingCustomerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        effectiveFrom = ((sub as any)?.next_invoice_date as string | null) ?? null;
      }
    }
    if (ctxPlanId) {
      const { data: plan } = await supabase
        .from("pricing_plans")
        .select("id, name, monthly_price, yearly_price")
        .eq("id", ctxPlanId)
        .maybeSingle();
      if (plan) {
        const price = Number(
          ctxInterval === "yearly" ? (plan as any).yearly_price : (plan as any).monthly_price,
        );
        if (price > 0) {
          mandateContext = {
            plan_id: plan.id,
            plan_name: (plan as any).name,
            price,
            interval: ctxInterval,
            ...(effectiveFrom ? { effective_from: effectiveFrom } : {}),
          };
        }
      }
    }

    const { error: tokErr } = await supabase.from("mandate_setup_tokens").insert({
      tenant_id: internalTenantId,
      customer_id: billingCustomerId,
      token,
      stripe_customer_id: stripeCustomerId,
      context: mandateContext,
    });
    if (tokErr) throw tokErr;

    const origin =
      req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
    const url = `${origin}/betaling/machtiging/${token}`;
    log("Platform mandate token created", {
      tenant: tenantId,
      internal_tenant: internalTenantId,
      billing_customer_id: billingCustomerId,
    });

    return json({ success: true, url, token, billing_customer_id: billingCustomerId });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = errMsg(err);
    log("ERROR", { message });
    return json({ success: false, error: message }, 500);
  }
});
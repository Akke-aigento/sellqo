// 2a·2: Self-service billing status for a tenant's own SellQo subscription.
// The billing customer, the mandate and the billing subscription all live on
// the INTERNAL SellQo tenant, which a tenant_admin cannot read directly
// (tenant-scoped RLS). This function reads/writes it with the service role
// after verifying the caller is tenant_admin of the requesting tenant.
//
// actions:
//   'status'            -> read the full billing status
//   'set_payment_mode'  -> set subscriptions.payment_mode ('mandate' | 'manual')

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-PLATFORM-BILLING-STATUS] ${step}${suffix}`);
};

const errMsg = (err: unknown): string => {
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
};

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
    const action = (body?.action ?? "status") as string;

    if (typeof tenantId !== "string" || !tenantId) {
      return json({ success: false, error: "tenant_id is required" }, 400);
    }
    if (!["status", "set_payment_mode"].includes(action)) {
      return json({ success: false, error: "action invalid" }, 400);
    }

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin"]);

    const { data: internalTenant, error: itErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("is_internal_tenant", true)
      .maybeSingle();
    if (itErr) throw itErr;
    if (!internalTenant) {
      return json({ success: false, error: "Internal SellQo tenant not configured" }, 500);
    }
    const internalTenantId = internalTenant.id as string;

    const { data: ts, error: tsErr } = await supabase
      .from("tenant_subscriptions")
      .select("id, billing_customer_id, billing_subscription_id, status, billing_interval")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (tsErr) throw tsErr;

    const billingCustomerId = (ts?.billing_customer_id as string | null) ?? null;
    const billingSubscriptionId = (ts?.billing_subscription_id as string | null) ?? null;

    // ---------------- set_payment_mode ----------------
    if (action === "set_payment_mode") {
      const mode = body?.payment_mode;
      if (mode !== "mandate" && mode !== "manual") {
        return json({ success: false, error: "payment_mode must be 'mandate' or 'manual'" }, 400);
      }
      if (!billingSubscriptionId) {
        return json(
          { success: false, error: "No billing subscription yet — activate a plan first" },
          409,
        );
      }
      const { data: updated, error: updErr } = await supabase
        .from("subscriptions")
        .update({ payment_mode: mode })
        .eq("id", billingSubscriptionId)
        .eq("tenant_id", internalTenantId)
        .select("id, payment_mode")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        return json({ success: false, error: "Billing subscription not found" }, 404);
      }
      log("payment_mode set", { tenantId, mode });
      return json({ success: true, payment_mode: updated.payment_mode });
    }

    // ---------------- status ----------------
    let mandate: { status: string; method_type: string } | null = null;
    if (billingCustomerId) {
      // Multiple mandate rows can exist (a failed one plus a fresh one) — take
      // the newest, so a superseded failure never blocks the tenant.
      const { data: mRows, error: mErr } = await supabase
        .from("customer_payment_mandates")
        .select("status, method_type, created_at")
        .eq("tenant_id", internalTenantId)
        .eq("customer_id", billingCustomerId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (mErr) throw mErr;
      const m = mRows?.[0];
      if (m) mandate = { status: m.status as string, method_type: m.method_type as string };
    }

    let paymentMode: string | null = null;
    let billingModel: string | null = null;
    let nextInvoiceDate: string | null = null;
    let subscriptionStatus: string | null = null;
    if (billingSubscriptionId) {
      const { data: sub, error: sErr } = await supabase
        .from("subscriptions")
        .select("id, payment_mode, billing_model, next_invoice_date, status")
        .eq("id", billingSubscriptionId)
        .eq("tenant_id", internalTenantId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (sub) {
        paymentMode = sub.payment_mode as string;
        billingModel = sub.billing_model as string;
        nextInvoiceDate = (sub.next_invoice_date as string | null) ?? null;
        subscriptionStatus = (sub.status as string | null) ?? null;
      }
    }

    return json({
      success: true,
      has_billing_customer: !!billingCustomerId,
      billing_customer_id: billingCustomerId,
      billing_subscription_id: billingSubscriptionId,
      billing_subscription_status: subscriptionStatus,
      mandate,
      payment_mode: paymentMode,
      billing_model: billingModel,
      next_invoice_date: nextInvoiceDate,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = errMsg(err);
    log("ERROR", { message });
    return json({ success: false, error: message }, 500);
  }
});
// 2a·2: Self-service billing status for a tenant's own SellQo subscription.
// The billing customer, the mandate and the billing subscription all live on
// the INTERNAL SellQo tenant, which a tenant_admin cannot read directly
// (tenant-scoped RLS). This function reads/writes it with the service role
// after verifying the caller is tenant_admin of the requesting tenant.
//
// actions:
//   'status'            -> read the full billing status
//   'set_payment_mode'  -> set subscriptions.payment_mode ('mandate' | 'manual')
//   'cancel_upgrade'    -> UPGRADE-PF-1: abort an unpaid pro-rata upgrade
//   'documents'         -> 2a·4: invoices + credit notes + open payment requests
//                          of the tenant's own SellQo subscription. A separate
//                          action (not folded into 'status') so the status
//                          payload stays small and cacheable, and the document
//                          list can be fetched/refetched independently.

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
    if (!["status", "set_payment_mode", "cancel_upgrade", "documents"].includes(action)) {
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
      .select(
        "id, billing_customer_id, billing_subscription_id, status, billing_interval, plan_id, pending_plan_id, pending_interval, pending_effective_at, pending_billing_cycle_id",
      )
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

    // ---------------- cancel_upgrade (UPGRADE-PF-1) ----------------
    // Allowed as long as the pro-rata cycle is unpaid: cancel the cycle and
    // clear the pending markers. Never touches a settled cycle or its invoice.
    if (action === "cancel_upgrade") {
      const cycleId = (ts?.pending_billing_cycle_id as string | null) ?? null;
      if (!cycleId) {
        return json({ success: false, error: "Er staat geen openstaande upgrade" }, 409);
      }
      const { data: cancelled, error: cErr } = await supabase
        .from("billing_cycles")
        .update({ status: "cancelled" })
        .eq("id", cycleId)
        .eq("cycle_type", "proration")
        .in("status", ["pending", "awaiting_payment", "reopened"])
        .is("invoice_id", null)
        .select("id");
      if (cErr) throw cErr;
      if (!cancelled || cancelled.length === 0) {
        return json(
          { success: false, error: "Deze upgrade kan niet meer geannuleerd worden" },
          409,
        );
      }
      const { error: clrErr } = await supabase
        .from("tenant_subscriptions")
        .update({
          pending_plan_id: null,
          pending_interval: null,
          pending_effective_at: null,
          pending_billing_cycle_id: null,
        })
        .eq("tenant_id", tenantId);
      if (clrErr) throw clrErr;
      log("Pending upgrade cancelled", { tenantId, billing_cycle_id: cycleId });
      return json({ success: true, cancelled_billing_cycle_id: cycleId });
    }

    // ---------------- documents (2a·4) ----------------
    // The billing customer is the complete link: it survives subscription
    // switches, so invoices from before a plan/interval swap stay visible.
    if (action === "documents") {
      if (!billingCustomerId) {
        return json({ success: true, invoices: [], credit_notes: [], payment_requests: [] });
      }

      const [invRes, cnRes, cycRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, status, total, issue_date, created_at, paid_at, pdf_path")
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", billingCustomerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, total, issue_date, original_invoice_id, pdf_path")
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", billingCustomerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("billing_cycles")
          .select(
            "id, payment_request_number, total, due_date, checkout_session_url, pdf_path, status, cycle_type, description",
          )
          .eq("tenant_id", internalTenantId)
          .eq("customer_id", billingCustomerId)
          .in("status", ["awaiting_payment", "processing", "reopened"])
          .order("created_at", { ascending: false }),
      ]);
      if (invRes.error) throw invRes.error;
      if (cnRes.error) throw cnRes.error;
      if (cycRes.error) throw cycRes.error;

      const invoiceRows = invRes.data ?? [];
      const numberById = new Map<string, string>();
      for (const row of invoiceRows) {
        numberById.set(row.id as string, (row.invoice_number as string) ?? "");
      }
      // A credit note can point at an invoice outside this list (edge case);
      // resolve those numbers too so the overview is never blank.
      const missing = (cnRes.data ?? [])
        .map((c) => c.original_invoice_id as string | null)
        .filter((id): id is string => !!id && !numberById.has(id));
      if (missing.length > 0) {
        const { data: extra, error: exErr } = await supabase
          .from("invoices")
          .select("id, invoice_number")
          .in("id", Array.from(new Set(missing)));
        if (exErr) throw exErr;
        for (const row of extra ?? []) {
          numberById.set(row.id as string, (row.invoice_number as string) ?? "");
        }
      }

      const creditNotes = (cnRes.data ?? []).map((c) => ({
        id: c.id,
        credit_note_number: c.credit_note_number,
        total: Number(c.total ?? 0),
        issue_date: c.issue_date,
        original_invoice_id: c.original_invoice_id,
        original_invoice_number: c.original_invoice_id
          ? numberById.get(c.original_invoice_id as string) ?? null
          : null,
        has_pdf: !!c.pdf_path,
      }));

      return json({
        success: true,
        invoices: invoiceRows.map((i) => ({
          id: i.id,
          invoice_number: i.invoice_number,
          status: i.status,
          total: Number(i.total ?? 0),
          issue_date: i.issue_date ?? i.created_at,
          paid_at: i.paid_at,
          has_pdf: !!i.pdf_path,
          credited_by: creditNotes
            .filter((c) => c.original_invoice_id === i.id)
            .map((c) => c.credit_note_number),
        })),
        credit_notes: creditNotes,
        payment_requests: (cycRes.data ?? []).map((c) => ({
          id: c.id,
          payment_request_number: c.payment_request_number,
          total: Number(c.total ?? 0),
          due_date: c.due_date,
          checkout_session_url: c.checkout_session_url,
          has_pdf: !!c.pdf_path,
          status: c.status,
          cycle_type: c.cycle_type,
          description: c.description,
        })),
      });
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

    // UPGRADE-PF-1: the open pro-rata upgrade, so the UI can show
    // "upgrade waiting for payment" with a pay link and a cancel option.
    let pendingUpgrade: Record<string, unknown> | null = null;
    if (ts?.pending_billing_cycle_id) {
      const { data: pc, error: pcErr } = await supabase
        .from("billing_cycles")
        .select(
          "id, status, total, description, target_plan_id, target_interval, checkout_session_url, payment_request_number, due_date, grace_until",
        )
        .eq("id", ts.pending_billing_cycle_id as string)
        .maybeSingle();
      if (pcErr) throw pcErr;
      if (pc && ["pending", "awaiting_payment", "processing", "reopened"].includes(pc.status as string)) {
        pendingUpgrade = {
          billing_cycle_id: pc.id,
          status: pc.status,
          total: Number(pc.total ?? 0),
          description: pc.description,
          target_plan_id: pc.target_plan_id,
          target_interval: pc.target_interval,
          checkout_session_url: pc.checkout_session_url,
          payment_request_number: pc.payment_request_number,
          due_date: pc.due_date,
          grace_until: pc.grace_until,
          cancellable: ["pending", "awaiting_payment", "reopened"].includes(pc.status as string),
        };
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
      pending_upgrade: pendingUpgrade,
      pending_plan_id: (ts?.pending_plan_id as string | null) ?? null,
      pending_interval: (ts?.pending_interval as string | null) ?? null,
      pending_effective_at: (ts?.pending_effective_at as string | null) ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = errMsg(err);
    log("ERROR", { message });
    return json({ success: false, error: message }, 500);
  }
});
// SUB-2 / CYCLE-3: Shared handler for payment_intent.* webhook events that
// carry either metadata.invoice_id (invoice-first: off-session charges of
// existing Sellqo subscription invoices) or metadata.billing_cycle_id
// (pay-first: the webhook is the ONLY place that creates the invoice).
// Idempotent — invoked from both platform-stripe-webhook and
// stripe-connect-webhook so it works for internal (platform account) and
// connected tenants alike.

import type Stripe from "https://esm.sh/stripe@18.5.0";

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  functions?: { invoke: (name: string, opts?: Record<string, unknown>) => any };
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUB-CHARGE-WEBHOOK] ${step}${suffix}`);
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * If the payment method itself is gone/revoked, flag the mandate as failed so
 * we stop trying to reuse it. Shared by both branches.
 */
async function flagMandateIfDetached(
  supabase: SupabaseLike,
  intent: Stripe.PaymentIntent,
) {
  const lastError = intent.last_payment_error;
  const paymentMethodId =
    (typeof lastError?.payment_method === "object" && lastError?.payment_method?.id) ||
    (typeof intent.payment_method === "string" ? intent.payment_method : null);

  const detached =
    lastError?.code === "payment_method_detached" ||
    lastError?.code === "sepa_debit_generic_failure" ||
    lastError?.decline_code === "revoked_authorization";
  if (!detached || !paymentMethodId) return;

  const { error: mErr } = await supabase
    .from("customer_payment_mandates")
    .update({ status: "failed" })
    .eq("stripe_payment_method_id", paymentMethodId);
  if (mErr) {
    log("Failed to flag mandate", { paymentMethodId, error: mErr.message });
  } else {
    log("Mandate flagged as failed", { paymentMethodId });
  }
}

/**
 * Returns true when the intent was recognized as a subscription-invoice
 * charge and processing was attempted (so caller can skip other branches).
 */
export async function handleSubscriptionChargeWebhook(
  supabase: SupabaseLike,
  event: Stripe.Event,
): Promise<boolean> {
  if (
    event.type !== "payment_intent.succeeded" &&
    event.type !== "payment_intent.payment_failed"
  ) {
    return false;
  }

  const intent = event.data.object as Stripe.PaymentIntent;

  // CYCLE-3: pay-first cycles take precedence — checked before invoice_id.
  const cycleId = intent.metadata?.billing_cycle_id;
  if (cycleId) {
    return await handleCycleCharge(supabase, event, intent, cycleId);
  }

  const invoiceId = intent.metadata?.invoice_id;
  if (!invoiceId) return false;

  return await handleInvoiceCharge(supabase, event, intent, invoiceId);
}

// ---------------------------------------------------------------------------
// invoice-first path (unchanged behaviour)
// ---------------------------------------------------------------------------
async function handleInvoiceCharge(
  supabase: SupabaseLike,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  invoiceId: string,
): Promise<boolean> {
  // Fetch current invoice state — used for idempotency.
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, charge_attempts, paid_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchErr) {
    log("Failed to load invoice", { invoiceId, error: fetchErr.message });
    return true;
  }
  if (!invoice) {
    log("Invoice not found — dropping event", { invoiceId });
    return true;
  }

  if (event.type === "payment_intent.succeeded") {
    if (invoice.status === "paid") {
      log("Idempotent: invoice already paid", { invoiceId });
      return true;
    }
    const { error: updErr } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: invoice.paid_at ?? new Date().toISOString(),
      })
      .eq("id", invoiceId);
    if (updErr) {
      log("Failed to mark invoice paid", { invoiceId, error: updErr.message });
    } else {
      log("Invoice marked paid", { invoiceId, intent: intent.id });
    }
    return true;
  }

  // payment_intent.payment_failed
  const lastError = intent.last_payment_error;

  const { error: updErr } = await supabase
    .from("invoices")
    .update({
      status: "unpaid",
      charge_attempts: (invoice.charge_attempts ?? 0) + 1,
    })
    .eq("id", invoiceId)
    .neq("status", "paid"); // never overwrite a paid invoice
  if (updErr) {
    log("Failed to mark invoice unpaid", { invoiceId, error: updErr.message });
  } else {
    log("Invoice marked unpaid", {
      invoiceId,
      code: lastError?.code,
      decline: lastError?.decline_code,
    });
  }

  await flagMandateIfDetached(supabase, intent);

  return true;
}

// ---------------------------------------------------------------------------
// CYCLE-3: pay-first path — the invoice is created here, as proof of payment.
// ---------------------------------------------------------------------------

/** Derive the VAT rate from the cycle totals, snapping to common BE rates. */
function deriveVatRate(subtotal: number, vatAmount: number): number {
  if (!subtotal) return 0;
  const raw = (vatAmount / subtotal) * 100;
  for (const common of [0, 6, 12, 21]) {
    if (Math.abs(raw - common) <= 0.05) return common;
  }
  return +raw.toFixed(2);
}

const nlDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

async function handleCycleCharge(
  supabase: SupabaseLike,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  cycleId: string,
): Promise<boolean> {
  const { data: cycle, error: cErr } = await supabase
    .from("billing_cycles")
    .select(
      "id, tenant_id, customer_id, subscription_id, period_start, period_end, subtotal, vat_amount, total, status, invoice_id, due_date, grace_until",
    )
    .eq("id", cycleId)
    .maybeSingle();

  if (cErr) {
    log("Failed to load billing cycle", { cycleId, error: cErr.message });
    return true;
  }
  if (!cycle) {
    log("Billing cycle not found — dropping event", { cycleId });
    return true;
  }

  if (event.type === "payment_intent.payment_failed") {
    const lastError = intent.last_payment_error;
    const patch: Record<string, unknown> = {
      status: "awaiting_payment",
      stripe_payment_intent_id: intent.id,
    };
    // Only fill due_date/grace_until when the runner has not set them yet.
    if (!cycle.due_date) {
      const today = toISODate(new Date());
      patch.due_date = today;
      const grace = new Date();
      grace.setUTCDate(grace.getUTCDate() + 7); // TODO: make grace period configurable
      patch.grace_until = toISODate(grace);
    }

    const { error: updErr } = await supabase
      .from("billing_cycles")
      .update(patch)
      .eq("id", cycle.id)
      .neq("status", "settled")
      .is("invoice_id", null);
    if (updErr) {
      log("Failed to mark cycle awaiting_payment", { cycleId, error: updErr.message });
    } else {
      log("Cycle marked awaiting_payment", {
        cycleId,
        code: lastError?.code,
        decline: lastError?.decline_code,
      });
    }

    await flagMandateIfDetached(supabase, intent);
    return true;
  }

  // payment_intent.succeeded
  if (cycle.status === "settled" || cycle.invoice_id) {
    log("Idempotent: cycle already settled", { cycleId, invoiceId: cycle.invoice_id });
    return true;
  }

  const wasReopened = cycle.status === "expired" || cycle.status === "reopened";

  const subtotal = Number(cycle.subtotal ?? 0);
  const vatAmount = Number(cycle.vat_amount ?? 0);
  const total = Number(cycle.total ?? 0);

  // Invoice number from the existing tenant sequence.
  const { data: numData, error: numErr } = await supabase.rpc(
    "generate_invoice_number",
    { _tenant_id: cycle.tenant_id },
  );
  if (numErr) {
    log("Failed to generate invoice number", { cycleId, error: numErr.message });
    return true;
  }

  const todayISO = toISODate(new Date());
  const nowISO = new Date().toISOString();

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: cycle.tenant_id,
      customer_id: cycle.customer_id,
      subscription_id: cycle.subscription_id,
      invoice_number: numData as string,
      status: "paid",
      paid_at: nowISO,
      issue_date: todayISO,
      due_date: todayISO,
      subtotal,
      tax_amount: vatAmount,
      total,
    })
    .select("id")
    .single();
  if (invErr || !invoice) {
    log("Failed to create cycle invoice", { cycleId, error: invErr?.message });
    return true;
  }

  // Single line: amounts come from the cycle (source of truth for what was
  // actually charged); the VAT rate is derived from those totals.
  let subscriptionName: string | null = null;
  if (cycle.subscription_id) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("name")
      .eq("id", cycle.subscription_id)
      .maybeSingle();
    subscriptionName = sub?.name ?? null;
  }
  const description = `${subscriptionName ?? "Abonnement"} (${nlDate(cycle.period_start)} t/m ${nlDate(cycle.period_end)})`;

  const { error: lineErr } = await supabase.from("invoice_lines").insert({
    invoice_id: invoice.id,
    line_type: "product",
    description,
    quantity: 1,
    unit_price: subtotal,
    vat_rate: deriveVatRate(subtotal, vatAmount),
    vat_amount: vatAmount,
    net_amount: subtotal,
    gross_amount: total,
    line_total: total,
    sort_order: 0,
  });
  if (lineErr) {
    log("Failed to insert cycle invoice line", { cycleId, invoiceId: invoice.id, error: lineErr.message });
  }

  const { data: settled, error: setErr } = await supabase
    .from("billing_cycles")
    .update({
      status: "settled",
      invoice_id: invoice.id,
      stripe_payment_intent_id: intent.id,
    })
    .eq("id", cycle.id)
    .is("invoice_id", null)
    .select("id");
  if (setErr) {
    log("Failed to settle cycle", { cycleId, invoiceId: invoice.id, error: setErr.message });
    return true;
  }
  if (!settled || settled.length === 0) {
    // A concurrent webhook won the race and already linked an invoice.
    log("Cycle already linked by concurrent event — invoice left in place", {
      cycleId,
      invoiceId: invoice.id,
    });
    return true;
  }

  log(wasReopened ? "Cycle reopened and settled" : "Cycle settled", {
    cycleId,
    invoiceId: invoice.id,
    invoiceNumber: numData,
    intent: intent.id,
  });

  // PDF/UBL — best-effort. Odoo sync picks the paid invoice up on its own.
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${url}/functions/v1/generate-subscription-invoice-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sr}`, apikey: sr },
      body: JSON.stringify({ invoice_id: invoice.id }),
    });
    if (!r.ok) {
      log("Document generation returned non-OK", { invoiceId: invoice.id, status: r.status });
    }
  } catch (docErr) {
    log("Document generation failed", {
      invoiceId: invoice.id,
      error: docErr instanceof Error ? docErr.message : String(docErr),
    });
  }

  // Mail — pay-first always mails: the invoice is the proof of payment.
  try {
    if (supabase.functions?.invoke) {
      const { error: mailErr } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoice_id: invoice.id },
      });
      if (mailErr) throw mailErr;
    } else {
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${url}/functions/v1/send-invoice-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sr}`, apikey: sr },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }
  } catch (mailErr) {
    log("Invoice email failed", {
      invoiceId: invoice.id,
      error: mailErr instanceof Error ? mailErr.message : String(mailErr),
    });
  }

  return true;
}

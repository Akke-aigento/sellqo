// SUB-2: Shared handler for payment_intent.* webhook events that carry
// metadata.invoice_id (i.e. off-session charges of Sellqo subscription
// invoices). Idempotent — invoked from both platform-stripe-webhook and
// stripe-connect-webhook so it works for internal (platform account) and
// connected tenants alike.

import type Stripe from "https://esm.sh/stripe@18.5.0";

type SupabaseLike = {
  from: (table: string) => any;
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUB-CHARGE-WEBHOOK] ${step}${suffix}`);
};

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
  const invoiceId = intent.metadata?.invoice_id;
  if (!invoiceId) return false;

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
  const paymentMethodId =
    (typeof lastError?.payment_method === "object" && lastError?.payment_method?.id) ||
    (typeof intent.payment_method === "string" ? intent.payment_method : null);

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

  // If the payment method itself is gone/revoked, flag the mandate as failed
  // so we stop trying to reuse it.
  const detached =
    lastError?.code === "payment_method_detached" ||
    lastError?.code === "sepa_debit_generic_failure" ||
    lastError?.decline_code === "revoked_authorization";
  if (detached && paymentMethodId) {
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

  return true;
}
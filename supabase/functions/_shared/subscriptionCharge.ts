// SUB-2 / CYCLE-3: Shared handler for payment_intent.* webhook events that
// carry either metadata.invoice_id (invoice-first: off-session charges of
// existing Sellqo subscription invoices) or metadata.billing_cycle_id
// (pay-first: the webhook is the ONLY place that creates the invoice).
// Idempotent — invoked from both platform-stripe-webhook and
// stripe-connect-webhook so it works for internal (platform account) and
// connected tenants alike.

import type Stripe from "https://esm.sh/stripe@18.5.0";
import { effectuatePlanSwitch } from "./planEffectuate.ts";
import { advanceDate, type Interval } from "./planProration.ts";
import { resolveInvoiceFiscalFields } from "./invoiceFiscalFields.ts";
import { announceReopen, refreshStateForCustomer } from "./billingReopen.ts";
import { tenantPeriodAfterSettle } from "./tenantPeriod.ts";
import { invoiceLinesFromSnapshot } from "./addonBilling.ts";
import { effectuateAddonCycle } from "./addonLines.ts";
import {
  classifyPayment,
  cycleState,
  invoiceState,
  routeChargeEvent,
  settleBundleItems,
  type BundleItem,
} from "./payLink.ts";
import {
  customerDisplayName,
  customerSubscriptionStatus,
  declineReason,
  clearUnprocessedAlert,
  handleCycleChargeFailure,
  notifyOnce,
  paymentReceivedText,
  unprocessedPaymentText,
} from "./billingAlerts.ts";

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

/** true = afgehandeld (ook idempotent/anomalie); "dropped" = post bestaat niet (meer). */
type Outcome = true | "dropped";

/** Een alarm "niet verwerkt" pas na een uur: een hik die Stripe zelf binnen het uur herstelt, mailt niemand. */
const UNPROCESSED_ALERT_AFTER_S = 3600;

/** Deterministische UUID (SHA-256 van de sleutel, versie-4-vorm). Zelfde sleutel → zelfde id. */
export async function stableUuid(key: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  const b = hash.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * UPGRADE-PF-1: turn a settled proration cycle into the live plan.
 * The cycle's tenant_id is the invoicing (internal) tenant; the tenant whose
 * plan changes is found through the billing subscription.
 */
async function effectuateProrationCycle(supabase: SupabaseLike, cycle: any): Promise<void> {
  const targetInterval = ((cycle.target_interval as string) || "monthly") as Interval;

  const { data: ts, error: tsErr } = await supabase
    .from("tenant_subscriptions")
    .select("tenant_id, current_period_start, current_period_end")
    .eq("billing_subscription_id", cycle.subscription_id)
    .maybeSingle();
  if (tsErr) throw tsErr;
  if (!ts?.tenant_id) {
    log("Proration cycle has no tenant_subscription — skipping effectuation", {
      cycleId: cycle.id,
      subscriptionId: cycle.subscription_id,
    });
    return;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("interval")
    .eq("id", cycle.subscription_id)
    .maybeSingle();
  const intervalSwap = (sub?.interval ?? targetInterval) !== targetInterval;

  const today = toISODate(new Date());
  const periodStart = intervalSwap
    ? today
    : String(ts.current_period_start ?? cycle.period_start).slice(0, 10);
  const periodEnd = intervalSwap
    ? advanceDate(today, targetInterval)
    : String(ts.current_period_end ?? cycle.period_end).slice(0, 10);

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("name, billing_company_name")
    .eq("id", ts.tenant_id)
    .maybeSingle();

  const result = await effectuatePlanSwitch(supabase, {
    tenantId: ts.tenant_id,
    billingSubscriptionId: cycle.subscription_id,
    targetPlanId: String(cycle.target_plan_id),
    targetInterval,
    periodStart,
    periodEnd,
    intervalSwap,
    billingNamePrefix: tenantRow?.billing_company_name || tenantRow?.name || null,
  });

  log(
    result.applied
      ? "Proration settled — plan effectuated (manual path)"
      : "Proration settled — plan already live (mandate path)",
    { cycleId: cycle.id, tenantId: ts.tenant_id, targetPlanId: cycle.target_plan_id, targetInterval },
  );
}

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
  // PAY-LINK-1: de keuze staat puur in payLink.ts (getest). Een webshopbetaling
  // (stripe-connect-webhook) heeft geen billing-sleutel → null → false, en de
  // webhook gaat door naar zijn eigen order-, checkout- en refundtakken.
  const intentMeta = (event.data.object as { metadata?: Record<string, unknown> } | null)?.metadata;
  const route = routeChargeEvent(event.type, intentMeta);
  if (!route) return false;

  const intent = event.data.object as Stripe.PaymentIntent;

  // BILLING-SAFE-1: een fout bij het verwerken wordt niet meer ingeslikt. De handler
  // gooit, de webhook antwoordt 500 en Stripe probeert opnieuw (de afboeking is
  // idempotent). Daarnaast één melding aan de verkoper, want een betaalde klant die
  // niet als betaald staat, kan in leesmodus vallen.
  try {
    let handled: Outcome;
    if (route === "bundle") {
      handled = await handleBundleCharge(supabase, event, intent, String(intent.metadata?.payment_bundle_id));
    } else if (route === "cycle") {
      // CYCLE-3: pay-first cycles take precedence — checked before invoice_id.
      handled = await handleCycleCharge(supabase, event, intent, String(intent.metadata?.billing_cycle_id));
    } else {
      handled = await handleInvoiceCharge(supabase, event, intent, String(intent.metadata?.invoice_id));
    }
    // Alsnog verwerkt: een alarm "niet verwerkt" van een eerdere poging klopt niet meer.
    // Niet bij een gedropt event (post verdwenen): dan blijft het alarm staan.
    if (handled === true && event.type === "payment_intent.succeeded") await clearUnprocessedAlert(supabase, intent.id);
    if (handled === "dropped") log("Event dropped — post not found", { route, intent: intent.id });
    return true;
  } catch (e) {
    const step = e instanceof Error ? e.message : String(e);
    log("ERROR: charge not processed — Stripe will retry", { route, intent: intent.id, step });
    // Pas na een uur alarm: de eerste herpogingen van Stripe vallen daarbinnen.
    const ageS = Math.floor(Date.now() / 1000) - Number((event as { created?: number }).created ?? 0);
    if (event.type === "payment_intent.succeeded" && ageS >= UNPROCESSED_ALERT_AFTER_S) {
      await notifyUnprocessedPayment(supabase, route, intent, step);
    }
    throw e;
  }
}

/** Zoekt bij een onverwerkte betaling de verkoper en de klant op, en meldt het één keer. */
async function notifyUnprocessedPayment(
  supabase: SupabaseLike,
  route: string,
  intent: Stripe.PaymentIntent,
  step: string,
): Promise<void> {
  try {
    const meta = (intent.metadata ?? {}) as Record<string, string>;
    const table = route === "bundle" ? "payment_bundles" : route === "cycle" ? "billing_cycles" : "invoices";
    const id = route === "bundle" ? meta.payment_bundle_id : route === "cycle" ? meta.billing_cycle_id : meta.invoice_id;
    const { data: row } = id
      ? await supabase.from(table).select("tenant_id, customer_id").eq("id", id).maybeSingle()
      : { data: null };
    const tenantId = (row?.tenant_id as string | undefined) ?? meta.tenant_id;
    if (!tenantId) return;
    const customerName = await customerDisplayName(supabase, row?.customer_id ?? null);
    const text = unprocessedPaymentText({
      customerName,
      amount: Number(intent.amount_received ?? intent.amount ?? 0) / 100,
      intentId: intent.id,
      step,
    });
    await notifyOnce(supabase, {
      tenantId,
      category: "payments",
      type: "payment_unprocessed",
      priority: "urgent",
      title: text.title,
      message: text.message,
      dedupeKey: `unprocessed:${intent.id}`,
      data: { payment_intent_id: intent.id, route },
    });
  } catch (e) {
    log("Unprocessed-payment notification failed", { intent: intent.id, error: e instanceof Error ? e.message : String(e) });
  }
}

// ---------------------------------------------------------------------------
// PAY-LINK-1: "Alles betalen" — één betaling, per post dezelfde afboekcode.
// ---------------------------------------------------------------------------
async function handleBundleCharge(
  supabase: SupabaseLike,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  bundleId: string,
): Promise<Outcome> {
  const { data: bundle, error } = await supabase
    .from("payment_bundles")
    .select("id, tenant_id, customer_id, items, status, payment_intent_id")
    .eq("id", bundleId)
    .maybeSingle();
  // BILLING-SAFE-1: een leesfout is tijdelijk → opnieuw laten proberen.
  if (error) throw new Error(`bundle laden: ${error.message}`);
  if (!bundle) {
    log("Bundle not found — dropping event", { bundleId });
    return "dropped";
  }
  // Een mislukte bundelbetaling raakt geen enkele post: die blijven open en betaalbaar.
  if (event.type === "payment_intent.payment_failed") {
    log("Bundle payment failed — posts untouched", { bundleId, intent: intent.id });
    return true;
  }
  if (bundle.status === "paid" && bundle.payment_intent_id === intent.id) {
    log("Idempotent: bundle already settled", { bundleId });
    return true;
  }

  const items = (bundle.items ?? []) as BundleItem[];
  const results = await settleBundleItems(items, async (item) => {
    if (item.type === "cycle") await handleCycleCharge(supabase, event, intent, item.id, bundleId);
    else await handleInvoiceCharge(supabase, event, intent, item.id, bundleId);
  });
  const summary = results.map((r) => ({ type: r.item.type, id: r.item.id, ok: r.ok, error: r.error }));

  // BILLING-SAFE-1: tot 27-10 ging de bundel altijd op 'paid', ook als een post
  // faalde — en blokkeerde de idempotentie daarna elke herpoging. Nu: pas 'paid'
  // als alle posten verwerkt zijn; anders gooien zodat Stripe opnieuw probeert
  // (reeds afgeboekte posten herkennen dezelfde betaling als 'retry').
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    log("Bundle partially settled — retry", { bundleId, intent: intent.id, results: summary });
    throw new Error(`bundel: ${failed.length} van ${results.length} posten niet verwerkt (${failed[0].error ?? "onbekend"})`);
  }

  const { error: paidErr } = await supabase
    .from("payment_bundles")
    .update({ status: "paid", payment_intent_id: intent.id, paid_at: new Date().toISOString() })
    .eq("id", bundleId);
  if (paidErr) throw new Error(`bundel op betaald zetten: ${paidErr.message}`);
  log("Bundle settled", { bundleId, intent: intent.id, results: summary });

  // Eén melding voor de hele bundel (de posten zelf melden niets in een bundel).
  try {
    const cycleIds = items.filter((i) => i.type === "cycle").map((i) => i.id);
    const { data: cycles } = cycleIds.length
      ? await supabase.from("billing_cycles").select("invoice_id").in("id", cycleIds)
      : { data: [] };
    const invoiceIds = (cycles ?? []).map((c: { invoice_id: string | null }) => c.invoice_id).filter(Boolean);
    const { data: newInvoices } = invoiceIds.length
      ? await supabase.from("invoices").select("invoice_number").in("id", invoiceIds)
      : { data: [] };
    const customerId = (bundle.customer_id as string | null) ?? null;
    const text = paymentReceivedText({
      customerName: await customerDisplayName(supabase, customerId),
      amount: Number(intent.amount_received ?? intent.amount ?? 0) / 100,
      paidFor: items.map((i) => i.number ?? null),
      newInvoiceNumbers: (newInvoices ?? []).map((i: { invoice_number: string }) => i.invoice_number),
      subscriptionStatus: await customerSubscriptionStatus(supabase, customerId),
    });
    await notifyOnce(supabase, {
      tenantId: bundle.tenant_id,
      category: "payments",
      type: "payment_received",
      priority: "high",
      title: text.title,
      message: text.message,
      dedupeKey: `paid:${intent.id}`,
      data: { payment_intent_id: intent.id, payment_bundle_id: bundleId },
    });
  } catch (e) {
    log("Bundle payment notification failed", { bundleId, error: e instanceof Error ? e.message : String(e) });
  }
  return true;
}

/**
 * PAY-LINK-1: een betaling op een post die al betaald of geannuleerd was.
 * Nooit opnieuw afboeken en nooit automatisch terugbetalen (beslissing Akke
 * 01-10): een rij in payment_anomalies (de markering op de post) en een melding
 * aan de tenant van de post — voor platformposten is dat SellQo.
 */
async function recordPaymentAnomaly(
  supabase: SupabaseLike,
  kind: "duplicate" | "closed_item",
  post: { tenantId: string; billingCycleId?: string; invoiceId?: string; number?: string | null },
  intent: Stripe.PaymentIntent,
  bundleId?: string,
): Promise<void> {
  const amount = Number(intent.amount_received ?? intent.amount ?? 0) / 100;
  const { error } = await supabase.from("payment_anomalies").insert({
    kind,
    tenant_id: post.tenantId,
    billing_cycle_id: post.billingCycleId ?? null,
    invoice_id: post.invoiceId ?? null,
    bundle_id: bundleId ?? null,
    payment_intent_id: intent.id,
    amount,
    currency: intent.currency ?? null,
  });
  if (error) {
    // 23505: dezelfde betaling op dezelfde post is al gemeld (webhook-retry).
    if ((error as { code?: string }).code === "23505") return;
    log("Failed to record payment anomaly", { kind, intent: intent.id, error: error.message });
  }
  const what = post.billingCycleId ? `betaalverzoek ${post.number ?? ""}` : `factuur ${post.number ?? ""}`;
  const { error: nErr } = await supabase.from("notifications").insert({
    tenant_id: post.tenantId,
    category: "payments",
    type: "payment_duplicate",
    priority: "high",
    title: kind === "duplicate" ? "Dubbele betaling ontvangen" : "Betaling op een geannuleerde post",
    message: kind === "duplicate"
      ? `Er kwam een tweede betaling binnen voor ${what.trim()}, die al betaald was. Niet automatisch terugbetaald (Stripe ${intent.id}).`
      : `Er kwam een betaling binnen voor ${what.trim()}, die geannuleerd was. Niet afgeboekt en niet automatisch terugbetaald (Stripe ${intent.id}).`,
    data: {
      payment_intent_id: intent.id,
      billing_cycle_id: post.billingCycleId ?? null,
      invoice_id: post.invoiceId ?? null,
      bundle_id: bundleId ?? null,
      amount,
    },
  });
  if (nErr) log("Failed to notify payment anomaly", { intent: intent.id, error: nErr.message });
  log(kind === "duplicate" ? "Duplicate payment recorded" : "Payment on closed item recorded", { ...post, intent: intent.id, bundleId });
}

// ---------------------------------------------------------------------------
// invoice-first path (unchanged behaviour)
// ---------------------------------------------------------------------------
async function handleInvoiceCharge(
  supabase: SupabaseLike,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  invoiceId: string,
  bundleId?: string,
): Promise<Outcome> {
  // Fetch current invoice state — used for idempotency.
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, tenant_id, customer_id, invoice_number, status, charge_attempts, paid_at, metadata")
    .eq("id", invoiceId)
    .maybeSingle();

  // BILLING-SAFE-1: een leesfout is tijdelijk → gooien, Stripe probeert opnieuw.
  if (fetchErr) throw new Error(`factuur laden: ${fetchErr.message}`);
  if (!invoice) {
    log("Invoice not found — dropping event", { invoiceId });
    return "dropped";
  }

  if (event.type === "payment_intent.succeeded") {
    // PAY-LINK-1: retry, dubbele betaling of betaling op een geannuleerde factuur?
    const metadata = (invoice.metadata ?? {}) as Record<string, unknown>;
    const decision = classifyPayment(
      { state: invoiceState(invoice), paidIntentId: (metadata.paid_payment_intent_id as string | undefined) ?? null },
      intent.id,
    );
    if (decision === "retry") {
      log("Idempotent: invoice already paid", { invoiceId });
      return true;
    }
    if (decision === "duplicate" || decision === "closed_item") {
      await recordPaymentAnomaly(supabase, decision, { tenantId: invoice.tenant_id, invoiceId, number: invoice.invoice_number }, intent, bundleId);
      return true;
    }
    const { error: updErr } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: invoice.paid_at ?? new Date().toISOString(),
        // PAY-LINK-1: welke betaling deze factuur betaalde, zodat een tweede herkend wordt.
        metadata: { ...metadata, paid_payment_intent_id: intent.id },
      })
      .eq("id", invoiceId);
    // BILLING-SAFE-1: niet op betaald gezet = gooien, Stripe probeert opnieuw.
    if (updErr) throw new Error(`factuur op betaald zetten: ${updErr.message}`);
    log("Invoice marked paid", { invoiceId, intent: intent.id });
    // BILLING-ENFORCE-1: een betaalde domeinfactuur kan de leesmodus opheffen.
    // PAYMENT-ALERT-1: en meteen melden dat de winkel weer open is.
    await announceReopen(supabase, await refreshStateForCustomer(supabase, invoice.customer_id ?? null));

    // BILLING-SAFE-1: melding aan de verkoper (in een bundel meldt de bundel zelf).
    if (!bundleId) {
      const text = paymentReceivedText({
        customerName: await customerDisplayName(supabase, invoice.customer_id ?? null),
        amount: Number(intent.amount_received ?? intent.amount ?? 0) / 100,
        paidFor: [invoice.invoice_number],
        newInvoiceNumbers: [],
        subscriptionStatus: await customerSubscriptionStatus(supabase, invoice.customer_id ?? null),
      });
      await notifyOnce(supabase, {
        tenantId: invoice.tenant_id,
        category: "payments",
        type: "payment_received",
        priority: "high",
        title: text.title,
        message: text.message,
        dedupeKey: `paid:${intent.id}`,
        data: { payment_intent_id: intent.id, invoice_id: invoiceId },
      });
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
    .neq("status", "paid") // never overwrite a paid invoice
    .neq("status", "cancelled"); // PAY-LINK-1: en een geannuleerde factuur niet heropenen
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
  bundleId?: string,
): Promise<Outcome> {
  const { data: cycle, error: cErr } = await supabase
    .from("billing_cycles")
    .select(
      "id, tenant_id, customer_id, subscription_id, period_start, period_end, subtotal, vat_amount, total, status, invoice_id, due_date, grace_until, cycle_type, target_plan_id, target_interval, description, payment_request_number, stripe_payment_intent_id, lines",
    )
    .eq("id", cycleId)
    .maybeSingle();

  // BILLING-SAFE-1: een leesfout is tijdelijk → gooien, Stripe probeert opnieuw.
  if (cErr) throw new Error(`cyclus laden: ${cErr.message}`);
  if (!cycle) {
    log("Billing cycle not found — dropping event", { cycleId });
    return "dropped";
  }

  if (event.type === "payment_intent.payment_failed") {
    // PAY-LINK-1: een mislukte poging op een geannuleerde cyclus (bv. PR-2026-0003)
    // mag hem niet heropenen.
    if (cycle.status === "cancelled") {
      log("Payment failed on cancelled cycle — left cancelled", { cycleId, intent: intent.id });
      return true;
    }
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
      .neq("status", "cancelled")
      .is("invoice_id", null);
    if (updErr) {
      // BILLING-SAFE-1: gooien, Stripe probeert opnieuw.
      throw new Error(`cyclus op wacht-op-betaling zetten: ${updErr.message}`);
    } else {
      log("Cycle marked awaiting_payment", {
        cycleId,
        code: lastError?.code,
        decline: lastError?.decline_code,
      });
    }

    await flagMandateIfDetached(supabase, intent);

    // BILLING-SAFE-1: een mislukte automatische afschrijving (mandaat, door de
    // runner gestart) krijgt meteen een betaalverzoek aan de klant en een melding
    // aan de verkoper. Een mislukte poging van de klant zelf via de betaallink niet:
    // die zit op dat moment op de betaalpagina. Eén keer per cyclus (claim).
    if (!bundleId && (intent.metadata as Record<string, string> | null)?.charge_kind === "mandate") {
      await handleCycleChargeFailure(supabase, {
        cycleId: cycle.id,
        reason: declineReason(lastError?.code, lastError?.decline_code, lastError?.message),
        intentId: intent.id,
      });
    }
    return true;
  }

  // payment_intent.succeeded
  // PAY-LINK-1: retry, dubbele betaling of betaling op een geannuleerde cyclus?
  // Tot 01-10 werd een geannuleerde cyclus gewoon afgeboekt en een tweede betaling
  // alleen gelogd.
  const decision = classifyPayment(
    { state: cycleState(cycle), paidIntentId: cycle.stripe_payment_intent_id ?? null },
    intent.id,
  );
  if (decision === "retry") {
    log("Idempotent: cycle already settled", { cycleId, invoiceId: cycle.invoice_id });
    return true;
  }
  if (decision === "duplicate" || decision === "closed_item") {
    await recordPaymentAnomaly(
      supabase,
      decision,
      { tenantId: cycle.tenant_id, billingCycleId: cycleId, number: cycle.payment_request_number },
      intent,
      bundleId,
    );
    return true;
  }

  const wasReopened = cycle.status === "expired" || cycle.status === "reopened";

  const subtotal = Number(cycle.subtotal ?? 0);
  const vatAmount = Number(cycle.vat_amount ?? 0);
  const total = Number(cycle.total ?? 0);

  const todayISO = toISODate(new Date());

  // ---- BILL-2: fiscale velden ----
  // PAD 2 (charge-first): het BEDRAG bepaalt het REGIME.
  // Dit is het SPIEGELBEELD van generate-subscription-invoices, waar het regime
  // het bedrag bepaalt. Het geld is hier AL geïncasseerd via Stripe, dus
  // cycle.subtotal/vat_amount/total zijn de waarheid van wat betaald is.
  // Herrekenen mag niet, en een regime dat 0% verlegd claimt op een factuur
  // waar 21% btw op staat is geen "afwijking om te loggen" maar een
  // aangiftefout: de maatstaf belandt in rooster 46 terwijl de geïnde btw uit
  // rooster 54 verdwijnt.
  //
  // TREK DIT NIET GELIJK MET PAD 1. Een refactor die "consistentie" nastreeft
  // breekt de fiscale correctheid zonder dat een test faalt.
  //
  // De customer_id-guard is hier noodzakelijk: billing_cycles.customer_id is
  // nullable, anders dan subscriptions.customer_id (NOT NULL).
  const fiscal = cycle.customer_id
    ? await resolveInvoiceFiscalFields(supabase, {
      tenant_id: cycle.tenant_id as string,
      customer_id: cycle.customer_id as string,
      invoice_lines: [{ line_type: "product", amount: subtotal }],
      order_date: todayISO,
      sales_channel: "b2b_direct",
    })
    : null;

  let fiscalFields: Record<string, unknown> = {};
  let fiscalMetadata: Record<string, unknown> | null = null;
  if (fiscal) {
    const chargedRate = deriveVatRate(subtotal, vatAmount);
    const resolvedRate = fiscal.per_line[0]?.vat_rate;
    // Vergelijk TARIEVEN, niet regimes: dat vangt in één test zowel de
    // IC/export-casus als een 21-vs-6-afwijking. deriveVatRate snapt al naar
    // [0, 6, 12, 21] binnen 0.05, dus 0.01 tolerantie volstaat hier.
    //
    // subtotal > 0: een factuur van € 0 (gratis proef, 100% korting) kán geen
    // echte tarief-mismatch hebben — deriveVatRate geeft daar per definitie 0
    // terug. De mismatch-metadata is de werklijst voor de boekhouder; zulke
    // rijen erin zetten vervuilt precies de correctie-query.
    const mismatch = subtotal > 0 && resolvedRate !== undefined &&
      Math.abs(resolvedRate - chargedRate) >= 0.01;

    fiscalFields = mismatch
      ? { ...fiscal.fields, vat_regime: "domestic_standard" }
      : { ...fiscal.fields };

    if (mismatch) {
      log("Cycle VAT regime mismatch — regime forced to domestic_standard", {
        cycleId,
        chargedRate,
        resolvedRate,
        resolvedRegime: fiscal.fields.vat_regime,
      });
      // Metadata, niet alleen een log: dit draait in een webhook die niemand
      // bekijkt, dus een console-regel is de facto onzichtbaar en niet
      // queryable. invoices.metadata is jsonb met GIN-index; generate-invoice
      // gebruikt exact deze vorm al voor vat_regime_override.
      fiscalMetadata = {
        vat_regime_mismatch: {
          charged_rate: chargedRate,
          resolved_rate: resolvedRate,
          resolved_regime: fiscal.fields.vat_regime,
          detected_at: new Date().toISOString(),
        },
      };
    }
    if (fiscal.degraded) {
      log("Fiscal resolution degraded", {
        cycleId,
        error: fiscal.error,
        warnings: fiscal.warnings,
      });
    }
  }

  const nowISO = new Date().toISOString();

  // BILLING-SAFE-1: een vorige poging (Stripe-retry na een fout verderop) kan de
  // factuur al gemaakt hebben. Die hergebruiken we, zodat een herpoging nooit een
  // tweede factuur voor dezelfde betaling maakt. Herkenning via metadata die we
  // vanaf nu bij elke cyclusfactuur meegeven.
  const { data: orphanRows, error: orphanErr } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("tenant_id", cycle.tenant_id)
    .contains("metadata", { billing_cycle_id: cycle.id, payment_intent_id: intent.id })
    .limit(1);
  if (orphanErr) throw new Error(`eerdere factuur zoeken: ${orphanErr.message}`);
  const orphan = Array.isArray(orphanRows) ? orphanRows[0] : null;

  let invoice: { id: string };
  let invoiceNumber: string;
  if (orphan) {
    invoice = { id: orphan.id };
    invoiceNumber = orphan.invoice_number;
    log("Reusing invoice from an earlier attempt", { cycleId, invoiceId: orphan.id });
  } else {
    // Invoice number from the existing tenant sequence.
    // Staat bewust ná de fiscale resolutie: generate_invoice_number is MAX(...)+1,
    // dus die lezing en de insert horen zo dicht mogelijk op elkaar.
    const { data: numData, error: numErr } = await supabase.rpc(
      "generate_invoice_number",
      { _tenant_id: cycle.tenant_id },
    );
    if (numErr) throw new Error(`factuurnummer: ${numErr.message}`);

    const { data: inserted, error: invErr } = await supabase
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
        ...fiscalFields,
        metadata: { ...(fiscalMetadata ?? {}), billing_cycle_id: cycle.id, payment_intent_id: intent.id },
      })
      .select("id")
      .single();
    if (invErr || !inserted) throw new Error(`factuur aanmaken: ${invErr?.message ?? "geen rij"}`);
    invoice = inserted;
    invoiceNumber = numData as string;
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
  // UPGRADE-PF-1: a proration cycle carries its own human description
  // ("Upgrade X → Y (pro rata n/m d, ...)"); fall back to the period text.
  const description = cycle.description
    ? String(cycle.description)
    : `${subscriptionName ?? "Abonnement"} (${nlDate(cycle.period_start)} t/m ${nlDate(cycle.period_end)})`;

  // BILL-ADDON-1: een cyclus met een regelsnapshot (plan, add-ons, ticketkosten) krijgt een
  // gespecificeerde factuur. De btw per regel telt exact op tot wat er geïnd werd; als de
  // som van de snapshot niet klopt met de cyclus (oude of handmatige cyclus), één regel.
  const snapshot = Array.isArray(cycle.lines) ? (cycle.lines as { description: string; quantity: number; unit_price: number; vat_rate: number }[]) : [];
  const itemized = snapshot.length > 0 ? invoiceLinesFromSnapshot(snapshot, vatAmount) : [];
  const itemizedNet = +itemized.reduce((a, r) => a + r.net, 0).toFixed(2);
  const useItemized = itemized.length > 0 && Math.abs(itemizedNet - subtotal) < 0.005;
  const lineRows = useItemized
    ? itemized.map((r, i) => ({
      invoice_id: invoice.id,
      line_type: "product",
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      vat_rate: r.vat_rate,
      vat_amount: r.vat_amount,
      net_amount: r.net,
      gross_amount: r.gross,
      line_total: r.gross,
      sort_order: i,
    }))
    : [{
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
    }];
  if (itemized.length > 0 && !useItemized) {
    log("Cycle line snapshot does not match subtotal — single line", { cycleId, itemizedNet, subtotal });
  }
  // BILLING-SAFE-1: regels enkel als de (hergebruikte) factuur er nog geen heeft;
  // een fout hier is niet meer stil, want een factuur zonder regels is ongeldig.
  const { count: existingLines, error: countErr } = await supabase
    .from("invoice_lines")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoice.id);
  if (countErr) throw new Error(`factuurregels tellen: ${countErr.message}`);
  if (!existingLines) {
    // Vaste regel-id's (afgeleid van factuur + volgorde): twee gelijktijdige pogingen
    // op dezelfde factuur kunnen zo nooit dubbele regels maken.
    const rowsWithIds = await Promise.all(
      lineRows.map(async (r) => ({ ...r, id: await stableUuid(`${invoice.id}:line:${r.sort_order}`) })),
    );
    const { error: lineErr } = await supabase
      .from("invoice_lines")
      .upsert(rowsWithIds, { onConflict: "id", ignoreDuplicates: true });
    if (lineErr) throw new Error(`factuurregels: ${lineErr.message}`);
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
  if (setErr) throw new Error(`cyclus afboeken: ${setErr.message}`);
  if (!settled || settled.length === 0) {
    // BILLING-SAFE-1: een gelijktijdige levering van dezelfde betaling heeft dezelfde
    // (hergebruikte) factuur al gekoppeld — dan is er niets dubbel.
    const { data: now, error: nowErr } = await supabase
      .from("billing_cycles")
      .select("invoice_id")
      .eq("id", cycle.id)
      .maybeSingle();
    if (nowErr) throw new Error(`cyclus herlezen: ${nowErr.message}`);
    if (now?.invoice_id === invoice.id) {
      log("Cycle settled by a concurrent delivery of the same payment", { cycleId, invoiceId: invoice.id });
      return true;
    }
    // A concurrent webhook won the race and already linked an invoice.
    log("Cycle already linked by concurrent event — invoice left in place", {
      cycleId,
      invoiceId: invoice.id,
    });
    // BILLING-SAFE-1: dan bestaat er een tweede factuur voor dezelfde cyclus. Niet
    // stil laten staan: de verkoper moet ze crediteren.
    await notifyOnce(supabase, {
      tenantId: cycle.tenant_id,
      category: "payments",
      type: "payment_duplicate",
      priority: "high",
      title: `Dubbele factuur ${invoiceNumber}`,
      message: `Bij het verwerken van een betaling (Stripe ${intent.id}) ontstond factuur ${invoiceNumber} naast de factuur die al aan deze cyclus hing. Crediteer ${invoiceNumber}.`,
      dedupeKey: `race_invoice:${invoice.id}`,
      data: { billing_cycle_id: cycle.id, invoice_id: invoice.id, payment_intent_id: intent.id },
    });
    return true;
  }

  log(wasReopened ? "Cycle reopened and settled" : "Cycle settled", {
    cycleId,
    invoiceId: invoice.id,
    invoiceNumber,
    intent: intent.id,
  });

  // BILL-ADDON-1: de kassa-ticketfees op deze cyclus zijn nu gefactureerd.
  // LIMITS-1: ook de orderfees boven het gratis limiet.
  for (const table of ["platform_ticket_fees", "platform_order_fees"]) {
    const { error: feeErr } = await supabase
      .from(table)
      .update({ invoiced_at: nowISO })
      .eq("billing_cycle_id", cycle.id)
      .is("invoiced_at", null);
    if (feeErr) log("Fees invoiced_at update failed", { cycleId, table, error: feeErr.message });
  }

  // BILLING-ENFORCE-1: betaald is betaald — meteen herberekenen, niet pas bij de
  // cron van morgenochtend. Geldt voor het mandaat-pad én voor een handmatige
  // betaling via de betaallink; beide komen hier langs.
  // PAYMENT-ALERT-1: en meteen melden dat de winkel weer open is.
  await announceReopen(supabase, await refreshStateForCustomer(supabase, cycle.customer_id));

  // BILL-FIX-1: de tenant volgt de betaalde periode (alleen recurring, alleen vooruit).
  try {
    const { data: ts } = await supabase
      .from("tenant_subscriptions")
      .select("id, current_period_end")
      .eq("billing_subscription_id", cycle.subscription_id)
      .maybeSingle();
    if (ts) {
      const period = tenantPeriodAfterSettle(ts.current_period_end, cycle);
      const { error: tsErr } = await supabase
        .from("tenant_subscriptions")
        .update({
          ...(period ?? {}),
          last_payment_date: new Date().toISOString(),
          last_payment_amount: Number(cycle.total ?? 0),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ts.id);
      if (tsErr) log("Tenant period update failed", { cycleId, error: tsErr.message });
      else log("Tenant period updated", { cycleId, advanced: !!period });
    }
  } catch (e) {
    log("Tenant period update skipped", { cycleId, error: e instanceof Error ? e.message : String(e) });
  }

  // UPGRADE-PF-1: settlement of a proration cycle effectuates the plan switch.
  // Mandate mode already applied it in sync-tenant-plan (logged as a no-op
  // here); manual mode applies it now, on payment.
  if (cycle.cycle_type === "proration" && cycle.target_plan_id) {
    try {
      await effectuateProrationCycle(supabase, cycle);
    } catch (e) {
      log("ERROR: proration effectuation failed", {
        cycleId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  // BILL-ADDON-1: een betaalde add-on-pro-rata (geen plan) zet de add-on aan. Bij het
  // mandaatpad deed sync-tenant-plan dat al; dan is dit een no-op.
  if (cycle.cycle_type === "proration" && !cycle.target_plan_id) {
    try {
      const done = await effectuateAddonCycle(supabase, cycle);
      if (done) log("Add-on activated on settlement", { cycleId });
    } catch (e) {
      log("ERROR: add-on activation failed", { cycleId, error: e instanceof Error ? e.message : String(e) });
    }
  }

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
  let mailed = false;
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
    mailed = true;
  } catch (mailErr) {
    log("Invoice email failed", {
      invoiceId: invoice.id,
      error: mailErr instanceof Error ? mailErr.message : String(mailErr),
    });
  }

  // BILLING-SAFE-1: melding aan de verkoper (in een bundel meldt de bundel zelf).
  if (!bundleId) {
    try {
      const text = paymentReceivedText({
        customerName: await customerDisplayName(supabase, cycle.customer_id),
        amount: Number(intent.amount_received ?? intent.amount ?? 0) / 100,
        paidFor: [cycle.payment_request_number ?? description],
        newInvoiceNumbers: [invoiceNumber],
        mailed,
        subscriptionStatus: await customerSubscriptionStatus(supabase, cycle.customer_id),
      });
      await notifyOnce(supabase, {
        tenantId: cycle.tenant_id,
        category: "payments",
        type: "payment_received",
        priority: "high",
        title: text.title,
        message: text.message,
        dedupeKey: `paid:${intent.id}`,
        data: { payment_intent_id: intent.id, billing_cycle_id: cycle.id, invoice_id: invoice.id },
      });
    } catch (e) {
      log("Payment notification failed", { cycleId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return true;
}

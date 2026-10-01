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
import { refreshBillingStateForCustomer } from "./billingGuard.ts";
import {
  classifyPayment,
  cycleState,
  invoiceState,
  routeChargeEvent,
  settleBundleItems,
  type BundleItem,
} from "./payLink.ts";

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

  if (route === "bundle") {
    return await handleBundleCharge(supabase, event, intent, String(intent.metadata?.payment_bundle_id));
  }
  // CYCLE-3: pay-first cycles take precedence — checked before invoice_id.
  if (route === "cycle") {
    return await handleCycleCharge(supabase, event, intent, String(intent.metadata?.billing_cycle_id));
  }
  return await handleInvoiceCharge(supabase, event, intent, String(intent.metadata?.invoice_id));
}

// ---------------------------------------------------------------------------
// PAY-LINK-1: "Alles betalen" — één betaling, per post dezelfde afboekcode.
// ---------------------------------------------------------------------------
async function handleBundleCharge(
  supabase: SupabaseLike,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  bundleId: string,
): Promise<boolean> {
  const { data: bundle, error } = await supabase
    .from("payment_bundles")
    .select("id, tenant_id, items, status, payment_intent_id")
    .eq("id", bundleId)
    .maybeSingle();
  if (error || !bundle) {
    log("Bundle not found — dropping event", { bundleId, error: error?.message });
    return true;
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

  const results = await settleBundleItems((bundle.items ?? []) as BundleItem[], async (item) => {
    if (item.type === "cycle") await handleCycleCharge(supabase, event, intent, item.id, bundleId);
    else await handleInvoiceCharge(supabase, event, intent, item.id, bundleId);
  });

  await supabase
    .from("payment_bundles")
    .update({ status: "paid", payment_intent_id: intent.id, paid_at: new Date().toISOString() })
    .eq("id", bundleId);
  log("Bundle settled", {
    bundleId,
    intent: intent.id,
    results: results.map((r) => ({ type: r.item.type, id: r.item.id, ok: r.ok, error: r.error })),
  });
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
): Promise<boolean> {
  // Fetch current invoice state — used for idempotency.
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, tenant_id, invoice_number, status, charge_attempts, paid_at, metadata")
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
    if (updErr) {
      log("Failed to mark invoice paid", { invoiceId, error: updErr.message });
    } else {
      log("Invoice marked paid", { invoiceId, intent: intent.id });
      // BILLING-ENFORCE-1: een betaalde domeinfactuur kan de leesmodus opheffen.
      const { data: paidInvoice } = await supabase
        .from("invoices")
        .select("customer_id")
        .eq("id", invoiceId)
        .maybeSingle();
      await refreshBillingStateForCustomer(supabase, paidInvoice?.customer_id ?? null);
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
): Promise<boolean> {
  const { data: cycle, error: cErr } = await supabase
    .from("billing_cycles")
    .select(
      "id, tenant_id, customer_id, subscription_id, period_start, period_end, subtotal, vat_amount, total, status, invoice_id, due_date, grace_until, cycle_type, target_plan_id, target_interval, description, payment_request_number, stripe_payment_intent_id",
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

  // Invoice number from the existing tenant sequence.
  // Staat bewust ná de fiscale resolutie: generate_invoice_number is MAX(...)+1,
  // dus die lezing en de insert horen zo dicht mogelijk op elkaar.
  const { data: numData, error: numErr } = await supabase.rpc(
    "generate_invoice_number",
    { _tenant_id: cycle.tenant_id },
  );
  if (numErr) {
    log("Failed to generate invoice number", { cycleId, error: numErr.message });
    return true;
  }

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
      ...fiscalFields,
      ...(fiscalMetadata ? { metadata: fiscalMetadata } : {}),
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
  // UPGRADE-PF-1: a proration cycle carries its own human description
  // ("Upgrade X → Y (pro rata n/m d, ...)"); fall back to the period text.
  const description = cycle.description
    ? String(cycle.description)
    : `${subscriptionName ?? "Abonnement"} (${nlDate(cycle.period_start)} t/m ${nlDate(cycle.period_end)})`;

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

  // BILLING-ENFORCE-1: betaald is betaald — meteen herberekenen, niet pas bij de
  // cron van morgenochtend. Geldt voor het mandaat-pad én voor een handmatige
  // betaling via de betaallink; beide komen hier langs.
  await refreshBillingStateForCustomer(supabase, cycle.customer_id);

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

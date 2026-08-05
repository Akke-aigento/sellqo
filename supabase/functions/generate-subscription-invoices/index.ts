import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GEN-SUB-INVOICES] ${step}${suffix}`);
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function advanceDate(from: string, interval: string, count: number): string {
  // Parse as UTC date to avoid timezone drift
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const n = Math.max(1, Number(count) || 1);
  const iv = (interval || "monthly").toLowerCase();
  switch (iv) {
    case "weekly":
      dt.setUTCDate(dt.getUTCDate() + 7 * n);
      break;
    case "monthly":
      dt.setUTCMonth(dt.getUTCMonth() + n);
      break;
    case "quarterly":
      dt.setUTCMonth(dt.getUTCMonth() + 3 * n);
      break;
    case "yearly":
    case "annual":
      dt.setUTCFullYear(dt.getUTCFullYear() + n);
      break;
    default:
      dt.setUTCMonth(dt.getUTCMonth() + n);
  }
  return toISODate(dt);
}

// CYCLE-1: grace period after the due date of a payment request.
// TODO: make configurable per tenant/plan.
const GRACE_DAYS = 7;

function addDays(iso: string, days: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODate(dt);
}

type CycleSummary = {
  cycles_created: number;
  cycles_awaiting_payment: number;
  cycles_processing: number;
  cycles_swept: number;
  charge_failed: number;
  no_mandate: number;
};

type BillingCycleRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  total: number | string;
  mode: "mandate" | "manual";
  period_start: string;
  payment_request_number: string | null;
};

/**
 * CYCLE-1: takes a freshly created (or stale 'pending') billing cycle from
 * 'pending' to either 'awaiting_payment' (manual / no mandate / failed charge)
 * or 'processing' (mandate charge accepted by Stripe).
 *
 * The runner NEVER sets 'settled' — the Stripe webhook (CYCLE-3) is the single
 * place that creates the invoice and settles the cycle.
 */
async function handlePendingCycle(
  supabase: any,
  cycle: BillingCycleRow,
  summary: CycleSummary,
): Promise<void> {
  const dueDate = cycle.period_start;
  const graceUntil = addDays(dueDate, GRACE_DAYS);

  const toAwaitingPayment = async (extra: Record<string, unknown> = {}) => {
    await supabase
      .from("billing_cycles")
      .update({
        status: "awaiting_payment",
        due_date: dueDate,
        grace_until: graceUntil,
        ...extra,
      })
      .eq("id", cycle.id);
    summary.cycles_awaiting_payment++;
  };

  if (cycle.mode === "manual") {
    let prNumber = cycle.payment_request_number;
    if (!prNumber) {
      const { data: prData, error: prErr } = await supabase.rpc(
        "generate_payment_request_number",
        { _tenant_id: cycle.tenant_id },
      );
      if (prErr) throw prErr;
      prNumber = prData as string;
    }
    await toAwaitingPayment({ payment_request_number: prNumber });
    log("Cycle awaiting manual payment", {
      billing_cycle_id: cycle.id,
      payment_request_number: prNumber,
    });
    return;
  }

  // mode === 'mandate'
  try {
    const { data: mandate, error: mErr } = await supabase
      .from("customer_payment_mandates")
      .select("stripe_customer_id, stripe_payment_method_id, method_type, status")
      .eq("tenant_id", cycle.tenant_id)
      .eq("customer_id", cycle.customer_id)
      .maybeSingle();
    if (mErr) throw mErr;

    if (!mandate || mandate.status !== "active") {
      summary.no_mandate++;
      await toAwaitingPayment();
      log("Cycle has no active mandate — awaiting payment", { billing_cycle_id: cycle.id });
      return;
    }

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, is_demo, is_internal_tenant, stripe_account_id")
      .eq("id", cycle.tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error("Tenant not found for cycle charge");

    const ctx = getStripeContext(tenant);
    const amountCents = Math.round(Number(cycle.total) * 100);

    const intent = await ctx.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "eur",
        customer: mandate.stripe_customer_id,
        payment_method: mandate.stripe_payment_method_id,
        payment_method_types: [mandate.method_type],
        confirm: true,
        off_session: true,
        metadata: {
          billing_cycle_id: cycle.id,
          tenant_id: cycle.tenant_id,
        },
      },
      { ...ctx.requestOptions, idempotencyKey: `cycle:${cycle.id}` },
    );

    if (intent.status === "succeeded" || intent.status === "processing") {
      // Deliberately NOT 'settled': the webhook creates the invoice.
      await supabase
        .from("billing_cycles")
        .update({
          status: "processing",
          stripe_payment_intent_id: intent.id,
          due_date: dueDate,
          grace_until: graceUntil,
        })
        .eq("id", cycle.id);
      summary.cycles_processing++;
      log("Cycle charge accepted", {
        billing_cycle_id: cycle.id,
        intent: intent.id,
        status: intent.status,
      });
      return;
    }

    summary.charge_failed++;
    await toAwaitingPayment({ stripe_payment_intent_id: intent.id });
    log("Cycle charge not confirmed", { billing_cycle_id: cycle.id, status: intent.status });
  } catch (chargeErr) {
    const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
    console.error(`[GEN-SUB-INVOICES] Cycle charge failed for ${cycle.id}: ${msg}`);
    summary.charge_failed++;
    await toAwaitingPayment();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const summary = {
    processed: 0,
    created: 0,
    skipped_existing: 0,
    skipped_no_lines: 0,
    charged: 0,
    charge_processing: 0,
    charge_failed: 0,
    no_mandate: 0,
    documents_generated: 0,
    documents_failed: 0,
    backfilled: 0,
    cycles_created: 0,
    cycles_awaiting_payment: 0,
    cycles_processing: 0,
    cycles_swept: 0,
    failed: [] as Array<{ subscription_id: string; error: string }>,
  };

  try {
    const today = new Date();
    const todayISO = toISODate(today);

    // Optional body: { subscription_id } for manual single-run
    let manualId: string | null = null;
    let backfillDocuments = false;
    try {
      if (req.method === "POST") {
        const text = await req.text();
        if (text) {
          const body = JSON.parse(text);
          if (body && typeof body.subscription_id === "string") {
            manualId = body.subscription_id;
          }
          if (body && body.backfill_documents === true) {
            backfillDocuments = true;
          }
        }
      }
    } catch (_) {
      // ignore malformed body — behave as full-run
    }

    log("Start", { today: todayISO, manualId, backfillDocuments });

    // ------------------------------------------------------------------
    // INV-DOC-1 backfill mode: iterate invoices missing pdf_url that are
    // linked to subscriptions and regenerate their documents. This is
    // idempotent — the PDF generator overwrites the stored object.
    // ------------------------------------------------------------------
    if (backfillDocuments) {
      const { data: missing, error: mErr } = await supabase
        .from("invoices")
        .select("id, subscription_id")
        .not("subscription_id", "is", null)
        .is("pdf_url", null)
        .limit(200);
      if (mErr) throw mErr;
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      for (const inv of missing ?? []) {
        try {
          const r = await fetch(`${url}/functions/v1/generate-subscription-invoice-pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sr}`, "apikey": sr },
            body: JSON.stringify({ invoice_id: (inv as any).id }),
          });
          const bodyText = await r.text().catch(() => "");
          if (r.ok) {
            summary.backfilled++;
          } else {
            summary.documents_failed++;
            console.error(`[GEN-SUB-INVOICES] Backfill doc HTTP ${r.status} for ${(inv as any).id}: ${bodyText.slice(0, 500)}`);
          }
        } catch (e) {
          summary.documents_failed++;
          console.error(`[GEN-SUB-INVOICES] Backfill doc failed for ${(inv as any).id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      log("Backfill complete", { backfilled: summary.backfilled, failed: summary.documents_failed });
      return new Response(JSON.stringify({ success: true, backfill: true, ...summary }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active subscriptions with lines
    // ------------------------------------------------------------------
    // CYCLE-1 sweep: billing cycles that were created but never reached
    // 'awaiting_payment'/'processing' (crash or timeout between insert and
    // charge). Retried after 1 hour; the Stripe idempotency key makes a
    // repeated charge attempt safe.
    // ------------------------------------------------------------------
    try {
      const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: stale, error: staleErr } = await supabase
        .from("billing_cycles")
        .select("id, tenant_id, customer_id, total, mode, period_start, payment_request_number")
        .eq("status", "pending")
        .lt("created_at", staleBefore)
        .limit(100);
      if (staleErr) throw staleErr;
      for (const cycle of (stale ?? []) as BillingCycleRow[]) {
        try {
          await handlePendingCycle(supabase, cycle, summary);
          summary.cycles_swept++;
        } catch (e) {
          console.error(
            `[GEN-SUB-INVOICES] Sweep failed for cycle ${cycle.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if ((stale ?? []).length > 0) {
        log("Pending-cycle sweep", { swept: summary.cycles_swept });
      }
    } catch (sweepErr) {
      console.error(
        `[GEN-SUB-INVOICES] Pending-cycle sweep failed: ${sweepErr instanceof Error ? sweepErr.message : String(sweepErr)}`,
      );
    }

    let query = supabase
      .from("subscriptions")
      .select(`
        id, tenant_id, customer_id, name, interval, interval_count,
        next_invoice_date, last_invoice_date, end_date, status,
        auto_send, payment_term_days, generate_days_before,
        payment_mode, billing_model,
        subscription_lines ( id, description, quantity, unit_price, vat_rate, sort_order )
      `)
      .eq("status", "active")
      .not("next_invoice_date", "is", null);
    if (manualId) {
      query = supabase
        .from("subscriptions")
        .select(`
          id, tenant_id, customer_id, name, interval, interval_count,
          next_invoice_date, last_invoice_date, end_date, status,
          auto_send, payment_term_days, generate_days_before,
          payment_mode, billing_model,
          subscription_lines ( id, description, quantity, unit_price, vat_rate, sort_order )
        `)
        .eq("status", "active")
        .eq("id", manualId)
        .not("next_invoice_date", "is", null);
    }
    const { data: subs, error: subsErr } = await query;

    if (subsErr) throw subsErr;

    const eligible = (subs ?? []).filter((s: any) => {
      if (!s.next_invoice_date) return false;
      // Manual run bypasses the cutoff check but keeps end_date guard.
      if (manualId) {
        const nid = new Date(s.next_invoice_date + "T00:00:00Z");
        if (s.end_date && new Date(s.end_date + "T00:00:00Z") < nid) return false;
        return true;
      }
      const daysBefore = Number(s.generate_days_before ?? 0);
      const cutoff = new Date(today);
      cutoff.setUTCDate(cutoff.getUTCDate() + daysBefore);
      const nid = new Date(s.next_invoice_date + "T00:00:00Z");
      if (nid > cutoff) return false;
      if (s.end_date && new Date(s.end_date + "T00:00:00Z") < nid) return false;
      return true;
    });

    log("Eligible subscriptions", { count: eligible.length });
    summary.processed = eligible.length;

    for (const sub of eligible as any[]) {
      try {
        const periodStart: string = sub.next_invoice_date;
        const periodEnd: string = advanceDate(periodStart, sub.interval, Number(sub.interval_count) || 1);

        // ------------------------------------------------------------------
        // ONBOARD-1: apply any pending downgrade / interval change on the
        // linked tenant_subscription BEFORE generating this period's invoice.
        // ------------------------------------------------------------------
        try {
          const { data: ts } = await supabase
            .from("tenant_subscriptions")
            .select("id, tenant_id, plan_id, billing_interval, pending_plan_id, pending_interval")
            .eq("billing_subscription_id", sub.id)
            .maybeSingle();
          if (ts && ts.pending_plan_id) {
            const newPlanId = ts.pending_plan_id as string;
            const newInterval = (ts.pending_interval as string) || ts.billing_interval || sub.interval;
            const { data: newPlan } = await supabase
              .from("pricing_plans")
              .select("id, name, slug, monthly_price, yearly_price")
              .eq("id", newPlanId)
              .maybeSingle();
            if (newPlan) {
              const isFree =
                newPlan.slug === "free" || Number(newPlan.monthly_price) === 0;
              if (isFree) {
                // Cancel billing subscription at boundary; no line rewrite needed.
                await supabase
                  .from("subscriptions")
                  .update({ status: "cancelled" })
                  .eq("id", sub.id);
                await supabase
                  .from("tenant_subscriptions")
                  .update({
                    plan_id: "free",
                    billing_interval: newInterval,
                    status: "canceled",
                    canceled_at: new Date().toISOString(),
                    cancel_at_period_end: true,
                    pending_plan_id: null,
                    pending_interval: null,
                    pending_effective_at: null,
                  })
                  .eq("id", ts.id);
                log("Applied pending downgrade to free — cancelling", {
                  subscription_id: sub.id,
                  tenant_id: ts.tenant_id,
                });
                summary.skipped_no_lines++;
                continue;
              }
              // Rewrite line + subscription
              const unit =
                newInterval === "yearly"
                  ? Number(newPlan.yearly_price)
                  : Number(newPlan.monthly_price);
              const { data: existingLines } = await supabase
                .from("subscription_lines")
                .select("id")
                .eq("subscription_id", sub.id)
                .order("sort_order", { ascending: true });
              if (existingLines && existingLines.length > 0) {
                await supabase
                  .from("subscription_lines")
                  .update({
                    description: `${newPlan.name} (${newInterval})`,
                    quantity: 1,
                    unit_price: unit,
                    vat_rate: 21,
                  })
                  .eq("id", existingLines[0].id);
                // Trim extra lines
                for (const extra of existingLines.slice(1)) {
                  await supabase.from("subscription_lines").delete().eq("id", extra.id);
                }
              } else {
                await supabase.from("subscription_lines").insert({
                  subscription_id: sub.id,
                  description: `${newPlan.name} (${newInterval})`,
                  quantity: 1,
                  unit_price: unit,
                  vat_rate: 21,
                  sort_order: 0,
                });
              }
              await supabase
                .from("subscriptions")
                .update({ interval: newInterval })
                .eq("id", sub.id);
              await supabase
                .from("tenant_subscriptions")
                .update({
                  plan_id: newPlanId,
                  billing_interval: newInterval,
                  pending_plan_id: null,
                  pending_interval: null,
                  pending_effective_at: null,
                })
                .eq("id", ts.id);
              // Refresh in-memory sub so downstream code sees the new interval + lines
              sub.interval = newInterval;
              sub.subscription_lines = [
                {
                  id: (existingLines && existingLines[0]?.id) || null,
                  description: `${newPlan.name} (${newInterval})`,
                  quantity: 1,
                  unit_price: unit,
                  vat_rate: 21,
                  sort_order: 0,
                },
              ];
              log("Applied pending plan change", {
                subscription_id: sub.id,
                new_plan: newPlanId,
                new_interval: newInterval,
              });
            }
          }
        } catch (pendingErr) {
          const pmsg = pendingErr instanceof Error ? pendingErr.message : String(pendingErr);
          console.error(`[GEN-SUB-INVOICES] Pending-plan apply failed for ${sub.id}: ${pmsg}`);
        }

        // Recompute periodEnd in case interval changed
        const periodEndAdj: string = advanceDate(
          periodStart,
          sub.interval,
          Number(sub.interval_count) || 1,
        );

        // ------------------------------------------------------------------
        // CYCLE-1: pay-first path. No invoice is created here — the runner
        // registers a billing cycle and (for mandates) starts the charge.
        // The invoice follows in the Stripe webhook (CYCLE-3).
        // `subscription_invoices` is never written in this path.
        // ------------------------------------------------------------------
        if (sub.billing_model === "pay_first") {
          const payFirstLines = (sub.subscription_lines ?? []) as any[];
          if (payFirstLines.length === 0) {
            summary.skipped_no_lines++;
            console.warn(`[GEN-SUB-INVOICES] Subscription ${sub.id} has no lines — skipping`);
            continue;
          }

          let cycleSubtotal = 0;
          let cycleVat = 0;
          for (const ln of payFirstLines) {
            const qty = Number(ln.quantity ?? 1);
            const unit = Number(ln.unit_price ?? 0);
            const rate = Number(ln.vat_rate ?? 0);
            const net = qty * unit;
            cycleSubtotal += net;
            cycleVat += +(net * rate / 100).toFixed(2);
          }
          cycleSubtotal = +cycleSubtotal.toFixed(2);
          cycleVat = +cycleVat.toFixed(2);
          const cycleTotal = +(cycleSubtotal + cycleVat).toFixed(2);
          const cycleMode = (sub.payment_mode as "mandate" | "manual") ?? "mandate";

          // Idempotency: insert-first on (subscription_id, period_start).
          const { data: cycle, error: cycleErr } = await supabase
            .from("billing_cycles")
            .insert({
              subscription_id: sub.id,
              tenant_id: sub.tenant_id,
              customer_id: sub.customer_id,
              period_start: periodStart,
              period_end: periodEndAdj,
              subtotal: cycleSubtotal,
              vat_amount: cycleVat,
              total: cycleTotal,
              mode: cycleMode,
              model: "pay_first",
              status: "pending",
            })
            .select("id, tenant_id, customer_id, total, mode, period_start, payment_request_number")
            .single();

          if (cycleErr) {
            if ((cycleErr as any).code === "23505") {
              // Cycle already exists for this period. Self-healing: if the
              // subscription's next_invoice_date was never advanced (crash
              // between cycle insert and advance), advance it now. No charge
              // is retried here — the sweep handles unfinished cycles.
              summary.skipped_existing++;
              if (sub.next_invoice_date === periodStart) {
                const { error: healErr } = await supabase
                  .from("subscriptions")
                  .update({ last_invoice_date: periodStart, next_invoice_date: periodEndAdj })
                  .eq("id", sub.id);
                if (healErr) throw healErr;
                log("Self-healed next_invoice_date after existing cycle", {
                  subscription_id: sub.id,
                  period_start: periodStart,
                });
              } else {
                log("Skip existing cycle", { subscription_id: sub.id, period_start: periodStart });
              }
              continue;
            }
            throw cycleErr;
          }

          summary.cycles_created++;
          log("Billing cycle created", {
            billing_cycle_id: cycle.id,
            subscription_id: sub.id,
            period_start: periodStart,
            period_end: periodEndAdj,
            mode: cycleMode,
            total: cycleTotal,
          });

          await handlePendingCycle(supabase, cycle as BillingCycleRow, summary);

          const { error: advErr } = await supabase
            .from("subscriptions")
            .update({ last_invoice_date: periodStart, next_invoice_date: periodEndAdj })
            .eq("id", sub.id);
          if (advErr) throw advErr;

          continue;
        }

        // Idempotency: existing invoice for same subscription + period_start?
        const { data: existing, error: existErr } = await supabase
          .from("subscription_invoices")
          .select("id")
          .eq("subscription_id", sub.id)
          .eq("period_start", periodStart)
          .maybeSingle();
        if (existErr) throw existErr;
        if (existing) {
          summary.skipped_existing++;
          log("Skip existing", { subscription_id: sub.id, period_start: periodStart });
          continue;
        }

        const lines = (sub.subscription_lines ?? []) as any[];
        if (lines.length === 0) {
          summary.skipped_no_lines++;
          console.warn(`[GEN-SUB-INVOICES] Subscription ${sub.id} has no lines — skipping`);
          continue;
        }

        // Compute totals
        let subtotal = 0;
        let taxAmount = 0;
        const invoiceLines = lines
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((ln, idx) => {
            const qty = Number(ln.quantity ?? 1);
            const unit = Number(ln.unit_price ?? 0);
            const rate = Number(ln.vat_rate ?? 0);
            const net = qty * unit;
            const vat = +(net * rate / 100).toFixed(2);
            const lineTotal = +(net + vat).toFixed(2);
            subtotal += net;
            taxAmount += vat;
            return {
              line_type: "product",
              description: ln.description ?? sub.name ?? "Abonnement",
              quantity: qty,
              unit_price: unit,
              vat_rate: rate,
              vat_amount: vat,
              line_total: lineTotal,
              net_amount: +net.toFixed(2),
              gross_amount: lineTotal,
              sort_order: idx,
            };
          });
        subtotal = +subtotal.toFixed(2);
        taxAmount = +taxAmount.toFixed(2);
        const total = +(subtotal + taxAmount).toFixed(2);

        // Generate invoice number via existing DB function
        const { data: invNumData, error: invNumErr } = await supabase.rpc(
          "generate_invoice_number",
          { _tenant_id: sub.tenant_id }
        );
        if (invNumErr) throw invNumErr;
        const invoiceNumber = invNumData as string;

        const issueDate = todayISO;
        const paymentTermDays = Number(sub.payment_term_days ?? 14);
        const dueDate = advanceDate(issueDate, "weekly", 0); // placeholder
        // compute due date properly
        const dueDateObj = new Date(issueDate + "T00:00:00Z");
        dueDateObj.setUTCDate(dueDateObj.getUTCDate() + paymentTermDays);
        const dueDateISO = toISODate(dueDateObj);

        // Create invoice
        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            tenant_id: sub.tenant_id,
            customer_id: sub.customer_id,
            invoice_number: invoiceNumber,
            status: "sent",
            subtotal,
            tax_amount: taxAmount,
            total,
            subscription_id: sub.id,
            issue_date: issueDate,
            due_date: dueDateISO,
          })
          .select()
          .single();
        if (invErr) throw invErr;

        // Insert invoice lines
        const linesToInsert = invoiceLines.map((l) => ({ ...l, invoice_id: invoice.id }));
        const { error: linesErr } = await supabase
          .from("invoice_lines")
          .insert(linesToInsert);
        if (linesErr) throw linesErr;

        // Link subscription_invoices with period
        const { error: linkErr } = await supabase
          .from("subscription_invoices")
          .insert({
            subscription_id: sub.id,
            invoice_id: invoice.id,
            period_start: periodStart,
            period_end: periodEndAdj,
          });
        if (linkErr) throw linkErr;

        // Advance subscription's next_invoice_date (from OLD next_invoice_date)
        const { error: updErr } = await supabase
          .from("subscriptions")
          .update({
            last_invoice_date: periodStart,
            next_invoice_date: periodEndAdj,
          })
          .eq("id", sub.id);
        if (updErr) throw updErr;

        summary.created++;
        log("Invoice created", {
          subscription_id: sub.id,
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          period_start: periodStart,
          period_end: periodEndAdj,
        });

        // ----------------------------------------------------------------
        // INV-DOC-1: generate PDF + UBL for this subscription invoice.
        // Runs BEFORE the charge/mail block so that (a) auto-collect
        // mails, and (b) reminders sent later, always have documents
        // available. Failures are logged but never abort the invoice.
        // ----------------------------------------------------------------
        try {
          const url = Deno.env.get("SUPABASE_URL")!;
          const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const r = await fetch(`${url}/functions/v1/generate-subscription-invoice-pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sr}`, "apikey": sr },
            body: JSON.stringify({ invoice_id: invoice.id }),
          });
          if (r.ok) {
            summary.documents_generated++;
          } else {
            summary.documents_failed++;
            log("Document generation returned non-OK", { invoice_id: invoice.id, status: r.status });
          }
        } catch (docErr) {
          summary.documents_failed++;
          console.error(
            `[GEN-SUB-INVOICES] Document generation failed for invoice ${invoice.id}: ${docErr instanceof Error ? docErr.message : String(docErr)}`,
          );
        }

        // ----------------------------------------------------------------
        // SUB-2: off-session charge via active mandate (best-effort;
        // failure never invalidates the invoice itself).
        // ----------------------------------------------------------------
        try {
          const { data: mandate, error: mErr } = await supabase
            .from("customer_payment_mandates")
            .select("stripe_customer_id, stripe_payment_method_id, method_type, status")
            .eq("tenant_id", sub.tenant_id)
            .eq("customer_id", sub.customer_id)
            .maybeSingle();
          if (mErr) throw mErr;

          if (!mandate || mandate.status !== "active") {
            summary.no_mandate++;
            log("No active mandate", { subscription_id: sub.id });
          } else {
            const { data: tenant, error: tErr } = await supabase
              .from("tenants")
              .select("id, is_demo, is_internal_tenant, stripe_account_id")
              .eq("id", sub.tenant_id)
              .maybeSingle();
            if (tErr) throw tErr;
            if (!tenant) throw new Error("Tenant not found for charge");

            const ctx = getStripeContext(tenant);
            const amountCents = Math.round(Number(total) * 100);

            const intent = await ctx.stripe.paymentIntents.create(
              {
                amount: amountCents,
                currency: "eur",
                customer: mandate.stripe_customer_id,
                payment_method: mandate.stripe_payment_method_id,
                payment_method_types: [mandate.method_type],
                confirm: true,
                off_session: true,
                metadata: {
                  invoice_id: invoice.id,
                  tenant_id: sub.tenant_id,
                  subscription_id: sub.id,
                },
              },
              ctx.requestOptions,
            );

            if (intent.status === "succeeded") {
              await supabase
                .from("invoices")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", invoice.id);
              summary.charged++;
              log("Charge succeeded", { invoice_id: invoice.id, intent: intent.id });
            } else if (intent.status === "processing") {
              await supabase
                .from("invoices")
                .update({ status: "processing" })
                .eq("id", invoice.id);
              summary.charge_processing++;
              log("Charge processing (SEPA)", { invoice_id: invoice.id, intent: intent.id });
            } else {
              // requires_action / requires_payment_method / canceled
              const nowIso = new Date().toISOString();
              const nextAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
              await supabase
                .from("invoices")
                .update({
                  status: "unpaid",
                  charge_attempts: 1,
                  last_charge_attempt_at: nowIso,
                  next_action_at: nextAt,
                })
                .eq("id", invoice.id);
              summary.charge_failed++;
              log("Charge not confirmed", { invoice_id: invoice.id, status: intent.status });
            }
          }
        } catch (chargeErr) {
          const chargeMessage =
            chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
          console.error(
            `[GEN-SUB-INVOICES] Charge failed for invoice ${invoice.id}: ${chargeMessage}`,
          );
          summary.charge_failed++;
          const nowIso = new Date().toISOString();
          const nextAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from("invoices")
            .update({
              status: "unpaid",
              charge_attempts: 1,
              last_charge_attempt_at: nowIso,
              next_action_at: nextAt,
            })
            .eq("id", invoice.id);
        }

        // Auto-send email (best-effort, do not fail invoice on email error)
        if (sub.auto_send) {
          try {
            const { error: emailErr } = await supabase.functions.invoke(
              "send-invoice-email",
              { body: { invoice_id: invoice.id } }
            );
            if (emailErr) throw emailErr;
          } catch (emailError: any) {
            console.error(
              `[GEN-SUB-INVOICES] Email send failed for invoice ${invoice.id}: ${emailError?.message ?? emailError}`
            );
          }
        }
      } catch (err: any) {
        const message = err?.message ?? String(err);
        console.error(`[GEN-SUB-INVOICES] Failed subscription ${sub.id}: ${message}`);
        summary.failed.push({ subscription_id: sub.id, error: message });
      }
    }

    log("Summary", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error(`[GEN-SUB-INVOICES] Fatal error: ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: message, ...summary }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
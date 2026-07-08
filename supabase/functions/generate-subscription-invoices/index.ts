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
    failed: [] as Array<{ subscription_id: string; error: string }>,
  };

  try {
    const today = new Date();
    const todayISO = toISODate(today);

    // Optional body: { subscription_id } for manual single-run
    let manualId: string | null = null;
    try {
      if (req.method === "POST") {
        const text = await req.text();
        if (text) {
          const body = JSON.parse(text);
          if (body && typeof body.subscription_id === "string") {
            manualId = body.subscription_id;
          }
        }
      }
    } catch (_) {
      // ignore malformed body — behave as full-run
    }

    log("Start", { today: todayISO, manualId });

    // Fetch active subscriptions with lines
    let query = supabase
      .from("subscriptions")
      .select(`
        id, tenant_id, customer_id, name, interval, interval_count,
        next_invoice_date, last_invoice_date, end_date, status,
        auto_send, payment_term_days, generate_days_before,
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
            period_end: periodEnd,
          });
        if (linkErr) throw linkErr;

        // Advance subscription's next_invoice_date (from OLD next_invoice_date)
        const { error: updErr } = await supabase
          .from("subscriptions")
          .update({
            last_invoice_date: periodStart,
            next_invoice_date: periodEnd,
          })
          .eq("id", sub.id);
        if (updErr) throw updErr;

        summary.created++;
        log("Invoice created", {
          subscription_id: sub.id,
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          period_start: periodStart,
          period_end: periodEnd,
        });

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
              await supabase
                .from("invoices")
                .update({ charge_attempts: 1 })
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
          await supabase
            .from("invoices")
            .update({ charge_attempts: 1 })
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
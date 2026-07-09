import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DUNNING] ${step}${suffix}`);
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e)));

// Charge-retry interval by attempt number (attempt going from 1 -> 2 waits 3d, 2 -> 3 waits 7d)
const CHARGE_RETRY_DAYS = [0, 3, 7];
const MAX_CHARGE_ATTEMPTS = 3;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const summary = {
    scanned: 0,
    charged: 0,
    charge_processing: 0,
    charge_failed: 0,
    reminder_sent: 0,
    payment_request_sent: 0,
    admin_notified: 0,
    skipped: 0,
    failed: [] as Array<{ invoice_id: string; error: string }>,
  };

  try {
    const now = new Date();
    const nowISO = now.toISOString();

    // Optional body: { invoice_id } for manual single-run bypassing next_action_at
    let manualId: string | null = null;
    try {
      if (req.method === 'POST') {
        const text = await req.text();
        if (text) {
          const body = JSON.parse(text);
          if (body && typeof body.invoice_id === 'string') manualId = body.invoice_id;
        }
      }
    } catch { /* ignore */ }

    let query = supabase
      .from('invoices')
      .select('id, tenant_id, customer_id, subscription_id, invoice_number, total, status, issue_date, due_date, charge_attempts, reminder_level, last_reminder_at, dunning_level, last_charge_attempt_at, next_action_at, checkout_session_url, checkout_session_created_at')
      .in('status', ['unpaid', 'sent'])
      .limit(500);

    if (manualId) {
      query = query.eq('id', manualId);
    } else {
      query = query.or(`next_action_at.is.null,next_action_at.lte.${nowISO}`);
    }

    const { data: invoices, error: qErr } = await query;
    if (qErr) throw qErr;

    for (const invoice of invoices ?? []) {
      summary.scanned++;
      try {
        // Load tenant, customer, mandate
        const { data: tenant, error: tErr } = await supabase
          .from('tenants')
          .select('id, name, is_demo, is_internal_tenant, stripe_account_id, currency, billing_email, owner_email, reminders_enabled, reminder_level1_days, reminder_level2_days, reminder_level3_days, reminder_late_fee_enabled, reminder_late_fee_percentage')
          .eq('id', invoice.tenant_id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!tenant) { summary.skipped++; continue; }

        // Compute due date
        let dueDate: Date | null = null;
        if (invoice.due_date) {
          dueDate = new Date(invoice.due_date + 'T00:00:00Z');
        } else if (invoice.issue_date) {
          // fallback: issue + 14d (or subscription payment_term_days if we have it)
          let paymentTermDays = 14;
          if (invoice.subscription_id) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('payment_term_days')
              .eq('id', invoice.subscription_id)
              .maybeSingle();
            paymentTermDays = Number(sub?.payment_term_days ?? 14);
          }
          dueDate = addDays(new Date(invoice.issue_date + 'T00:00:00Z'), paymentTermDays);
        }
        if (!dueDate) { summary.skipped++; continue; }
        if (dueDate > now) {
          // Not yet overdue; schedule next check for right after due date
          await supabase.from('invoices').update({ next_action_at: dueDate.toISOString() }).eq('id', invoice.id);
          summary.skipped++;
          continue;
        }

        const daysPastDue = daysBetween(now, dueDate);
        const currentChargeAttempts = Number(invoice.charge_attempts ?? 0);
        const currentDunningLevel = Number(invoice.dunning_level ?? invoice.reminder_level ?? 0);

        // Look up mandate (customer-scoped)
        let mandate: any = null;
        if (invoice.customer_id) {
          const { data: m } = await supabase
            .from('customer_payment_mandates')
            .select('stripe_customer_id, stripe_payment_method_id, method_type, status')
            .eq('tenant_id', invoice.tenant_id)
            .eq('customer_id', invoice.customer_id)
            .maybeSingle();
          mandate = m ?? null;
        }

        const mandateActive = mandate && mandate.status === 'active';

        // -------------------------------------------------------------------
        // BRANCH A: mandate-backed subscription invoice — retry off-session
        // -------------------------------------------------------------------
        if (mandateActive && currentChargeAttempts >= 1 && currentChargeAttempts < MAX_CHARGE_ATTEMPTS && invoice.subscription_id) {
          const nextAttempt = currentChargeAttempts + 1;
          const waitDays = CHARGE_RETRY_DAYS[currentChargeAttempts] ?? 7;
          const lastAttempt = invoice.last_charge_attempt_at ? new Date(invoice.last_charge_attempt_at) : dueDate;
          const eligibleAt = addDays(lastAttempt, waitDays);
          if (now < eligibleAt) {
            await supabase.from('invoices').update({ next_action_at: eligibleAt.toISOString() }).eq('id', invoice.id);
            summary.skipped++;
            continue;
          }

          try {
            const ctx = getStripeContext(tenant);
            const amountCents = Math.round(Number(invoice.total) * 100);
            const intent = await ctx.stripe.paymentIntents.create({
              amount: amountCents,
              currency: 'eur',
              customer: mandate.stripe_customer_id,
              payment_method: mandate.stripe_payment_method_id,
              payment_method_types: [mandate.method_type],
              confirm: true,
              off_session: true,
              metadata: { invoice_id: invoice.id, tenant_id: invoice.tenant_id, retry_attempt: String(nextAttempt) },
            }, ctx.requestOptions);

            if (intent.status === 'succeeded') {
              await supabase.from('invoices').update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                charge_attempts: nextAttempt,
                last_charge_attempt_at: nowISO,
                next_action_at: null,
              }).eq('id', invoice.id);
              summary.charged++;
              log('Retry charge succeeded', { invoice_id: invoice.id, attempt: nextAttempt });
            } else if (intent.status === 'processing') {
              await supabase.from('invoices').update({
                status: 'processing',
                charge_attempts: nextAttempt,
                last_charge_attempt_at: nowISO,
                next_action_at: null,
              }).eq('id', invoice.id);
              summary.charge_processing++;
            } else {
              const nextWait = CHARGE_RETRY_DAYS[nextAttempt] ?? 7;
              await supabase.from('invoices').update({
                charge_attempts: nextAttempt,
                last_charge_attempt_at: nowISO,
                next_action_at: addDays(now, nextWait).toISOString(),
              }).eq('id', invoice.id);
              summary.charge_failed++;
            }
          } catch (chargeErr) {
            const msg = errMsg(chargeErr);
            log('Retry charge exception', { invoice_id: invoice.id, error: msg });
            const nextWait = CHARGE_RETRY_DAYS[nextAttempt] ?? 7;
            await supabase.from('invoices').update({
              charge_attempts: nextAttempt,
              last_charge_attempt_at: nowISO,
              next_action_at: addDays(now, nextWait).toISOString(),
            }).eq('id', invoice.id);
            summary.charge_failed++;
          }
          continue;
        }

        // -------------------------------------------------------------------
        // BRANCH C: mandate-backed retries exhausted — send final payment-request
        //           email with Checkout fallback + admin notification.
        // -------------------------------------------------------------------
        if (invoice.subscription_id && currentChargeAttempts >= MAX_CHARGE_ATTEMPTS && currentDunningLevel < 3) {
          const checkoutUrl = await ensureCheckoutUrl(supabase, invoice.id);
          await supabase.functions.invoke('send-invoice-email', {
            body: { invoice_id: invoice.id, reminder_level: 3, checkout_url: checkoutUrl },
          }).catch((e) => log('Payment-request email failed', errMsg(e)));

          await supabase.from('payment_reminders').insert({
            invoice_id: invoice.id, level: 3, total_due_amount: invoice.total,
          }).catch(() => { /* audit-only */ });

          await supabase.from('notifications').insert({
            tenant_id: invoice.tenant_id,
            category: 'billing',
            type: 'invoice_charge_exhausted',
            title: `Automatische incasso mislukt: ${invoice.invoice_number}`,
            message: `Na ${MAX_CHARGE_ATTEMPTS} pogingen kon factuur ${invoice.invoice_number} niet automatisch worden geïncasseerd. De klant heeft een betaal-link ontvangen.`,
            priority: 'high',
            action_url: `/admin/invoices/${invoice.id}`,
            data: { invoice_id: invoice.id, invoice_number: invoice.invoice_number },
          }).catch(() => { /* non-blocking */ });

          await supabase.from('invoices').update({
            dunning_level: 3, last_reminder_at: nowISO, reminder_level: 3, next_action_at: null,
          }).eq('id', invoice.id);

          summary.payment_request_sent++;
          summary.admin_notified++;
          continue;
        }

        // -------------------------------------------------------------------
        // BRANCH B: manual/no-mandate — payment reminders per tenant config
        // -------------------------------------------------------------------
        if (!tenant.reminders_enabled) {
          await supabase.from('invoices').update({ next_action_at: null }).eq('id', invoice.id);
          summary.skipped++;
          continue;
        }

        const l1 = Number(tenant.reminder_level1_days ?? 7);
        const l2 = Number(tenant.reminder_level2_days ?? 21);
        const l3 = Number(tenant.reminder_level3_days ?? 35);

        let targetLevel: 1 | 2 | 3 | null = null;
        if (currentDunningLevel < 1 && daysPastDue >= l1) targetLevel = 1;
        else if (currentDunningLevel < 2 && daysPastDue >= l2) targetLevel = 2;
        else if (currentDunningLevel < 3 && daysPastDue >= l3) targetLevel = 3;

        if (!targetLevel) {
          // Schedule next boundary
          const nextThreshold = currentDunningLevel < 1 ? l1 : currentDunningLevel < 2 ? l2 : currentDunningLevel < 3 ? l3 : null;
          const nextAt = nextThreshold != null ? addDays(dueDate, nextThreshold).toISOString() : null;
          await supabase.from('invoices').update({ next_action_at: nextAt }).eq('id', invoice.id);
          summary.skipped++;
          continue;
        }

        // Late fee only on level 3 (matches existing usePaymentReminders logic)
        let lateFee = 0;
        let totalDue = Number(invoice.total);
        if (targetLevel === 3 && tenant.reminder_late_fee_enabled) {
          lateFee = +(totalDue * (Number(tenant.reminder_late_fee_percentage ?? 10) / 100)).toFixed(2);
          totalDue = +(totalDue + lateFee).toFixed(2);
        }

        const checkoutUrl = await ensureCheckoutUrl(supabase, invoice.id);

        await supabase.functions.invoke('send-invoice-email', {
          body: { invoice_id: invoice.id, reminder_level: targetLevel, checkout_url: checkoutUrl },
        }).catch((e) => log('Reminder email failed', errMsg(e)));

        await supabase.from('payment_reminders').insert({
          invoice_id: invoice.id, level: targetLevel, late_fee_amount: lateFee, total_due_amount: totalDue,
        }).catch(() => { /* audit-only */ });

        const updates: Record<string, unknown> = {
          dunning_level: targetLevel, reminder_level: targetLevel, last_reminder_at: nowISO,
        };
        if (targetLevel < 3) {
          const nextTh = targetLevel === 1 ? l2 : l3;
          updates.next_action_at = addDays(dueDate, nextTh).toISOString();
        } else {
          updates.next_action_at = null;
        }
        await supabase.from('invoices').update(updates).eq('id', invoice.id);

        summary.reminder_sent++;

        if (targetLevel === 3) {
          await supabase.from('notifications').insert({
            tenant_id: invoice.tenant_id,
            category: 'billing',
            type: 'invoice_final_reminder',
            title: `Laatste herinnering verstuurd: ${invoice.invoice_number}`,
            message: `Factuur ${invoice.invoice_number} is ${daysPastDue} dagen te laat. Overweeg incasso.`,
            priority: 'high',
            action_url: `/admin/invoices/${invoice.id}`,
            data: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, days_past_due: daysPastDue },
          }).catch(() => { /* non-blocking */ });
          summary.admin_notified++;
        }
      } catch (err) {
        const message = errMsg(err);
        log('Failed invoice', { invoice_id: invoice.id, error: message });
        summary.failed.push({ invoice_id: invoice.id, error: message });
      }
    }

    log('Summary', summary);
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = errMsg(err);
    console.error('[DUNNING] Fatal:', message);
    return new Response(JSON.stringify({ success: false, error: message, ...summary }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function ensureCheckoutUrl(supabase: any, invoiceId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-invoice-payment-link', {
      body: { invoice_id: invoiceId },
    });
    if (error) throw error;
    return data?.checkout_url ?? null;
  } catch (e) {
    console.warn('[DUNNING] Could not create checkout link:', errMsg(e));
    return null;
  }
}
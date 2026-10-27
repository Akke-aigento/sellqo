import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAuthorizedCronRequest } from "../_shared/cronAuth.ts";
import { AuthError, authenticateRequest, requireRole } from "../_shared/auth.ts";
import { getStripeContext } from "../_shared/stripe.ts";
import { declineReason, handleCycleChargeFailure, isPaymentDecline, notifyChargeUnclear } from "../_shared/billingAlerts.ts";
import {
  resolveInvoiceFiscalFields,
  isDomesticFamilyRegime,
} from "../_shared/invoiceFiscalFields.ts";
// BILLING-1: gedeelde datum- en geldrekenkunde. De lokale advanceDate hier
// gebruikte setUTCMonth (2026-01-31 + 1 mnd = 2026-03-03) en had geen anchor,
// waardoor een 31e-abonnement na februari op de 28e bleef hangen.
import { advanceDate } from "../_shared/billingDates.ts";
import { cycleDueDates } from "../_shared/billingState.ts";
import { computeVatTotals } from "../_shared/billingMoney.ts";
import { loadBillingTenant } from "../_shared/billingTenant.ts";
import {
  type BillingLine, commitmentEnd, cycleLinesSnapshot, FEE_TABLES, feeLines, type FeeSource, pendingAppliesAt, type FeeRow, linesForPeriod, sumFees, USAGE_MIN_CENTS, usageDecision,
} from "../_shared/addonBilling.ts";
import { dropAddonsForTrack, loadAddons, repriceAddonLines, setTenantModule } from "../_shared/addonLines.ts";

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
  // BILLING-ENFORCE-1: de vervaldatum kwam uit period_start, dus een cyclus die
  // met terugwerkende kracht werd aangemaakt (inhaalrun, handmatige run, sweep)
  // was bij zijn geboorte al over zijn respijt heen — de eerstvolgende
  // herinneringsronde sprong dan meteen naar niveau 3 en zette hem op 'expired'.
  // Nu: nooit een vervaldatum in het verleden, en respijt telt vanaf de vervaldatum.
  const { dueDate, graceUntil } = cycleDueDates({
    periodStart: cycle.period_start,
    today: toISODate(new Date()),
  });

  // BILLING-SAFE-1: nooit een cyclus terugzetten die de webhook intussen al
  // afboekte, en de uitkomst teruggeven: zonder wacht-op-betaling geen betaalverzoek.
  const toAwaitingPayment = async (extra: Record<string, unknown> = {}): Promise<boolean> => {
    const { error } = await supabase
      .from("billing_cycles")
      .update({
        status: "awaiting_payment",
        due_date: dueDate,
        grace_until: graceUntil,
        ...extra,
      })
      .eq("id", cycle.id)
      .is("invoice_id", null)
      .not("status", "in", "(settled,cancelled)");
    if (error) {
      log("WARNING: awaiting_payment update failed", { billing_cycle_id: cycle.id, error: error.message });
      return false;
    }
    summary.cycles_awaiting_payment++;
    return true;
  };

  // CYCLE-2: best-effort payment request (link + PDF + mail). Never allowed to
  // break the runner — a failed dispatch is picked up by the reminder cron.
  const dispatchPaymentRequest = async () => {
    try {
      const { error } = await supabase.functions.invoke("dispatch-payment-request", {
        body: { billing_cycle_id: cycle.id },
      });
      if (error) throw error;
      log("Payment request dispatched", { billing_cycle_id: cycle.id });
    } catch (e) {
      log("WARNING: payment request dispatch failed", {
        billing_cycle_id: cycle.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const ensurePrNumber = async (): Promise<string | null> => {
    if (cycle.payment_request_number) return cycle.payment_request_number;
    const { data, error } = await supabase.rpc("generate_payment_request_number", {
      _tenant_id: cycle.tenant_id,
    });
    if (error) throw error;
    return (data as string) ?? null;
  };

  if (cycle.mode === "manual") {
    const prNumber = await ensurePrNumber();
    await toAwaitingPayment({ payment_request_number: prNumber });
    log("Cycle awaiting manual payment", {
      billing_cycle_id: cycle.id,
      payment_request_number: prNumber,
    });
    await dispatchPaymentRequest();
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
      // Safety net: no active mandate → fall back to a payment request.
      let prNumber: string | null = null;
      try {
        prNumber = await ensurePrNumber();
      } catch (e) {
        log("WARNING: PR number generation failed", {
          billing_cycle_id: cycle.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      await toAwaitingPayment(prNumber ? { payment_request_number: prNumber } : {});
      log("Cycle has no active mandate — awaiting payment", { billing_cycle_id: cycle.id });
      if (prNumber) await dispatchPaymentRequest();
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
          // BILLING-SAFE-1: zo weet de webhook dat een mislukking een automatische
          // afschrijving was (betaalverzoek + melding), geen poging via de betaallink.
          charge_kind: "mandate",
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
        .eq("id", cycle.id)
        // BILLING-SAFE-1: een snelle webhook kan al afgeboekt hebben.
        .is("invoice_id", null)
        .not("status", "in", "(settled,cancelled)");
      summary.cycles_processing++;
      log("Cycle charge accepted", {
        billing_cycle_id: cycle.id,
        intent: intent.id,
        status: intent.status,
      });
      return;
    }

    summary.charge_failed++;
    const parked = await toAwaitingPayment({ stripe_payment_intent_id: intent.id });
    log("Cycle charge not confirmed", { billing_cycle_id: cycle.id, status: intent.status });
    // BILLING-SAFE-1: tot 27-10 bleef de cyclus hier stil wachten, zonder
    // betaalverzoek aan de klant en zonder melding. Nu meteen beide (één keer).
    const le = intent.last_payment_error;
    if (parked) await handleCycleChargeFailure(supabase, {
      cycleId: cycle.id,
      reason: declineReason(le?.code, le?.decline_code, le?.message) ?? `status ${intent.status}`,
      intentId: intent.id,
    });
  } catch (chargeErr) {
    const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
    console.error(`[GEN-SUB-INVOICES] Cycle charge failed for ${cycle.id}: ${msg}`);
    summary.charge_failed++;
    // BILLING-SAFE-1: enkel een échte weigering (StripeCardError, of een intent die
    // op een nieuwe betaalmethode wacht) krijgt een betaalverzoek. Bij een time-out,
    // netwerk- of databankfout is de uitkomst onbekend: de afschrijving kan bij Stripe
    // gelukt zijn (de webhook boekt dan af). Een betaalverzoek zou dan tot dubbele
    // betaling leiden — daarom alleen een melding aan de verkoper.
    const se = chargeErr as {
      code?: string;
      decline_code?: string;
      raw?: { payment_intent?: { id?: string } };
    };
    const intentId = se?.raw?.payment_intent?.id ?? null;
    const declined = isPaymentDecline(chargeErr);
    const parked = await toAwaitingPayment(intentId ? { stripe_payment_intent_id: intentId } : {});
    if (declined) {
      // Niet geparkeerd: de webhook payment_intent.payment_failed (charge_kind mandate)
      // zet de cyclus op wacht en stuurt dan zelf het verzoek.
      if (parked) {
        await handleCycleChargeFailure(supabase, {
          cycleId: cycle.id,
          reason: declineReason(se?.code, se?.decline_code, msg),
          intentId,
        });
      }
    } else {
      await notifyChargeUnclear(supabase, { cycleId: cycle.id, error: msg });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Versie-vingerafdruk na een deploy (doet niets, geen auth nodig).
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, version: "BILLING-LOCK-2" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    fiscal_degraded: 0,
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

    // AUTH-TRIAGE-3. Tot 13 sep 2026 kon iedereen met de URL de facturatierun
    // starten, of met `subscription_id` één abonnement buiten zijn cyclus laten
    // factureren (en afschrijven, bij een mandaat).
    //   - cron en andere functies (sync-tenant-plan): cron-secret of service-key;
    //   - de knop "nu genereren" op de abonnementenpagina: alleen voor dat ene
    //     abonnement, en alleen met schrijfrecht op facturen in die winkel
    //     (tenant_admin, staff — PERMISSION_MATRIX `invoices.write`).
    // Een volledige run of een backfill is nooit iets voor een gebruiker.
    if (!(await isAuthorizedCronRequest(req, supabase))) {
      if (!manualId || backfillDocuments) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("tenant_id")
        .eq("id", manualId)
        .maybeSingle();
      if (!sub?.tenant_id) {
        return new Response(JSON.stringify({ success: false, error: "No access to this subscription" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const auth = await authenticateRequest(req, sub.tenant_id);
        requireRole(auth, sub.tenant_id, ["tenant_admin", "staff"]);
      } catch (e) {
        if (e instanceof AuthError) {
          return new Response(
            JSON.stringify({ success: false, error: e.status === 401 ? "Unauthorized" : "No access to this subscription" }),
            { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw e;
      }
    }


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
        // UPGRADE-PF-1: proration cycles are owned by sync-tenant-plan (it charges
        // or dispatches the payment request itself, and a stale one is cancelled
        // there). The sweep must never re-charge or re-dispatch them.
        .eq("cycle_type", "recurring")
        .is("invoice_id", null)
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

    // ------------------------------------------------------------------
    // BILL-ADDON-1: kassa-ticketfees (collected_via = 'invoice').
    // a) fees van een geannuleerde cyclus komen weer vrij voor de volgende factuur;
    // b) een Flex-winkel zonder facturatieabonnement met ≥ €5 openstaand krijgt er een
    //    (sync-tenant-plan 'ensure_usage'), zodat de lus hieronder de verbruiksfactuur maakt.
    // ------------------------------------------------------------------
    const { data: billingTenantRow } = await loadBillingTenant(supabase, "id");
    const billingTenantId = (billingTenantRow?.id as string | undefined) ?? null;
    if (billingTenantId && !manualId) {
      try {
        // LIMITS-1: zelfde regels voor beide feeregisters (kassatickets en orders boven het limiet).
        for (const table of Object.values(FEE_TABLES)) {
          const { data: orphaned, error: orErr } = await supabase
            .from(table)
            .select("order_id, billing_cycles!inner(status)")
            .eq("collected_via", "invoice")
            .is("invoiced_at", null)
            .not("billing_cycle_id", "is", null)
            .eq("billing_cycles.status", "cancelled")
            .limit(1000);
          if (orErr) throw orErr;
          // Ook fees op een vervallen cyclus van een gestopt abonnement: die cyclus wordt nooit meer betaald.
          const { data: deadCycleFees, error: dcErr } = await supabase
            .from(table)
            .select("order_id, billing_cycles!inner(status, subscriptions!inner(status))")
            .eq("collected_via", "invoice")
            .is("invoiced_at", null)
            .not("billing_cycle_id", "is", null)
            .eq("billing_cycles.status", "expired")
            .eq("billing_cycles.subscriptions.status", "cancelled")
            .limit(1000);
          if (dcErr) throw dcErr;
          const ids = [...(orphaned ?? []), ...(deadCycleFees ?? [])].map((r: { order_id: string }) => r.order_id);
          if (ids.length) {
            const { error: relErr } = await supabase.from(table).update({ billing_cycle_id: null }).in("order_id", ids);
            if (relErr) throw relErr;
            log("Released fees of cancelled cycles", { table, count: ids.length });
          }
        }

        // Gestopte add-ons: na hun laatste betaalde dag regel weg en module uit (dagelijks,
        // dus niet al 5 dagen vroeger bij het aanmaken van de volgende cyclus).
        const todayISO = today.toISOString().slice(0, 10);
        const { data: endedLines, error: elErr } = await supabase
          .from("subscription_lines")
          .select("id, subscription_id, addon_id, end_date")
          .eq("kind", "addon")
          .lt("end_date", todayISO)
          .limit(500);
        if (elErr) throw elErr;
        if ((endedLines ?? []).length) {
          const addons = await loadAddons(supabase);
          for (const l of endedLines as { id: string; subscription_id: string; addon_id: string }[]) {
            const { data: lts } = await supabase
              .from("tenant_subscriptions").select("tenant_id").eq("billing_subscription_id", l.subscription_id).maybeSingle();
            const track = addons.get(l.addon_id)?.track;
            if (lts?.tenant_id && track) await setTenantModule(supabase, lts.tenant_id as string, track, false);
            const { error: delErr } = await supabase.from("subscription_lines").delete().eq("id", l.id);
            if (delErr) throw delErr;
          }
          log("Ended add-ons removed", { count: endedLines!.length });
        }

        const perTenant = new Map<string, number>();
        for (const table of Object.values(FEE_TABLES)) {
          const { data: open, error: openErr } = await supabase
            .from(table)
            .select("tenant_id, fee_cents")
            .eq("collected_via", "invoice")
            .is("billing_cycle_id", null)
            .limit(10000);
          if (openErr) throw openErr;
          for (const r of (open ?? []) as { tenant_id: string; fee_cents: number }[]) {
            perTenant.set(r.tenant_id, (perTenant.get(r.tenant_id) ?? 0) + Number(r.fee_cents || 0));
          }
        }
        for (const [tid, cents] of perTenant) {
          if (cents < USAGE_MIN_CENTS) continue;
          const { data: tsRow } = await supabase
            .from("tenant_subscriptions")
            .select("billing_subscription_id")
            .eq("tenant_id", tid)
            .maybeSingle();
          if (!tsRow) continue; // geen plan-rij: niets om aan te hangen
          if (tsRow.billing_subscription_id) {
            const { data: bs } = await supabase.from("subscriptions").select("status").eq("id", tsRow.billing_subscription_id).maybeSingle();
            if (bs?.status === "active") continue;
          }
          const { error: euErr } = await supabase.functions.invoke("sync-tenant-plan", {
            body: { tenant_id: tid, action: "ensure_usage" },
          });
          if (euErr) console.error(`[GEN-SUB-INVOICES] ensure_usage failed for ${tid}: ${euErr.message}`);
          else log("Usage subscription ensured", { tenant_id: tid, open_cents: cents });
        }
      } catch (feeErr) {
        console.error(`[GEN-SUB-INVOICES] Ticket-fee pre-step failed: ${feeErr instanceof Error ? feeErr.message : String(feeErr)}`);
      }
    }

    let query = supabase
      .from("subscriptions")
      .select(`
        id, tenant_id, customer_id, name, interval, interval_count,
        next_invoice_date, last_invoice_date, end_date, status,
        auto_send, payment_term_days, generate_days_before,
        payment_mode, billing_model, billing_anchor_day,
        subscription_lines ( id, description, quantity, unit_price, vat_rate, sort_order, kind, addon_id, end_date )
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
          payment_mode, billing_model, billing_anchor_day,
          subscription_lines ( id, description, quantity, unit_price, vat_rate, sort_order, kind, addon_id, end_date )
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
        // BILLING-1: billing_anchor_day is de BEDOELDE factuurdag. Zonder anchor
        // zou een abonnement dat in februari naar de 28e geklemd werd daar
        // blijven hangen; met anchor keert het in maart terug naar de 31e.
        const anchorDay: number | null = sub.billing_anchor_day ?? null;
        // Math.max(1, ...) stond in de oude lokale helper en blijft hier staan:
        // subscriptions.interval_count heeft geen CHECK, en een negatieve waarde
        // zou next_invoice_date achteruit zetten — waarna het abonnement zichzelf
        // eindeloos opnieuw factureert. De gedeelde helper klemt bewust niet,
        // want retreatDate moet wel terug kunnen tellen.
        const intervalCount = Math.max(1, Number(sub.interval_count) || 1);
        const periodEnd: string = advanceDate(periodStart, sub.interval, intervalCount, anchorDay);

        // ------------------------------------------------------------------
        // ONBOARD-1: apply any pending downgrade / interval change on the
        // linked tenant_subscription BEFORE generating this period's invoice.
        // ------------------------------------------------------------------
        try {
          const { data: ts } = await supabase
            .from("tenant_subscriptions")
            .select("id, tenant_id, plan_id, billing_interval, pending_plan_id, pending_interval, pending_effective_at")
            .eq("billing_subscription_id", sub.id)
            .maybeSingle();
          // BILL-TERM-1: een wijziging die pas later ingaat (opzegging binnen het contract
          // van Events Vast) niet al op deze maandgrens toepassen.
          const pendingLater = !!ts && !pendingAppliesAt(ts.pending_effective_at as string | null, periodStart);
          if (ts && ts.pending_plan_id && !pendingLater) {
            const newPlanId = ts.pending_plan_id as string;
            const newInterval = (ts.pending_interval as string) || ts.billing_interval || sub.interval;
            const { data: newPlan } = await supabase
              .from("pricing_plans")
              .select("id, name, slug, monthly_price, yearly_price, min_term_months, track")
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
                // BILL-ADDON-1: add-ons uitzetten doet de sweep op de echte grens (dit draait tot 5 dagen vroeger).
                log("Applied pending downgrade to free — cancelling", {
                  subscription_id: sub.id,
                  tenant_id: ts.tenant_id,
                });
                summary.skipped_no_lines++;
                continue;
              }
              // Rewrite de planregel (BILL-ADDON-1: add-onregels blijven staan en volgen het interval).
              const unit =
                newInterval === "yearly"
                  ? Number(newPlan.yearly_price)
                  : Number(newPlan.monthly_price);
              const { data: existingLines } = await supabase
                .from("subscription_lines")
                .select("id")
                .eq("subscription_id", sub.id)
                .eq("kind", "plan")
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
                // Trim extra planregels
                for (const extra of existingLines.slice(1)) {
                  await supabase.from("subscription_lines").delete().eq("id", extra.id);
                }
              } else {
                await supabase.from("subscription_lines").insert({
                  subscription_id: sub.id,
                  kind: "plan",
                  description: `${newPlan.name} (${newInterval})`,
                  quantity: 1,
                  unit_price: unit,
                  vat_rate: 21,
                  sort_order: 0,
                });
              }
              // Een add-on van het spoor van het nieuwe plan valt weg (het plan dekt het).
              await dropAddonsForTrack(supabase, sub.id, ts.tenant_id as string, (newPlan as { track?: string | null }).track ?? null);
              if (newInterval !== sub.interval) {
                await repriceAddonLines(supabase, sub.id, newInterval as "monthly" | "yearly");
              }
              await supabase
                .from("subscriptions")
                .update({ interval: newInterval })
                .eq("id", sub.id);
              const termMonths = Number((newPlan as { min_term_months?: number | null }).min_term_months ?? 0);
              await supabase
                .from("tenant_subscriptions")
                .update({
                  plan_id: newPlanId,
                  billing_interval: newInterval,
                  pending_plan_id: null,
                  pending_interval: null,
                  pending_effective_at: null,
                  // BILL-TERM-1: een plan met minimale looptijd start zijn contract op deze grens;
                  // zelfde plan, ander interval (Vast maandelijks → jaarlijks): het lopende contract blijft.
                  ...(ts.plan_id === newPlanId ? {} : {
                    commitment_end_at: termMonths > 0 ? `${commitmentEnd(periodStart, termMonths)}T00:00:00Z` : null,
                  }),
                })
                .eq("id", ts.id);
              // Refresh in-memory sub so downstream code sees the new interval + lines
              sub.interval = newInterval;
              const { data: freshLines } = await supabase
                .from("subscription_lines")
                .select("id, description, quantity, unit_price, vat_rate, sort_order, kind, addon_id, end_date")
                .eq("subscription_id", sub.id);
              sub.subscription_lines = freshLines ?? [];
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
        const periodEndAdj: string = advanceDate(periodStart, sub.interval, intervalCount, anchorDay);

        // ------------------------------------------------------------------
        // CYCLE-1: pay-first path. No invoice is created here — the runner
        // registers a billing cycle and (for mandates) starts the charge.
        // The invoice follows in the Stripe webhook (CYCLE-3).
        // `subscription_invoices` is never written in this path.
        // ------------------------------------------------------------------
        if (sub.billing_model === "pay_first") {
          // BILL-ADDON-1: een add-on die vóór deze periode stopte, telt niet meer mee.
          const allLines = (sub.subscription_lines ?? []) as BillingLine[];
          let payFirstLines = linesForPeriod(allLines, periodStart);
          const isPlatformSub = !!billingTenantId && sub.tenant_id === billingTenantId;
          let shopTenantId: string | null = null;
          let fees: FeeRow[] = [];
          if (isPlatformSub) {
            const { data: shopTs } = await supabase
              .from("tenant_subscriptions")
              .select("tenant_id")
              .eq("billing_subscription_id", sub.id)
              .maybeSingle();
            shopTenantId = (shopTs?.tenant_id as string | undefined) ?? null;

            if (shopTenantId) {
              const { data: feeRows, error: feeErr } = await supabase
                .from("platform_ticket_fees")
                .select("order_id, tickets, fee_cents")
                .eq("tenant_id", shopTenantId)
                .eq("collected_via", "invoice")
                .is("billing_cycle_id", null);
              if (feeErr) throw feeErr;
              // LIMITS-1: 2% op orders boven het gratis limiet.
              const { data: orderFeeRows, error: ofErr } = await supabase
                .from("platform_order_fees")
                .select("order_id, fee_cents")
                .eq("tenant_id", shopTenantId)
                .eq("collected_via", "invoice")
                .is("billing_cycle_id", null);
              if (ofErr) throw ofErr;
              fees = [
                ...((feeRows ?? []) as FeeRow[]).map((r) => ({ ...r, source: "ticket" as FeeSource })),
                ...((orderFeeRows ?? []) as { order_id: string; fee_cents: number }[]).map((r) => ({ order_id: r.order_id, tickets: 1, fee_cents: r.fee_cents, source: "order" as FeeSource })),
              ];
            }
          }

          const usage = usageDecision(payFirstLines.length, sumFees(fees).cents);
          const baseLines = payFirstLines;
          if (usage === "include") {
            payFirstLines = [...payFirstLines, ...feeLines(fees)];
          }

          if (payFirstLines.length === 0) {
            summary.skipped_no_lines++;
            if (isPlatformSub) {
              // Alleen verbruik en (nog) onder €5, of niets: maand doorschuiven, fees blijven open.
              const { error: advErr } = await supabase
                .from("subscriptions")
                .update({ next_invoice_date: periodEndAdj })
                .eq("id", sub.id);
              if (advErr) throw advErr;
              log("Usage below minimum — rolled over", { subscription_id: sub.id, open_cents: sumFees(fees).cents });
            } else {
              console.warn(`[GEN-SUB-INVOICES] Subscription ${sub.id} has no lines — skipping`);
            }
            continue;
          }

          // BILLING-1: btw per tarief-groep sommeren en DAN afronden. De oude
          // per-regel-afronding gaf op 3 x EUR 9,99 @ 21% EUR 6,30 in plaats van
          // de verschuldigde EUR 6,29 — en die cycle-bedragen worden hier ook
          // echt geincasseerd, dus de drift landde op de rekening van de klant.
          const cycleTotals = computeVatTotals(
            payFirstLines.map((ln) => ({
              net: Number(ln.quantity ?? 1) * Number(ln.unit_price ?? 0),
              vatRate: Number(ln.vat_rate ?? 0),
            })),
          );
          const cycleSubtotal = cycleTotals.subtotal;
          const cycleVat = cycleTotals.vatAmount;
          const cycleTotal = cycleTotals.total;
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
              lines: cycleLinesSnapshot(payFirstLines),
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
          // BILL-ADDON-1: de fees op deze cyclus vastpinnen (nooit dubbel, nooit gemist).
          // Lukt het vastpinnen niet volledig (race met een tweede run, of een fout), dan rekent
          // de cyclus alleen de fees aan die écht vastgepind zijn — vóór er geïnd wordt.
          if (usage === "include" && fees.length) {
            // Per register vastpinnen; een order kan in beide staan (ticket én limiet), dus per bron tellen.
            let pinnedCount = 0;
            const pinnedKeys = new Set<string>();
            for (const src of ["ticket", "order"] as FeeSource[]) {
              const ids = fees.filter((f) => (f.source ?? "ticket") === src).map((f) => f.order_id);
              if (!ids.length) continue;
              const { data: pinned, error: pinErr } = await supabase
                .from(FEE_TABLES[src])
                .update({ billing_cycle_id: cycle.id })
                .in("order_id", ids)
                .is("billing_cycle_id", null)
                .select("order_id");
              if (pinErr) console.error(`[GEN-SUB-INVOICES] Pinning ${src} fees to ${cycle.id} failed: ${pinErr.message}`);
              for (const r of (pinned ?? []) as { order_id: string }[]) { pinnedKeys.add(`${src}:${r.order_id}`); pinnedCount++; }
            }
            if (pinnedCount !== fees.length) {
              const keptFees = fees.filter((f) => pinnedKeys.has(`${f.source ?? "ticket"}:${f.order_id}`));
              const fixedLines = [...baseLines, ...feeLines(keptFees)];
              if (fixedLines.length === 0) {
                await supabase.from("billing_cycles").update({ status: "cancelled" }).eq("id", cycle.id).is("invoice_id", null);
                log("Cycle cancelled: fees already pinned elsewhere", { billing_cycle_id: cycle.id });
                continue;
              }
              const fixed = computeVatTotals(fixedLines.map((ln) => ({
                net: Number(ln.quantity ?? 1) * Number(ln.unit_price ?? 0),
                vatRate: Number(ln.vat_rate ?? 0),
              })));
              const { error: fixErr } = await supabase
                .from("billing_cycles")
                .update({ subtotal: fixed.subtotal, vat_amount: fixed.vatAmount, total: fixed.total, lines: cycleLinesSnapshot(fixedLines) })
                .eq("id", cycle.id)
                .eq("status", "pending");
              if (fixErr) throw fixErr;
              (cycle as { total: number }).total = fixed.total;
              log("Cycle amounts corrected to pinned fees", { billing_cycle_id: cycle.id, expected: fees.length, pinned: pinnedCount });
            }
          }
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

        // ---- BILL-2: fiscale resolutie, vóór de nummer-RPC ----
        // Volgorde is load-bearing: generate_invoice_number is MAX(...)+1, geen
        // consumerende sequence. Elke seconde tussen die lezing en de insert is een
        // collision-window bij gelijktijdige facturatie voor dezelfde tenant, en de
        // resolver kan tot 5s VIES-latency toevoegen. Die hoort er dus vóór.
        const issueDate = todayISO;
        // .sort() muteert in place — hoist één gesorteerde array en map beide arrays
        // daaruit, anders volgt per_line[idx] een andere volgorde dan invoiceLines[idx]
        // zodra sort_order afwijkt van de volgorde waarin de DB de regels teruggaf.
        const sortedLines = [...lines].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const fiscal = await resolveInvoiceFiscalFields(supabase, {
          tenant_id: sub.tenant_id,
          customer_id: sub.customer_id,
          invoice_lines: sortedLines.map((ln) => ({
            line_type: "product" as const,
            amount: Number(ln.quantity ?? 1) * Number(ln.unit_price ?? 0),
          })),
          order_date: issueDate,
          sales_channel: "b2b_direct",
        });
        if (fiscal.degraded) {
          summary.fiscal_degraded++;
          log("Fiscale resolutie gedegradeerd", {
            subscription_id: sub.id,
            error: fiscal.error,
            warnings: fiscal.warnings,
          });
        }

        // PAD 1 (invoice-first): het REGIME bepaalt het BEDRAG.
        // Er is nog niets geïncasseerd, dus het resolver-tarief mag de opgeslagen
        // regel overrulen. In _shared/subscriptionCharge.ts geldt het SPIEGELBEELD:
        // daar is het geld al binnen en bepaalt het BEDRAG het REGIME.
        // TREK DIE TWEE NIET GELIJK — het verschil is fiscaal noodzakelijk.
        //
        // Clausule: alleen overrulen bij een niet-domestic regime. Abonnementsregels
        // dragen geen product_category, dus domesticRegimeForCategory(undefined) geeft
        // altijd 'domestic_standard' → 21% (regimeResolver.ts:89-92 + :101). Zonder
        // clausule zou een 6%- of 12%-abonnement stil naar 21% getild worden — en de
        // off-session incasso verderop debiteert dat bedrag ook echt. De door de tenant
        // ingestelde subscription_lines.vat_rate is daar de betere informatie.
        const regimeLeads = !isDomesticFamilyRegime(fiscal.fields.vat_regime);

        // Compute totals
        const invoiceLines = sortedLines
          .map((ln, idx) => {
            const qty = Number(ln.quantity ?? 1);
            const unit = Number(ln.unit_price ?? 0);
            const storedRate = Number(ln.vat_rate ?? 0);
            const pl = fiscal.per_line[idx];
            // per_line[idx], niet per_line[0]: de resolver levert één entry per
            // input-regel (regimeResolver.ts:289). generate-invoice:1537 gebruikt [0]
            // en produceert bij gemengde tarieven een header die niet de som van de
            // regels is — dat kopiëren we bewust niet.
            const rate = regimeLeads ? Number(pl?.vat_rate ?? storedRate) : storedRate;
            const net = qty * unit;
            const vat = +(net * rate / 100).toFixed(2);
            const lineTotal = +(net + vat).toFixed(2);
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
              // Zonder deze twee classificeert een verlegde regel op regelniveau nog
              // steeds als binnenlands. Conform generate-invoice:1624-1625.
              ...(pl?.vat_box_code ? { vat_box_code: pl.vat_box_code } : {}),
              ...(pl?.gl_account_code ? { gl_account_code: pl.gl_account_code } : {}),
            };
          });
        // BILLING-1: de FACTUURKOP telt per tarief-groep op — eerst netto
        // sommeren, dan afronden. Per regel afronden en daarna sommeren gaf op
        // 3 x EUR 9,99 @ 21% een kop van EUR 6,30 tegen de verschuldigde EUR 6,29.
        //
        // De per-regel vat_amount/line_total hierboven blijven bewust per regel
        // afgerond: dat is wat invoice_lines opslaat en wat de rest van de keten
        // leest. De kop volgt hiermee exact het model van
        // _shared/peppol/ubl-builder.ts:127-145 (aggregateTaxSubtotals), dat de
        // UBL TaxSubtotals al per tarief groepeert en dan pas afrondt — kop en
        // UBL lopen daardoor niet langer uiteen.
        //
        // Invoer is net_amount (de afgeronde regelnetto), niet de ruwe qty*unit:
        // zo is het kop-subtotaal per definitie de som van de netto's die op de
        // factuur staan, en telt een klant die de regels optelt op hetzelfde uit.
        const headerTotals = computeVatTotals(
          invoiceLines.map((l) => ({ net: Number(l.net_amount), vatRate: Number(l.vat_rate) })),
        );
        const subtotal = headerTotals.subtotal;
        const taxAmount = headerTotals.vatAmount;
        const total = headerTotals.total;

        // Generate invoice number via existing DB function
        const { data: invNumData, error: invNumErr } = await supabase.rpc(
          "generate_invoice_number",
          { _tenant_id: sub.tenant_id }
        );
        if (invNumErr) throw invNumErr;
        const invoiceNumber = invNumData as string;

        const paymentTermDays = Number(sub.payment_term_days ?? 14);
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
            ...fiscal.fields,
            ...(fiscal.degraded
              ? {
                metadata: {
                  fiscal_resolution_degraded: {
                    reason: fiscal.error ?? fiscal.warnings[0] ?? "unknown",
                    at: new Date().toISOString(),
                  },
                },
              }
              : {}),
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
// BILLING-ENFORCE-1 — dagelijkse statusmachine voor abonnementen.
//
// Draait na de twee herinneringsronden (dunning 07:00, cycle-reminders 07:30)
// en zet `tenant_subscriptions.status` op wat de feiten zeggen:
// trialing → active → past_due → restricted → suspended.
//
// Waarom een eigen functie en geen uitbreiding van process-cycle-reminders:
// die kent alleen pay-first-cycli, terwijl deze machine ook de domeinfacturen
// weegt (invoice-first + dunning). En geld verdient een functie die je apart
// kunt draaien — met `{ dry_run: true }` rapporteert hij wat er zou gebeuren
// zonder iets te schrijven.
//
// Schrijft ALLEEN `tenant_subscriptions.status` (+ een melding bij een wissel).
// Nooit het plan, nooit `tenants.subscription_status` — die kolom stuurt de RLS
// van de webshop-chatbot.
//
// BILLING-LOCK-2 (27-10): bij `suspended` gaat de webshop dicht (storefront-api
// get_shop_status, zie _shared/shopStatus.ts); in alle andere toestanden blijft hij
// online. PAYMENT-ALERT-1: elke wissel naar leesmodus/opgeschort en elke heropening
// krijgt ook een melding bij SellQo zelf, niet enkel bij de winkel.
// Sinds 27-10 dagelijks via cron (sync-billing-state-daily, 07:45 UTC).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { resolveBillingState, type BillingState } from "../_shared/billingState.ts";
import { notificationRoute } from "../_shared/notificationRoutes.ts";
import { isBillingExempt } from "../_shared/billingExempt.ts";
import { announceBlockToSellqo, announceReopenToSellqo } from "../_shared/billingReopen.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/** Statussen die deze machine beheert. `canceled` blijft met rust. */
const MANAGED = new Set<string>(["trialing", "active", "past_due", "restricted", "suspended"]);

interface Row {
  tenant: string;
  tenant_id: string;
  from: string;
  to: BillingState;
  reason: string;
  open_amount: number;
  changed: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const denied = await denyUnlessCron(req, supabase, corsHeaders);
    if (denied) return denied;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;
    const onlyTenant: string | undefined = body?.tenant_id;

    const { data: subs, error: subsErr } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, status, trial_end, plan_id, billing_customer_id, tenants(name, is_demo, is_internal_tenant, billing_exempt, billing_on_hold)");
    if (subsErr) throw subsErr;

    const rows: Row[] = [];
    const now = new Date();

    for (const sub of (subs ?? []) as Array<Record<string, unknown>>) {
      const tenantId = sub.tenant_id as string;
      if (onlyTenant && tenantId !== onlyTenant) continue;
      const tenant = (sub.tenants ?? {}) as {
        name?: string; is_demo?: boolean; is_internal_tenant?: boolean; billing_exempt?: boolean; billing_on_hold?: boolean;
      };

      // Demo, SellQo zelf en vrijgestelde winkels (BILLING-EXEMPT-1) betalen niet: nooit afsluiten.
      // "Gratis tot omschakeling" (billing_on_hold) evenmin: er wordt nog niets aangerekend.
      if (tenant.is_demo === true || isBillingExempt(tenant) || tenant.billing_on_hold === true) continue;
      const current = String(sub.status ?? "");
      if (!MANAGED.has(current)) continue; // canceled / onbekend: met rust laten

      const customerId = sub.billing_customer_id as string | null;
      let cycles: unknown[] = [];
      let invoices: unknown[] = [];
      if (customerId) {
        const [c, i] = await Promise.all([
          supabase
            .from("billing_cycles")
            .select("id, status, due_date, grace_until, total, invoice_id, checkout_session_url, payment_request_number")
            .eq("customer_id", customerId)
            .in("status", ["awaiting_payment", "reopened", "expired"]),
          supabase
            .from("invoices")
            .select("id, status, dunning_level, due_date, last_reminder_at, total, invoice_number")
            .eq("customer_id", customerId)
            .in("status", ["unpaid", "sent"]),
        ]);
        cycles = c.data ?? [];
        invoices = i.data ?? [];
      }

      const result = resolveBillingState({
        subscription: { status: current, trial_end: sub.trial_end as string | null, plan_id: sub.plan_id as string | null },
        cycles: cycles as never,
        invoices: invoices as never,
        now,
      });

      const changed = result.state !== current;
      rows.push({
        tenant: tenant.name ?? tenantId,
        tenant_id: tenantId,
        from: current,
        to: result.state,
        reason: result.reason,
        open_amount: result.openAmount,
        changed,
      });

      if (!changed || dryRun) continue;

      // Voorwaardelijk: heeft een betaalwebhook de status intussen al bijgewerkt (de lijst
      // hierboven is aan het begin van de run gelezen), dan niets schrijven en niets melden.
      const { data: upd, error: upErr } = await supabase
        .from("tenant_subscriptions")
        .update({ status: result.state, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("status", current)
        .select("tenant_id");
      if (upErr) throw upErr;
      if (!upd || upd.length === 0) { rows[rows.length - 1].changed = false; continue; }

      // De winkel die het aangaat krijgt de melding — de verloopmelding van
      // process-cycle-reminders gaat vandaag naar SellQo in plaats van naar de klant.
      const data = { from: current, to: result.state, reason: result.reason, open_amount: result.openAmount };
      await supabase.from("notifications").insert({
        tenant_id: tenantId,
        category: "subscriptions",
        type: result.state === "active" ? "subscription_reactivated" : "subscription_state_changed",
        priority: result.state === "active" ? "medium" : "urgent",
        title: TITLES[result.state],
        message: MESSAGES[result.state],
        action_url: notificationRoute({ category: "subscriptions", type: "subscription_state_changed", data }),
        data,
      });

      // PAYMENT-ALERT-1: SellQo zelf ook verwittigen (best effort, gooit niet).
      const change = { tenantId, tenantName: tenant.name ?? tenantId, from: current, to: result.state };
      await announceBlockToSellqo(supabase, change);
      await announceReopenToSellqo(supabase, change, false);
    }

    return new Response(
      JSON.stringify({ success: true, dry_run: dryRun, scanned: rows.length, changed: rows.filter((r) => r.changed).length, rows }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sync-billing-state] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

const TITLES: Record<BillingState, string> = {
  trialing: "Proefperiode loopt",
  active: "Abonnement weer actief",
  past_due: "Betaling openstaand",
  restricted: "Winkel in leesmodus",
  suspended: "Winkel opgeschort",
};

const MESSAGES: Record<BillingState, string> = {
  trialing: "Je proefperiode loopt nog.",
  active: "Je betaling is verwerkt. Alles staat weer open.",
  past_due: "Er staat een betaling open. Betaal om onderbreking te voorkomen.",
  restricted: "Je kunt alles bekijken, exporteren en betalen. Wijzigen kan weer zodra de betaling binnen is.",
  suspended: "Je webshop staat offline en alleen facturatie en betalen zijn nog beschikbaar. Betaal om je winkel weer te openen.",
};

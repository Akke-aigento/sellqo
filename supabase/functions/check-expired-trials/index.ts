// BILL-FIX-1 (11-10-2026): trial-einde = betaalabonnement, niet langer "naar free".
//
// Per afgelopen proefperiode beslist _shared/trialEnd.ts (getest) wat er gebeurt:
//   activate     → sync-tenant-plan action=activate: pay-first abonnement op het
//                  huidige plan + meteen het eerste betaalverzoek (zelfde pad als
//                  een handmatige activatie in Billing).
//   clear_exempt → eigen winkel (billing_exempt / is_internal_tenant): trial wissen.
//   hold         → "gratis tot omschakeling" (billing_on_hold): niets, morgen opnieuw.
//   rest         → overslaan.
// Lukt een activatie niet (bv. geen facturatie-e-mail), dan krijgt de
// SellQo-tenant een melding en blijft trial_end staan: morgen nieuwe poging.
// Nooit stil naar free, nooit stil gratis.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { loadBillingTenant } from "../_shared/billingTenant.ts";
import { decideTrialEnd, normalizeInterval, type TrialEndDecision } from "../_shared/trialEnd.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-EXPIRED-TRIALS] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing backend env vars");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AUTH-TRIAGE-3: alleen de cron of een andere functie (cron-secret of service-key).
    const denied = await denyUnlessCron(req, supabase, corsHeaders);
    if (denied) return denied;

    // Bewust ook status 'active': klantwinkels in trial staan daar (Mancini, Benny Rich).
    const { data: expired, error: fetchError } = await supabase
      .from("tenant_subscriptions")
      .select("id, tenant_id, plan_id, status, trial_end, billing_interval, billing_subscription_id")
      .not("trial_end", "is", null)
      .lte("trial_end", new Date().toISOString())
      .in("status", ["trialing", "active"]);
    if (fetchError) throw fetchError;

    const summary: Record<TrialEndDecision, number> & { failed: Array<{ tenant_id: string; error: string }> } = {
      not_expired: 0, skip_demo: 0, clear_exempt: 0, hold: 0, skip_free: 0,
      skip_has_billing: 0, skip_status: 0, activate: 0, failed: [],
    };

    if (!expired || expired.length === 0) {
      logStep("No expired trials found");
      return json({ success: true, version: "bill-fix-1", ...summary });
    }

    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, is_demo, is_internal_tenant, billing_exempt, billing_on_hold")
      .in("id", expired.map((s) => s.tenant_id));
    if (tErr) throw tErr;
    type TenantRow = {
      id: string; name: string | null; is_demo: boolean | null; is_internal_tenant: boolean | null;
      billing_exempt: boolean | null; billing_on_hold: boolean | null;
    };
    const tenantById = new Map<string, TenantRow>(
      ((tenants ?? []) as TenantRow[]).map((t) => [t.id, t] as [string, TenantRow]),
    );

    const { data: billingTenant } = await loadBillingTenant(supabase, "id");

    for (const sub of expired) {
      const tenant = tenantById.get(sub.tenant_id);
      const decision = decideTrialEnd(tenant, sub);

      if (decision === "clear_exempt") {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .update({ trial_end: null, status: "active", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        if (error) summary.failed.push({ tenant_id: sub.tenant_id, error: `clear_exempt: ${error.message}` });
        else summary.clear_exempt++;
        continue;
      }

      if (decision !== "activate") {
        summary[decision]++;
        continue;
      }

      const interval = normalizeInterval(sub.billing_interval);
      try {
        // Service-key = systeemaanroep (zie sync-tenant-plan, BILL-FIX-1).
        const res = await fetch(`${supabaseUrl}/functions/v1/sync-tenant-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
          },
          body: JSON.stringify({ tenant_id: sub.tenant_id, plan_id: sub.plan_id, billing_interval: interval, action: "activate" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.success) {
          throw new Error(body?.error || `sync-tenant-plan HTTP ${res.status}`);
        }

        // De activatie laat trial_end staan; hier weg, anders blijft de UI "proef" tonen.
        await supabase.from("tenant_subscriptions").update({ trial_end: null }).eq("tenant_id", sub.tenant_id);
        // Gedenormaliseerd planlabel (headerbadge) gelijk trekken.
        await supabase.from("tenants").update({ subscription_plan: sub.plan_id }).eq("id", sub.tenant_id);

        try {
          await supabase.from("notifications").insert({
            tenant_id: sub.tenant_id,
            category: "system",
            type: "trial_converted",
            title: "Je proefperiode is afgelopen",
            message: "Je abonnement is gestart. Je ontvangt het eerste betaalverzoek per e-mail.",
            priority: "high",
            action_url: "/admin/billing",
            data: { plan_id: sub.plan_id, interval, billing_subscription_id: body.billing_subscription_id ?? null },
          });
        } catch (notifErr) {
          logStep("Tenant notification failed", { tenant_id: sub.tenant_id, error: errMsg(notifErr) });
        }

        summary.activate++;
        logStep("Trial converted", { tenant_id: sub.tenant_id, plan_id: sub.plan_id, interval });
      } catch (e) {
        const message = errMsg(e);
        summary.failed.push({ tenant_id: sub.tenant_id, error: message });
        logStep("Trial conversion failed", { tenant_id: sub.tenant_id, error: message });
        if (billingTenant?.id) {
          try {
            await supabase.from("notifications").insert({
              tenant_id: billingTenant.id,
              category: "system",
              type: "trial_conversion_failed",
              title: `Abonnement starten mislukt: ${tenant?.name ?? sub.tenant_id}`,
              message: `De proefperiode is voorbij maar het betaalabonnement kon niet starten (${message}). Morgen volgt een nieuwe poging.`,
              priority: "high",
              action_url: `/admin/platform/tenants/${sub.tenant_id}`,
              data: { tenant_id: sub.tenant_id, plan_id: sub.plan_id, error: message },
            });
          } catch (notifErr) {
            logStep("Admin notification failed", { error: errMsg(notifErr) });
          }
        }
      }
    }

    logStep("Done", summary);
    return json({ success: true, version: "bill-fix-1", ...summary });
  } catch (error) {
    const message = errMsg(error);
    logStep("ERROR", { message });
    return json({ error: message }, 500);
  }
});

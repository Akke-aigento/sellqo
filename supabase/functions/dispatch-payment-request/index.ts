// CYCLE-2: thin orchestrator for a payment request on a pay-first billing
// cycle: create the Stripe Checkout link, render the PDF (which embeds the
// link), then mail it. Callers (runner, reminder cron) only need this address.
// Order matters: link first so the PDF can print it.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DISPATCH-PAYMENT-REQUEST] ${step}${suffix}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const steps: Record<string, string> = {};
  try {
    const { billing_cycle_id, reminder_level, skip_email } = await req.json();
    if (!billing_cycle_id) throw new Error("billing_cycle_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // AUTH-TRIAGE-2 — deze functie stond volledig open. Eén `billing_cycle_id`
    // was genoeg om een Stripe-betaallink te laten aanmaken, een PDF te
    // hergenereren en een mail met factuur naar de klant te sturen, op kosten
    // van de tenant. Een UUID is onraadbaar, maar het is geen autorisatie: het
    // staat in URL's, mails en supportberichten.
    //
    // Resolve-then-authorize: eerst de cyclus ophalen om te wéten bij welke
    // tenant hij hoort, dan pas de aanroeper toetsen. De interne aanroepers
    // (generate-subscription-invoices, process-cycle-reminders, sync-tenant-plan)
    // gebruiken allemaal een service-role-client, en `authenticateRequest` laat
    // die door — de keten blijft dus werken.
    const { data: cycle, error: cycleErr } = await supabase
      .from("billing_cycles")
      .select("tenant_id")
      .eq("id", billing_cycle_id)
      .maybeSingle();
    if (cycleErr) throw cycleErr;
    if (!cycle) throw new Error("billing cycle not found");

    await authenticateRequest(req, cycle.tenant_id);

    const call = async (fn: string, payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(fn, { body: payload });
      if (error) throw new Error(`${fn}: ${error.message}`);
      if (data && (data as any).error) throw new Error(`${fn}: ${(data as any).error}`);
      return data;
    };

    // 1. Payment link (idempotent — reuses a session younger than 24h)
    try {
      await call("create-cycle-payment-link", { billing_cycle_id });
      steps.link = "ok";
    } catch (e) {
      steps.link = `failed: ${e instanceof Error ? e.message : String(e)}`;
      log("WARNING link failed", steps.link);
    }

    // 2. PDF (regenerated so the current link is printed on it)
    try {
      await call("generate-payment-request-pdf", { billing_cycle_id });
      steps.pdf = "ok";
    } catch (e) {
      steps.pdf = `failed: ${e instanceof Error ? e.message : String(e)}`;
      log("WARNING pdf failed", steps.pdf);
    }

    // 3. Mail — pay-first always mails
    if (skip_email === true) {
      steps.email = "skipped";
    } else {
      try {
        await call("send-payment-request-email", {
          billing_cycle_id,
          reminder_level: reminder_level ?? null,
        });
        steps.email = "ok";
        await supabase
          .from("billing_cycles")
          .update({ request_sent_at: new Date().toISOString() })
          .eq("id", billing_cycle_id)
          .select("id");
      } catch (e) {
        steps.email = `failed: ${e instanceof Error ? e.message : String(e)}`;
        log("WARNING email failed", steps.email);
      }
    }

    const success = steps.email === "ok" || steps.email === "skipped";
    log("Done", { billing_cycle_id, steps });
    return new Response(JSON.stringify({ success, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // AuthError vóór de generieke tak: anders wordt een 401 een 500, en dat is
    // precies de fout die send-whatsapp-message ook had.
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message, steps });
    return new Response(JSON.stringify({ error: message, steps }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
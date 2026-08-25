import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // CN-AUTO-1: safety-net auto credit note. Called after any successful
  // refund path so that returns whose "approved" transition happened via
  // SQL/DB (bypassing useReturns) still get a credit note. Idempotent —
  // the target function short-circuits when a CN already exists.
  const fireAutoCreditNote = async (returnId: string) => {
    try {
      const url = Deno.env.get("SUPABASE_URL") ?? "";
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      await fetch(`${url}/functions/v1/create-credit-note-from-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sr}`, "apikey": sr },
        body: JSON.stringify({ return_id: returnId, auto_send_email: true }),
      });
    } catch (e) {
      console.warn("[process-refund] auto CN failed", e instanceof Error ? e.message : String(e));
    }
  };

  try {
    const auth = await authenticateRequest(req);

    const { return_id } = await req.json();
    if (!return_id) {
      return new Response(JSON.stringify({ error: "return_id is verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch return with order info
    const { data: returnRecord, error: fetchError } = await supabase
      .from("returns")
      .select("*, orders!returns_order_id_fkey(stripe_payment_intent_id, marketplace_source, tenant_id)")
      .eq("id", return_id)
      .single();

    if (fetchError || !returnRecord) {
      return new Response(JSON.stringify({ error: "Retour niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch 2A2b: refund-write strikt tenant_admin tot cap-feature voor staff bestaat (Fase 3).
    const orderForRole = returnRecord.orders as any;
    const refundTenantId = orderForRole?.tenant_id || returnRecord.tenant_id;
    requireRole(auth, refundTenantId, ["tenant_admin"]);

    // Audit-log: welke admin heeft deze refund verwerkt.
    {
      const { error: auditErr } = await supabase.from("admin_actions_log").insert({
        admin_user_id: auth.user_id === "service_role" ? null : auth.user_id,
        target_tenant_id: refundTenantId,
        action_type: "refund_processed",
        action_details: {
          return_id,
          refund_method: returnRecord.refund_method,
          refund_amount: returnRecord.refund_amount,
        },
      });
      if (auditErr) console.error("[process-refund] audit log failed:", auditErr);
    }

    // ── Idempotency guard ──
    if (returnRecord.refund_status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Refund was reeds verwerkt',
          already_completed: true,
          stripe_refund_id: returnRecord.stripe_refund_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (returnRecord.stripe_refund_id) {
      // Previous attempt created Stripe refund but crashed before status update
      await supabase.from("returns").update({
        refund_status: "completed",
        refund_completed_at: new Date().toISOString(),
        refund_notes: `Idempotency recovery: refund ${returnRecord.stripe_refund_id} already existed`,
      }).eq("id", return_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Refund hersteld', already_completed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refundMethod = returnRecord.refund_method || "manual";
    const order = returnRecord.orders as any;

    // Marketplace returns: status update only
    if (refundMethod === "bolcom" || refundMethod === "amazon") {
      await supabase
        .from("returns")
        .update({
          refund_status: "completed",
          refund_completed_at: new Date().toISOString(),
          refund_notes: `Terugbetaling verloopt via ${refundMethod === "bolcom" ? "Bol.com" : "Amazon"}`,
        })
        .eq("id", return_id);

      await fireAutoCreditNote(return_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Terugbetaling via ${refundMethod === "bolcom" ? "Bol.com" : "Amazon"} — intern bijgewerkt`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stripe refund
    if (refundMethod === "stripe") {
      const paymentIntentId = order?.stripe_payment_intent_id;
      if (!paymentIntentId) {
        await supabase
          .from("returns")
          .update({ refund_status: "failed", refund_notes: "Geen Stripe Payment Intent gevonden op de order" })
          .eq("id", return_id);

        return new Response(
          JSON.stringify({ error: "Geen Stripe Payment Intent gevonden op de order" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Tenant ophalen voor de Stripe-context. Zelfde kolomset als de elf andere
      // getStripeContext-aanroepers, bijv. create-invoice-payment-link/index.ts:59.
      // Vervangt een query op `tenant_settings.stripe_secret_key` — een tabel die
      // in geen enkele migratie bestaat, waardoor die query stil faalde en de key
      // altijd al uit de omgeving kwam.
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, is_demo, is_internal_tenant, stripe_account_id")
        .eq("id", refundTenantId)
        .maybeSingle();

      // EEN PRINCIPE: een refund spiegelt het CHARGE-account, niet de billing-regels
      // van getStripeContext. De charge is aangemaakt door storefront-api, en die
      //   - rekent ALTIJD met de live key af (storefront-api:3054 / :3350), ook voor
      //     is_demo-tenants;
      //   - gaat het Stripe-pad alleen in als stripe_account_id bestaat
      //     (storefront-api:3050), ongeacht is_internal_tenant — de charge staat dus
      //     altijd op het connected account, nooit op het platform.
      // Beide overrides hieronder volgen uit dat ene principe; ze zijn geen losse
      // trucs. Trek er GEEN van los recht: dan wijkt het refund-account af van het
      // charge-account en faalt de refund met resource_missing. Ze mogen pas weg
      // wanneer storefront-api zelf op getStripeContext zit.
      let ctx: ReturnType<typeof getStripeContext>;
      try {
        if (!tenant) throw new Error(`Tenant ${refundTenantId} niet gevonden`);
        ctx = getStripeContext({ ...tenant, is_demo: false, is_internal_tenant: false });
      } catch (ctxErr) {
        // Vervangt de oude "Geen Stripe key geconfigureerd"-tak. getStripeContext
        // throwt bij een ontbrekende STRIPE_SECRET_KEY (stripe.ts:62) en bij een
        // tenant zonder stripe_account_id (stripe.ts:137). Zonder deze catch zou dat
        // een 500 worden zonder dat de returns-rij op failed komt te staan.
        const reason = ctxErr instanceof Error
          ? ctxErr.message
          : "Stripe-configuratie onvolledig";
        await supabase
          .from("returns")
          .update({
            refund_status: "failed",
            refund_notes: reason,
            // De frontend leest bij mislukking alleen refund_failure_reason
            // (src/hooks/useReturns.ts:735-737); beide zetten maakt de echte
            // oorzaak zichtbaar in plaats van de generieke tekst.
            refund_failure_reason: reason,
          })
          .eq("id", return_id);

        return new Response(
          JSON.stringify({ error: reason }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refundAmount = returnRecord.refund_amount
        ? Math.round(returnRecord.refund_amount * 100)
        : undefined;

      let refund;
      try {
        refund = await ctx.stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            ...(refundAmount ? { amount: refundAmount } : {}),
            reason: "requested_by_customer",
          },
          ctx.requestOptions
        );
      } catch (stripeErr: any) {
        await supabase.from("returns").update({
          refund_status: "failed",
          refund_failed_at: new Date().toISOString(),
          refund_failure_reason: stripeErr.message || 'Stripe refund failed',
        }).eq("id", return_id);
        return new Response(JSON.stringify({ error: stripeErr.message }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("returns")
        .update({
          refund_status: "completed",
          refund_completed_at: new Date().toISOString(),
          stripe_refund_id: refund.id,
          refund_notes: `Stripe refund ${refund.id} aangemaakt`,
        })
        .eq("id", return_id);

      await fireAutoCreditNote(return_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Stripe terugbetaling succesvol verwerkt",
          stripe_refund_id: refund.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual refund: financial status update only
    await supabase
      .from("returns")
      .update({
        refund_status: "completed",
        refund_completed_at: new Date().toISOString(),
        refund_notes: "Handmatig als terugbetaald gemarkeerd",
      })
      .eq("id", return_id);

    await fireAutoCreditNote(return_id);

    return new Response(
      JSON.stringify({ success: true, message: "Retour als terugbetaald gemarkeerd" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("Process refund error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message || "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

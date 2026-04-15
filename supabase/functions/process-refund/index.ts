import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { return_id } = await req.json();
    if (!return_id) {
      return new Response(JSON.stringify({ error: "return_id is verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch return with order info (include tenant's stripe_account_id for direct charge refunds)
    const { data: returnRecord, error: fetchError } = await supabase
      .from("returns")
      .select("*, orders!returns_order_id_fkey(stripe_payment_intent_id, marketplace_source, tenant_id, tenants(stripe_account_id))")
      .eq("id", return_id)
      .single();

    if (fetchError || !returnRecord) {
      return new Response(JSON.stringify({ error: "Retour niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refundMethod = returnRecord.refund_method || "manual";
    const order = returnRecord.orders as any;

    // Marketplace returns: status update only (financial, not logistics)
    if (refundMethod === "bolcom" || refundMethod === "amazon") {
      await supabase
        .from("returns")
        .update({
          refund_status: "completed",
          refund_notes: `Terugbetaling verloopt via ${refundMethod === "bolcom" ? "Bol.com" : "Amazon"}`,
        })
        .eq("id", return_id);

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

      // Get tenant's Stripe key
      const tenantId = order?.tenant_id || returnRecord.tenant_id;
      const { data: tenantSettings } = await supabase
        .from("tenant_settings")
        .select("stripe_secret_key")
        .eq("tenant_id", tenantId)
        .single();

      const stripeKey = tenantSettings?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        await supabase
          .from("returns")
          .update({ refund_status: "failed", refund_notes: "Geen Stripe key geconfigureerd" })
          .eq("id", return_id);

        return new Response(
          JSON.stringify({ error: "Geen Stripe key geconfigureerd" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const refundAmount = returnRecord.refund_amount
        ? Math.round(returnRecord.refund_amount * 100)
        : undefined;

      // Use stripeAccount for direct charge refunds (same pattern as pos-refund-payment)
      const stripeAccountId = order?.tenants?.stripe_account_id;
      let refund;
      try {
        refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            ...(refundAmount ? { amount: refundAmount } : {}),
            reason: "requested_by_customer",
          },
          stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
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
          stripe_refund_id: refund.id,
          refund_notes: `Stripe refund ${refund.id} aangemaakt`,
        })
        .eq("id", return_id);

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
        refund_notes: "Handmatig als terugbetaald gemarkeerd",
      })
      .eq("id", return_id);

    return new Response(
      JSON.stringify({ success: true, message: "Retour als terugbetaald gemarkeerd" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process refund error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

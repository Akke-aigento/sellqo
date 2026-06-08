import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id, amount, reason } = await req.json();

    if (!transaction_id) {
      throw new Error("Transaction ID is vereist");
    }

    // Use service-role client for DB access; auth is handled below via shared helper.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the transaction with stripe_payment_intent_id
    const { data: transaction, error: txError } = await supabaseClient
      .from("pos_transactions")
      .select("id, stripe_payment_intent_id, status, total, tenant_id")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      throw new Error("Transactie niet gevonden");
    }

    // Batch 2A2b: authenticate + strikt tenant_admin (cap-feature voor staff bestaat nog niet).
    const auth = await authenticateRequest(req, transaction.tenant_id);
    requireRole(auth, transaction.tenant_id, ["tenant_admin"]);

    if (transaction.status === "refunded") {
      throw new Error("Transactie is al terugbetaald");
    }

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("Geen kaartbetaling gevonden voor deze transactie");
    }

    // Get tenant's Stripe Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", transaction.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant niet gevonden");
    }

    if (!tenant.stripe_account_id || !tenant.stripe_charges_enabled) {
      throw new Error("Stripe account niet actief");
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe configuratie ontbreekt");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Calculate refund amount (use provided amount or full transaction total)
    const refundAmountCents = amount || Math.round(transaction.total * 100);

    // Validate refund amount doesn't exceed original
    const maxRefundCents = Math.round(transaction.total * 100);
    if (refundAmountCents > maxRefundCents) {
      throw new Error(`Refund bedrag (€${(refundAmountCents / 100).toFixed(2)}) mag niet hoger zijn dan transactie totaal (€${transaction.total.toFixed(2)})`);
    }

    // Map reason to Stripe-accepted values
    let stripeReason: "duplicate" | "fraudulent" | "requested_by_customer" = "requested_by_customer";
    if (reason?.toLowerCase().includes("dubbel") || reason?.toLowerCase().includes("duplicate")) {
      stripeReason = "duplicate";
    } else if (reason?.toLowerCase().includes("fraude") || reason?.toLowerCase().includes("fraud")) {
      stripeReason = "fraudulent";
    }

    // Create refund on connected account
    const refund = await stripe.refunds.create(
      {
        payment_intent: transaction.stripe_payment_intent_id,
        amount: refundAmountCents,
        reason: stripeReason,
        metadata: {
          pos_transaction_id: transaction_id,
          refund_reason: reason || "Klant retour",
        },
      },
      {
        stripeAccount: tenant.stripe_account_id,
      }
    );

    // Update transaction with refund ID
    await supabaseClient
      .from("pos_transactions")
      .update({
        stripe_refund_id: refund.id,
      })
      .eq("id", transaction_id);

    console.log(`Stripe refund created: ${refund.id} for transaction ${transaction_id}`);

    // Audit-log: welke admin heeft POS-refund verwerkt.
    {
      const { error: auditErr } = await supabaseClient.from("admin_actions_log").insert({
        admin_user_id: auth.user_id === "service_role" ? null : auth.user_id,
        target_tenant_id: transaction.tenant_id,
        action_type: "pos_refund_processed",
        action_details: {
          transaction_id,
          stripe_refund_id: refund.id,
          amount: refundAmountCents / 100,
          reason: reason || null,
        },
      });
      if (auditErr) console.error("[pos-refund-payment] audit log failed:", auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        amount_refunded: refundAmountCents / 100,
        status: refund.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("POS refund error:", error);
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Geen autorisatie header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Niet geautoriseerd");

    const { orderId, items, reason, refundAmount, restockItems } = await req.json();

    if (!orderId) throw new Error("Order ID is vereist");
    if (!reason) throw new Error("Reden is vereist");

    // Get order with tenant info
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("id, tenant_id, order_number, total, payment_status, stripe_payment_intent_id, customer_name, customer_email, customer_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Bestelling niet gevonden");

    if (order.payment_status === "refunded") {
      throw new Error("Bestelling is al volledig terugbetaald");
    }

    const actualRefundAmount = refundAmount || Number(order.total);
    const maxRefund = Number(order.total);
    if (actualRefundAmount > maxRefund) {
      throw new Error(`Refund bedrag (€${actualRefundAmount.toFixed(2)}) mag niet hoger zijn dan bestelling totaal (€${maxRefund.toFixed(2)})`);
    }

    let stripeRefundId: string | null = null;
    let refundMethod = "manual";
    let refundStatus = "pending";

    // Try Stripe refund if payment was via Stripe
    if (order.stripe_payment_intent_id) {
      const { data: tenant } = await supabaseClient
        .from("tenants")
        .select("stripe_account_id, stripe_charges_enabled")
        .eq("id", order.tenant_id)
        .single();

      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

      if (tenant?.stripe_account_id && tenant?.stripe_charges_enabled && stripeSecretKey) {
        try {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
          const refundAmountCents = Math.round(actualRefundAmount * 100);

          const refund = await stripe.refunds.create(
            {
              payment_intent: order.stripe_payment_intent_id,
              amount: refundAmountCents,
              reason: "requested_by_customer",
              metadata: {
                order_id: orderId,
                order_number: order.order_number,
                refund_reason: reason,
              },
            },
            { stripeAccount: tenant.stripe_account_id }
          );

          stripeRefundId = refund.id;
          refundMethod = "stripe";
          refundStatus = refund.status === "succeeded" ? "processed" : "pending";
          console.log(`Stripe refund created: ${refund.id} for order ${order.order_number}`);
        } catch (stripeError) {
          console.error("Stripe refund failed:", stripeError);
          refundMethod = "manual";
          refundStatus = "failed";
        }
      }
    }

    // Determine if partial or full refund
    const isPartial = actualRefundAmount < maxRefund;
    const newPaymentStatus = isPartial ? "pending" : "refunded";

    // Create return record
    const returnItems = items?.map((item: any) => ({
      product_name: item.product_name,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })) || [];

    const { data: returnRecord, error: returnError } = await supabaseClient
      .from("returns")
      .insert({
        tenant_id: order.tenant_id,
        order_id: orderId,
        customer_id: order.customer_id || null,
        marketplace_return_id: null,
        marketplace_connection_id: null,
        status: refundStatus === "processed" ? "approved" : "registered",
        return_reason: reason,
        customer_name: order.customer_name,
        items: returnItems,
        source: "manual",
        refund_amount: actualRefundAmount,
        refund_status: refundStatus,
        refund_method: refundMethod,
        stripe_refund_id: stripeRefundId,
        registration_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (returnError) {
      console.error("Return insert error:", returnError);
      throw new Error("Kon retour niet opslaan: " + returnError.message);
    }

    // Update order payment status
    await supabaseClient
      .from("orders")
      .update({ payment_status: newPaymentStatus })
      .eq("id", orderId);

    // Restock items if requested
    if (restockItems && items?.length > 0) {
      for (const item of items) {
        if (item.product_id) {
          await supabaseClient.rpc("bulk_adjust_prices", {
            // Using a direct update instead
          }).then(() => {});

          // Direct stock update
          const { data: product } = await supabaseClient
            .from("products")
            .select("stock, track_inventory")
            .eq("id", item.product_id)
            .single();

          if (product?.track_inventory) {
            await supabaseClient
              .from("products")
              .update({ stock: (product.stock || 0) + item.quantity })
              .eq("id", item.product_id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        return_id: returnRecord?.id,
        refund_method: refundMethod,
        refund_status: refundStatus,
        stripe_refund_id: stripeRefundId,
        amount_refunded: actualRefundAmount,
        is_partial: isPartial,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Process order refund error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekende fout" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

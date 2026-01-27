import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to send payout notifications
async function sendPayoutNotification(
  supabaseClient: SupabaseClient,
  stripeAccountId: string,
  notificationType: string,
  title: string,
  message: string,
  priority: string,
  metadata: Record<string, unknown>
) {
  try {
    // Find tenant by stripe_account_id
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id")
      .eq("stripe_account_id", stripeAccountId)
      .single();

    if (tenantError || !tenant) {
      logStep("Could not find tenant for stripe account", { stripeAccountId, error: tenantError?.message });
      return;
    }

    // Send notification using RPC
    const { error: notifError } = await supabaseClient.rpc("send_notification", {
      p_tenant_id: tenant.id,
      p_category: "payments",
      p_type: notificationType,
      p_title: title,
      p_message: message,
      p_priority: priority,
      p_action_url: "/admin/payments",
      p_data: metadata,
    });

    if (notifError) {
      logStep("Error sending notification", { error: notifError.message });
    } else {
      logStep("Notification sent successfully", { type: notificationType, tenantId: tenant.id });
    }
  } catch (err) {
    logStep("Exception sending notification", { error: err instanceof Error ? err.message : String(err) });
  }
}

// Format currency amount (Stripe uses cents)
function formatAmount(amount: number, currency: string): string {
  const decimalAmount = amount / 100;
  const symbol = currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase();
  return `${symbol}${decimalAmount.toFixed(2)}`;
}

// Format date for display
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logStep("Webhook signature verification failed", { error: message });
        return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Parse event without verification (for development)
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", { 
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted
        });

        // Update tenant status based on Stripe account status
        const { error } = await supabaseClient
          .from("tenants")
          .update({
            stripe_onboarding_complete: account.details_submitted || false,
            stripe_charges_enabled: account.charges_enabled || false,
            stripe_payouts_enabled: account.payouts_enabled || false,
          })
          .eq("stripe_account_id", account.id);

        if (error) {
          logStep("Error updating tenant", { error: error.message });
        } else {
          logStep("Tenant status updated successfully");
        }
        break;
      }

      // ==================== PAYOUT EVENTS ====================
      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout created", { 
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          arrivalDate: payout.arrival_date
        });

        const arrivalDate = payout.arrival_date ? formatDate(payout.arrival_date) : 'binnenkort';
        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_available',
          `Uitbetaling gepland: ${amountFormatted}`,
          `Een uitbetaling van ${amountFormatted} is gepland voor ${arrivalDate}`,
          'medium',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            arrival_date: payout.arrival_date,
          }
        );
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout paid", { 
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency
        });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_completed',
          `Uitbetaling ontvangen: ${amountFormatted}`,
          `De uitbetaling van ${amountFormatted} is succesvol op je bankrekening gestort`,
          'low',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
          }
        );
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout failed", { 
          payoutId: payout.id,
          amount: payout.amount,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message
        });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'stripe_account_issue',
          `Uitbetaling mislukt: ${amountFormatted}`,
          `De uitbetaling van ${amountFormatted} is mislukt. Reden: ${payout.failure_message || payout.failure_code || 'Onbekend'}. Controleer je bankgegevens.`,
          'urgent',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            failure_code: payout.failure_code,
            failure_message: payout.failure_message,
          }
        );
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout canceled", { payoutId: payout.id });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_available',
          `Uitbetaling geannuleerd: ${amountFormatted}`,
          `De geplande uitbetaling van ${amountFormatted} is geannuleerd`,
          'medium',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            status: 'canceled',
          }
        );
        break;
      }
      // ========================================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        const orderId = session.metadata?.order_id;
        if (!orderId) {
          logStep("No order_id in session metadata");
          break;
        }

        // Get tenant_id from order first for transaction recording
        const { data: orderData } = await supabaseClient
          .from("orders")
          .select("tenant_id")
          .eq("id", orderId)
          .single();

        // Update order payment status
        const { error } = await supabaseClient
          .from("orders")
          .update({
            payment_status: "paid",
            status: "processing",
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq("id", orderId);

        if (error) {
          logStep("Error updating order", { error: error.message });
        } else {
          logStep("Order updated to paid", { orderId });
          
          // Record transaction for usage tracking
          if (orderData?.tenant_id) {
            try {
              await supabaseClient.rpc('record_transaction', {
                p_tenant_id: orderData.tenant_id,
                p_transaction_type: 'stripe',
                p_order_id: orderId,
              });
              logStep("Transaction recorded for usage tracking");
            } catch (txError) {
              logStep("Warning: Failed to record transaction", { error: String(txError) });
            }
          }
        }

        // Update stock for each order item
        const { data: orderItems } = await supabaseClient
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);

        if (orderItems) {
          for (const item of orderItems) {
            if (item.product_id) {
              await supabaseClient.rpc("decrement_stock", {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
              });
            }
          }
          logStep("Stock updated for order items");
        }

        // Generate invoice after successful payment
        try {
          logStep("Triggering invoice generation", { orderId });
          
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          const invoiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ order_id: orderId }),
          });

          const invoiceResult = await invoiceResponse.json();
          logStep("Invoice generation result", invoiceResult);

          // Send invoice email if auto_send is enabled
          if (invoiceResult.success && invoiceResult.auto_send && invoiceResult.invoice_id) {
            logStep("Triggering invoice email send", { invoice_id: invoiceResult.invoice_id });
            
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ invoice_id: invoiceResult.invoice_id }),
            });

            const emailResult = await emailResponse.json();
            logStep("Invoice email result", emailResult);
          }
        } catch (invoiceError) {
          logStep("Invoice generation error (non-blocking)", { 
            error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError) 
          });
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent succeeded", { 
          paymentIntentId: paymentIntent.id,
          orderId: paymentIntent.metadata?.order_id 
        });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabaseClient
            .from("orders")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", orderId);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent failed", { paymentIntentId: paymentIntent.id });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabaseClient
            .from("orders")
            .update({
              payment_status: "failed",
            })
            .eq("id", orderId);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

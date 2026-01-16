import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PLATFORM-STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Processing event", { type: event.type });

    switch (event.type) {
      // ============================================
      // SUBSCRIPTION EVENTS
      // ============================================
      
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata.tenantId;
        const planId = subscription.metadata.planId;

        if (!tenantId) {
          logStep("No tenantId in subscription metadata", { subscriptionId: subscription.id });
          break;
        }

        // Determine billing interval from price
        const priceId = subscription.items.data[0]?.price?.id;
        let billingInterval: "monthly" | "yearly" = "monthly";
        
        if (priceId) {
          const { data: plan } = await supabase
            .from("pricing_plans")
            .select("stripe_price_id_monthly, stripe_price_id_yearly")
            .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
            .single();
          
          if (plan?.stripe_price_id_yearly === priceId) {
            billingInterval = "yearly";
          }
        }

        logStep("Upserting subscription", { tenantId, planId, status: subscription.status });

        // Upsert subscription
        const { error: upsertError } = await supabase
          .from("tenant_subscriptions")
          .upsert({
            tenant_id: tenantId,
            plan_id: planId || "starter",
            billing_interval: billingInterval,
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at 
              ? new Date(subscription.canceled_at * 1000).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "tenant_id",
          });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError.message });
        }

        // Update tenant
        await supabase
          .from("tenants")
          .update({
            subscription_plan: planId || "starter",
            subscription_status: subscription.status,
          })
          .eq("id", tenantId);

        logStep("Subscription updated", { subscriptionId: subscription.id, tenantId });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata.tenantId;

        if (!tenantId) break;

        logStep("Canceling subscription", { tenantId });

        // Update subscription status
        await supabase
          .from("tenant_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        // Downgrade tenant to free plan
        await supabase
          .from("tenants")
          .update({
            subscription_plan: "free",
            subscription_status: "canceled",
          })
          .eq("id", tenantId);

        logStep("Subscription canceled", { tenantId });
        break;
      }

      // ============================================
      // INVOICE EVENTS
      // ============================================

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Get tenant from customer
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", invoice.customer)
          .single();

        if (!tenant) {
          logStep("Tenant not found for customer", { customerId: invoice.customer });
          break;
        }

        logStep("Saving paid invoice", { tenantId: tenant.id, invoiceId: invoice.id });

        // Save invoice
        await supabase
          .from("platform_invoices")
          .upsert({
            tenant_id: tenant.id,
            stripe_invoice_id: invoice.id,
            stripe_charge_id: invoice.charge as string,
            invoice_number: invoice.number,
            amount: (invoice.amount_paid || 0) / 100,
            currency: invoice.currency?.toUpperCase() || "EUR",
            status: "paid",
            invoice_date: new Date(invoice.created * 1000).toISOString(),
            paid_at: invoice.status_transitions?.paid_at 
              ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
              : new Date().toISOString(),
            period_start: invoice.period_start 
              ? new Date(invoice.period_start * 1000).toISOString() 
              : null,
            period_end: invoice.period_end 
              ? new Date(invoice.period_end * 1000).toISOString() 
              : null,
            invoice_pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
          }, {
            onConflict: "stripe_invoice_id",
          });

        // Update subscription last payment
        await supabase
          .from("tenant_subscriptions")
          .update({
            last_payment_date: new Date().toISOString(),
            last_payment_amount: (invoice.amount_paid || 0) / 100,
          })
          .eq("tenant_id", tenant.id);

        logStep("Invoice saved", { invoiceId: invoice.id, tenantId: tenant.id });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, owner_email, name")
          .eq("stripe_customer_id", invoice.customer)
          .single();

        if (!tenant) break;

        logStep("Payment failed", { tenantId: tenant.id });

        // Update subscription status
        await supabase
          .from("tenant_subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant.id);

        // Update tenant status
        await supabase
          .from("tenants")
          .update({ subscription_status: "past_due" })
          .eq("id", tenant.id);

        // TODO: Send payment failed email via Resend
        logStep("Payment failed notification pending", { email: tenant.owner_email });
        break;
      }

      // ============================================
      // TRIAL EVENTS
      // ============================================

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata.tenantId;

        if (!tenantId) break;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("owner_email, name")
          .eq("id", tenantId)
          .single();

        logStep("Trial ending soon", { tenantId, email: tenant?.owner_email });
        // TODO: Send trial ending email via Resend
        break;
      }

      // ============================================
      // CHECKOUT EVENTS
      // ============================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id });
        // Subscription is automatically handled by subscription.created event
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});

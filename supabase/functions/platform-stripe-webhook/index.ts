import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PLATFORM-STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Helper: Format amount from cents to euros
const formatAmount = (amountInCents: number, currency: string = 'eur'): string => {
  const amount = amountInCents / 100;
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' ';
  return `${symbol}${amount.toFixed(2).replace('.', ',')}`;
};

// Helper: Format date to NL-BE format
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Helper: Send payout notification to tenant
const sendPayoutNotification = async (
  supabase: any,
  stripeAccountId: string,
  type: string,
  title: string,
  message: string,
  priority: string,
  data: Record<string, unknown>
) => {
  // Find tenant by stripe_account_id (Connect) or stripe_customer_id (Platform)
  let tenantId: string | null = null;
  
  // First try stripe_account_id for Connect merchants
  const { data: connectTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .single();
  
  if (connectTenant?.id) {
    tenantId = connectTenant.id;
  } else {
    // Fallback to stripe_customer_id via tenant_subscriptions for platform payouts
    const { data: subscription } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_customer_id", stripeAccountId)
      .maybeSingle();
    tenantId = subscription?.tenant_id || null;
  }
  
  if (!tenantId) {
    logStep("Tenant not found for payout notification", { stripeAccountId });
    return;
  }

  logStep("Sending payout notification", { tenantId, type, title });

  // Use invoke to call the create-notification function
  await supabase.functions.invoke("create-notification", {
    body: {
      tenant_id: tenantId,
      category: "payments",
      type,
      title,
      message,
      priority,
      action_url: "/admin/payouts",
      data,
    },
  });
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
            status: "active",
          })
          .eq("tenant_id", tenant.id);

        // Update tenant status back to active (in case it was past_due)
        await supabase
          .from("tenants")
          .update({ subscription_status: "active" })
          .eq("id", tenant.id);

        // Send invoice paid notification email
        const invoiceAmount = formatAmount(invoice.amount_paid || 0, invoice.currency || 'eur');
        await supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenant.id,
            category: "billing",
            type: "invoice_paid",
            title: `Factuur betaald: ${invoiceAmount}`,
            message: invoice.invoice_pdf 
              ? `Je factuur ${invoice.number || ''} van ${invoiceAmount} is betaald. [Bekijk factuur](${invoice.invoice_pdf})`
              : `Je factuur ${invoice.number || ''} van ${invoiceAmount} is succesvol betaald.`,
            priority: "low",
            action_url: "/admin/settings?tab=subscription",
            data: {
              invoice_id: invoice.id,
              invoice_number: invoice.number,
              amount: (invoice.amount_paid || 0) / 100,
              invoice_pdf_url: invoice.invoice_pdf,
            },
            skip_in_app: true,
          },
        });

        logStep("Invoice saved + email sent", { invoiceId: invoice.id, tenantId: tenant.id });
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

        // Send payment failed email
        const failedAmount = formatAmount(invoice.amount_due || 0, invoice.currency || 'eur');
        await supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenant.id,
            category: "billing",
            type: "payment_failed",
            title: `Betaling mislukt: ${failedAmount}`,
            message: `Je betaling van ${failedAmount} kon niet worden verwerkt. Update je betaalmethode om je abonnement actief te houden.`,
            priority: "urgent",
            action_url: "/admin/settings?tab=subscription",
            data: {
              invoice_id: invoice.id,
              amount: (invoice.amount_due || 0) / 100,
            },
            skip_in_app: true,
          },
        });

        logStep("Payment failed notification sent", { tenantId: tenant.id, email: tenant.owner_email });
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

      // ============================================
      // PAYOUT EVENTS (Stripe Connect)
      // ============================================

      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        const stripeAccountId = event.account || payout.destination as string;
        
        if (stripeAccountId) {
          const amount = formatAmount(payout.amount, payout.currency);
          const arrivalDate = payout.arrival_date ? formatDate(payout.arrival_date) : "binnenkort";
          
          await sendPayoutNotification(
            supabase,
            stripeAccountId,
            "payout_available",
            `Uitbetaling gepland: ${amount}`,
            `Je uitbetaling van ${amount} wordt verwacht op ${arrivalDate}.`,
            "medium",
            {
              payout_id: payout.id,
              amount: payout.amount,
              currency: payout.currency,
              arrival_date: arrivalDate,
            }
          );
          logStep("Payout created notification sent", { payoutId: payout.id, amount });
        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        const stripeAccountId = event.account || payout.destination as string;
        
        if (stripeAccountId) {
          const amount = formatAmount(payout.amount, payout.currency);
          
          await sendPayoutNotification(
            supabase,
            stripeAccountId,
            "payout_completed",
            `Uitbetaling ontvangen: ${amount}`,
            `Je uitbetaling van ${amount} is succesvol verwerkt en staat op je bankrekening.`,
            "low",
            {
              payout_id: payout.id,
              amount: payout.amount,
              currency: payout.currency,
            }
          );
          logStep("Payout paid notification sent", { payoutId: payout.id, amount });
        }
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        const stripeAccountId = event.account || payout.destination as string;
        
        if (stripeAccountId) {
          const amount = formatAmount(payout.amount, payout.currency);
          const failureMessage = payout.failure_message || "Onbekende fout";
          
          await sendPayoutNotification(
            supabase,
            stripeAccountId,
            "stripe_account_issue",
            `Uitbetaling mislukt: ${amount}`,
            `Je uitbetaling van ${amount} is mislukt. Reden: ${failureMessage}. Controleer je bankgegevens in Stripe.`,
            "urgent",
            {
              payout_id: payout.id,
              amount: payout.amount,
              currency: payout.currency,
              failure_code: payout.failure_code,
              failure_message: failureMessage,
            }
          );
          logStep("Payout failed notification sent", { payoutId: payout.id, amount, failureMessage });
        }
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        const stripeAccountId = event.account || payout.destination as string;
        
        if (stripeAccountId) {
          const amount = formatAmount(payout.amount, payout.currency);
          
          await sendPayoutNotification(
            supabase,
            stripeAccountId,
            "payout_available",
            `Uitbetaling geannuleerd: ${amount}`,
            `Je uitbetaling van ${amount} is geannuleerd. Het saldo blijft beschikbaar voor een volgende uitbetaling.`,
            "medium",
            {
              payout_id: payout.id,
              amount: payout.amount,
              currency: payout.currency,
            }
          );
          logStep("Payout canceled notification sent", { payoutId: payout.id, amount });
        }
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

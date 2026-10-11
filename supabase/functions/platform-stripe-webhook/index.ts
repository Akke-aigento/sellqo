import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { handleSubscriptionChargeWebhook } from "../_shared/subscriptionCharge.ts";
import { notifyPayout, type PayoutClient } from "../_shared/payoutNotification.ts";
import { reusablePaymentMethod, wantsMandateSave } from "../_shared/linkMandate.ts";

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

// Helper: Send payout notification to tenant.
// NOTIF-SOURCES-1: via het gedeelde pad (_shared/payoutNotification.ts), zodat
// deze webhook en stripe-connect-webhook samen één melding per payout geven.
const sendPayoutNotification = async (
  supabase: any,
  stripeAccountId: string,
  type: string,
  title: string,
  message: string,
  priority: string,
  data: Record<string, unknown>
) => {
  const result = await notifyPayout(supabase as PayoutClient, { stripeAccountId, type, title, message, priority, data });
  logStep("Payout notification", { type, result });
};

// BILL-FIX-1: een betaling via de betaallink met setup_future_usage bewaart het
// betaalmiddel. Hier wordt het het mandaat van de klant, zodat de volgende
// periode off-session geïnd wordt. Nooit over een actief mandaat heen, en een
// fout hier mag de afboeking (al gebeurd) nooit raken.
const saveMandateFromIntent = async (supabase: any, stripe: Stripe, intent: Stripe.PaymentIntent) => {
  try {
    const meta = (intent.metadata ?? {}) as Record<string, unknown>;
    if (!wantsMandateSave(meta)) return;
    const tenantId = String(meta.tenant_id);
    const customerId = String(meta.mandate_customer_id);
    const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    const pmId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
    if (!stripeCustomerId || !pmId) {
      logStep("Mandate save skipped — no customer or payment method", { intent: intent.id });
      return;
    }

    const { data: existing } = await supabase
      .from("customer_payment_mandates")
      .select("status")
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (existing?.status === "active") {
      logStep("Mandate save skipped — active mandate exists", { intent: intent.id });
      return;
    }

    const pm = await stripe.paymentMethods.retrieve(pmId);
    let details: unknown = null;
    if (pm.type !== "card" && pm.type !== "sepa_debit") {
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        details = charge.payment_method_details ?? null;
      }
    }
    const reusable = reusablePaymentMethod(pm.type, pm.id, details);
    if (!reusable) {
      logStep("Mandate save skipped — payment method not reusable", { intent: intent.id, type: pm.type });
      return;
    }

    const { error } = await supabase.from("customer_payment_mandates").upsert(
      {
        tenant_id: tenantId,
        customer_id: customerId,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: reusable.paymentMethodId,
        method_type: reusable.methodType,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_id" },
    );
    if (error) throw error;
    logStep("Mandate saved from pay link", { intent: intent.id, method: reusable.methodType });
  } catch (e) {
    logStep("Mandate save failed", { intent: intent.id, error: e instanceof Error ? e.message : String(e) });
  }
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
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Processing event", { type: event.type });

    // SUB-2: intercept off-session subscription-invoice charges first.
    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const handled = await handleSubscriptionChargeWebhook(supabase, event);
      if (handled && event.type === "payment_intent.succeeded") {
        await saveMandateFromIntent(supabase, stripe, event.data.object as Stripe.PaymentIntent);
      }
      if (handled) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    switch (event.type) {
      // ============================================
      // NOTE (FASE-B-SLOOP, 6 aug 2026): de Stripe Billing-events
      // (customer.subscription.created/updated/deleted, invoice.paid,
      // invoice.payment_failed, customer.subscription.trial_will_end) zijn
      // verwijderd. SellQo's abonnementsfacturatie loopt volledig via de
      // native pay-first engine (billing_cycles + payment_intent-interceptor
      // hierboven). Eventuele oude events vallen in de default-tak.
      // ============================================

      // ============================================
      // CHECKOUT EVENTS
      // ============================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id });
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
            "payout_canceled",
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

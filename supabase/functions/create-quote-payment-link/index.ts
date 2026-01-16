import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CREATE-QUOTE-PAYMENT-LINK] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const { quoteId } = await req.json();
    logStep("Request received", { quoteId });

    if (!quoteId) {
      throw new Error("Quote ID is required");
    }

    // Fetch quote with items and customer
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        customer:customers(*),
        quote_items(*)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote not found: ${quoteError?.message}`);
    }

    logStep("Quote fetched", { quoteNumber: quote.quote_number, total: quote.total });

    // Fetch tenant for Stripe account
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", quote.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    if (!tenant.stripe_account_id) {
      throw new Error("Tenant has no Stripe account connected");
    }

    logStep("Tenant fetched", { tenantName: tenant.name, stripeAccountId: tenant.stripe_account_id });

    // Create line items for Stripe
    const lineItems = quote.quote_items.map((item: any) => {
      const unitAmountAfterDiscount = Math.round(
        item.unit_price * (1 - (item.discount_percent || 0) / 100) * 100
      );
      
      return {
        price_data: {
          currency: tenant.currency?.toLowerCase() || "eur",
          product_data: {
            name: item.product_name,
            description: item.description || undefined,
          },
          unit_amount: unitAmountAfterDiscount,
        },
        quantity: item.quantity,
      };
    });

    // Add tax as a separate line item if applicable
    if (quote.tax_amount > 0) {
      lineItems.push({
        price_data: {
          currency: tenant.currency?.toLowerCase() || "eur",
          product_data: {
            name: `BTW (${tenant.tax_percentage || 21}%)`,
          },
          unit_amount: Math.round(quote.tax_amount * 100),
        },
        quantity: 1,
      });
    }

    // Calculate platform fee (2%)
    const platformFeeAmount = Math.round(quote.total * 0.02 * 100);

    logStep("Creating Stripe checkout session", { lineItems: lineItems.length, platformFee: platformFeeAmount });

    // Get origin from request headers or use default
    const origin = req.headers.get("origin") || "https://sellqo.lovable.app";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: quote.customer?.email,
      success_url: `${origin}/quote-accepted?quote=${quote.quote_number}`,
      cancel_url: `${origin}/quote-declined?quote=${quote.quote_number}`,
      metadata: {
        quote_id: quote.id,
        quote_number: quote.quote_number,
        tenant_id: quote.tenant_id,
      },
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: tenant.stripe_account_id,
        },
      },
    });

    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    // Update quote with payment link
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ payment_link: session.url })
      .eq("id", quoteId);

    if (updateError) {
      console.error("Error updating quote:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        paymentLink: session.url,
        sessionId: session.id
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});

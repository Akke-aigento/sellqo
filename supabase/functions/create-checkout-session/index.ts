import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

// Platform fee percentage (e.g., 5%)
const PLATFORM_FEE_PERCENT = 5;

interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
}

interface CheckoutRequest {
  tenant_id: string;
  items: CartItem[];
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  shipping_method_id?: string;
  shipping_cost?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body: CheckoutRequest = await req.json();
    const { 
      tenant_id, 
      items, 
      customer_email, 
      customer_name, 
      customer_phone,
      shipping_address,
      shipping_method_id,
      shipping_cost = 0
    } = body;

    if (!tenant_id) throw new Error("tenant_id is required");
    if (!items || items.length === 0) throw new Error("items are required");
    if (!customer_email) throw new Error("customer_email is required");
    logStep("Request validated", { tenant_id, itemCount: items.length });

    // Get tenant data with Stripe account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name, stripe_account_id, stripe_charges_enabled, tax_percentage, currency")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.stripe_account_id) {
      throw new Error("Tenant has not configured payments yet");
    }

    if (!tenant.stripe_charges_enabled) {
      throw new Error("Tenant payment account is not fully activated");
    }
    logStep("Tenant verified", { tenantName: tenant.name, stripeAccountId: tenant.stripe_account_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const taxPercentage = tenant.tax_percentage || 21;
    const taxAmount = Math.round(subtotal * (taxPercentage / 100));
    const total = subtotal + taxAmount + (shipping_cost * 100); // Convert shipping to cents

    // Calculate platform fee (in cents)
    const platformFee = Math.round(total * (PLATFORM_FEE_PERCENT / 100));
    logStep("Totals calculated", { subtotal, taxAmount, shipping: shipping_cost * 100, total, platformFee });

    // Create line items for Stripe Checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
      price_data: {
        currency: tenant.currency?.toLowerCase() || "eur",
        product_data: {
          name: item.product_name,
          images: item.product_image ? [item.product_image] : undefined,
        },
        unit_amount: Math.round(item.unit_price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item if present
    if (shipping_cost > 0) {
      lineItems.push({
        price_data: {
          currency: tenant.currency?.toLowerCase() || "eur",
          product_data: {
            name: "Verzendkosten",
          },
          unit_amount: Math.round(shipping_cost * 100),
        },
        quantity: 1,
      });
    }

    // Generate order number
    const { data: orderNumberData } = await supabaseClient.rpc('generate_order_number', { 
      _tenant_id: tenant_id 
    });
    const orderNumber = orderNumberData || `#${Date.now()}`;
    logStep("Order number generated", { orderNumber });

    // Create pending order in database
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        tenant_id,
        order_number: orderNumber,
        customer_email,
        customer_name,
        customer_phone,
        shipping_address,
        subtotal: subtotal / 100, // Store in main currency units
        tax_amount: taxAmount / 100,
        shipping_cost: shipping_cost,
        total: total / 100,
        status: "pending",
        payment_status: "pending",
        shipping_method_id,
      })
      .select()
      .single();

    if (orderError) {
      logStep("Error creating order", { error: orderError.message });
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
    logStep("Order created", { orderId: order.id });

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      product_image: item.product_image,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      logStep("Error creating order items", { error: itemsError.message });
    }

    // Create Stripe Checkout Session with destination charge
    const origin = req.headers.get("origin") || "https://id-preview--9932a7fe-43a1-42de-9c64-168968599600.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "ideal", "bancontact"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/shop/${tenant_id}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${tenant_id}/checkout?cancelled=true`,
      customer_email,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: tenant.stripe_account_id,
        },
        metadata: {
          order_id: order.id,
          tenant_id,
          order_number: orderNumber,
        },
      },
      metadata: {
        order_id: order.id,
        tenant_id,
        order_number: orderNumber,
      },
    });
    logStep("Checkout session created", { sessionId: session.id });

    // Update order with checkout session ID
    await supabaseClient
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id,
      order_id: order.id,
      order_number: orderNumber,
    }), {
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

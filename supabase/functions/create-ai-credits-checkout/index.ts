import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit packages configuration
const creditPackages: Record<string, { credits: number; price: number; name: string }> = {
  pack_50: { credits: 50, price: 499, name: '50 AI Credits' },
  pack_100: { credits: 100, price: 899, name: '100 AI Credits' },
  pack_250: { credits: 250, price: 1999, name: '250 AI Credits' },
  pack_500: { credits: 500, price: 3499, name: '500 AI Credits' },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user?.email) {
      throw new Error("User not authenticated");
    }

    const { tenantId, packageId } = await req.json();

    if (!tenantId || !packageId) {
      throw new Error("Missing tenantId or packageId");
    }

    const pkg = creditPackages[packageId];
    if (!pkg) {
      throw new Error("Invalid package ID");
    }

    // Verify user has access to tenant
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!userRole) {
      throw new Error("User does not have access to this tenant");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          tenant_id: tenantId,
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('ai_credit_purchases')
      .insert({
        tenant_id: tenantId,
        credits_amount: pkg.credits,
        price_paid: pkg.price / 100,
        currency: 'EUR',
        status: 'pending',
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Purchase record error:', purchaseError);
      throw new Error('Could not create purchase record');
    }

    // Create Stripe checkout session
    const origin = req.headers.get("origin") || "https://sellqo.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: pkg.name,
              description: `${pkg.credits} AI credits voor content generatie`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/admin/marketing/ai?purchase=success&credits=${pkg.credits}`,
      cancel_url: `${origin}/admin/marketing/ai?purchase=cancelled`,
      metadata: {
        tenant_id: tenantId,
        purchase_id: purchase.id,
        credits: pkg.credits.toString(),
        type: 'ai_credits',
      },
    });

    // Update purchase record with session ID
    await supabaseAdmin
      .from('ai_credit_purchases')
      .update({ stripe_session_id: session.id })
      .eq('id', purchase.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

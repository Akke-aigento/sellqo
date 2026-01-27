import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ADDON-CHECKOUT] ${step}${detailsStr}`);
};

// Add-on price configuration
const ADDON_PRICES: Record<string, { priceId: string; name: string; monthlyPrice: number }> = {
  peppol: {
    priceId: 'price_peppol_addon', // Replace with actual Stripe price ID
    name: 'Peppol e-Invoicing Add-on',
    monthlyPrice: 12.00,
  },
  pos: {
    priceId: 'price_pos_addon',
    name: 'POS Kassa Module',
    monthlyPrice: 29.00,
  },
  webshop: {
    priceId: 'price_webshop_addon',
    name: 'Webshop Builder',
    monthlyPrice: 19.00,
  },
  bol_com: {
    priceId: 'price_bol_addon',
    name: 'Bol.com Kanaal',
    monthlyPrice: 15.00,
  },
  whatsapp: {
    priceId: 'price_whatsapp_addon',
    name: 'WhatsApp Berichten',
    monthlyPrice: 9.00,
  },
};

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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { tenant_id, addon_type } = await req.json();
    if (!tenant_id || !addon_type) {
      throw new Error("Missing tenant_id or addon_type");
    }

    // Verify user belongs to tenant
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!roleData) {
      throw new Error("User does not belong to this tenant");
    }

    // Get addon config
    const addonConfig = ADDON_PRICES[addon_type];
    if (!addonConfig) {
      throw new Error(`Unknown addon type: ${addon_type}`);
    }

    logStep("Creating checkout for addon", { addon_type, tenant_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if tenant already has this addon
    const { data: existingAddon } = await supabaseClient
      .from('tenant_addons')
      .select('id, status')
      .eq('tenant_id', tenant_id)
      .eq('addon_type', addon_type)
      .single();

    if (existingAddon?.status === 'active') {
      throw new Error("This addon is already active");
    }

    const origin = req.headers.get("origin") || "https://sellqo.lovable.app";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: addonConfig.name,
              description: `Maandelijks add-on abonnement voor ${addonConfig.name}`,
            },
            unit_amount: Math.round(addonConfig.monthlyPrice * 100),
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/admin/settings?tab=billing&addon_success=${addon_type}`,
      cancel_url: `${origin}/admin/settings?tab=peppol&addon_cancelled=true`,
      metadata: {
        tenant_id,
        addon_type,
        type: 'addon_subscription',
      },
      subscription_data: {
        metadata: {
          tenant_id,
          addon_type,
          type: 'addon_subscription',
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
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

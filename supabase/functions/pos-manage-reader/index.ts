import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Niet geautoriseerd");
    }

    const { action, tenant_id, reader_id, registration_code, label, location_id } = await req.json();

    // Get tenant's Stripe Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant?.stripe_account_id) {
      throw new Error("Tenant Stripe account niet gevonden");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const stripeOptions = { stripeAccount: tenant.stripe_account_id };

    switch (action) {
      case "list_readers": {
        const readers = await stripe.terminal.readers.list(
          { limit: 100 },
          stripeOptions
        );
        return new Response(
          JSON.stringify({ readers: readers.data }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "register_reader": {
        if (!registration_code || !label) {
          throw new Error("Registratiecode en label zijn vereist");
        }
        
        const reader = await stripe.terminal.readers.create({
          registration_code,
          label,
          location: location_id,
        }, stripeOptions);

        return new Response(
          JSON.stringify({ reader }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "delete_reader": {
        if (!reader_id) {
          throw new Error("Reader ID is vereist");
        }
        
        await stripe.terminal.readers.del(reader_id, stripeOptions);

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "cancel_action": {
        if (!reader_id) {
          throw new Error("Reader ID is vereist");
        }
        
        const reader = await stripe.terminal.readers.cancelAction(
          reader_id,
          stripeOptions
        );

        return new Response(
          JSON.stringify({ reader }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "list_locations": {
        const locations = await stripe.terminal.locations.list(
          { limit: 100 },
          stripeOptions
        );
        return new Response(
          JSON.stringify({ locations: locations.data }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "create_location": {
        const { display_name, address } = await req.json();
        
        const location = await stripe.terminal.locations.create({
          display_name,
          address,
        }, stripeOptions);

        return new Response(
          JSON.stringify({ location }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      default:
        throw new Error("Ongeldige actie");
    }
  } catch (error: unknown) {
    console.error("[POS] Reader management error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

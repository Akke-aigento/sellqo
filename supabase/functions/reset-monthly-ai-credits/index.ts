import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Platform-only endpoint. Draait met de service-role en raakt ALLE tenants;
    // mag daarom nooit door een gewone gebruiker of met de publieke anon-key
    // afgevuurd kunnen worden.
    const auth = await authenticateRequest(req);
    if (!auth.is_platform_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: platform admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("[reset-monthly-ai-credits] Starting monthly credit reset...");

    // Call the database function to reset credits
    const { data, error } = await supabaseAdmin.rpc('reset_monthly_ai_credits');

    if (error) {
      console.error("[reset-monthly-ai-credits] Error:", error);
      throw error;
    }

    console.log(`[reset-monthly-ai-credits] Reset completed. Affected rows: ${data}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset ${data} tenant credit records`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("[reset-monthly-ai-credits] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

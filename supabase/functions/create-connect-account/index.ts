import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ensureConnectAccount } from "../_shared/connectAccount.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get request body
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");
    logStep("Tenant ID received", { tenant_id });

    // Authenticate user + role check (Batch 2B1b)
    const auth = await authenticateRequest(req, tenant_id);
    requireRole(auth, tenant_id, ['tenant_admin']);
    logStep("User authenticated", { userId: auth.user_id });

    // TENANT-ACTION-1: account-mint logica leeft nu in _shared/connectAccount.ts
    // zodat resolve-tenant-action exact dezelfde accounts aanmaakt. Gedrag,
    // foutteksten en respons zijn ongewijzigd.
    const { accountId, created } = await ensureConnectAccount(
      supabaseClient,
      tenant_id,
      logStep,
    );

    if (!created) {
      logStep("Tenant already has Stripe account, creating new onboarding link");
    }

    // Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${req.headers.get("origin")}/admin/settings?stripe=refresh`,
      return_url: `${req.headers.get("origin")}/admin/settings?stripe=success`,
      type: "account_onboarding",
    });
    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: accountId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

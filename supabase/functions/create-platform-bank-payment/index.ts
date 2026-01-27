import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PLATFORM-BANK-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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
    const { tenantId, paymentType, amount, creditsAmount, packageId, addonType } = await req.json();
    
    if (!tenantId || !paymentType || !amount) {
      throw new Error("Missing required fields: tenantId, paymentType, amount");
    }

    logStep("Request parsed", { tenantId, paymentType, amount });

    // Verify user belongs to tenant
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (roleError || !roleData) {
      throw new Error("User does not belong to this tenant");
    }

    // Generate unique OGM reference
    const { data: ogmData, error: ogmError } = await supabaseAdmin
      .rpc('generate_platform_ogm');

    if (ogmError) {
      logStep("OGM generation error, using fallback", { error: ogmError.message });
      // Fallback OGM generation
    }

    const ogmReference = ogmData || generateFallbackOGM();
    logStep("OGM generated", { ogmReference });

    // Create pending payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('pending_platform_payments')
      .insert({
        tenant_id: tenantId,
        ogm_reference: ogmReference,
        amount: amount,
        currency: 'EUR',
        payment_type: paymentType,
        status: 'pending',
        credits_amount: creditsAmount || null,
        package_id: packageId || null,
        addon_type: addonType || null,
        metadata: {
          created_by: user.id,
          email: user.email,
        },
      })
      .select()
      .single();

    if (paymentError) {
      logStep("Payment creation error", { error: paymentError.message });
      throw new Error("Could not create payment record");
    }

    logStep("Payment created", { paymentId: payment.id, ogmReference });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        ogmReference: ogmReference,
        amount: amount,
        expiresAt: payment.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Fallback OGM generation if DB function fails
function generateFallbackOGM(): string {
  const timestamp = Date.now().toString().slice(-10);
  const numericBase = timestamp.padStart(10, '0');
  const baseNum = BigInt(numericBase);
  const remainder = Number(baseNum % 97n);
  const checksum = (remainder === 0 ? 97 : remainder).toString().padStart(2, '0');
  const full = numericBase + checksum;
  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7, 12)}+++`;
}

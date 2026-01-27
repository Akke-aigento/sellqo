import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-PLATFORM-BANK-PAYMENT] ${step}${detailsStr}`);
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
    logStep("User authenticated", { userId: user.id });

    // Check if user is platform admin
    const { data: isPlatformAdmin } = await supabaseAdmin
      .rpc('is_platform_admin', { _user_id: user.id });

    if (!isPlatformAdmin) {
      throw new Error("Only platform admins can confirm payments");
    }

    logStep("User is platform admin");

    // Parse request body
    const { paymentId, ogmReference, notes } = await req.json();
    
    if (!paymentId && !ogmReference) {
      throw new Error("Either paymentId or ogmReference is required");
    }

    // Find the pending payment
    let query = supabaseAdmin
      .from('pending_platform_payments')
      .select('*');
    
    if (paymentId) {
      query = query.eq('id', paymentId);
    } else {
      query = query.eq('ogm_reference', ogmReference);
    }

    const { data: payment, error: paymentError } = await query.single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== 'pending') {
      throw new Error(`Payment already ${payment.status}`);
    }

    logStep("Payment found", { paymentId: payment.id, type: payment.payment_type });

    // Process based on payment type
    if (payment.payment_type === 'ai_credits') {
      // Add AI credits to tenant
      const { error: creditsError } = await supabaseAdmin
        .rpc('add_ai_credits', {
          p_tenant_id: payment.tenant_id,
          p_credits: payment.credits_amount,
        });

      if (creditsError) {
        logStep("Credits error", { error: creditsError.message });
        throw new Error("Failed to add credits");
      }

      logStep("AI credits added", { credits: payment.credits_amount });

    } else if (payment.payment_type === 'addon') {
      // Activate the add-on
      const { error: addonError } = await supabaseAdmin
        .from('tenant_addons')
        .upsert({
          tenant_id: payment.tenant_id,
          addon_type: payment.addon_type,
          status: 'active',
          activated_at: new Date().toISOString(),
          price_monthly: payment.amount,
          payment_method: 'bank_transfer',
        }, {
          onConflict: 'tenant_id,addon_type',
        });

      if (addonError) {
        logStep("Addon activation error", { error: addonError.message });
        throw new Error("Failed to activate addon");
      }

      logStep("Addon activated", { addonType: payment.addon_type });
    }

    // Update payment status to confirmed
    const { error: updateError } = await supabaseAdmin
      .from('pending_platform_payments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        notes: notes || null,
      })
      .eq('id', payment.id);

    if (updateError) {
      logStep("Update error", { error: updateError.message });
      throw new Error("Failed to update payment status");
    }

    // Create platform invoice
    const { error: invoiceError } = await supabaseAdmin
      .from('platform_invoices')
      .insert({
        tenant_id: payment.tenant_id,
        amount: payment.amount,
        currency: 'EUR',
        status: 'paid',
        payment_method: 'bank_transfer',
        ogm_reference: payment.ogm_reference,
        payment_type: payment.payment_type,
        paid_at: new Date().toISOString(),
        invoice_date: new Date().toISOString(),
      });

    if (invoiceError) {
      logStep("Invoice creation error (non-fatal)", { error: invoiceError.message });
    }

    logStep("Payment confirmed successfully", { paymentId: payment.id });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        paymentType: payment.payment_type,
        amount: payment.amount,
        creditsAdded: payment.credits_amount,
        addonActivated: payment.addon_type,
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

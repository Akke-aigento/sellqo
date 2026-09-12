import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeForTenant } from "../_shared/stripe.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-MERCHANT-PAYOUTS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Request received");

    // Auth: service-role client plus een expliciete tenant- en rolcheck.
    //
    // Hier stond een client met de ANON-key en zónder Authorization-header. De
    // JWT ging alleen naar `auth.getUser(token)` — dat werkt, want dat gaat naar
    // GoTrue en niet via RLS. Maar élke query daarna draaide als rol `anon`, en
    // de policy op `user_roles` is `TO authenticated`. De lookup gaf dus altijd
    // nul rijen, `.single()` faalde, en de melding "No tenant found for user"
    // werd een HTTP 500. Voor iedereen, altijd.
    //
    // Het patroon hieronder is dat van de zusterfuncties in hetzelfde domein
    // (`get-stripe-login-link`, `disconnect-stripe-account`): de tenant komt uit
    // de body en wordt geverifieerd, in plaats van afgeleid uit een query die
    // RLS toch blokkeert. `accountant` mag mee omdat dit leesbare financiële
    // historie is — dezelfde rol die `create-manual-invoice` al vertrouwt.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const auth = await authenticateRequest(req, tenantId);
    // Exact de lijst uit `useCan.ts` (`payments.read`), waar `RouteGuard` de
    // pagina op afsluit. Stond hier eerst op tenant_admin + accountant, en dat
    // is strakker dan het rechtenmodel: een staff- of viewer-gebruiker mocht de
    // pagina openen en kreeg gegarandeerd een 403 — een scherm dat zichtbaar is
    // en per definitie stukgaat. Wijkt de gate hier af van useCan, dan is dat
    // een stille rechtenwijziging; die hoort in useCan te gebeuren, niet hier.
    // (`platform_admin` staat er voor de leesbaarheid bij; requireRole laat die
    // rol sowieso door via auth.is_platform_admin.)
    requireRole(auth, tenantId, ["platform_admin", "tenant_admin", "staff", "accountant", "viewer"]);
    logStep("User authenticated", { userId: auth.user_id });

    const { data: tenant, error: tenantErr } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenantId)
      .single();
    if (tenantErr) logStep("Tenant lookup failed", { message: tenantErr.message });

    if (!tenant?.stripe_account_id) {
      return new Response(JSON.stringify({ 
        payouts: [],
        has_more: false,
        message: "No Stripe account connected" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenantId);
    logStep("Stripe client initialised", { keyMode });

    logStep("Fetching payouts for Stripe account", { accountId: tenant.stripe_account_id });

    // De frontend roept aan via `functions.invoke` — een POST zonder
    // querystring. Deze parameters kwamen dus nooit aan; `limit` uit de hook
    // werd stil genegeerd. De querystring blijft als terugval voor handmatige
    // aanroepen.
    const url = new URL(req.url);
    const limit = Number(body?.limit) || parseInt(url.searchParams.get("limit") || "20");
    const startingAfter = body?.starting_after || url.searchParams.get("starting_after") || undefined;

    // Fetch payouts from merchant's Stripe account
    const params: Stripe.PayoutListParams = { limit };
    if (startingAfter) params.starting_after = startingAfter;

    const payouts = await stripe.payouts.list(params, {
      stripeAccount: tenant.stripe_account_id,
    });

    logStep("Payouts fetched", { count: payouts.data.length });

    // Transform to simpler format
    const formattedPayouts = payouts.data.map((payout: Stripe.Payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      type: payout.type,
      method: payout.method,
      arrival_date: payout.arrival_date,
      created: payout.created,
      description: payout.description,
      failure_message: payout.failure_message,
    }));

    // Get account info for next scheduled payout
    const account = await stripe.accounts.retrieve(tenant.stripe_account_id);
    
    let nextPayoutDate = null;
    if (account.settings?.payouts?.schedule) {
      const schedule = account.settings.payouts.schedule;
      nextPayoutDate = {
        interval: schedule.interval,
        delay_days: schedule.delay_days,
        weekly_anchor: schedule.weekly_anchor,
        monthly_anchor: schedule.monthly_anchor,
      };
    }

    return new Response(JSON.stringify({ 
      payouts: formattedPayouts,
      has_more: payouts.has_more,
      schedule: nextPayoutDate,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    });
  }
});

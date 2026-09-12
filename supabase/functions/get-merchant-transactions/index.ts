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
  console.log(`[GET-MERCHANT-TRANSACTIONS] ${step}${detailsStr}`);
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
    requireRole(auth, tenantId, ["tenant_admin", "accountant"]);
    logStep("User authenticated", { userId: auth.user_id });

    const { data: tenant, error: tenantErr } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenantId)
      .single();
    if (tenantErr) logStep("Tenant lookup failed", { message: tenantErr.message });

    if (!tenant?.stripe_account_id) {
      return new Response(JSON.stringify({ 
        transactions: [],
        has_more: false,
        message: "No Stripe account connected" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenantId);
    logStep("Stripe client initialised", { keyMode });

    logStep("Fetching transactions for Stripe account", { accountId: tenant.stripe_account_id });

    // De frontend roept aan via `functions.invoke` — een POST zonder
    // querystring. Deze parameters kwamen dus nooit aan; `limit` uit de hook
    // werd stil genegeerd. De querystring blijft als terugval voor handmatige
    // aanroepen.
    const url = new URL(req.url);
    const limit = Number(body?.limit) || parseInt(url.searchParams.get("limit") || "50");
    const startingAfter = body?.starting_after || url.searchParams.get("starting_after") || undefined;
    const createdGte = body?.created_gte || url.searchParams.get("created_gte") || undefined;
    const createdLte = body?.created_lte || url.searchParams.get("created_lte") || undefined;

    // Fetch balance transactions from merchant's Stripe account
    const params: Stripe.BalanceTransactionListParams = {
      limit,
      expand: ['data.source'],
    };

    if (startingAfter) params.starting_after = startingAfter;
    if (createdGte) params.created = { ...params.created as object, gte: parseInt(createdGte) };
    if (createdLte) params.created = { ...params.created as object, lte: parseInt(createdLte) };

    const transactions = await stripe.balanceTransactions.list(params, {
      stripeAccount: tenant.stripe_account_id,
    });

    logStep("Transactions fetched", { count: transactions.data.length });

    // Transform to simpler format
    const formattedTransactions = transactions.data.map((tx: Stripe.BalanceTransaction) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee,
      net: tx.net,
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      created: tx.created,
      available_on: tx.available_on,
      source_type: tx.source ? (tx.source as any).object : null,
    }));

    // Get balance summary
    const balance = await stripe.balance.retrieve({
      stripeAccount: tenant.stripe_account_id,
    });

    const availableBalance = balance.available.reduce((sum: number, b: Stripe.Balance.Available) => sum + b.amount, 0);
    const pendingBalance = balance.pending.reduce((sum: number, b: Stripe.Balance.Pending) => sum + b.amount, 0);

    return new Response(JSON.stringify({ 
      transactions: formattedTransactions,
      has_more: transactions.has_more,
      balance: {
        available: availableBalance,
        pending: pendingBalance,
        currency: balance.available[0]?.currency || 'eur',
      }
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

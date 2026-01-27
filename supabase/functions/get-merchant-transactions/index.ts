import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    logStep("User authenticated", { userId: user.id });

    // Get user's tenant with stripe account
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      throw new Error("No tenant found for user");
    }

    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", userRole.tenant_id)
      .single();

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

    logStep("Fetching transactions for Stripe account", { accountId: tenant.stripe_account_id });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const startingAfter = url.searchParams.get("starting_after") || undefined;
    const createdGte = url.searchParams.get("created_gte") || undefined;
    const createdLte = url.searchParams.get("created_lte") || undefined;

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    });
  }
});

// AI-CRED-2 (12-10-2026) — credits toekennen bij terugkeer na betalen.
//
// De webhook (platform-stripe-webhook) kent bijgekochte credits toe, maar hangt af
// van het Stripe-endpoint dat op checkout.session.completed geabonneerd is — en
// dat valt niet te controleren zonder het dashboard. Deze functie maakt dat
// overbodig: komt de klant terug op /admin/marketing/ai?purchase=success&session_id=…,
// dan vraagt de app hier na of die sessie betaald is en kent ze toe.
//
// Zelfde code als de webhook (_shared/aiCreditPurchase.ts), dus idempotent: wie
// eerst komt (webhook of terugkeer) kent toe, de ander krijgt 'already_completed'.
// Leest alleen bij Stripe; maakt daar niets aan.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { grantAiCreditPurchase } from "../_shared/aiCreditPurchase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const log = (step: string, details?: unknown) =>
  console.log(`[VERIFY-AI-CREDITS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user }, error: authError } = await anon.auth.getUser(token);
    if (authError || !user) return json({ error: "not_authenticated" }, 401);

    const { sessionId } = await req.json().catch(() => ({}));
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return json({ error: "invalid_session_id" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Alleen sessies die we zelf aanmaakten: de aankoop moet bestaan met dit sessie-id.
    const { data: purchase } = await admin
      .from("ai_credit_purchases")
      .select("id, tenant_id, status")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!purchase) return json({ error: "unknown_session" }, 404);

    // De gebruiker moet bij die winkel horen (zelfde check als create-ai-credits-checkout).
    const { data: role } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", purchase.tenant_id)
      .limit(1)
      .maybeSingle();
    if (!role) return json({ error: "forbidden" }, 403);

    if (purchase.status === "completed") return json({ status: "already_completed" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Extra slot: de sessie moet echt bij deze aankoop en winkel horen.
    if (session.metadata?.purchase_id !== purchase.id || session.metadata?.tenant_id !== purchase.tenant_id) {
      log("Metadata komt niet overeen", { sessionId });
      return json({ error: "mismatch" }, 409);
    }
    if (session.payment_status !== "paid") return json({ status: "pending" });

    const result = await grantAiCreditPurchase(admin, session as never, log);
    if (typeof result === "object") return json({ error: "grant_failed" }, 500);
    return json({ status: result });
  } catch (e) {
    log("Fout", { error: e instanceof Error ? e.message : String(e) });
    return json({ error: "internal" }, 500);
  }
});

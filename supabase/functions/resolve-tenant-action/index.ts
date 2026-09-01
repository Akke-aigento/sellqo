// TENANT-ACTION-1: PUBLIEKE resolver. Het token IS de autorisatie — zelfde
// patroon als mandate-setup-info. Geen enkel veld uit het request bepaalt wat er
// gebeurt behalve het token zelf (origin wordt enkel gebruikt om onze eigen
// redirect-URL's te bouwen en wordt strikt gevalideerd).
//
// Bij elk bezoek wordt een VERSE Stripe accountLink gemint. refresh_url wijst
// terug naar /actie/<token>, zodat een verlopen Stripe-link zichzelf ververst.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ensureConnectAccount } from "../_shared/connectAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RESOLVE-TENANT-ACTION] ${step}${suffix}`);
};

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Alleen onze eigen app-origins mogen de redirect-URL's bepalen. */
function safeOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    let originParam = url.searchParams.get("origin");
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.token === "string") token = body.token;
      if (typeof body?.origin === "string") originParam = body.origin;
    }
    if (!token) return json({ success: false, error: "token is required" }, 400);

    const { data: row, error: rowErr } = await supabase
      .from("tenant_action_tokens")
      .select("id, tenant_id, action_type, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (rowErr) throw rowErr;

    if (!row) return json({ success: false, error: "invalid_token" }, 404);
    if (row.status === "completed") return json({ success: false, error: "token_used" }, 410);
    if (row.status === "revoked") return json({ success: false, error: "token_revoked" }, 410);
    if (row.status === "expired") return json({ success: false, error: "token_expired" }, 410);

    if (new Date(row.expires_at) < new Date()) {
      // Idempotent: alleen vanuit 'pending' naar 'expired'.
      await supabase
        .from("tenant_action_tokens")
        .update({ status: "expired" })
        .eq("id", row.id)
        .eq("status", "pending");
      return json({ success: false, error: "token_expired" }, 410);
    }

    if (row.action_type !== "connect_onboarding") {
      // De machtigingsflow heeft haar eigen publieke pagina.
      return json({ success: false, error: "unsupported_action" }, 400);
    }

    const origin =
      safeOrigin(originParam) ??
      safeOrigin(req.headers.get("origin")) ??
      safeOrigin(req.headers.get("referer")) ??
      safeOrigin(Deno.env.get("PUBLIC_APP_URL") ?? null);
    if (!origin) return json({ success: false, error: "origin_unresolved" }, 400);

    const { stripe, accountId } = await ensureConnectAccount(supabase, row.tenant_id, log);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      // Kritiek: een verlopen Stripe-link keert terug naar onze wrapper, die dan
      // opnieuw een verse link mint.
      refresh_url: `${origin}/actie/${token}`,
      return_url: `${origin}/actie/${token}/gelukt`,
      type: "account_onboarding",
    });

    log("Onboarding link minted", { tenant: row.tenant_id, account: accountId });

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: accountLink.url },
    });
  } catch (err) {
    const message = errMsg(err);
    log("ERROR", { message });
    return json({ success: false, error: message }, 500);
  }
});

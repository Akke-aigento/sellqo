// TENANT-ACTION-1: platform_admin genereert een deelbare, lang-levende link op
// ons eigen domein voor een onboarding-actie bij een tenant.
//
// - action_type 'sepa_mandate'  -> volledig gedelegeerd aan de bestaande
//   create-platform-mandate-setup (geen eigen token, geen eigen rij).
// - action_type 'connect_onboarding' -> eigen token in tenant_action_tokens;
//   de verse Stripe-onboarding-link wordt pas bij bezoek gemint door
//   resolve-tenant-action.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-TENANT-ACTION-LINK] ${step}${suffix}`);
};

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ACTION_TYPES = ["connect_onboarding", "sepa_mandate"] as const;
type ActionType = typeof ACTION_TYPES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenant_id;
    const actionType = body?.action_type as ActionType | undefined;

    if (typeof tenantId !== "string" || !tenantId) {
      return json({ success: false, error: "tenant_id is required" }, 400);
    }
    if (!actionType || !ACTION_TYPES.includes(actionType)) {
      return json({ success: false, error: "action_type must be connect_onboarding or sepa_mandate" }, 400);
    }

    // Platform-admin only: dit is een support-actie op een andere tenant,
    // niet iets wat een tenant_admin voor zichzelf mag doen.
    const auth = await authenticateRequest(req);
    if (!auth.is_platform_admin) {
      throw new AuthError("Platform admin required", 403);
    }

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) return json({ success: false, error: "Tenant not found" }, 404);

    const origin =
      req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";

    // ---- SEPA-machtiging: volledig delegeren ----------------------------------
    if (actionType === "sepa_mandate") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-platform-mandate-setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const payload = await resp.json().catch(() => ({}));
      log("Delegated to create-platform-mandate-setup", { tenant: tenantId, status: resp.status });
      return json(payload, resp.status);
    }

    // ---- Connect-onboarding: eigen token -------------------------------------
    const token = randomToken();
    const { error: insErr } = await supabase.from("tenant_action_tokens").insert({
      tenant_id: tenantId,
      action_type: "connect_onboarding",
      token,
      created_by: auth.user_id === "service_role" ? null : auth.user_id,
    });
    if (insErr) throw insErr;

    const url = `${origin}/actie/${token}`;
    log("Connect onboarding token created", { tenant: tenantId });

    return json({ success: true, url, token, action_type: actionType });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = errMsg(err);
    log("ERROR", { message });
    return json({ success: false, error: message }, 500);
  }
});

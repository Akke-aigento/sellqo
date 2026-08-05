import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) {
      return json({ success: false, error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Single auth path: x-cron-secret must match the stored internal secret ---
    const provided = req.headers.get("x-cron-secret");
    if (!provided) return json({ success: false, error: "Unauthorized" }, 401);

    const { data: cfg, error: cfgError } = await admin
      .from("internal_config")
      .select("value")
      .eq("key", "internal_webhook_secret")
      .maybeSingle();

    if (cfgError || !cfg?.value) {
      console.error("[sync-cron-vault-key] config lookup failed", cfgError?.message);
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const expected = String(cfg.value);
    if (
      provided.length !== expected.length ||
      !crypto.subtle.timingSafeEqual === undefined
    ) {
      // fallthrough to constant-ish comparison below
    }
    let mismatch = provided.length !== expected.length ? 1 : 0;
    for (let i = 0; i < Math.min(provided.length, expected.length); i++) {
      mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    // --- Upsert the vault secret with the real service-role key ---
    const { data: updated, error: rpcError } = await admin.rpc(
      "sync_cron_service_role_key",
      { new_value: serviceKey },
    );

    if (rpcError) {
      console.error("[sync-cron-vault-key] vault upsert failed", rpcError.message);
      return json({ success: false, error: "Vault update failed" }, 500);
    }

    return json({ success: true, updated: updated === true });
  } catch (e) {
    console.error("[sync-cron-vault-key] unexpected error", (e as Error).message);
    return json({ success: false, error: "Unexpected error" }, 500);
  }
});
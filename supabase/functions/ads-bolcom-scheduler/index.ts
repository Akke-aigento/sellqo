import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "sync" | "reports" | "ai";

const MODE_FUNCTION_MAP: Record<Mode, string> = {
  sync: "ads-bolcom-sync",
  reports: "ads-bolcom-reports",
  ai: "ads-ai-engine",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const expectedAnon = `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`;
  const expectedService = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (authHeader !== expectedAnon && authHeader !== expectedService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "sync") as Mode;
    if (!MODE_FUNCTION_MAP[mode]) {
      return new Response(JSON.stringify({ error: `Invalid mode: ${mode}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downstream = MODE_FUNCTION_MAP[mode];
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[ads-bolcom-scheduler] mode=${mode} downstream=${downstream}`);

    const { data: connections, error: fetchErr } = await supabase
      .from("marketplace_connections")
      .select("tenant_id, credentials")
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);

    if (fetchErr) throw fetchErr;

    const tenantIds = Array.from(
      new Set(
        (connections || [])
          .filter((c: any) => c.credentials?.advertisingClientId && c.credentials?.advertisingClientSecret)
          .map((c: any) => c.tenant_id),
      ),
    );

    console.log(`[ads-bolcom-scheduler] ${tenantIds.length} tenant(s) with advertising credentials`);

    const results: Array<{ tenant_id: string; success: boolean; status?: number; error?: string; data?: unknown }> = [];

    for (const tenantId of tenantIds) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${downstream}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        });
        const text = await res.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* leave as text */ }
        if (res.ok) {
          console.log(`[ads-bolcom-scheduler] ✓ ${tenantId} (${res.status})`);
          results.push({ tenant_id: tenantId, success: true, status: res.status, data: parsed });
        } else {
          console.error(`[ads-bolcom-scheduler] ✗ ${tenantId} (${res.status}): ${text}`);
          results.push({ tenant_id: tenantId, success: false, status: res.status, error: text });
        }
      } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err, corsHeaders);
    }
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ads-bolcom-scheduler] ✗ ${tenantId} threw: ${message}`);
        results.push({ tenant_id: tenantId, success: false, error: message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        downstream,
        total_tenants: tenantIds.length,
        success_count: successCount,
        fail_count: tenantIds.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err, corsHeaders);
    }
    console.error("[ads-bolcom-scheduler] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
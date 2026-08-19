// EVENT-SYSTEEM fase 2b — "waar ben ik en wat mag ik" voor een tokenscanner.
//
// Valideert uitsluitend een event_scanner_access.access_token en geeft de
// scan-context terug. GEEN attendee-data, GEEN tellers, GEEN financiële data.
// Auth gebeurt in-code (verify_jwt = false); de scanner heeft geen JWT.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scanner-token",
};

const SCANNER_TOKEN_RE = /^[a-f0-9]{64}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Eén generieke afwijzing voor onbekend / inactief / verlopen — geen orakel.
  const rejected = () => json({ success: false, error: "invalid scanner token" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(
      req.headers.get("x-scanner-token") ?? (body as { scanner_token?: unknown })?.scanner_token ?? "",
    ).trim();

    if (!SCANNER_TOKEN_RE.test(token)) return rejected();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("event_scanner_access")
      .select("id, name, tenant_id, event_detail_id, zone_id, direction, scan_mode, allowed_product_ids, expires_at")
      .eq("access_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[SCANNER-CONTEXT] lookup failed", error.message ?? JSON.stringify(error));
      return json({ success: false, error: "lookup failed" }, 500);
    }
    if (!row) return rejected();
    if (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now()) return rejected();

    const tenantId = row.tenant_id as string;

    const [{ data: event }, { data: zone }, { data: tenant }] = await Promise.all([
      admin
        .from("event_details")
        .select("id, event_date, start_time, end_time, location_name, status")
        .eq("id", row.event_detail_id as string)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin
        .from("event_zones")
        .select("id, name")
        .eq("id", row.zone_id as string)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin.from("tenants").select("name, logo_url").eq("id", tenantId).maybeSingle(),
    ]);

    let allowedProductNames: string[] | null = null;
    const allowed = (row.allowed_product_ids as string[] | null) ?? null;
    if (allowed && allowed.length > 0) {
      const { data: products } = await admin
        .from("products")
        .select("name")
        .eq("tenant_id", tenantId)
        .in("id", allowed);
      allowedProductNames = (products ?? []).map((p) => String(p.name));
    }

    return json({
      success: true,
      scanner: { id: row.id, name: row.name },
      event: event
        ? {
            id: event.id,
            date: event.event_date,
            start_time: event.start_time,
            end_time: event.end_time,
            location_name: event.location_name,
            status: event.status,
          }
        : null,
      zone: zone ? { id: zone.id, name: zone.name } : null,
      direction: row.direction,
      scan_mode: row.scan_mode,
      allowed_product_names: allowedProductNames,
      tenant_branding: tenant ? { name: tenant.name, logo_url: tenant.logo_url ?? null } : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SCANNER-CONTEXT] unexpected", msg);
    return json({ success: false, error: "unexpected error" }, 500);
  }
});

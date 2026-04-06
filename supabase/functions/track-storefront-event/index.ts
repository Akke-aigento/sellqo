import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_EVENT_TYPES = [
  "page_view", "product_view", "add_to_cart", "remove_from_cart",
  "checkout_start", "search", "wishlist_add", "email_open", "email_click",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    // Support single event or batch
    const events: Array<{
      tenant_id: string;
      event_type: string;
      session_id?: string;
      storefront_customer_id?: string;
      event_data?: Record<string, unknown>;
      page_url?: string;
      referrer_url?: string;
    }> = Array.isArray(body.events) ? body.events : [body];

    if (events.length === 0 || events.length > 50) {
      return new Response(
        JSON.stringify({ error: "Provide 1-50 events" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash IP for privacy
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(clientIp + "sellqo-salt"));
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const userAgent = req.headers.get("user-agent") || null;

    const rows = events
      .filter(e => e.tenant_id && VALID_EVENT_TYPES.includes(e.event_type))
      .map(e => ({
        tenant_id: e.tenant_id,
        event_type: e.event_type,
        session_id: e.session_id || null,
        storefront_customer_id: e.storefront_customer_id || null,
        event_data: e.event_data || {},
        page_url: e.page_url || null,
        referrer_url: e.referrer_url || null,
        user_agent: userAgent,
        ip_hash: ipHash,
      }));

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid events" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase.from("customer_events").insert(rows);
    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Track event error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

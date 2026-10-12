import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SEC-TENANT-1: neveneffectvrije versiestempel om de deploy te bewijzen.
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: "SEC-TENANT-1" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, name } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEC-TENANT-1: elke ingelogde gebruiker kon voor ELKE winkel een sleutel maken
    // (insert met service role, RLS omzeild). Nu alleen een admin van die winkel.
    try {
      const auth = await authenticateRequest(req, tenant_id);
      requireRole(auth, tenant_id, ["tenant_admin"]);
    } catch (e) {
      if (e instanceof AuthError) return authErrorResponse(e, corsHeaders);
      throw e;
    }

    // Generate random key: sk_live_ + 48 hex chars
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);
    const hexChars = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const fullKey = `sk_live_${hexChars}`;
    const keyPrefix = fullKey.slice(0, 12);

    // SHA-256 hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fullKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Insert with service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabaseAdmin
      .from("storefront_api_keys")
      .insert({
        tenant_id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: name || "API Key",
        is_active: true,
      })
      .select("id, key_prefix, name, is_active, created_at")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ...data,
        full_key: fullKey, // Only returned once!
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

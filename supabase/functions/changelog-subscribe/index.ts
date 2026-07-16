import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SELLQO_TENANT_ID = "d03c63fe-48c6-4ff7-a30b-7506ea3e71ab";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.email === "string" ? body.email : "";
    const email = raw.trim().toLowerCase();

    if (!email || email.length > 255 || !EMAIL_REGEX.test(email)) {
      return json(400, { error: "invalid_email" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing, error: selectError } = await supabase
      .from("customers")
      .select("id, email_subscribed")
      .eq("tenant_id", SELLQO_TENANT_ID)
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      console.error("changelog-subscribe select error:", selectError);
      return json(500, { error: "server_error" });
    }

    const now = new Date().toISOString();

    if (existing) {
      if (!existing.email_subscribed) {
        const { error: updErr } = await supabase
          .from("customers")
          .update({ email_subscribed: true, email_subscribed_at: now })
          .eq("id", existing.id);
        if (updErr) {
          console.error("changelog-subscribe update error:", updErr);
          return json(500, { error: "server_error" });
        }
      }
    } else {
      const { error: insErr } = await supabase.from("customers").insert({
        tenant_id: SELLQO_TENANT_ID,
        email,
        email_subscribed: true,
        email_subscribed_at: now,
        acquisition_source: "changelog",
        customer_type: "b2c",
      });
      if (insErr) {
        console.error("changelog-subscribe insert error:", insErr);
        return json(500, { error: "server_error" });
      }
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("changelog-subscribe fatal:", err);
    return json(500, { error: "server_error" });
  }
});
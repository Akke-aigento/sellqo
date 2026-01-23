import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML templates for the unsubscribe flow
const getUnsubscribePageHtml = (tenantName: string, email: string, tenantId: string, token: string) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uitschrijven - ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .email { font-weight: 600; color: #1a1a1a; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-secondary { background: #f3f4f6; color: #374151; margin-left: 12px; }
    .btn-secondary:hover { background: #e5e7eb; }
    .buttons { margin-top: 32px; }
    .reason-select { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    form { margin-top: 24px; }
    .preferences-link { margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .preferences-link a { color: #2563eb; text-decoration: none; font-size: 14px; }
    .preferences-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Uitschrijven van emails</h1>
    <p>Wil je geen emails meer ontvangen van <strong>${tenantName}</strong>?</p>
    <p>Je schrijft je uit voor: <span class="email">${email}</span></p>
    
    <form action="/functions/v1/unsubscribe" method="POST">
      <input type="hidden" name="email" value="${email}">
      <input type="hidden" name="tenant_id" value="${tenantId}">
      <input type="hidden" name="token" value="${token}">
      <input type="hidden" name="action" value="confirm">
      
      <select name="reason" class="reason-select">
        <option value="">Selecteer een reden (optioneel)</option>
        <option value="too_many">Ik ontvang te veel emails</option>
        <option value="not_relevant">De content is niet relevant voor mij</option>
        <option value="never_signed_up">Ik heb me nooit ingeschreven</option>
        <option value="other">Andere reden</option>
      </select>
      
      <div class="buttons">
        <button type="submit" class="btn btn-danger">Uitschrijven</button>
      </div>
    </form>
    
    <div class="preferences-link">
      <a href="/functions/v1/email-preferences?email=${encodeURIComponent(email)}&tenant=${tenantId}">
        Of beheer je email voorkeuren
      </a>
    </div>
  </div>
</body>
</html>
`;

const getSuccessPageHtml = (tenantName: string) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uitgeschreven - ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
    .resubscribe { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .resubscribe a { color: #2563eb; text-decoration: none; font-size: 14px; }
    .resubscribe a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>Je bent uitgeschreven</h1>
    <p>Je ontvangt geen marketing emails meer van <strong>${tenantName}</strong>.</p>
    <p style="margin-top: 16px; font-size: 14px;">Je zult nog wel belangrijke transactie emails ontvangen over je bestellingen.</p>
    <div class="resubscribe">
      <p style="font-size: 14px;">Per ongeluk uitgeschreven? Neem contact op met ${tenantName} om je opnieuw in te schrijven.</p>
    </div>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET request - show unsubscribe confirmation page
    if (req.method === "GET") {
      const email = url.searchParams.get("email");
      const tenantId = url.searchParams.get("tenant");
      const token = url.searchParams.get("token") || crypto.randomUUID();

      if (!email || !tenantId) {
        return new Response("Ongeldige link", { 
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // Get tenant info for branding
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();

      const tenantName = tenant?.name || "onze webshop";

      return new Response(getUnsubscribePageHtml(tenantName, email, tenantId, token), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // POST request - process unsubscribe
    if (req.method === "POST") {
      const formData = await req.formData();
      const email = formData.get("email") as string;
      const tenantId = formData.get("tenant_id") as string;
      const reason = formData.get("reason") as string;

      if (!email || !tenantId) {
        return new Response("Ongeldige gegevens", { 
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // Get tenant info
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();

      const tenantName = tenant?.name || "onze webshop";

      // Insert into email_unsubscribes
      await supabase.from("email_unsubscribes").upsert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        reason: reason || null,
        unsubscribed_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,email" });

      // Update customer email_subscribed to false
      await supabase
        .from("customers")
        .update({ email_subscribed: false })
        .eq("tenant_id", tenantId)
        .ilike("email", email);

      // Update newsletter subscriber if exists
      await supabase
        .from("newsletter_subscribers")
        .update({ 
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
          unsubscribe_reason: reason || null
        })
        .eq("tenant_id", tenantId)
        .ilike("email", email);

      // Update email preferences
      await supabase
        .from("email_preferences")
        .upsert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          newsletter: false,
          promotions: false,
          product_updates: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,email" });

      return new Response(getSuccessPageHtml(tenantName), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response("Er is een fout opgetreden. Probeer het later opnieuw.", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

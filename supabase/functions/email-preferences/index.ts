import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getPreferencesPageHtml = (
  tenantName: string, 
  email: string, 
  preferences: { newsletter: boolean; promotions: boolean; product_updates: boolean; frequency: string },
  tenantId: string,
  token: string
) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Voorkeuren - ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; padding: 40px 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 560px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .email-display { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 32px; font-size: 14px; color: #4b5563; }
    .email-display strong { color: #1a1a1a; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px; }
    .option { display: flex; align-items: flex-start; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
    .option:hover { border-color: #a5b4fc; background: #f5f3ff; }
    .option.active { border-color: #7c3aed; background: #f5f3ff; }
    .option input { margin-top: 4px; }
    .option-content { margin-left: 12px; flex: 1; }
    .option-title { font-weight: 500; color: #1a1a1a; margin-bottom: 4px; }
    .option-desc { font-size: 14px; color: #6b7280; }
    .frequency-select { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-primary { background: #7c3aed; color: white; width: 100%; }
    .btn-primary:hover { background: #6d28d9; }
    .unsubscribe-all { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; }
    .unsubscribe-all a { color: #dc2626; font-size: 14px; text-decoration: none; }
    .unsubscribe-all a:hover { text-decoration: underline; }
    .success-message { background: #d1fae5; color: #065f46; padding: 16px; border-radius: 8px; margin-bottom: 24px; display: none; }
    .success-message.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Voorkeuren</h1>
    <p class="subtitle">Beheer welke emails je ontvangt van ${tenantName}</p>
    
    <div class="email-display">
      Email: <strong>${email}</strong>
    </div>
    
    <div class="success-message" id="successMessage">
      ✓ Je voorkeuren zijn opgeslagen!
    </div>
    
    <form action="/functions/v1/email-preferences" method="POST" id="preferencesForm">
      <input type="hidden" name="email" value="${email}">
      <input type="hidden" name="tenant_id" value="${tenantId}">
      <input type="hidden" name="token" value="${token}">
      
      <div class="section">
        <div class="section-title">Email Types</div>
        
        <label class="option ${preferences.newsletter ? 'active' : ''}">
          <input type="checkbox" name="newsletter" ${preferences.newsletter ? 'checked' : ''}>
          <div class="option-content">
            <div class="option-title">📰 Nieuwsbrief</div>
            <div class="option-desc">Algemene updates, nieuws en content</div>
          </div>
        </label>
        
        <label class="option ${preferences.promotions ? 'active' : ''}">
          <input type="checkbox" name="promotions" ${preferences.promotions ? 'checked' : ''}>
          <div class="option-content">
            <div class="option-title">🏷️ Aanbiedingen & Kortingen</div>
            <div class="option-desc">Exclusieve deals en promoties</div>
          </div>
        </label>
        
        <label class="option ${preferences.product_updates ? 'active' : ''}">
          <input type="checkbox" name="product_updates" ${preferences.product_updates ? 'checked' : ''}>
          <div class="option-content">
            <div class="option-title">🆕 Nieuwe Producten</div>
            <div class="option-desc">Updates over nieuwe producten en collecties</div>
          </div>
        </label>
      </div>
      
      <div class="section">
        <div class="section-title">Email Frequentie</div>
        <select name="frequency" class="frequency-select">
          <option value="normal" ${preferences.frequency === 'normal' ? 'selected' : ''}>Normaal - zoals gepland</option>
          <option value="weekly" ${preferences.frequency === 'weekly' ? 'selected' : ''}>Wekelijks - max 1x per week</option>
          <option value="minimal" ${preferences.frequency === 'minimal' ? 'selected' : ''}>Minimaal - alleen belangrijke updates</option>
        </select>
      </div>
      
      <button type="submit" class="btn btn-primary">Voorkeuren Opslaan</button>
      
      <div class="unsubscribe-all">
        <a href="/functions/v1/unsubscribe?email=${encodeURIComponent(email)}&tenant=${tenantId}">
          Uitschrijven van alle emails
        </a>
      </div>
    </form>
  </div>
  
  <script>
    document.querySelectorAll('.option').forEach(option => {
      const checkbox = option.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        option.classList.toggle('active', checkbox.checked);
      });
    });
  </script>
</body>
</html>
`;

const getSuccessRedirectHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=javascript:history.back()">
  <script>
    window.location.href = document.referrer || '/';
    setTimeout(() => { document.getElementById('msg').style.display = 'block'; }, 100);
  </script>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .msg { text-align: center; display: none; }
    .msg h1 { color: #10b981; }
  </style>
</head>
<body>
  <div class="msg" id="msg">
    <h1>✓ Opgeslagen!</h1>
    <p>Je voorkeuren zijn bijgewerkt.</p>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET - Show preferences page
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

      // Get tenant info
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();

      const tenantName = tenant?.name || "onze webshop";

      // Get or create preferences
      let { data: prefs } = await supabase
        .from("email_preferences")
        .select("*")
        .eq("tenant_id", tenantId)
        .ilike("email", email)
        .maybeSingle();

      if (!prefs) {
        // Create default preferences
        const { data: newPrefs } = await supabase
          .from("email_preferences")
          .insert({
            tenant_id: tenantId,
            email: email.toLowerCase(),
            newsletter: true,
            promotions: true,
            product_updates: true,
            frequency: "normal",
          })
          .select()
          .single();
        prefs = newPrefs;
      }

      const preferences = {
        newsletter: prefs?.newsletter ?? true,
        promotions: prefs?.promotions ?? true,
        product_updates: prefs?.product_updates ?? true,
        frequency: prefs?.frequency ?? "normal",
      };

      return new Response(getPreferencesPageHtml(tenantName, email, preferences, tenantId, token), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // POST - Update preferences
    if (req.method === "POST") {
      const formData = await req.formData();
      const email = formData.get("email") as string;
      const tenantId = formData.get("tenant_id") as string;
      const newsletter = formData.get("newsletter") === "on";
      const promotions = formData.get("promotions") === "on";
      const productUpdates = formData.get("product_updates") === "on";
      const frequency = formData.get("frequency") as string || "normal";

      if (!email || !tenantId) {
        return new Response("Ongeldige gegevens", { 
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // Update preferences
      await supabase
        .from("email_preferences")
        .upsert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          newsletter,
          promotions,
          product_updates: productUpdates,
          frequency,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,email" });

      // If all are false, update unsubscribe status
      if (!newsletter && !promotions && !productUpdates) {
        await supabase
          .from("customers")
          .update({ email_subscribed: false })
          .eq("tenant_id", tenantId)
          .ilike("email", email);
      } else {
        // Make sure they're subscribed if they have any preference on
        await supabase
          .from("customers")
          .update({ email_subscribed: true })
          .eq("tenant_id", tenantId)
          .ilike("email", email);
      }

      // Redirect back to preferences page with success message
      const redirectUrl = `/functions/v1/email-preferences?email=${encodeURIComponent(email)}&tenant=${tenantId}&saved=true`;
      return new Response(null, {
        status: 302,
        headers: { "Location": redirectUrl }
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Email preferences error:", error);
    return new Response("Er is een fout opgetreden", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

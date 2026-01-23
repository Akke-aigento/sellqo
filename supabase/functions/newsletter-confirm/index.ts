import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSuccessPageHtml = (tenantName: string) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inschrijving bevestigd - ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.2); max-width: 480px; width: 100%; padding: 48px; text-align: center; }
    .icon { width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 40px; height: 40px; color: white; }
    h1 { color: #1a1a1a; font-size: 28px; margin-bottom: 12px; }
    p { color: #666; line-height: 1.7; font-size: 16px; }
    .highlight { color: #7c3aed; font-weight: 600; }
    .benefits { background: #f8fafc; border-radius: 12px; padding: 24px; margin-top: 32px; text-align: left; }
    .benefits h3 { color: #1a1a1a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .benefits ul { list-style: none; }
    .benefits li { padding: 8px 0; color: #4b5563; display: flex; align-items: center; gap: 12px; }
    .benefits li::before { content: "✓"; color: #10b981; font-weight: bold; }
    .cta { margin-top: 32px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s; }
    .cta a:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Je bent ingeschreven! 🎉</h1>
    <p>Welkom bij de nieuwsbrief van <span class="highlight">${tenantName}</span>. Je ontvangt binnenkort onze eerste email.</p>
    
    <div class="benefits">
      <h3>Wat je kunt verwachten:</h3>
      <ul>
        <li>Exclusieve aanbiedingen en kortingen</li>
        <li>Als eerste op de hoogte van nieuwe producten</li>
        <li>Tips en inspiratie</li>
        <li>VIP toegang tot speciale acties</li>
      </ul>
    </div>
  </div>
</body>
</html>
`;

const getErrorPageHtml = (message: string) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fout bij bevestiging</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Oeps, er ging iets mis</h1>
    <p>${message}</p>
  </div>
</body>
</html>
`;

const getAlreadyConfirmedPageHtml = (tenantName: string) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reeds bevestigd - ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✉️</div>
    <h1>Je bent al ingeschreven</h1>
    <p>Je inschrijving voor de nieuwsbrief van <strong>${tenantName}</strong> was al bevestigd. Je ontvangt onze emails al!</p>
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

    const token = url.searchParams.get("token");
    const tenantId = url.searchParams.get("tenant");

    if (!token || !tenantId) {
      return new Response(getErrorPageHtml("Ongeldige bevestigingslink. Controleer de link in je email."), {
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

    // Find subscriber by token
    const { data: subscriber, error } = await supabase
      .from("newsletter_subscribers")
      .select("*")
      .eq("confirmation_token", token)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error || !subscriber) {
      return new Response(getErrorPageHtml("Deze bevestigingslink is ongeldig of verlopen."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Check if already confirmed
    if (subscriber.status === "active" && subscriber.confirmed_at) {
      return new Response(getAlreadyConfirmedPageHtml(tenantName), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Confirm the subscription
    await supabase
      .from("newsletter_subscribers")
      .update({
        status: "active",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", subscriber.id);

    // If there's a customer with this email, update their subscription status
    await supabase
      .from("customers")
      .update({ email_subscribed: true })
      .eq("tenant_id", tenantId)
      .ilike("email", subscriber.email);

    // Create/update email preferences
    await supabase
      .from("email_preferences")
      .upsert({
        tenant_id: tenantId,
        email: subscriber.email.toLowerCase(),
        newsletter: true,
        promotions: true,
        product_updates: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,email" });

    // Sync to external provider if configured
    const { data: config } = await supabase
      .from("tenant_newsletter_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (config?.provider === "mailchimp" && config.mailchimp_api_key) {
      try {
        const serverPrefix = config.mailchimp_server_prefix || config.mailchimp_api_key.split("-").pop();
        const response = await fetch(
          `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${config.mailchimp_audience_id}/members`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`anystring:${config.mailchimp_api_key}`)}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email_address: subscriber.email,
              status: "subscribed",
              merge_fields: { FNAME: subscriber.first_name || "" },
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          await supabase
            .from("newsletter_subscribers")
            .update({ sync_status: "synced", external_id: data.id })
            .eq("id", subscriber.id);
        }
      } catch (syncError) {
        console.error("Mailchimp sync error:", syncError);
      }
    } else if (config?.provider === "klaviyo" && config.klaviyo_api_key) {
      try {
        const response = await fetch(
          "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/",
          {
            method: "POST",
            headers: {
              "Authorization": `Klaviyo-API-Key ${config.klaviyo_api_key}`,
              "Content-Type": "application/json",
              "revision": "2023-02-22",
            },
            body: JSON.stringify({
              data: {
                type: "profile-subscription-bulk-create-job",
                attributes: {
                  profiles: {
                    data: [{
                      type: "profile",
                      attributes: {
                        email: subscriber.email,
                        subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                      },
                    }],
                  },
                },
                relationships: {
                  list: { data: { type: "list", id: config.klaviyo_list_id } },
                },
              },
            }),
          }
        );
        
        if (response.ok) {
          await supabase
            .from("newsletter_subscribers")
            .update({ sync_status: "synced" })
            .eq("id", subscriber.id);
        }
      } catch (syncError) {
        console.error("Klaviyo sync error:", syncError);
      }
    }

    return new Response(getSuccessPageHtml(tenantName), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    console.error("Newsletter confirm error:", error);
    return new Response(getErrorPageHtml("Er is een fout opgetreden. Probeer het later opnieuw."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

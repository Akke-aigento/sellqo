import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRIAL-EXPIRY-WARNING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing backend env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find trials expiring within 23-25 hours (roughly "tomorrow")
    const now = new Date();
    const minEnd = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
    const maxEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now

    const { data: expiringTrials, error: fetchError } = await supabase
      .from("tenant_subscriptions")
      .select(`
        id, 
        tenant_id, 
        plan_id,
        trial_end,
        tenants:tenant_id (
          id,
          name,
          owner_email,
          logo_url,
          primary_color
        )
      `)
      .eq("status", "trialing")
      .is("trial_warning_sent_at", null)
      .neq("plan_id", "free")
      .gte("trial_end", minEnd.toISOString())
      .lte("trial_end", maxEnd.toISOString());

    if (fetchError) {
      logStep("Error fetching expiring trials", { error: fetchError.message });
      throw fetchError;
    }

    if (!expiringTrials || expiringTrials.length === 0) {
      logStep("No expiring trials found");
      return new Response(JSON.stringify({ warnings_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found expiring trials", { count: expiringTrials.length });

    let warningsSent = 0;

    for (const trial of expiringTrials) {
      const tenantData = trial.tenants as unknown as { 
        id: string; 
        name: string; 
        owner_email: string; 
        logo_url: string | null;
        primary_color: string | null;
      } | null;
      const tenant = tenantData;
      
      if (!tenant?.owner_email) {
        logStep("Skipping trial - no owner email", { tenant_id: trial.tenant_id });
        continue;
      }

      const trialEndDate = new Date(trial.trial_end);
      const formattedDate = trialEndDate.toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // 1. Create in-app notification
      try {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            tenant_id: trial.tenant_id,
            category: 'billing',
            type: 'trial_expiring',
            title: 'Je proefperiode eindigt morgen',
            message: `Je ${trial.plan_id} trial loopt morgen af (${formattedDate}). Upgrade nu om al je features te behouden.`,
            priority: 'high',
            action_url: '/admin/settings/billing',
            data: {
              plan_id: trial.plan_id,
              trial_end: trial.trial_end,
            }
          });

        if (notifError) {
          logStep("Error creating notification", { error: notifError.message, tenant_id: trial.tenant_id });
        } else {
          logStep("In-app notification created", { tenant_id: trial.tenant_id });
        }
      } catch (notifErr) {
        logStep("Exception creating notification", { error: String(notifErr), tenant_id: trial.tenant_id });
      }

      // 2. Send email if Resend is configured
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          
          const tenantName = tenant.name || 'Sellqo';
          const primaryColor = tenant.primary_color || '#18181b';
          const logoUrl = tenant.logo_url;
          const planName = trial.plan_id.charAt(0).toUpperCase() + trial.plan_id.slice(1);

          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <tr>
                  <td>
                    <div style="background-color: ${primaryColor}; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
                      ${logoUrl 
                        ? `<img src="${logoUrl}" alt="${tenantName}" style="max-height: 48px; max-width: 200px;">`
                        : `<span style="color: white; font-size: 24px; font-weight: 600;">${tenantName}</span>`
                      }
                    </div>
                    
                    <div style="background-color: white; border-radius: 0 0 8px 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      <div style="background-color: #ffedd5; color: #ea580c; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-weight: 500;">
                        ⏰ Je proefperiode eindigt morgen
                      </div>
                      
                      <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
                        Je ${planName} trial loopt bijna af
                      </h1>
                      
                      <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                        Je proefperiode eindigt op <strong>${formattedDate}</strong>.
                      </p>
                      
                      <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                        Na deze datum wordt je account automatisch omgezet naar het gratis plan. 
                        Dit betekent dat sommige features tijdelijk niet beschikbaar zijn totdat je upgrade.
                      </p>
                      
                      <div style="background-color: #f4f4f5; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                        <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0; font-weight: 500;">
                          ✅ Goed nieuws: Je data blijft bewaard!
                        </p>
                        <p style="color: #71717a; font-size: 14px; margin: 0;">
                          Al je producten, bestellingen, klanten en instellingen blijven behouden. 
                          Bij een latere upgrade heb je direct weer toegang tot alles.
                        </p>
                      </div>
                      
                      <a href="https://sellqo.lovable.app/admin/settings/billing" style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Upgrade naar ${planName} →
                      </a>
                      
                      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 24px 0;">
                      
                      <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                        Je ontvangt deze email omdat je een actieve proefperiode hebt.
                        <br><br>
                        Met vriendelijke groet,<br>
                        <strong>${tenantName}</strong>
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          const emailResponse = await resend.emails.send({
            from: `${tenantName} <noreply@sellqo.app>`,
            to: [tenant.owner_email],
            subject: `⏰ Je proefperiode eindigt morgen`,
            html: htmlContent,
          });

          logStep("Email sent", { tenant_id: trial.tenant_id, email: tenant.owner_email, response: emailResponse });
        } catch (emailErr) {
          logStep("Error sending email", { error: String(emailErr), tenant_id: trial.tenant_id });
        }
      }

      // 3. Mark warning as sent
      const { error: updateError } = await supabase
        .from("tenant_subscriptions")
        .update({ trial_warning_sent_at: new Date().toISOString() })
        .eq("id", trial.id);

      if (updateError) {
        logStep("Error updating trial_warning_sent_at", { error: updateError.message, subscription_id: trial.id });
      } else {
        warningsSent++;
        logStep("Warning marked as sent", { subscription_id: trial.id });
      }
    }

    logStep("Completed", { warnings_sent: warningsSent });

    return new Response(JSON.stringify({ 
      warnings_sent: warningsSent,
      tenant_ids: expiringTrials.map(t => t.tenant_id),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

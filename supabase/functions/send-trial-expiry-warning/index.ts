import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";

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
          const planName = trial.plan_id.charAt(0).toUpperCase() + trial.plan_id.slice(1);
          const billingUrl = "https://sellqo.lovable.app/admin/settings/billing";

          const introHtml = `
            <p style="margin:0 0 12px;">Hoi,</p>
            <p style="margin:0 0 12px;">
              Je proefperiode van het ${planName}-plan voor <strong>${tenantName}</strong>
              eindigt op <strong>${formattedDate}</strong>.
            </p>
            <p style="margin:0;">
              Daarna gaat je account automatisch over naar het gratis plan en zijn
              sommige features tijdelijk niet meer beschikbaar tot je upgrade.
            </p>
          `;

          const htmlContent = renderSellqoEmail({
            preheader: `Je ${planName}-proefperiode voor ${tenantName} eindigt morgen.`,
            heading: `Je ${planName}-proefperiode eindigt morgen`,
            intro: introHtml,
            infoBox: {
              title: "✅ Je data blijft bewaard",
              subtitle: "Al je producten, bestellingen, klanten en instellingen blijven behouden. Bij een latere upgrade heb je meteen weer toegang tot alles.",
            },
            cta: { label: `Upgrade naar ${planName}`, url: billingUrl },
            ctaNote: "Je ontvangt deze e-mail omdat je een actieve proefperiode hebt.",
          });
          const textContent = htmlToPlainText(htmlContent);

          const emailResponse = await resend.emails.send({
            from: "SellQo <noreply@sellqo.app>",
            reply_to: "support@sellqo.app",
            to: [tenant.owner_email],
            subject: `Je proefperiode voor ${tenantName} eindigt morgen`,
            html: htmlContent,
            text: textContent,
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

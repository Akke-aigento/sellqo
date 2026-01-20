import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaign_id, batch_size = 50 } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*, segment:customer_segments(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant info for email personalization
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, email, street, city, postal_code, country")
      .eq("id", campaign.tenant_id)
      .single();

    // Build recipient query
    let recipientQuery = supabase
      .from("customers")
      .select("id, email, first_name, last_name, company_name")
      .eq("tenant_id", campaign.tenant_id)
      .eq("email_subscribed", true);

    // Apply segment filters if segment exists
    if (campaign.segment?.filter_rules) {
      const rules = campaign.segment.filter_rules;
      if (rules.customer_type && rules.customer_type !== "all") {
        recipientQuery = recipientQuery.eq("customer_type", rules.customer_type);
      }
      if (rules.countries?.length) {
        recipientQuery = recipientQuery.in("billing_country", rules.countries);
      }
      if (rules.min_orders) {
        recipientQuery = recipientQuery.gte("total_orders", rules.min_orders);
      }
      if (rules.min_total_spent) {
        recipientQuery = recipientQuery.gte("total_spent", rules.min_total_spent);
      }
    }

    // Check for unsubscribes
    const { data: unsubscribes } = await supabase
      .from("email_unsubscribes")
      .select("email")
      .eq("tenant_id", campaign.tenant_id);

    const unsubscribedEmails = new Set((unsubscribes || []).map((u) => u.email.toLowerCase()));

    const { data: recipients } = await recipientQuery.limit(batch_size);

    if (!recipients?.length) {
      // Update campaign as sent if no recipients
      await supabase
        .from("email_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString(), completed_at: new Date().toISOString() })
        .eq("id", campaign_id);

      return new Response(JSON.stringify({ sent: 0, message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out unsubscribed
    const validRecipients = recipients.filter(
      (r) => !unsubscribedEmails.has(r.email.toLowerCase())
    );

    // Update campaign status to sending
    await supabase
      .from("email_campaigns")
      .update({ status: "sending", total_recipients: validRecipients.length })
      .eq("id", campaign_id);

    let sentCount = 0;
    const companyAddress = tenant ? `${tenant.street || ""}, ${tenant.postal_code || ""} ${tenant.city || ""}` : "";

    for (const recipient of validRecipients) {
      const customerName = recipient.first_name || recipient.company_name || "Klant";
      
      // Replace template variables
      let htmlContent = campaign.html_content
        .replace(/\{\{customer_name\}\}/g, customerName)
        .replace(/\{\{customer_email\}\}/g, recipient.email)
        .replace(/\{\{company_name\}\}/g, tenant?.name || "")
        .replace(/\{\{company_address\}\}/g, companyAddress)
        .replace(/\{\{unsubscribe_url\}\}/g, `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(recipient.email)}&tenant=${campaign.tenant_id}`);

      try {
        const emailResponse = await resend.emails.send({
          from: tenant?.email ? `${tenant.name} <${tenant.email}>` : "noreply@resend.dev",
          to: [recipient.email],
          subject: campaign.subject.replace(/\{\{customer_name\}\}/g, customerName),
          html: htmlContent,
        });

        // Create campaign_send record
        await supabase.from("campaign_sends").insert({
          campaign_id,
          customer_id: recipient.id,
          email: recipient.email,
          customer_name: customerName,
          status: "sent",
          resend_id: emailResponse.data?.id,
          sent_at: new Date().toISOString(),
        });

        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send to ${recipient.email}:`, emailError);
        await supabase.from("campaign_sends").insert({
          campaign_id,
          customer_id: recipient.id,
          email: recipient.email,
          customer_name: customerName,
          status: "bounced",
          error_message: emailError.message,
        });
      }
    }

    // Update campaign stats
    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        total_sent: sentCount,
      })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ sent: sentCount, total: validRecipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-campaign-batch:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail } from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";
import { extractEmailBody, buildVariableMap, applyVariables } from "../_shared/emailContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);

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

    requireRole(auth, campaign.tenant_id, ["tenant_admin", "staff", "marketing"]);

    // Get tenant info for email personalization
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, email, owner_email, phone, custom_domain, iban, street, city, postal_code, country")
      .eq("id", campaign.tenant_id)
      .single();
    const marketingSender = EMAIL_SENDERS.marketing(tenant?.name || 'Sellqo', (tenant as any)?.email || (tenant as any)?.owner_email);
    const brand = await getTenantBrand(supabase, campaign.tenant_id);
    const locale = brand.defaultLocale;

    // Build recipient query
    let recipientQuery = supabase
      .from("customers")
      .select("id, email, first_name, last_name, company_name, phone, vat_number, billing_city, billing_country, total_orders, total_spent, tags, created_at")
      .eq("tenant_id", campaign.tenant_id)
      .eq("email_subscribed", true);

    // Apply segment filters if segment exists
    if (campaign.segment?.filter_rules) {
      const rules = campaign.segment.filter_rules as Record<string, unknown>;
      if (rules.customer_type && rules.customer_type !== "all") {
        recipientQuery = recipientQuery.eq("customer_type", rules.customer_type as string);
      }
      if (Array.isArray(rules.countries) && rules.countries.length) {
        recipientQuery = recipientQuery.in("billing_country", rules.countries as string[]);
      }
      if (typeof rules.min_orders === "number") {
        recipientQuery = recipientQuery.gte("total_orders", rules.min_orders);
      }
      if (typeof rules.max_orders === "number") {
        recipientQuery = recipientQuery.lte("total_orders", rules.max_orders);
      }
      if (typeof rules.min_total_spent === "number") {
        recipientQuery = recipientQuery.gte("total_spent", rules.min_total_spent);
      }
      if (typeof rules.max_total_spent === "number") {
        recipientQuery = recipientQuery.lte("total_spent", rules.max_total_spent);
      }
      if (rules.email_subscribed === false) {
        // Anti-spam law: never send to unsubscribed users. Ignore this rule
        // and keep the base .eq("email_subscribed", true) guard.
        console.warn(`Campaign ${campaign_id}: segment rule email_subscribed=false ignored (base guard enforced)`);
      }
      if (Array.isArray(rules.tags) && rules.tags.length) {
        const tagsMatch = rules.tags_match === "all" ? "contains" : "overlaps";
        if (tagsMatch === "contains") {
          recipientQuery = recipientQuery.contains("tags", rules.tags as string[]);
        } else {
          recipientQuery = recipientQuery.overlaps("tags", rules.tags as string[]);
        }
      }
      if (typeof rules.created_after === "string") {
        recipientQuery = recipientQuery.gte("created_at", rules.created_after);
      }
      if (typeof rules.created_before === "string") {
        recipientQuery = recipientQuery.lte("created_at", rules.created_before);
      }
      if (rules.last_order_days_ago !== undefined || rules.no_order_since_days !== undefined || rules.min_engagement_score !== undefined) {
        // No column available on customers for these rules; the segment
        // preview also skips them, so parity is maintained.
        console.warn(`Campaign ${campaign_id}: unsupported filter fields skipped`);
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

    for (const recipient of validRecipients) {
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(recipient.email)}&tenant=${campaign.tenant_id}`;
      const vars = buildVariableMap(recipient, tenant, { subject: campaign.subject }, unsubscribeUrl);
      const customerName = vars.customer_name;

      // Backwards compat: legacy campaigns stored full HTML documents with a
      // built-in unsubscribe footer. Extract the body so we don't double-wrap
      // or double-render the footer.
      const rawBody = extractEmailBody(campaign.html_content || "");
      const htmlContent = applyVariables(rawBody, vars);
      const renderedSubject = applyVariables(campaign.subject || "", vars);

      const { html: wrappedHtml, text: wrappedText } = renderTenantEmail({
        tenantBrand: brand,
        locale,
        preheader: renderedSubject,
        heading: renderedSubject,
        intro: htmlContent,
        unsubscribeUrl, // MANDATORY for marketing (anti-spam law)
        poweredByLabel: t(locale, 'campaign.poweredBy'),
      });

      try {
        const emailResponse = await resend.emails.send({
          from: marketingSender.from,
          reply_to: marketingSender.replyTo,
          to: [recipient.email],
          subject: renderedSubject,
          html: wrappedHtml,
          text: wrappedText,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
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
          error_message: emailError instanceof Error ? emailError.message : String(emailError),
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
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

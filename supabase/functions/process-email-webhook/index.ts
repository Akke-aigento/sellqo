import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: {
      link: string;
      timestamp: string;
      user_agent?: string;
      ip_address?: string;
    };
  };
}

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
    const payload: ResendWebhookPayload = await req.json();
    console.log("Received webhook:", payload.type, payload.data.email_id);

    const resendId = payload.data.email_id;
    const eventType = payload.type;

    const { data: send, error: sendError } = await supabase
      .from("campaign_sends")
      .select("id, campaign_id, customer_id, status, link_clicks")
      .eq("resend_id", resendId)
      .maybeSingle();

    if (sendError) {
      console.error("Error finding campaign send:", sendError);
      throw sendError;
    }

    if (!send) {
      console.log("No campaign send found for resend_id:", resendId);
      return new Response(JSON.stringify({ message: "Send not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    switch (eventType) {
      case "email.delivered":
        await supabase
          .from("campaign_sends")
          .update({ status: "delivered", delivered_at: now })
          .eq("id", send.id);

        await supabase.rpc("increment_campaign_delivered", { p_campaign_id: send.campaign_id });
        break;

      case "email.opened":
        if (send.status !== "opened" && send.status !== "clicked") {
          await supabase
            .from("campaign_sends")
            .update({ status: "opened", opened_at: now, first_opened_at: now })
            .eq("id", send.id);

           await supabase.rpc("increment_campaign_opened", { p_campaign_id: send.campaign_id });

          // Write to customer_events for unified timeline
          if (send.customer_id) {
            const { data: campaign } = await supabase
              .from("email_campaigns")
              .select("tenant_id, name")
              .eq("id", send.campaign_id)
              .single();

            if (campaign) {
              await supabase.from("customer_events").insert({
                tenant_id: campaign.tenant_id,
                customer_id: send.customer_id,
                event_type: "email_open",
                event_data: {
                  campaign_id: send.campaign_id,
                  campaign_name: campaign.name,
                  subject: payload.data.subject,
                },
              });
            }

            const { data: customer } = await supabase
              .from("customers")
              .select("email_engagement_score")
              .eq("id", send.customer_id)
              .maybeSingle();

            await supabase
              .from("customers")
              .update({
                email_engagement_score: (customer?.email_engagement_score || 0) + 5,
                last_email_opened_at: now,
              })
              .eq("id", send.customer_id);
          }
        }
        break;

      case "email.clicked":
        const clickData = payload.data.click;

        if (clickData?.link) {
          const { data: campaign } = await supabase
            .from("email_campaigns")
            .select("tenant_id, name")
            .eq("id", send.campaign_id)
            .single();

          if (campaign) {
            await supabase.from("campaign_link_clicks").insert({
              campaign_id: send.campaign_id,
              send_id: send.id,
              customer_id: send.customer_id,
              tenant_id: campaign.tenant_id,
              link_url: clickData.link,
              clicked_at: clickData.timestamp || now,
              user_agent: clickData.user_agent,
            });

            // Write to customer_events for unified timeline
            if (send.customer_id) {
              await supabase.from("customer_events").insert({
                tenant_id: campaign.tenant_id,
                customer_id: send.customer_id,
                event_type: "email_click",
                event_data: {
                  campaign_id: send.campaign_id,
                  campaign_name: campaign.name,
                  link_url: clickData.link,
                },
              });
            }
          }
        }

        if (send.status !== "clicked") {
          await supabase
            .from("campaign_sends")
            .update({
              status: "clicked",
              clicked_at: now,
              first_clicked_at: now,
              link_clicks: (send.link_clicks || 0) + 1,
            })
            .eq("id", send.id);

          await supabase.rpc("increment_campaign_clicked", { p_campaign_id: send.campaign_id });

          if (send.customer_id) {
            const { data: customer } = await supabase
              .from("customers")
              .select("email_engagement_score")
              .eq("id", send.customer_id)
              .maybeSingle();

            await supabase
              .from("customers")
              .update({ email_engagement_score: (customer?.email_engagement_score || 0) + 10 })
              .eq("id", send.customer_id);
          }
        } else {
          await supabase
            .from("campaign_sends")
            .update({ link_clicks: (send.link_clicks || 0) + 1 })
            .eq("id", send.id);
        }
        break;

      case "email.bounced":
        await supabase
          .from("campaign_sends")
          .update({ status: "bounced", bounced_at: now, error_message: "Email bounced" })
          .eq("id", send.id);

        await supabase.rpc("increment_campaign_bounced", { p_campaign_id: send.campaign_id });

        if (send.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("email_engagement_score")
            .eq("id", send.customer_id)
            .maybeSingle();

          await supabase
            .from("customers")
            .update({
              email_engagement_score: Math.max(0, (customer?.email_engagement_score || 0) - 15),
            })
            .eq("id", send.customer_id);
        }
        break;

      case "email.complained":
        const { data: campaignData } = await supabase
          .from("email_campaigns")
          .select("tenant_id")
          .eq("id", send.campaign_id)
          .single();

        if (campaignData && send.customer_id) {
          await supabase.from("email_unsubscribes").insert({
            tenant_id: campaignData.tenant_id,
            customer_id: send.customer_id,
            email: payload.data.to[0],
            reason: "Marked as spam",
            campaign_id: send.campaign_id,
          });

          await supabase
            .from("customers")
            .update({ email_subscribed: false, email_engagement_score: 0 })
            .eq("id", send.customer_id);
        }
        break;

      default:
        console.log("Unhandled event type:", eventType);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

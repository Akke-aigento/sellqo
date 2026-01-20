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
    // For click events
    click?: {
      link: string;
      timestamp: string;
      user_agent?: string;
      ip_address?: string;
    };
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
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

    // Parse webhook payload
    const payload: ResendWebhookPayload = await req.json();
    console.log("Received webhook:", payload.type, payload.data.email_id);

    const resendId = payload.data.email_id;
    const eventType = payload.type;

    // Find the campaign send by resend_id
    const { data: send, error: sendError } = await supabase
      .from("campaign_sends")
      .select("id, campaign_id, customer_id, status")
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
          .update({
            status: "delivered",
            delivered_at: now,
          })
          .eq("id", send.id);

        // Update campaign totals
        await supabase.rpc("increment_campaign_delivered", {
          p_campaign_id: send.campaign_id,
        });
        break;

      case "email.opened":
        // Only update if not already opened (first open)
        if (send.status !== "opened" && send.status !== "clicked") {
          await supabase
            .from("campaign_sends")
            .update({
              status: "opened",
              opened_at: now,
              first_opened_at: now,
            })
            .eq("id", send.id);

          // Update campaign totals
          await supabase.rpc("increment_campaign_opened", {
            p_campaign_id: send.campaign_id,
          });

          // Update customer engagement score
          if (send.customer_id) {
            await supabase
              .from("customers")
              .update({
                email_engagement_score: supabase.sql`COALESCE(email_engagement_score, 0) + 5`,
                last_email_opened_at: now,
              })
              .eq("id", send.customer_id);
          }
        }
        break;

      case "email.clicked":
        const clickData = payload.data.click;
        
        // Always log the link click
        if (clickData?.link) {
          // Get tenant_id from campaign
          const { data: campaign } = await supabase
            .from("email_campaigns")
            .select("tenant_id")
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
          }
        }

        // Update send status to clicked (first click)
        if (send.status !== "clicked") {
          await supabase
            .from("campaign_sends")
            .update({
              status: "clicked",
              clicked_at: now,
              first_clicked_at: now,
              link_clicks: supabase.sql`COALESCE(link_clicks, 0) + 1`,
            })
            .eq("id", send.id);

          // Update campaign totals
          await supabase.rpc("increment_campaign_clicked", {
            p_campaign_id: send.campaign_id,
          });

          // Update customer engagement score
          if (send.customer_id) {
            await supabase
              .from("customers")
              .update({
                email_engagement_score: supabase.sql`COALESCE(email_engagement_score, 0) + 10`,
              })
              .eq("id", send.customer_id);
          }
        } else {
          // Just increment link clicks count
          await supabase
            .from("campaign_sends")
            .update({
              link_clicks: supabase.sql`COALESCE(link_clicks, 0) + 1`,
            })
            .eq("id", send.id);
        }
        break;

      case "email.bounced":
        await supabase
          .from("campaign_sends")
          .update({
            status: "bounced",
            bounced_at: now,
            error_message: "Email bounced",
          })
          .eq("id", send.id);

        // Update campaign totals
        await supabase.rpc("increment_campaign_bounced", {
          p_campaign_id: send.campaign_id,
        });

        // Reduce customer engagement score
        if (send.customer_id) {
          await supabase
            .from("customers")
            .update({
              email_engagement_score: supabase.sql`GREATEST(0, COALESCE(email_engagement_score, 0) - 15)`,
            })
            .eq("id", send.customer_id);
        }
        break;

      case "email.complained":
        // User marked as spam - auto unsubscribe
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
            .update({
              email_subscribed: false,
              email_engagement_score: 0,
            })
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

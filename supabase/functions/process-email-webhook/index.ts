import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { rejectUnlessSvix } from "../_shared/webhookAuth.ts";

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
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
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
    // WEBHOOK-SIG-1: de svix-headers stonden al in CORS, maar werden nergens
    // gecontroleerd. Nu wel, en zonder secret gaat niets door.
    const rawBody = await req.text();
    const denied = await rejectUnlessSvix(req, rawBody, "RESEND_EVENTS_WEBHOOK_SECRET", corsHeaders);
    if (denied) return denied;

    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    console.log("Received webhook:", payload.type, payload.data.email_id);

    const resendId = payload.data.email_id;
    const eventType = payload.type;

    const { data: send, error: sendError } = await supabase
      .from("campaign_sends")
      .select("id, campaign_id, customer_id, email, status, link_clicks")
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

    // MAIL-1a — idempotentie: Resend levert webhooks "at least once". Een teller
    // gaat enkel omhoog als deze update de rij echt van toestand doet veranderen
    // (de `is null`-voorwaarde faalt bij een herhaalde levering → geen rij terug).
    const transition = async (
      patch: Record<string, unknown>,
      nullColumn: string,
    ): Promise<boolean> => {
      const { data, error } = await supabase
        .from("campaign_sends")
        .update(patch)
        .eq("id", send.id)
        .is(nullColumn, null)
        .select("id");
      if (error) {
        console.error(`[process-email-webhook] update campaign_sends (${nullColumn}) mislukt`, error);
        return false;
      }
      return (data?.length ?? 0) > 0;
    };

    const loadCampaign = async () => {
      const { data } = await supabase
        .from("email_campaigns")
        .select("tenant_id, name")
        .eq("id", send.campaign_id)
        .maybeSingle();
      return data as { tenant_id: string; name: string | null } | null;
    };

    const recipientEmail = String(send.email || payload.data.to?.[0] || "").trim().toLowerCase();

    /**
     * MAIL-1a — harde bounce of klacht: het adres komt op de uitschrijflijst van
     * de winkel en de klant wordt uitgeschreven. Upsert op (tenant_id, email):
     * de oude insert faalde op de unieke sleutel zodra het adres er al stond.
     */
    const suppress = async (reason: "bounce" | "complaint", extraCustomerPatch: Record<string, unknown> = {}) => {
      const campaign = await loadCampaign();
      if (!campaign?.tenant_id || !recipientEmail) {
        console.warn("[process-email-webhook] kan niet onderdrukken: tenant of adres ontbreekt", { sendId: send.id, reason });
        return;
      }
      const { error: unsubError } = await supabase.from("email_unsubscribes").upsert({
        tenant_id: campaign.tenant_id,
        customer_id: send.customer_id ?? null,
        email: recipientEmail,
        reason,
        campaign_id: send.campaign_id,
        unsubscribed_at: now,
      }, { onConflict: "tenant_id,email" });
      if (unsubError) console.error("[process-email-webhook] email_unsubscribes upsert mislukt", unsubError);

      const escaped = recipientEmail.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { error: custError } = await supabase
        .from("customers")
        .update({ email_subscribed: false, ...extraCustomerPatch })
        .eq("tenant_id", campaign.tenant_id)
        .ilike("email", escaped);
      if (custError) console.error("[process-email-webhook] customers update mislukt", custError);
    };

    switch (eventType) {
      case "email.delivered": {
        // Status niet terugzetten als opened/clicked al eerder binnenkwam (events komen in willekeurige volgorde).
        const deliveredPatch: Record<string, unknown> = { delivered_at: now };
        if (send.status === "sent" || send.status === "sending" || !send.status) deliveredPatch.status = "delivered";
        const changed = await transition(deliveredPatch, "delivered_at");
        if (changed) {
          await supabase.rpc("increment_campaign_delivered", { p_campaign_id: send.campaign_id });
        }
        break;
      }

      case "email.opened": {
        // Status enkel vooruit zetten (niet terug van clicked naar opened).
        const patch: Record<string, unknown> = { opened_at: now, first_opened_at: now };
        if (send.status !== "clicked") patch.status = "opened";
        const changed = await transition(patch, "opened_at");

        if (changed) {
          await supabase.rpc("increment_campaign_opened", { p_campaign_id: send.campaign_id });

          // Write to customer_events for unified timeline
          if (send.customer_id) {
            const campaign = await loadCampaign();

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
      }

      case "email.clicked": {
        const clickData = payload.data.click;

        if (clickData?.link) {
          const campaign = await loadCampaign();

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

        const changed = await transition({
          status: "clicked",
          clicked_at: now,
          first_clicked_at: now,
          link_clicks: (send.link_clicks || 0) + 1,
        }, "clicked_at");

        if (changed) {
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
      }

      case "email.bounced": {
        // Resend: data.bounce.type = "Permanent" | "Transient" | "Undetermined".
        // Alles wat niet expliciet tijdelijk is, behandelen we als harde bounce.
        const bounceType = String(payload.data.bounce?.type ?? "").toLowerCase();
        const isTransient = bounceType === "transient" || bounceType.includes("temporar");

        const changed = await transition(
          {
            status: "bounced",
            bounced_at: now,
            error_message: isTransient ? "Email bounced (tijdelijk)" : "Email bounced",
          },
          "bounced_at",
        );

        if (changed) {
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
        }

        // Onderdrukken is idempotent (upsert), dus ook bij een herhaalde levering veilig.
        if (!isTransient) await suppress("bounce");
        break;
      }

      case "email.complained":
        await suppress("complaint", { email_engagement_score: 0 });
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

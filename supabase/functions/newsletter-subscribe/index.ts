import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscribeRequest {
  tenantId: string;
  email: string;
  firstName?: string;
  source?: string;
}

interface SyncResult {
  synced: boolean;
  provider: string;
  externalId?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenantId, email, firstName, source = "website" }: SubscribeRequest = await req.json();

    if (!tenantId || !email) {
      return new Response(
        JSON.stringify({ error: "tenantId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already subscribed
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === "active") {
        return new Response(
          JSON.stringify({ success: true, message: "Already subscribed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Reactivate if previously unsubscribed
      await supabase
        .from("newsletter_subscribers")
        .update({ 
          status: "pending", 
          sync_status: "pending",
          unsubscribed_at: null,
          subscribed_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      // Insert new subscriber
      const { error: insertError } = await supabase
        .from("newsletter_subscribers")
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          first_name: firstName || null,
          source,
          status: "pending",
          sync_status: "pending",
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
    }

    // Get tenant newsletter config
    const { data: config } = await supabase
      .from("tenant_newsletter_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const provider = config?.provider || "internal";
    let syncResult: SyncResult = { synced: false, provider };

    // Sync to external provider if configured
    if (provider === "mailchimp" && config?.mailchimp_api_key && config?.mailchimp_audience_id) {
      syncResult = await syncToMailchimp(
        email,
        firstName,
        config.mailchimp_api_key,
        config.mailchimp_server_prefix || "",
        config.mailchimp_audience_id,
        config.double_optin
      );
    } else if (provider === "klaviyo" && config?.klaviyo_api_key && config?.klaviyo_list_id) {
      syncResult = await syncToKlaviyo(
        email,
        firstName,
        config.klaviyo_api_key,
        config.klaviyo_list_id,
        config.double_optin
      );
    }

    // Update sync status
    const updateData: Record<string, unknown> = {
      status: syncResult.synced || provider === "internal" ? "active" : "pending",
      sync_status: syncResult.synced ? "synced" : provider === "internal" ? "synced" : "pending",
      confirmed_at: !config?.double_optin ? new Date().toISOString() : null,
    };

    if (syncResult.error) {
      updateData.sync_status = "failed";
      updateData.sync_error = syncResult.error;
    }

    if (syncResult.externalId) {
      updateData.external_id = syncResult.externalId;
    }

    await supabase
      .from("newsletter_subscribers")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .eq("email", email.toLowerCase());

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: config?.double_optin ? "Please check your email to confirm" : "Successfully subscribed",
        provider: syncResult.provider,
        synced: syncResult.synced
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Newsletter subscribe error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to subscribe";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncToMailchimp(
  email: string,
  firstName: string | undefined,
  apiKey: string,
  serverPrefix: string,
  audienceId: string,
  doubleOptin: boolean
): Promise<SyncResult> {
  try {
    // Extract server prefix from API key if not provided
    const server = serverPrefix || apiKey.split("-").pop();
    
    const response = await fetch(
      `https://${server}.api.mailchimp.com/3.0/lists/${audienceId}/members`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`anystring:${apiKey}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          status: doubleOptin ? "pending" : "subscribed",
          merge_fields: firstName ? { FNAME: firstName } : {},
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { synced: true, provider: "mailchimp", externalId: data.id };
    } else {
      const errorData = await response.json();
      // Member already exists is not an error
      if (errorData.title === "Member Exists") {
        return { synced: true, provider: "mailchimp" };
      }
      console.error("Mailchimp error:", errorData);
      return { synced: false, provider: "mailchimp", error: errorData.detail || errorData.title };
    }
  } catch (error: unknown) {
    console.error("Mailchimp sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { synced: false, provider: "mailchimp", error: errorMessage };
  }
}

async function syncToKlaviyo(
  email: string,
  firstName: string | undefined,
  apiKey: string,
  listId: string,
  doubleOptin: boolean
): Promise<SyncResult> {
  try {
    // Klaviyo API v2023-02-22
    const response = await fetch(
      `https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/`,
      {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${apiKey}`,
          "Content-Type": "application/json",
          "revision": "2023-02-22",
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: {
                      email: email,
                      first_name: firstName || undefined,
                      subscriptions: {
                        email: {
                          marketing: {
                            consent: doubleOptin ? "PENDING_DOUBLE_OPT_IN" : "SUBSCRIBED",
                          },
                        },
                      },
                    },
                  },
                ],
              },
              historical_import: false,
            },
            relationships: {
              list: {
                data: {
                  type: "list",
                  id: listId,
                },
              },
            },
          },
        }),
      }
    );

    if (response.ok || response.status === 202) {
      return { synced: true, provider: "klaviyo" };
    } else {
      const errorData = await response.json();
      console.error("Klaviyo error:", errorData);
      return { synced: false, provider: "klaviyo", error: JSON.stringify(errorData.errors?.[0]?.detail || errorData) };
    }
  } catch (error: unknown) {
    console.error("Klaviyo sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { synced: false, provider: "klaviyo", error: errorMessage };
  }
}

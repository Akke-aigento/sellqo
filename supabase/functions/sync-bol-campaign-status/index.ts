import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/retailer/advertising/v11";

async function getBolAdvertisingToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(BOL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bol token failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function bolApi(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BOL_ADV_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.retailer.v11+json",
      "Content-Type": "application/vnd.retailer.v11+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Bol API ${method} ${path} (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaigns with platform_campaign_id
    const { data: campaigns } = await supabase
      .from("ad_campaigns")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("platform", "bol_ads")
      .not("platform_campaign_id", "is", null);

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ message: "No Bol campaigns to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get advertising credentials
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("id, credentials")
      .eq("tenant_id", tenantId)
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);

    const bolConnection = connections?.find((c: any) => {
      const creds = c.credentials as any;
      return creds?.advertisingClientId && creds?.advertisingClientSecret;
    });

    if (!bolConnection) {
      return new Response(
        JSON.stringify({ error: "No Bol advertising credentials" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creds = bolConnection.credentials as any;
    const bolToken = await getBolAdvertisingToken(
      creds.advertisingClientId,
      creds.advertisingClientSecret
    );

    // Fetch campaign list from Bol
    const campaignIds = campaigns
      .map((c: any) => c.platform_campaign_id)
      .filter(Boolean);

    let synced = 0;

    // Get campaigns from Bol (filter by IDs)
    try {
      const bolCampaigns = await bolApi(bolToken, "PUT", "/sponsored-products/campaigns/list", {
        campaignIds: campaignIds.map((id: string) => parseInt(id, 10)).filter((n: number) => !isNaN(n)),
      });

      const bolCampaignMap = new Map<string, any>();
      for (const bc of bolCampaigns?.campaigns || []) {
        bolCampaignMap.set(String(bc.campaignId), bc);
      }

      // Update each local campaign
      for (const campaign of campaigns) {
        const bolCampaign = bolCampaignMap.get(campaign.platform_campaign_id);
        if (!bolCampaign) continue;

        const statusMap: Record<string, string> = {
          ENABLED: "active",
          PAUSED: "paused",
          ARCHIVED: "ended",
          ENDED: "ended",
        };

        const newStatus = statusMap[bolCampaign.state] || campaign.status;

        await supabase
          .from("ad_campaigns")
          .update({
            platform_status: bolCampaign.state?.toLowerCase(),
            status: newStatus,
            // Budget sync
            budget_amount: bolCampaign.dailyBudget?.amount || campaign.budget_amount,
          })
          .eq("id", campaign.id);

        synced++;
      }
    } catch (e) {
      console.error("Campaign list fetch failed:", e);
    }

    // TODO: Fetch performance stats via /sponsored-products/campaigns/performance endpoint
    // This requires date range params and returns impressions, clicks, spend, conversions

    return new Response(
      JSON.stringify({ success: true, synced, total: campaigns.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-bol-campaign-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

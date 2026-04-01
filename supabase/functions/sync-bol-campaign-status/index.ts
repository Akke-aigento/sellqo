import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/advertiser/sponsored-products/campaign-management";
const BOL_INSIGHTS_BASE = "https://api.bol.com/advertiser/sponsored-products/insights";

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

async function bolApi(token: string, method: string, url: string, body?: unknown) {
  console.log(`bolApi ${method} ${url}`);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.advertiser.v11+json",
      "Content-Type": "application/vnd.advertiser.v11+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  console.log(`bolApi response ${res.status}: ${text.substring(0, 500)}`);
  if (!res.ok && res.status !== 207) {
    throw new Error(`Bol API ${method} (${res.status}): ${text}`);
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

    const campaignIds = campaigns
      .map((c: any) => c.platform_campaign_id)
      .filter(Boolean);

    const numericIds = campaignIds
      .map((id: string) => parseInt(id, 10))
      .filter((n: number) => !isNaN(n));

    let synced = 0;

    // Step 1: Sync campaign statuses
    try {
      const bolCampaigns = await bolApi(
        bolToken,
        "POST",
        `${BOL_ADV_BASE}/campaigns/list`,
        { campaignIds: numericIds }
      );

      const bolCampaignMap = new Map<string, any>();
      const campaignList = bolCampaigns?.campaigns || bolCampaigns?.success || [];
      for (const bc of campaignList) {
        bolCampaignMap.set(String(bc.campaignId), bc);
      }

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
            budget_amount: bolCampaign.dailyBudget?.amount || campaign.budget_amount,
          })
          .eq("id", campaign.id);

        synced++;
      }
    } catch (e) {
      console.error("Campaign list fetch failed:", e);
    }

    // Step 2: Fetch performance insights (last 30 days)
    let insightsSynced = 0;
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const insightsResponse = await bolApi(
        bolToken,
        "POST",
        `${BOL_INSIGHTS_BASE}/campaigns`,
        {
          campaignIds: numericIds,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        }
      );

      console.log("Insights response keys:", Object.keys(insightsResponse || {}));

      // Parse insights — structure may be { campaignInsights: [...] } or similar
      const insightsList =
        insightsResponse?.campaignInsights ||
        insightsResponse?.campaigns ||
        insightsResponse?.insights ||
        [];

      const insightsMap = new Map<string, any>();
      for (const insight of insightsList) {
        const cId = String(insight.campaignId);
        if (!insightsMap.has(cId)) {
          insightsMap.set(cId, { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
        }
        const agg = insightsMap.get(cId)!;

        // Handle daily breakdown or aggregate
        const days = insight.days || insight.daily || [insight];
        for (const day of days) {
          agg.impressions += day.impressions || 0;
          agg.clicks += day.clicks || 0;
          agg.spend += day.cost || day.spend || 0;
          agg.conversions += day.conversions || day.orders || 0;
          agg.revenue += day.revenue || day.turnover || 0;
        }
      }

      // Update campaigns with real performance data
      for (const campaign of campaigns) {
        const metrics = insightsMap.get(campaign.platform_campaign_id!);
        if (!metrics) continue;

        const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : null;

        await supabase
          .from("ad_campaigns")
          .update({
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spend: Math.round(metrics.spend * 100) / 100,
            conversions: metrics.conversions,
            revenue: Math.round(metrics.revenue * 100) / 100,
            roas: roas ? Math.round(roas * 100) / 100 : null,
          })
          .eq("id", campaign.id);

        insightsSynced++;
      }
    } catch (e) {
      console.error("Insights fetch failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        insightsSynced,
        total: campaigns.length,
      }),
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

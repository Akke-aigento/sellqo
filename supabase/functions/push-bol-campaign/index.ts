import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/advertiser/sponsored-products/campaign-management";

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
    throw new Error(`Bol token request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function bolApi(
  token: string,
  method: string,
  path: string,
  body?: unknown
) {
  const url = `${BOL_ADV_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.advertiser.v11+json",
    "Content-Type": "application/vnd.advertiser.v11+json",
  };

  console.log(`[bolApi] ${method} ${url}`);
  if (body) console.log(`[bolApi] body:`, JSON.stringify(body));

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  console.log(`[bolApi] response ${res.status}:`, text);

  // Bol Advertising API returns 207 for multi-status responses
  if (!res.ok && res.status !== 207) {
    throw new Error(`Bol API ${method} ${path} failed (${res.status}): ${text}`);
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

    const { campaign_id, force_repush, action } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Get campaign
    const { data: campaign, error: campErr } = await supabase
      .from("ad_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (campaign.platform !== "bol_ads") {
      return new Response(
        JSON.stringify({ error: "Only bol_ads campaigns are supported" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Archive campaign on Bol (must be before "already pushed" check)
    if (action === 'archive' && campaign.platform_campaign_id) {
      // Need credentials for archive
      const { data: archConnections } = await supabase
        .from("marketplace_connections")
        .select("id, credentials")
        .eq("tenant_id", campaign.tenant_id)
        .eq("marketplace_type", "bol_com")
        .eq("is_active", true);

      const archBolConn = archConnections?.find((c: any) => {
        const cr = c.credentials as any;
        return cr?.advertisingClientId && cr?.advertisingClientSecret;
      });

      if (archBolConn) {
        const archCreds = archBolConn.credentials as any;
        const archToken = await getBolAdvertisingToken(archCreds.advertisingClientId, archCreds.advertisingClientSecret);
        try {
          const archiveResult = await bolApi(
            archToken,
            "PUT",
            `${BOL_ADV_BASE}/campaigns/${campaign.platform_campaign_id}`,
            { state: "ARCHIVED" }
          );
          console.log("Campaign archived on Bol:", JSON.stringify(archiveResult));
          return new Response(
            JSON.stringify({ success: true, archived: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e: any) {
          console.error("Failed to archive on Bol:", e);
          return new Response(
            JSON.stringify({ error: "Archiveren op Bol.com mislukt", detail: e.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Already pushed? Skip unless force_repush
    if (campaign.platform_campaign_id && !force_repush) {
      return new Response(
        JSON.stringify({
          success: true,
          already_pushed: true,
          platform_campaign_id: campaign.platform_campaign_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get Bol marketplace connection with advertising credentials
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("id, credentials")
      .eq("tenant_id", campaign.tenant_id)
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);

    const bolConnection = connections?.find((c: any) => {
      const creds = c.credentials as any;
      return creds?.advertisingClientId && creds?.advertisingClientSecret;
    });

    if (!bolConnection) {
      return new Response(
        JSON.stringify({
          error:
            "Geen Bol.com advertising credentials gevonden. Configureer deze eerst in je Bol.com connectie.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creds = bolConnection.credentials as any;

    // 3. Get advertising OAuth token
    const bolToken = await getBolAdvertisingToken(
      creds.advertisingClientId,
      creds.advertisingClientSecret
    );

    // (archive block moved above "already pushed" check)

    // 4. Get product EANs for the campaign
    let eans: string[] = [];
    if (campaign.product_ids && campaign.product_ids.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, barcode, bol_ean, name")
        .in("id", campaign.product_ids);

      eans = (products || [])
        .map((p: any) => p.bol_ean || p.barcode)
        .filter((e: string | null): e is string => !!e && !e.startsWith("'"));

      if (eans.length === 0) {
        return new Response(
          JSON.stringify({
            error:
              "Geen producten met EAN/barcode gevonden. Bol.com vereist EAN-nummers voor advertenties.",
            products_without_ean: (products || [])
              .filter((p: any) => !p.bol_ean && !p.barcode)
              .map((p: any) => p.name),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 5. Create campaign at Bol via POST /campaigns (bulk format)
    let bolCampaignId: string | null = null;

    // If force_repush, use existing campaign ID and skip to ad groups
    if (force_repush && campaign.platform_campaign_id) {
      bolCampaignId = campaign.platform_campaign_id;
      console.log("Force repush: using existing campaign ID:", bolCampaignId);
    }

    if (!bolCampaignId) {
      const isAuto = campaign.bid_strategy === "auto";
      const campaignType = isAuto ? "AUTO" : "MANUAL";

      const startDate =
        campaign.start_date ||
        new Date().toISOString().split("T")[0];

      const singleCampaign: any = {
        name: campaign.name,
        startDate,
        dailyBudget: {
          amount: campaign.budget_amount || 10,
          currency: "EUR",
        },
        targetCountries: ["NL", "BE"],
        targetChannels: ["DESKTOP", "MOBILE", "TABLET", "APP"],
        campaignType,
        state: "ENABLED",
      };

      if (campaign.end_date) {
        singleCampaign.endDate = campaign.end_date;
      }

      if (isAuto && campaign.target_roas) {
        singleCampaign.acosTargetPercentage = Math.round(
          (1 / campaign.target_roas) * 100
        );
      }

      const campaignPayload = { campaigns: [singleCampaign] };
      console.log("Creating Bol campaign (bulk):", JSON.stringify(campaignPayload));

      const createResult = await bolApi(
        bolToken,
        "POST",
        "/campaigns",
        campaignPayload
      );

      console.log("Bol campaign create result:", JSON.stringify(createResult));

      // Check for failures first
      const failures = createResult?.campaigns?.failure || [];
      if (failures.length > 0) {
        console.error("Campaign creation failures:", JSON.stringify(failures));
        return new Response(
          JSON.stringify({
            error: "Bol.com weigerde de campagne",
            details: failures,
            bol_response: createResult,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Extract campaign ID from bulk response
      bolCampaignId =
        createResult?.campaigns?.success?.[0]?.campaignId ||
        createResult?.campaigns?.[0]?.campaignId ||
        createResult?.campaignId ||
        createResult?.id;

      if (!bolCampaignId) {
        await supabase
          .from("ad_campaigns")
          .update({
            platform_status: "create_pending",
            status: "pending_approval",
          })
          .eq("id", campaign_id);

        return new Response(
          JSON.stringify({
            success: true,
            status: "pending",
            message:
              "Campagne aangemaakt bij Bol. Status wordt verwerkt. Check later opnieuw.",
            bol_response: createResult,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 6. Create ad group under campaign via POST /ad-groups (bulk format)
    let adGroupId: string | null = null;
    try {
      const adGroupPayload = {
        adGroups: [
          {
            campaignId: bolCampaignId,
            name: `${campaign.name} - Producten`,
            state: "ENABLED",
          },
        ],
      };

      console.log("Creating ad group (bulk):", JSON.stringify(adGroupPayload));

      const adGroupResult = await bolApi(
        bolToken,
        "POST",
        "/ad-groups",
        adGroupPayload
      );

      console.log("Ad group result:", JSON.stringify(adGroupResult));

      adGroupId =
        adGroupResult?.adGroups?.success?.[0]?.adGroupId ||
        adGroupResult?.adGroups?.[0]?.adGroupId ||
        adGroupResult?.adGroupId ||
        null;
      console.log("Ad group created:", adGroupId);
    } catch (e: any) {
      console.error("Ad group creation failed:", e);
      return new Response(
        JSON.stringify({
          error: "Ad group aanmaken mislukt bij Bol.com",
          detail: e.message,
          platform_campaign_id: bolCampaignId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Create ads (product targets) with EANs via POST /ads (bulk format)
    if (adGroupId && eans.length > 0) {
      try {
        const adsPayload = {
          ads: eans.map((ean) => ({
            adGroupId,
            ean,
            state: "ENABLED",
          })),
        };

        console.log("Creating ads (bulk):", JSON.stringify(adsPayload));
        const adsResult = await bolApi(bolToken, "POST", "/ads", adsPayload);
        console.log("Ads result:", JSON.stringify(adsResult));
      } catch (e: any) {
        console.error("Ad creation failed:", e);
        return new Response(
          JSON.stringify({
            error: "Ads aanmaken mislukt bij Bol.com",
            detail: e.message,
            platform_campaign_id: bolCampaignId,
            ad_group_id: adGroupId,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 8. Update local campaign with Bol IDs
    await supabase
      .from("ad_campaigns")
      .update({
        platform_campaign_id: String(bolCampaignId),
        platform_status: "enabled",
        status: "active",
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        platform_campaign_id: bolCampaignId,
        ad_group_id: adGroupId,
        eans_targeted: eans,
        steps_completed: ['campaign_created', 'adgroup_created', 'products_added'],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("push-bol-campaign error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

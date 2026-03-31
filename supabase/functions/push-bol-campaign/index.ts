import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/retailer/advertising/v11";

interface BolTokenResponse {
  access_token: string;
  expires_in: number;
}

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

  const data: BolTokenResponse = await res.json();
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
    Accept: "application/vnd.retailer.v11+json",
    "Content-Type": "application/vnd.retailer.v11+json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Bol API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const { campaign_id } = await req.json();
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

    // Already pushed?
    if (campaign.platform_campaign_id) {
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

    // 5. Create campaign at Bol
    const isAuto = campaign.bid_strategy === "auto";
    const campaignType = isAuto ? "AUTO" : "MANUAL";

    const startDate =
      campaign.start_date ||
      new Date().toISOString().split("T")[0];
    const bolCampaignPayload: any = {
      campaigns: [
        {
          name: campaign.name,
          startDate,
          dailyBudget: {
            amount: campaign.budget_amount || 10,
            currency: "EUR",
          },
          campaignType,
          state: "ENABLED",
        },
      ],
    };

    if (campaign.end_date) {
      bolCampaignPayload.campaigns[0].endDate = campaign.end_date;
    }

    // For AUTO campaigns with target ROAS
    if (isAuto && campaign.target_roas) {
      bolCampaignPayload.campaigns[0].acosTargetPercentage = Math.round(
        (1 / campaign.target_roas) * 100
      );
    }

    console.log(
      "Creating Bol campaign:",
      JSON.stringify(bolCampaignPayload)
    );

    const createResult = await bolApi(
      bolToken,
      "PUT",
      "/sponsored-products/campaigns",
      bolCampaignPayload
    );

    console.log("Bol campaign create result:", JSON.stringify(createResult));

    // Extract campaign ID from process status
    // Bol returns a process status with entity ID
    const bolCampaignId =
      createResult?.campaigns?.[0]?.campaignId ||
      createResult?.processStatusId ||
      createResult?.id;

    if (!bolCampaignId) {
      // Store response for debugging
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

    // 6. Create ad group under campaign
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

      const adGroupResult = await bolApi(
        bolToken,
        "PUT",
        "/sponsored-products/ad-groups",
        adGroupPayload
      );

      adGroupId =
        adGroupResult?.adGroups?.[0]?.adGroupId || null;
      console.log("Ad group created:", adGroupId);
    } catch (e) {
      console.error("Ad group creation failed:", e);
    }

    // 7. Create ads (product targets) with EANs
    if (adGroupId && eans.length > 0) {
      try {
        for (const ean of eans) {
          const adPayload = {
            ads: [
              {
                adGroupId,
                ean,
                state: "ENABLED",
              },
            ],
          };

          await bolApi(
            bolToken,
            "PUT",
            "/sponsored-products/ads",
            adPayload
          );
          console.log(`Ad created for EAN: ${ean}`);
        }
      } catch (e) {
        console.error("Ad creation failed:", e);
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

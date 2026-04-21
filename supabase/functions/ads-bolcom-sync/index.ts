import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/advertiser/sponsored-products/campaign-management";

const ADV_HEADERS = {
  Accept: "application/vnd.advertiser.v11+json",
  "Content-Type": "application/vnd.advertiser.v11+json",
};

async function getBolToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(BOL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function bolGet(token: string, url: string) {
  console.log(`GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...ADV_HEADERS },
  });
  const text = await res.text();
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok && res.status !== 207) throw new Error(`Bol API GET (${res.status}): ${text.substring(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function bolPost(token: string, url: string, body: unknown) {
  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...ADV_HEADERS },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok && res.status !== 207) throw new Error(`Bol API POST (${res.status}): ${text.substring(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    if (!tenantId) return jsonRes({ error: "tenant_id required" }, 400);

    // Get advertising credentials
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("id, credentials")
      .eq("tenant_id", tenantId)
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);

    const bolConn = connections?.find((c: any) => {
      const cr = c.credentials as any;
      return cr?.advertisingClientId && cr?.advertisingClientSecret;
    });
    if (!bolConn) return jsonRes({ error: "No Bol advertising credentials found" }, 400);

    const creds = bolConn.credentials as any;
    let token = await getBolToken(creds.advertisingClientId, creds.advertisingClientSecret);

    const withRetry = async <T>(fn: (t: string) => Promise<T>): Promise<T> => {
      try {
        return await fn(token);
      } catch (e: any) {
        if (e.message === "TOKEN_EXPIRED") {
          token = await getBolToken(creds.advertisingClientId, creds.advertisingClientSecret);
          return await fn(token);
        }
        throw e;
      }
    };

    let campaignsSynced = 0, adgroupsSynced = 0, keywordsSynced = 0, productsSynced = 0;

    // 1. Fetch all campaigns
    const campaignsRes = await withRetry(t => bolPost(t, `${BOL_ADV_BASE}/campaigns/list`, {}));
    const bolCampaigns = campaignsRes?.campaigns || [];

    const statusMap: Record<string, string> = {
      ENABLED: "active", PAUSED: "paused", ARCHIVED: "archived", ENDED: "ended",
    };

    for (const bc of bolCampaigns) {
      try {
        if (bc.state === "ARCHIVED" || bc.state === "ENDED") {
          // Defensive cleanup: remove any stale local row
          await supabase
            .from("ads_bolcom_campaigns")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("bolcom_campaign_id", String(bc.campaignId));
          continue;
        }
        const campaignData = {
          tenant_id: tenantId,
          bolcom_campaign_id: String(bc.campaignId),
          name: bc.name || `Campaign ${bc.campaignId}`,
          status: statusMap[bc.state] || bc.state?.toLowerCase() || "unknown",
          campaign_type: bc.campaignType?.toLowerCase() || "manual",
          targeting_type: bc.targetingType?.toLowerCase() || "manual",
          daily_budget: bc.dailyBudget?.amount || null,
          total_budget: bc.totalBudget?.amount || null,
          start_date: bc.startDate || null,
          end_date: bc.endDate || null,
          raw_data: bc,
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("ads_bolcom_campaigns")
          .upsert(campaignData, { onConflict: "tenant_id,bolcom_campaign_id" });

        if (error) { console.error(`Campaign upsert error:`, error); continue; }
        campaignsSynced++;

        // Get our internal campaign ID
        const { data: dbCampaign } = await supabase
          .from("ads_bolcom_campaigns")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("bolcom_campaign_id", String(bc.campaignId))
          .single();

        if (!dbCampaign) continue;
        const internalCampaignId = dbCampaign.id;

        // 2. Ad Groups
        let adGroups: any[] = [];
        try {
          const agRes = await withRetry(t => bolGet(t, `${BOL_ADV_BASE}/campaigns/${bc.campaignId}/ad-groups`));
          adGroups = agRes?.adGroups || [];
        } catch (e: any) {
          if (e.message?.startsWith("RATE_LIMITED")) throw e;
          console.error(`Ad groups fetch failed for campaign ${bc.campaignId}:`, e.message);
        }

        for (const ag of adGroups) {
          try {
            const agData = {
              tenant_id: tenantId,
              campaign_id: internalCampaignId,
              bolcom_adgroup_id: String(ag.adGroupId),
              name: ag.name || `Ad Group ${ag.adGroupId}`,
              status: statusMap[ag.state] || ag.state?.toLowerCase() || "active",
              default_bid: ag.defaultBid?.amount || null,
              raw_data: ag,
              synced_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from("ads_bolcom_adgroups")
              .upsert(agData, { onConflict: "tenant_id,bolcom_adgroup_id" });

            if (error) { console.error(`Adgroup upsert error:`, error); continue; }
            adgroupsSynced++;

            // Get our internal adgroup ID
            const { data: dbAg } = await supabase
              .from("ads_bolcom_adgroups")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("bolcom_adgroup_id", String(ag.adGroupId))
              .single();

            if (!dbAg) continue;
            const internalAgId = dbAg.id;

            // 3. Keywords
            try {
              const kwRes = await withRetry(t => bolGet(t, `${BOL_ADV_BASE}/ad-groups/${ag.adGroupId}/keywords`));
              const keywords = kwRes?.keywords || [];

              for (const kw of keywords) {
                const kwData = {
                  tenant_id: tenantId,
                  adgroup_id: internalAgId,
                  keyword: kw.text || kw.keyword || "",
                  match_type: kw.matchType?.toLowerCase() || "broad",
                  bid: kw.bid?.amount || null,
                  status: statusMap[kw.state] || kw.state?.toLowerCase() || "active",
                  is_negative: kw.negative || false,
                  bolcom_keyword_id: kw.keywordId ? String(kw.keywordId) : null,
                  raw_data: kw,
                  synced_at: new Date().toISOString(),
                };

                const { error } = await supabase
                  .from("ads_bolcom_keywords")
                  .upsert(kwData, { onConflict: "tenant_id,adgroup_id,keyword,match_type" });

                if (!error) keywordsSynced++;
                else console.error(`Keyword upsert error:`, error);
              }
            } catch (e: any) {
              if (e.message?.startsWith("RATE_LIMITED")) throw e;
              console.error(`Keywords fetch failed for adgroup ${ag.adGroupId}:`, e.message);
            }

            // 4. Target Products
            try {
              const tpRes = await withRetry(t => bolGet(t, `${BOL_ADV_BASE}/ad-groups/${ag.adGroupId}/target-products`));
              const products = tpRes?.targetProducts || tpRes?.products || [];

              for (const tp of products) {
                const ean = tp.ean || tp.productId || "";
                if (!ean) continue;

                // Try to match product_id via EAN
                let productId: string | null = null;
                const { data: matchedProduct } = await supabase
                  .from("products")
                  .select("id")
                  .eq("tenant_id", tenantId)
                  .or(`bol_ean.eq.${ean},barcode.eq.${ean}`)
                  .limit(1)
                  .maybeSingle();

                if (matchedProduct) productId = matchedProduct.id;

                const tpData = {
                  tenant_id: tenantId,
                  adgroup_id: internalAgId,
                  ean,
                  product_id: productId,
                  status: statusMap[tp.state] || tp.state?.toLowerCase() || "active",
                };

                const { error } = await supabase
                  .from("ads_bolcom_targeting_products")
                  .upsert(tpData, { onConflict: "tenant_id,adgroup_id,ean" });

                if (!error) productsSynced++;
                else console.error(`Target product upsert error:`, error);
              }
            } catch (e: any) {
              if (e.message?.startsWith("RATE_LIMITED")) throw e;
              console.error(`Target products fetch failed for adgroup ${ag.adGroupId}:`, e.message);
            }
          } catch (e: any) {
            if (e.message?.startsWith("RATE_LIMITED")) throw e;
            console.error(`Ad group processing failed ${ag.adGroupId}:`, e.message);
          }
        }
      } catch (e: any) {
        if (e.message?.startsWith("RATE_LIMITED")) {
          const retryAfter = e.message.split(":")[1];
          return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
        }
        console.error(`Campaign processing failed ${bc.campaignId}:`, e.message);
      }
    }

    return jsonRes({
      success: true,
      campaigns_synced: campaignsSynced,
      adgroups_synced: adgroupsSynced,
      keywords_synced: keywordsSynced,
      products_synced: productsSynced,
    });
  } catch (error: any) {
    console.error("ads-bolcom-sync error:", error);
    if (error.message?.startsWith("RATE_LIMITED")) {
      const retryAfter = error.message.split(":")[1];
      return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
    }
    return jsonRes({ error: error.message }, 500);
  }
});

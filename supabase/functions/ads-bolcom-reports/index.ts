import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_INSIGHTS_BASE = "https://api.bol.com/advertiser/sponsored-products/insights";

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

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
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

    const now = new Date();
    const endDate = body.end_date || formatDate(now);
    const startDate = body.start_date || formatDate(new Date(now.getTime() - 30 * 86400000));

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

    // Get local campaigns for ID mapping
    const { data: localCampaigns } = await supabase
      .from("ads_bolcom_campaigns")
      .select("id, bolcom_campaign_id")
      .eq("tenant_id", tenantId);

    if (!localCampaigns?.length) {
      return jsonRes({ success: true, days_synced: 0, performance_records: 0, search_term_records: 0, message: "No campaigns to report on" });
    }

    const campaignIdMap = new Map<string, string>();
    const bolCampaignIds: string[] = [];
    for (const c of localCampaigns) {
      campaignIdMap.set(c.bolcom_campaign_id, c.id);
      bolCampaignIds.push(c.bolcom_campaign_id);
    }

    let performanceRecords = 0;
    let searchTermRecords = 0;
    const datesSet = new Set<string>();

    // 1. Campaign performance
    try {
      const perfRes = await withRetry(t => bolPost(t, `${BOL_INSIGHTS_BASE}/campaigns`, {
        campaignIds: bolCampaignIds.map(Number),
        startDate,
        endDate,
      }));

      const perfData = perfRes?.campaignPerformances || perfRes?.performances || perfRes?.data || [];
      console.log(`Campaign performance response keys: ${Object.keys(perfRes || {}).join(", ")}, rows: ${Array.isArray(perfData) ? perfData.length : "N/A"}`);

      for (const row of (Array.isArray(perfData) ? perfData : [])) {
        const bolCampaignId = String(row.campaignId);
        const internalId = campaignIdMap.get(bolCampaignId);
        if (!internalId) continue;

        const date = row.date || row.reportDate;
        if (!date) continue;
        datesSet.add(date);

        const impressions = Number(row.impressions) || 0;
        const clicks = Number(row.clicks) || 0;
        const spend = Number(row.spend?.amount || row.spend || row.cost?.amount || row.cost) || 0;
        const orders = Number(row.orders || row.conversions) || 0;
        const revenue = Number(row.revenue?.amount || row.revenue || row.sales?.amount || row.sales) || 0;

        const perfRow = {
          tenant_id: tenantId,
          campaign_id: internalId,
          date,
          impressions,
          clicks,
          spend,
          orders,
          revenue,
          acos: revenue > 0 ? spend / revenue : null,
          ctr: impressions > 0 ? clicks / impressions : null,
          cpc: clicks > 0 ? spend / clicks : null,
          conversion_rate: clicks > 0 ? orders / clicks : null,
        };

        const { error } = await supabase
          .from("ads_bolcom_performance")
          .upsert(perfRow, { onConflict: "tenant_id,campaign_id,date" });

        if (!error) performanceRecords++;
        else console.error("Performance upsert error:", error);
      }
    } catch (e: any) {
      if (e.message?.startsWith("RATE_LIMITED")) {
        const retryAfter = e.message.split(":")[1];
        return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
      }
      console.error("Campaign performance fetch failed:", e.message);
    }

    // 2. Keyword performance
    try {
      // Get local adgroups + keywords for ID mapping
      const { data: localKeywords } = await supabase
        .from("ads_bolcom_keywords")
        .select("id, bolcom_keyword_id, adgroup_id")
        .eq("tenant_id", tenantId);

      if (localKeywords?.length) {
        const keywordIdMap = new Map<string, { id: string; adgroupId: string }>();
        for (const kw of localKeywords) {
          if (kw.bolcom_keyword_id) {
            keywordIdMap.set(kw.bolcom_keyword_id, { id: kw.id, adgroupId: kw.adgroup_id });
          }
        }

        const kwRes = await withRetry(t => bolPost(t, `${BOL_INSIGHTS_BASE}/keywords`, {
          campaignIds: bolCampaignIds.map(Number),
          startDate,
          endDate,
        }));

        const kwData = kwRes?.keywordPerformances || kwRes?.performances || kwRes?.data || [];
        console.log(`Keyword performance response keys: ${Object.keys(kwRes || {}).join(", ")}, rows: ${Array.isArray(kwData) ? kwData.length : "N/A"}`);

        for (const row of (Array.isArray(kwData) ? kwData : [])) {
          const bolKwId = String(row.keywordId);
          const kwInfo = keywordIdMap.get(bolKwId);
          if (!kwInfo) continue;

          const date = row.date || row.reportDate;
          if (!date) continue;

          const bolCampaignId = String(row.campaignId);
          const internalCampaignId = campaignIdMap.get(bolCampaignId);

          const impressions = Number(row.impressions) || 0;
          const clicks = Number(row.clicks) || 0;
          const spend = Number(row.spend?.amount || row.spend || row.cost?.amount || row.cost) || 0;
          const orders = Number(row.orders || row.conversions) || 0;
          const revenue = Number(row.revenue?.amount || row.revenue || row.sales?.amount || row.sales) || 0;

          const perfRow = {
            tenant_id: tenantId,
            campaign_id: internalCampaignId || null,
            adgroup_id: kwInfo.adgroupId,
            keyword_id: kwInfo.id,
            date,
            impressions,
            clicks,
            spend,
            orders,
            revenue,
            acos: revenue > 0 ? spend / revenue : null,
            ctr: impressions > 0 ? clicks / impressions : null,
            cpc: clicks > 0 ? spend / clicks : null,
            conversion_rate: clicks > 0 ? orders / clicks : null,
          };

          const { error } = await supabase
            .from("ads_bolcom_performance")
            .upsert(perfRow, { onConflict: "tenant_id,campaign_id,date" });

          if (!error) performanceRecords++;
          else console.error("Keyword perf upsert error:", error);
        }
      }
    } catch (e: any) {
      if (e.message?.startsWith("RATE_LIMITED")) {
        const retryAfter = e.message.split(":")[1];
        return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
      }
      console.error("Keyword performance fetch failed:", e.message);
    }

    // 3. Search terms
    try {
      const stRes = await withRetry(t => bolPost(t, `${BOL_INSIGHTS_BASE}/search-terms`, {
        campaignIds: bolCampaignIds.map(Number),
        startDate,
        endDate,
      }));

      const stData = stRes?.searchTermPerformances || stRes?.performances || stRes?.data || [];
      console.log(`Search term response keys: ${Object.keys(stRes || {}).join(", ")}, rows: ${Array.isArray(stData) ? stData.length : "N/A"}`);

      for (const row of (Array.isArray(stData) ? stData : [])) {
        const searchTerm = row.searchTerm || row.search_term || row.query;
        if (!searchTerm) continue;

        const date = row.date || row.reportDate;
        if (!date) continue;

        const bolCampaignId = String(row.campaignId);
        const internalCampaignId = campaignIdMap.get(bolCampaignId) || null;

        const stRow = {
          tenant_id: tenantId,
          campaign_id: internalCampaignId,
          search_term: searchTerm,
          date,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          spend: Number(row.spend?.amount || row.spend || row.cost?.amount || row.cost) || 0,
          orders: Number(row.orders || row.conversions) || 0,
          revenue: Number(row.revenue?.amount || row.revenue || row.sales?.amount || row.sales) || 0,
        };

        const { error } = await supabase
          .from("ads_bolcom_search_terms")
          .upsert(stRow, { onConflict: "tenant_id,search_term,date" });

        if (!error) searchTermRecords++;
        else console.error("Search term upsert error:", error);
      }
    } catch (e: any) {
      if (e.message?.startsWith("RATE_LIMITED")) {
        const retryAfter = e.message.split(":")[1];
        return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
      }
      console.error("Search terms fetch failed:", e.message);
    }

    return jsonRes({
      success: true,
      days_synced: datesSet.size,
      performance_records: performanceRecords,
      search_term_records: searchTermRecords,
    });
  } catch (error: any) {
    console.error("ads-bolcom-reports error:", error);
    if (error.message?.startsWith("RATE_LIMITED")) {
      const retryAfter = error.message.split(":")[1];
      return jsonRes({ error: "Rate limited by Bol.com", retry_after: parseInt(retryAfter) }, 429);
    }
    return jsonRes({ error: error.message }, 500);
  }
});

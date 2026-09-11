import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import {
  BOL_MAX_ENTITY_IDS,
  BOL_MAX_PAGE_SIZE,
  BOL_MAX_REPORT_DAYS,
  BOL_REPORTING_BASE,
  type BolPerformanceResponse,
  type BolPerformanceRow,
  BolRateLimitError,
  chunk,
  createBolAdvertisingClient,
  errorMessage,
  formatDate,
  performanceParams,
} from "../_shared/bolAdvertising.ts";

/** De enige velden van `marketplace_connections` die deze functie gebruikt. */
interface ConnectionRow {
  id: string;
  credentials: {
    advertisingClientId?: string;
    advertisingClientSecret?: string;
  } | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Standaard aantal dagen dat elke run opnieuw ophaalt.
 *
 * Niet één dag, en dat is opzettelijk. Alle conversiemetrieken van bol.com zijn
 * `*14d`: een klik van vandaag kan tot veertien dagen later nog een conversie
 * opleveren. De cijfers van een dag staan dus pas na twee weken vast. Zeven dagen
 * opnieuw ophalen vangt het grootste deel van die nakomende conversies zonder elke
 * run een volledige maand op te vragen. De upsert werkt bestaande dagen bij in
 * plaats van ze te dupliceren — dát is wat de unieke index uit migratie
 * 20260911130000 mogelijk maakt.
 */
const DEFAULT_LOOKBACK_DAYS = 7;

/** Metrieken uit de v11-reporting-respons naar onze kolommen. */
function metricsToRow(row: BolPerformanceRow) {
  return {
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    spend: Number(row.cost) || 0,
    orders: Number(row.conversions14d) || 0,
    revenue: Number(row.sales14d) || 0,
    acos: row.acos14d ?? null,
    ctr: row.ctr ?? null,
    cpc: row.averageCpc ?? null,
    conversion_rate: row.conversionRate14d ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSyncSecret = req.headers.get("X-Sync-Secret");
    const isCronSecret = !!cronSecret && providedSyncSecret === cronSecret;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const authToken = authHeader.slice(7);
    const isServiceRole = authToken === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      isServiceRole || isCronSecret
        ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        : Deno.env.get("SUPABASE_ANON_KEY")!,
      isServiceRole || isCronSecret
        ? undefined
        : { global: { headers: { Authorization: authHeader } } }
    );

    if (!isServiceRole && !isCronSecret) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    if (!tenantId) return jsonRes({ error: "tenant_id required" }, 400);

    if (!isServiceRole && !isCronSecret) {
      const auth = await authenticateRequest(req, tenantId);
      requireRole(auth, tenantId, ["tenant_admin", "staff", "marketing"]);
    }

    // ---- De dagen die we ophalen -------------------------------------------
    //
    // De reporting-API kent géén datumdimensie: `GET /performance` geeft één
    // geaggregeerd totaal over de opgevraagde periode, uitgesplitst per entiteit —
    // niet per dag. Onze tabel is wél per dag opgezet. De enige manier om dagcijfers
    // te krijgen is dus één aanroep per dag, met start- en einddatum gelijk.
    //
    // De oude code vroeg één periode van 30 dagen op en verwachtte `row.date` in het
    // antwoord. Dat veld bestaat niet; elke rij zou op `continue` zijn gestrand.
    const requestedDays = Math.min(
      Math.max(Number(body.days) || DEFAULT_LOOKBACK_DAYS, 1),
      BOL_MAX_REPORT_DAYS,
    );

    const dates: string[] = [];
    const today = new Date();
    for (let i = requestedDays - 1; i >= 0; i--) {
      dates.push(formatDate(new Date(today.getTime() - i * 86400000)));
    }

    // ---- Credentials --------------------------------------------------------
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("id, credentials")
      .eq("tenant_id", tenantId)
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);

    const bolConn = (connections as ConnectionRow[] | null)?.find(
      (c) => c.credentials?.advertisingClientId && c.credentials?.advertisingClientSecret,
    );
    if (!bolConn) return jsonRes({ error: "No Bol advertising credentials found" }, 400);

    const bol = createBolAdvertisingClient(
      bolConn.credentials!.advertisingClientId!,
      bolConn.credentials!.advertisingClientSecret!,
    );

    // ---- Lokale id-kaarten --------------------------------------------------
    const { data: localCampaigns } = await supabase
      .from("ads_bolcom_campaigns")
      .select("id, bolcom_campaign_id")
      .eq("tenant_id", tenantId);

    if (!localCampaigns?.length) {
      return jsonRes({
        success: true, days_synced: 0, performance_records: 0,
        search_term_records: 0, failures: [],
        message: "No campaigns to report on",
      });
    }

    const campaignIdMap = new Map<string, string>(
      localCampaigns.map((c) => [c.bolcom_campaign_id, c.id]),
    );
    const bolCampaignIds = localCampaigns.map((c) => c.bolcom_campaign_id);

    const { data: localAdGroups } = await supabase
      .from("ads_bolcom_adgroups")
      .select("id, bolcom_adgroup_id")
      .eq("tenant_id", tenantId);

    const adGroupIdMap = new Map<string, string>(
      (localAdGroups ?? []).map((a) => [a.bolcom_adgroup_id, a.id]),
    );

    const { data: localKeywords } = await supabase
      .from("ads_bolcom_keywords")
      .select("id, bolcom_keyword_id")
      .eq("tenant_id", tenantId)
      .not("bolcom_keyword_id", "is", null);

    const keywordIdMap = new Map<string, string>(
      (localKeywords ?? []).map((k) => [k.bolcom_keyword_id, k.id]),
    );

    // R4: wat faalt komt in deze lijst en daarmee in het antwoord. Tot 11 sep 2026
    // eindigde elke catch op een console.error en liep de functie door naar
    // `success: true` — een groene respons op een mislukte fetch.
    const failures: { step: string; error: string }[] = [];
    let performanceRecords = 0;
    let searchTermRecords = 0;

    // ---- 1. Campagne- en keyword-performance -------------------------------
    // Eén endpoint voor beide; alleen `entity-type` verschilt. Dat vervangt twee
    // van de drie kapotte insights-aanroepen.
    const bolKeywordIds = [...keywordIdMap.keys()];

    const levels: { type: "CAMPAIGN" | "KEYWORD"; ids: string[] }[] = [
      { type: "CAMPAIGN", ids: bolCampaignIds },
      { type: "KEYWORD", ids: bolKeywordIds },
    ];

    for (const date of dates) {
      for (const level of levels) {
        if (!level.ids.length) continue;

        for (const batch of chunk(level.ids, BOL_MAX_ENTITY_IDS)) {
          try {
            const res = await bol.get<BolPerformanceResponse>(
              BOL_REPORTING_BASE,
              "/performance",
              performanceParams(level.type, batch, date, date),
            );

            for (const row of (res?.subTotals ?? [])) {
              const campaignId = row.campaignId
                ? campaignIdMap.get(String(row.campaignId)) ?? null
                : null;
              const adgroupId = row.adGroupId
                ? adGroupIdMap.get(String(row.adGroupId)) ?? null
                : null;

              // Bij entity-type CAMPAIGN is entityId de campagne zelf; die hoort
              // dan in campaign_id en niet in keyword_id.
              const isKeyword = level.type === "KEYWORD";
              const keywordId = isKeyword
                ? keywordIdMap.get(String(row.entityId)) ?? null
                : null;
              if (isKeyword && !keywordId) continue;

              const resolvedCampaignId = campaignId ??
                (level.type === "CAMPAIGN"
                  ? campaignIdMap.get(String(row.entityId)) ?? null
                  : null);
              if (!resolvedCampaignId && !adgroupId && !keywordId) continue;

              const { error } = await supabase
                .from("ads_bolcom_performance")
                .upsert({
                  tenant_id: tenantId,
                  campaign_id: resolvedCampaignId,
                  adgroup_id: adgroupId,
                  keyword_id: keywordId,
                  date,
                  ...metricsToRow(row),
                }, { onConflict: "tenant_id,campaign_id,adgroup_id,keyword_id,date" });

              if (!error) performanceRecords++;
              else {
                console.error("Performance upsert error:", error);
                failures.push({ step: `performance_upsert_${level.type}`, error: error.message });
              }
            }
          } catch (e) {
            if (e instanceof BolRateLimitError) {
              return jsonRes({ error: "Rate limited by Bol.com", retry_after: e.retryAfter }, 429);
            }
            console.error(`${level.type} performance failed (${date}):`, errorMessage(e));
            failures.push({
              step: `performance_${level.type.toLowerCase()}`,
              error: `${date}: ${errorMessage(e)}`,
            });
          }
        }
      }
    }

    // ---- 2. Zoektermen ------------------------------------------------------
    // Werkt op ad-group-niveau. Dit was de laatste stap in de herbouw, omdat er
    // zonder werkende ad-group-sync geen enkel id is om mee te vragen.
    const bolAdGroupIds = [...adGroupIdMap.keys()];

    for (const date of dates) {
      for (const batch of chunk(bolAdGroupIds, BOL_MAX_ENTITY_IDS)) {
        try {
          for (let page = 1; ; page++) {
            const params = new URLSearchParams();
            for (const id of batch) params.append("ad-group-ids", id);
            params.set("period-start-date", date);
            params.set("period-end-date", date);
            params.set("page", String(page));
            params.set("page-size", String(BOL_MAX_PAGE_SIZE));

            const res = await bol.get<BolPerformanceResponse>(
              BOL_REPORTING_BASE, "/performance/search-term", params,
            );
            const rows = res?.subTotals ?? [];

            for (const row of rows) {
              const searchTerm = row.searchTerm;
              if (!searchTerm) continue;

              const { error } = await supabase
                .from("ads_bolcom_search_terms")
                .upsert({
                  tenant_id: tenantId,
                  campaign_id: row.campaignId
                    ? campaignIdMap.get(String(row.campaignId)) ?? null
                    : null,
                  adgroup_id: row.adGroupId
                    ? adGroupIdMap.get(String(row.adGroupId)) ?? null
                    : null,
                  search_term: searchTerm,
                  date,
                  impressions: Number(row.impressions) || 0,
                  clicks: Number(row.clicks) || 0,
                  spend: Number(row.cost) || 0,
                  orders: Number(row.conversions14d) || 0,
                  revenue: Number(row.sales14d) || 0,
                }, { onConflict: "tenant_id,campaign_id,adgroup_id,search_term,date" });

              if (!error) searchTermRecords++;
              else {
                console.error("Search term upsert error:", error);
                failures.push({ step: "search_term_upsert", error: error.message });
              }
            }

            if (rows.length < BOL_MAX_PAGE_SIZE) break;
          }
        } catch (e) {
          if (e instanceof BolRateLimitError) {
            return jsonRes({ error: "Rate limited by Bol.com", retry_after: e.retryAfter }, 429);
          }
          console.error(`Search terms failed (${date}):`, errorMessage(e));
          failures.push({ step: "search_terms", error: `${date}: ${errorMessage(e)}` });
        }
      }
    }

    // `success` weerspiegelt wat er werkelijk gebeurde. Een deelrapportage die
    // faalde maakt dit een gedeeltelijke run, geen geslaagde.
    return jsonRes({
      success: failures.length === 0,
      partial: failures.length > 0,
      days_synced: dates.length,
      period: { from: dates[0], to: dates[dates.length - 1] },
      performance_records: performanceRecords,
      search_term_records: searchTermRecords,
      failures,
    }, failures.length > 0 ? 207 : 200);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    if (error instanceof BolRateLimitError) {
      return jsonRes({ error: "Rate limited by Bol.com", retry_after: error.retryAfter }, 429);
    }
    console.error("ads-bolcom-reports error:", error);
    return jsonRes({ error: errorMessage(error) }, 500);
  }
});

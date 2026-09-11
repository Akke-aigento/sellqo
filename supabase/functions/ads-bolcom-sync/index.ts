import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import {
  BOL_MAX_ENTITY_IDS,
  type BolAd,
  type BolAdGroup,
  type BolCampaign,
  type BolKeyword,
  BolRateLimitError,
  chunk,
  createBolAdvertisingClient,
  errorMessage,
  listAllPages,
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

const statusMap: Record<string, string> = {
  ENABLED: "active", PAUSED: "paused", ARCHIVED: "archived", ENDED: "ended",
};

const toStatus = (state: unknown, fallback = "active") =>
  statusMap[String(state)] || String(state ?? "").toLowerCase() || fallback;

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

    // Get advertising credentials
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

    // R4: elke deelfout komt in deze lijst en daarmee in het antwoord. Tot 11 sep
    // 2026 eindigde elke catch op een console.error en liep de functie door naar
    // `success: true` — waardoor `adgroups_synced: 0` niet te onderscheiden was van
    // "alle ad-group-aanroepen faalden". Dat was precies wat er aan de hand was.
    const failures: { step: string; error: string }[] = [];
    let campaignsSynced = 0, adgroupsSynced = 0, keywordsSynced = 0, productsSynced = 0;

    // ---- 1. Campagnes -------------------------------------------------------
    const bolCampaigns = await listAllPages<BolCampaign>(
      bol, "/campaigns/list", {}, (r) => r?.campaigns as BolCampaign[] | undefined,
    );

    // bol.com-campagne-id -> onze uuid. Alleen levende campagnes; de ad-groups,
    // keywords en ads hieronder worden op deze lijst gefilterd, zodat gearchiveerde
    // campagnes vanzelf buiten de sync blijven.
    const campaignIdMap = new Map<string, string>();

    for (const bc of bolCampaigns) {
      try {
        const bolCampaignId = String(bc.campaignId);

        if (bc.state === "ARCHIVED" || bc.state === "ENDED") {
          // Defensive cleanup: remove any stale local row
          await supabase
            .from("ads_bolcom_campaigns")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("bolcom_campaign_id", bolCampaignId);
          continue;
        }

        const campaignData = {
          tenant_id: tenantId,
          bolcom_campaign_id: bolCampaignId,
          name: bc.name || `Campaign ${bolCampaignId}`,
          status: toStatus(bc.state, "unknown"),
          campaign_type: bc.campaignType?.toLowerCase() || "manual",
          targeting_type: bc.targetingType?.toLowerCase() || "manual",
          daily_budget: bc.dailyBudget?.amount ?? null,
          total_budget: bc.totalBudget?.amount ?? null,
          start_date: bc.startDate || null,
          end_date: bc.endDate || null,
          raw_data: bc,
          synced_at: new Date().toISOString(),
        };

        const { data: saved, error } = await supabase
          .from("ads_bolcom_campaigns")
          .upsert(campaignData, { onConflict: "tenant_id,bolcom_campaign_id" })
          .select("id")
          .single();

        if (error || !saved) {
          console.error("Campaign upsert error:", error);
          failures.push({ step: "campaign_upsert", error: error?.message ?? "geen rij terug" });
          continue;
        }

        campaignsSynced++;
        campaignIdMap.set(bolCampaignId, saved.id);
      } catch (e) {
        if (e instanceof BolRateLimitError) throw e;
        console.error(`Campaign processing failed ${bc.campaignId}:`, errorMessage(e));
        failures.push({ step: "campaign_processing", error: errorMessage(e) });
      }
    }

    const liveCampaignIds = [...campaignIdMap.keys()];
    // `campaignIds` accepteert hoogstens 100 waarden per verzoek — dezelfde grens
    // als entity-ids in de reporting-API.
    const campaignBatches = chunk(liveCampaignIds, BOL_MAX_ENTITY_IDS);

    // bol.com-adgroup-id -> onze uuid. Nodig om keywords en ads te koppelen.
    const adGroupIdMap = new Map<string, string>();

    // ---- 2. Ad groups -------------------------------------------------------
    // Was `GET campaigns/{id}/ad-groups` — dat pad bestaat niet en gaf 404, waardoor
    // deze tabel altijd leeg bleef en stap 3 en 4 nooit iets te doen hadden.
    if (campaignBatches.length) {
      for (const batch of campaignBatches) {
        try {
          const adGroups = await listAllPages<BolAdGroup>(
            bol, "/ad-groups/list", { campaignIds: batch },
            (r) => r?.adGroups as BolAdGroup[] | undefined,
          );

          for (const ag of adGroups) {
            const parentId = campaignIdMap.get(String(ag.campaignId));
            if (!parentId) continue;

            const agData = {
              tenant_id: tenantId,
              campaign_id: parentId,
              bolcom_adgroup_id: String(ag.adGroupId),
              name: ag.name || `Ad Group ${ag.adGroupId}`,
              status: toStatus(ag.state),
              // Een ad group heeft in v11 geen eigen bod: het schema kent alleen
              // name, state en targetPages. Biedingen zitten op keyword- en
              // target-product-niveau. Deze kolom blijft dus leeg — dat is het
              // contract, geen ontbrekende mapping.
              default_bid: null,
              raw_data: ag,
              synced_at: new Date().toISOString(),
            };

            const { data: savedAg, error } = await supabase
              .from("ads_bolcom_adgroups")
              .upsert(agData, { onConflict: "tenant_id,bolcom_adgroup_id" })
              .select("id")
              .single();

            if (error || !savedAg) {
              console.error("Adgroup upsert error:", error);
              failures.push({ step: "adgroup_upsert", error: error?.message ?? "geen rij terug" });
              continue;
            }

            adgroupsSynced++;
            adGroupIdMap.set(String(ag.adGroupId), savedAg.id);
          }
        } catch (e) {
          if (e instanceof BolRateLimitError) throw e;
          console.error("Ad groups fetch failed:", errorMessage(e));
          failures.push({ step: "ad_groups", error: errorMessage(e) });
        }
      }
    }

    // ---- 3. Keywords --------------------------------------------------------
    // Was `GET ad-groups/{id}/keywords` — bestaat niet. Let op `keywordText`: de
    // oude code las `kw.text || kw.keyword`, en geen van beide bestaat in v11.
    // Zelfs met een werkend pad was elke keyword als lege string opgeslagen.
    for (const batch of campaignBatches) {
      try {
        const keywords = await listAllPages<BolKeyword>(
          bol, "/keywords/list", { campaignIds: batch },
          (r) => r?.keywords as BolKeyword[] | undefined,
        );

        for (const kw of keywords) {
          const adgroupId = adGroupIdMap.get(String(kw.adGroupId));
          if (!adgroupId) continue;

          const text = kw.keywordText ?? "";
          if (!text) continue;

          const kwData = {
            tenant_id: tenantId,
            adgroup_id: adgroupId,
            keyword: text,
            match_type: kw.matchType?.toLowerCase() || "broad",
            bid: kw.bid?.amount ?? null,
            status: toStatus(kw.state),
            is_negative: false,
            bolcom_keyword_id: kw.keywordId ? String(kw.keywordId) : null,
            raw_data: kw,
            synced_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("ads_bolcom_keywords")
            .upsert(kwData, { onConflict: "tenant_id,adgroup_id,keyword,match_type" });

          if (!error) keywordsSynced++;
          else {
            console.error("Keyword upsert error:", error);
            failures.push({ step: "keyword_upsert", error: error.message });
          }
        }
      } catch (e) {
        if (e instanceof BolRateLimitError) throw e;
        console.error("Keywords fetch failed:", errorMessage(e));
        failures.push({ step: "keywords", error: errorMessage(e) });
      }
    }

    // ---- 4. Geadverteerde producten ----------------------------------------
    // Dit vult `ads_bolcom_targeting_products`, en de bron is `/ads/list` — niet
    // `/target-products/list`, waar de oude code op mikte.
    //
    // Dat is geen detail. Een targetProduct in v11 heeft alleen targetProductId,
    // adGroupId, campaignId en state: géén EAN. Het is het product waarop je
    // adverteert (PDP-targeting). Een ad heeft wél een `ean`, en dat is jóuw
    // artikel dat geadverteerd wordt.
    //
    // Deze tabel koppelt via `product_id` naar onze eigen producten, en
    // `ads-inventory-watch` gebruikt die koppeling om campagnes te pauzeren zodra
    // onze voorraad opraakt. Dat is per definitie het geadverteerde artikel. Die
    // functie heeft nooit gewerkt, simpelweg omdat deze tabel leeg was.
    for (const batch of campaignBatches) {
      try {
        const ads = await listAllPages<BolAd>(
          bol, "/ads/list", { campaignIds: batch },
          (r) => r?.ads as BolAd[] | undefined,
        );

        for (const ad of ads) {
          const adgroupId = adGroupIdMap.get(String(ad.adGroupId));
          if (!adgroupId) continue;

          const ean = ad.ean ? String(ad.ean) : "";
          if (!ean) continue;

          // Koppel aan ons eigen product via EAN of barcode.
          const { data: matchedProduct } = await supabase
            .from("products")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`bol_ean.eq.${ean},barcode.eq.${ean}`)
            .limit(1)
            .maybeSingle();

          const { error } = await supabase
            .from("ads_bolcom_targeting_products")
            .upsert({
              tenant_id: tenantId,
              adgroup_id: adgroupId,
              ean,
              product_id: matchedProduct?.id ?? null,
              status: toStatus(ad.state),
            }, { onConflict: "tenant_id,adgroup_id,ean" });

          if (!error) productsSynced++;
          else {
            console.error("Ad product upsert error:", error);
            failures.push({ step: "ad_product_upsert", error: error.message });
          }
        }
      } catch (e) {
        if (e instanceof BolRateLimitError) throw e;
        console.error("Ads fetch failed:", errorMessage(e));
        failures.push({ step: "ads", error: errorMessage(e) });
      }
    }

    // `success` weerspiegelt wat er werkelijk gebeurde; zie de noot bij `failures`.
    return jsonRes({
      success: failures.length === 0,
      partial: failures.length > 0,
      campaigns_synced: campaignsSynced,
      adgroups_synced: adgroupsSynced,
      keywords_synced: keywordsSynced,
      products_synced: productsSynced,
      failures,
    }, failures.length > 0 ? 207 : 200);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    if (error instanceof BolRateLimitError) {
      return jsonRes({ error: "Rate limited by Bol.com", retry_after: error.retryAfter }, 429);
    }
    console.error("ads-bolcom-sync error:", error);
    return jsonRes({ error: errorMessage(error) }, 500);
  }
});

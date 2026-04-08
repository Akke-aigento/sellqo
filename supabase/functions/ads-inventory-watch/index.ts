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

async function bolPut(token: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, ...ADV_HEADERS },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 207) {
    const text = await res.text();
    throw new Error(`Bol API PUT (${res.status}): ${text.substring(0, 200)}`);
  }
}

const tokenCache = new Map<string, string>();

async function getTokenForTenant(supabase: any, tenantId: string): Promise<string | null> {
  if (tokenCache.has(tenantId)) return tokenCache.get(tenantId)!;

  const { data: connections } = await supabase
    .from("marketplace_connections")
    .select("credentials")
    .eq("tenant_id", tenantId)
    .eq("marketplace_type", "bol_com")
    .eq("is_active", true);

  const conn = connections?.find((c: any) => {
    const cr = c.credentials as any;
    return cr?.advertisingClientId && cr?.advertisingClientSecret;
  });

  if (!conn) return null;

  const creds = conn.credentials as any;
  try {
    const token = await getBolToken(creds.advertisingClientId, creds.advertisingClientSecret);
    tokenCache.set(tenantId, token);
    return token;
  } catch {
    return null;
  }
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mappings, error: mapErr } = await supabase
      .from("ads_product_channel_map")
      .select("id, tenant_id, product_id, channel, min_stock_for_ads, is_advertised, products(id, name, stock)")
      .eq("is_advertised", true);

    if (mapErr) throw mapErr;
    if (!mappings || mappings.length === 0) {
      return jsonRes({ message: "No advertised products found", paused: 0, resumed: 0 });
    }

    let pausedCount = 0;
    let resumedCount = 0;

    for (const mapping of mappings) {
      const product = mapping.products as any;
      if (!product) continue;

      const stock = product.stock ?? 0;
      const minStock = mapping.min_stock_for_ads ?? 1;
      const tenantId = mapping.tenant_id;

      const { data: targetLinks } = await supabase
        .from("ads_bolcom_targeting_products")
        .select("adgroup_id, ads_bolcom_adgroups(campaign_id, ads_bolcom_campaigns(id, status, bolcom_campaign_id))")
        .eq("product_id", mapping.product_id)
        .eq("tenant_id", tenantId);

      if (!targetLinks || targetLinks.length === 0) continue;

      const campaignMap = new Map<string, { id: string; status: string; bolcom_campaign_id: string }>();
      for (const tl of targetLinks) {
        const ag = tl.ads_bolcom_adgroups as any;
        if (!ag?.ads_bolcom_campaigns) continue;
        const camp = ag.ads_bolcom_campaigns;
        if (!campaignMap.has(camp.id)) {
          campaignMap.set(camp.id, { id: camp.id, status: camp.status, bolcom_campaign_id: camp.bolcom_campaign_id });
        }
      }

      if (stock < minStock) {
        for (const [campId, camp] of campaignMap) {
          if (camp.status !== "active") continue;

          try {
            await supabase
              .from("ads_bolcom_campaigns")
              .update({ status: "paused" })
              .eq("id", campId)
              .eq("tenant_id", tenantId);

            // Also pause on Bol.com API
            if (camp.bolcom_campaign_id) {
              const bolToken = await getTokenForTenant(supabase, tenantId);
              if (bolToken) {
                try {
                  await bolPut(bolToken, `${BOL_ADV_BASE}/campaigns/${camp.bolcom_campaign_id}`, { state: "PAUSED" });
                } catch (e) {
                  console.error(`Failed to pause campaign ${campId} on Bol:`, e);
                }
              }
            }

            await supabase.from("ads_ai_recommendations").insert({
              tenant_id: tenantId,
              channel: "bolcom",
              entity_type: "campaign",
              entity_id: campId,
              recommendation_type: "pause_campaign",
              reason: `Voorraad van "${product.name}" is ${stock}, onder minimum ${minStock}. Campagne automatisch gepauzeerd.`,
              status: "auto_applied",
              auto_apply: true,
              applied_at: new Date().toISOString(),
              confidence: 1.0,
            });

            pausedCount++;
          } catch (e) {
            console.error(`Failed to pause campaign ${campId}:`, e);
          }
        }
      } else {
        for (const [campId, camp] of campaignMap) {
          if (camp.status !== "paused") continue;

          const { data: prevPause } = await supabase
            .from("ads_ai_recommendations")
            .select("id")
            .eq("entity_id", campId)
            .eq("tenant_id", tenantId)
            .eq("recommendation_type", "pause_campaign")
            .eq("status", "auto_applied")
            .limit(1);

          if (!prevPause || prevPause.length === 0) continue;

          try {
            await supabase
              .from("ads_bolcom_campaigns")
              .update({ status: "active" })
              .eq("id", campId)
              .eq("tenant_id", tenantId);

            // Also resume on Bol.com API
            if (camp.bolcom_campaign_id) {
              const bolToken = await getTokenForTenant(supabase, tenantId);
              if (bolToken) {
                try {
                  await bolPut(bolToken, `${BOL_ADV_BASE}/campaigns/${camp.bolcom_campaign_id}`, { state: "ENABLED" });
                } catch (e) {
                  console.error(`Failed to resume campaign ${campId} on Bol:`, e);
                }
              }
            }

            await supabase.from("ads_ai_recommendations").insert({
              tenant_id: tenantId,
              channel: "bolcom",
              entity_type: "campaign",
              entity_id: campId,
              recommendation_type: "resume_campaign",
              reason: `Voorraad van "${product.name}" is hersteld naar ${stock} (minimum: ${minStock}). Campagne automatisch hervat.`,
              status: "auto_applied",
              auto_apply: true,
              applied_at: new Date().toISOString(),
              confidence: 1.0,
            });

            resumedCount++;
          } catch (e) {
            console.error(`Failed to resume campaign ${campId}:`, e);
          }
        }
      }
    }

    return jsonRes({ success: true, paused: pausedCount, resumed: resumedCount });
  } catch (err) {
    console.error("ads-inventory-watch error:", err);
    return jsonRes({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

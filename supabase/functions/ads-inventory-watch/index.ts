import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Service role — processes all tenants
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get all advertised products with stock info
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

      // Find campaigns targeting this product via targeting_products → adgroups → campaigns
      const { data: targetLinks } = await supabase
        .from("ads_bolcom_targeting_products")
        .select("adgroup_id, ads_bolcom_adgroups(campaign_id, ads_bolcom_campaigns(id, status))")
        .eq("product_id", mapping.product_id)
        .eq("tenant_id", tenantId);

      if (!targetLinks || targetLinks.length === 0) continue;

      // Extract unique campaigns
      const campaignMap = new Map<string, { id: string; status: string }>();
      for (const tl of targetLinks) {
        const ag = tl.ads_bolcom_adgroups as any;
        if (!ag?.ads_bolcom_campaigns) continue;
        const camp = ag.ads_bolcom_campaigns;
        if (!campaignMap.has(camp.id)) {
          campaignMap.set(camp.id, { id: camp.id, status: camp.status });
        }
      }

      if (stock < minStock) {
        // PAUSE active campaigns
        for (const [campId, camp] of campaignMap) {
          if (camp.status !== "active") continue;

          // Try to pause via Bol.com API
          try {
            const bolManageUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ads-bolcom-manage`;
            // We need a user token but this is a service function — do direct DB update instead
            await supabase
              .from("ads_bolcom_campaigns")
              .update({ status: "paused" })
              .eq("id", campId)
              .eq("tenant_id", tenantId);

            // Log recommendation
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
        // RESUME campaigns that were auto-paused
        for (const [campId, camp] of campaignMap) {
          if (camp.status !== "paused") continue;

          // Check if there's an auto_applied pause recommendation for this campaign
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

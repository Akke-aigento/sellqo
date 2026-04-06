import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Get active auto_negative rules
    const { data: rules, error: rulesErr } = await supabase
      .from("ads_ai_rules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("rule_type", "auto_negative")
      .eq("is_active", true);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ recommendations_created: 0, auto_applied: 0, message: "No active rules" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCreated = 0;
    let totalAutoApplied = 0;

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown>;
      const actions = rule.actions as Record<string, unknown>;
      const lookbackDays = (conditions.lookback_days as number) || 14;
      const minClicks = (conditions.min_clicks as number) || 10;
      const maxConversions = (conditions.max_conversions as number) || 0;
      const minSpend = (conditions.min_spend as number) || 5.0;
      const matchType = (actions.match_type as string) || "exact";
      const autoApply = rule.is_active && (actions.auto_apply === true || (rule as any).auto_apply === true);

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - lookbackDays);
      const sinceDateStr = sinceDate.toISOString().split("T")[0];

      // Step 2: Get search terms in lookback window
      const { data: searchTerms, error: stErr } = await supabase
        .from("ads_bolcom_search_terms")
        .select("*")
        .eq("tenant_id", tenant_id)
        .gte("date", sinceDateStr);

      if (stErr) {
        console.error("Error fetching search terms:", stErr);
        continue;
      }
      if (!searchTerms || searchTerms.length === 0) continue;

      // Aggregate by search_term
      const aggregated = new Map<string, { clicks: number; spend: number; orders: number; impressions: number; revenue: number; adgroup_id: string | null; campaign_id: string | null }>();

      for (const st of searchTerms) {
        const key = st.search_term;
        const existing = aggregated.get(key);
        if (existing) {
          existing.clicks += st.clicks || 0;
          existing.spend += st.spend || 0;
          existing.orders += st.orders || 0;
          existing.impressions += st.impressions || 0;
          existing.revenue += st.revenue || 0;
          if (!existing.adgroup_id && st.adgroup_id) existing.adgroup_id = st.adgroup_id;
          if (!existing.campaign_id && st.campaign_id) existing.campaign_id = st.campaign_id;
        } else {
          aggregated.set(key, {
            clicks: st.clicks || 0,
            spend: st.spend || 0,
            orders: st.orders || 0,
            impressions: st.impressions || 0,
            revenue: st.revenue || 0,
            adgroup_id: st.adgroup_id,
            campaign_id: st.campaign_id,
          });
        }
      }

      // Step 3: Filter wasteful terms
      const wasteful: Array<{ term: string; stats: typeof aggregated extends Map<string, infer V> ? V : never }> = [];
      for (const [term, stats] of aggregated) {
        if (stats.clicks >= minClicks && stats.orders <= maxConversions && stats.spend >= minSpend) {
          wasteful.push({ term, stats });
        }
      }

      if (wasteful.length === 0) continue;

      // Step 4: Check for existing recommendations to avoid duplicates
      const wastefulTerms = wasteful.map((w) => w.term);
      const { data: existingRecs } = await supabase
        .from("ads_ai_recommendations")
        .select("current_value")
        .eq("tenant_id", tenant_id)
        .eq("recommendation_type", "add_negative_keyword")
        .in("status", ["pending", "accepted", "auto_applied"]);

      const existingTerms = new Set<string>();
      if (existingRecs) {
        for (const rec of existingRecs) {
          const cv = rec.current_value as Record<string, unknown> | null;
          if (cv?.search_term) existingTerms.add(cv.search_term as string);
        }
      }

      // Step 5: Create recommendations
      for (const { term, stats } of wasteful) {
        if (existingTerms.has(term)) continue;

        const confidence = Math.min(0.95, 0.5 + stats.clicks / 100);
        const acos = stats.revenue > 0 ? (stats.spend / stats.revenue) * 100 : null;
        const status = autoApply ? "auto_applied" : "pending";

        const { error: insertErr } = await supabase.from("ads_ai_recommendations").insert({
          tenant_id,
          channel: "bolcom",
          recommendation_type: "add_negative_keyword",
          entity_type: "search_term",
          entity_id: stats.adgroup_id,
          current_value: { search_term: term, clicks: stats.clicks, spend: stats.spend, orders: stats.orders, acos },
          recommended_value: { keyword: term, match_type: matchType },
          reason: `Zoekterm '${term}' heeft ${stats.clicks} clicks en €${stats.spend.toFixed(2)} spend maar ${stats.orders} conversies in de afgelopen ${lookbackDays} dagen`,
          confidence,
          status,
          auto_apply: autoApply,
          applied_at: autoApply ? new Date().toISOString() : null,
        });

        if (insertErr) {
          console.error("Error inserting recommendation:", insertErr);
          continue;
        }

        totalCreated++;

        // Step 6: Auto-apply if enabled
        if (autoApply && stats.adgroup_id) {
          totalAutoApplied++;
          try {
            const manageUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ads-bolcom-manage`;
            await fetch(manageUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                tenant_id,
                action: "add_negative_keyword",
                payload: {
                  adgroup_id: stats.adgroup_id,
                  keyword: term,
                  match_type: matchType,
                },
              }),
            });
          } catch (e) {
            console.error("Auto-apply failed for term:", term, e);
          }
        }
      }

      // Update rule last_triggered_at
      await supabase
        .from("ads_ai_rules")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", rule.id);
    }

    return new Response(
      JSON.stringify({ recommendations_created: totalCreated, auto_applied: totalAutoApplied }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ads-ai-engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

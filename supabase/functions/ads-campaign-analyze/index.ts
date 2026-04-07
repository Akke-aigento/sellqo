import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, tenant_id } = await req.json();
    if (!campaign_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "campaign_id and tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gather all campaign data in parallel
    const [campaignRes, adGroupsRes, keywordsRes, perfRes, searchTermsRes] = await Promise.all([
      supabase.from("ads_bolcom_campaigns").select("*").eq("id", campaign_id).eq("tenant_id", tenant_id).single(),
      supabase.from("ads_bolcom_adgroups").select("*").eq("campaign_id", campaign_id).eq("tenant_id", tenant_id),
      supabase.from("ads_bolcom_keywords").select("*").eq("tenant_id", tenant_id),
      supabase.from("ads_bolcom_performance").select("*").eq("campaign_id", campaign_id).eq("tenant_id", tenant_id).order("date", { ascending: false }).limit(500),
      supabase.from("ads_bolcom_search_terms").select("*").eq("campaign_id", campaign_id).eq("tenant_id", tenant_id).order("date", { ascending: false }).limit(200),
    ]);

    const campaign = campaignRes.data;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adGroups = adGroupsRes.data || [];
    const adGroupIds = adGroups.map((ag: any) => ag.id);
    const keywords = (keywordsRes.data || []).filter((k: any) => adGroupIds.includes(k.adgroup_id));
    const performance = perfRes.data || [];
    const searchTerms = searchTermsRes.data || [];

    // Early return if no data to analyze
    if (keywords.length === 0 && performance.length === 0 && searchTerms.length === 0) {
      return new Response(JSON.stringify({
        suggestions: [],
        count: 0,
        message: "Geen data beschikbaar om te analyseren. Wacht tot er performance data binnenkomt van Bol.com.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate keyword performance
    const kwPerfMap: Record<string, { impressions: number; clicks: number; spend: number; orders: number; revenue: number }> = {};
    for (const p of performance) {
      if (!p.keyword_id) continue;
      if (!kwPerfMap[p.keyword_id]) kwPerfMap[p.keyword_id] = { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 };
      const m = kwPerfMap[p.keyword_id];
      m.impressions += p.impressions || 0;
      m.clicks += p.clicks || 0;
      m.spend += p.spend || 0;
      m.orders += p.orders || 0;
      m.revenue += p.revenue || 0;
    }

    // Build prompt data
    const keywordData = keywords
      .filter((k: any) => !k.is_negative)
      .map((k: any) => {
        const perf = kwPerfMap[k.id] || { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 };
        const acos = perf.revenue > 0 ? ((perf.spend / perf.revenue) * 100).toFixed(1) : "N/A";
        return `- "${k.keyword}" (${k.match_type}, bod: €${k.bid?.toFixed(2) || "0.00"}, status: ${k.status}) → ${perf.impressions} imp, ${perf.clicks} clicks, €${perf.spend.toFixed(2)} spend, ${perf.orders} orders, ACoS: ${acos}% [ID: ${k.id}, adgroup: ${k.adgroup_id}]`;
      })
      .join("\n");

    const searchTermData = searchTerms
      .slice(0, 50)
      .map((st: any) => `- "${st.search_term}" → ${st.clicks || 0} clicks, €${(st.spend || 0).toFixed(2)} spend, ${st.orders || 0} orders`)
      .join("\n");

    const prompt = `Je bent een expert Bol.com Sponsored Products advertentie-optimizer. Analyseer de volgende campagne en geef concrete, actionable suggesties.

CAMPAGNE: "${campaign.name}"
Type: ${campaign.targeting_type} (${campaign.campaign_type})
Dagbudget: €${campaign.daily_budget?.toFixed(2) || "onbekend"}
Status: ${campaign.status}

KEYWORDS & PERFORMANCE (afgelopen 30 dagen):
${keywordData || "Geen keywords gevonden."}

ZOEKTERMEN (recent):
${searchTermData || "Geen zoektermen beschikbaar."}

REGELS:
- Bij ACoS > 30% en voldoende data (>10 clicks): overweeg bod verlagen of pauzeren
- Bij ACoS < 15% en goede conversie: overweeg bod verhogen voor meer volume
- Zoektermen met spend maar 0 orders: overweeg als negatief keyword
- Keywords zonder impressies: overweeg bod verhogen of verwijderen
- Geef maximaal 8 suggesties, gesorteerd op prioriteit
- Wees specifiek met bedragen (huidige waarde → nieuwe waarde)
- Geef een duidelijke, beknopte Nederlandse reden per suggestie
- Baseer je ALLEEN op de daadwerkelijke data hierboven. Verzin geen keywords of waarden die niet in de data staan.`;

    // Call Lovable AI with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Je bent een Bol.com advertising expert. Analyseer campagne data en geef concrete optimalisatie-suggesties. Gebruik altijd de campaign_suggestions tool om je antwoord te structureren. Baseer je ALLEEN op echte data — verzin nooit keywords of waarden." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "campaign_suggestions",
              description: "Geef gestructureerde campagne-optimalisatie suggesties",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action_type: { type: "string", enum: ["increase_bid", "decrease_bid", "pause_keyword", "add_negative", "resume_keyword"] },
                        entity_id: { type: "string", description: "ID van het keyword of adgroup" },
                        entity_name: { type: "string", description: "Naam/tekst van het keyword" },
                        current_value: { type: "string", description: "Huidige waarde, bijv. €0.25" },
                        recommended_value: { type: "string", description: "Aanbevolen waarde, bijv. €0.40" },
                        reason: { type: "string", description: "Korte Nederlandse uitleg waarom" },
                        confidence: { type: "number", description: "Betrouwbaarheid 0-1" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["action_type", "entity_name", "reason", "confidence", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "campaign_suggestions" } },
      }),
    });

    if (!aiResponse.ok) {
      const errStatus = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errStatus, errText);
      if (errStatus === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit bereikt. Probeer het later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errStatus === 402) {
        return new Response(JSON.stringify({ error: "Onvoldoende AI-credits. Vul je credits aan in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analyse mislukt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI gaf geen gestructureerd antwoord" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let suggestions: any[];
    try {
      const raw = toolCall.function.arguments;
      const cleaned = typeof raw === "string" ? raw.replace(/```json\s?/g, "").replace(/```/g, "").trim() : raw;
      const parsed = typeof cleaned === "string" ? JSON.parse(cleaned) : cleaned;
      suggestions = parsed.suggestions || [];
    } catch {
      return new Response(JSON.stringify({ error: "Kon AI-antwoord niet parsen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save suggestions to ads_ai_recommendations with campaign_id in entity_id context
    const records = suggestions.map((s: any) => ({
      tenant_id,
      channel: "bolcom",
      entity_type: s.action_type === "add_negative" ? "search_term" : "keyword",
      entity_id: s.entity_id || null,
      recommendation_type: s.action_type,
      current_value: s.current_value ? { value: s.current_value, campaign_id } : { campaign_id },
      recommended_value: s.recommended_value ? { value: s.recommended_value, campaign_id } : { campaign_id },
      reason: `[${s.entity_name}] ${s.reason}`,
      confidence: s.confidence,
      status: "pending",
      auto_apply: false,
    }));

    if (records.length > 0) {
      const { error: insertErr } = await supabase.from("ads_ai_recommendations").insert(records);
      if (insertErr) console.error("Insert error:", insertErr);
    }

    // Return suggestions with entity_name preserved for inline display
    return new Response(JSON.stringify({ suggestions, count: suggestions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ads-campaign-analyze error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

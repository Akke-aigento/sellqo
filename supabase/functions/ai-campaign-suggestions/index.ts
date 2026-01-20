import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { tenantId, context } = await req.json();

    // Check credits (1 for insights)
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 1,
      p_feature: 'campaign_suggestion',
      p_model: 'google/gemini-3-flash-preview',
    });

    if (!hasCredits) {
      return new Response(JSON.stringify({ error: 'Onvoldoende AI credits' }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Je bent een strategische marketing adviseur voor ${context.business.name}.
Analyseer de bedrijfsdata en suggereer de meest impactvolle marketing campagnes.

Geef je antwoord als JSON array met campagne suggesties:
[
  {
    "type": "campaign_type",
    "title": "Korte titel",
    "description": "Waarom deze campagne nu relevant is",
    "targetAudience": "Beschrijving doelgroep",
    "estimatedReach": number,
    "estimatedValue": number,
    "urgency": "high" | "medium" | "low",
    "suggestedTiming": "Wanneer te versturen",
    "keyProducts": ["product1", "product2"],
    "confidenceScore": 0-100
  }
]`;

    const dataPrompt = `
Analyseer deze bedrijfsdata en suggereer de top 5 marketing campagnes:

PRODUCTEN:
- Totaal: ${context.products.total}
- Lage voorraad (${context.products.lowStock.length}): ${context.products.lowStock.slice(0, 5).map((p: any) => `${p.name} (${p.stock} stuks)`).join(', ')}
- Nieuwe producten: ${context.products.newArrivals.map((p: any) => p.name).join(', ')}
- Uitgelicht: ${context.products.featured.map((p: any) => p.name).join(', ')}

KLANTEN:
- Totaal: ${context.customers.total}
- Nieuwsbrief abonnees: ${context.customers.subscribers}
- Recente aanmeldingen (7 dagen): ${context.customers.recentSignups}
- Top landen: ${context.customers.topCountries.map((c: any) => `${c.country} (${c.count})`).join(', ')}
- Segmenten: ${context.customers.segments.map((s: any) => `${s.name} (${s.memberCount})`).join(', ')}

BESTELLINGEN (laatste 30 dagen):
- Aantal: ${context.orders.lastMonth}
- Gemiddelde waarde: €${context.orders.avgOrderValue}
- Top producten: ${context.orders.topProducts.map((p: any) => p.productName).join(', ')}

EMAIL CAMPAGNES:
- Totaal verzonden: ${context.campaigns.total}
- Gem. open rate: ${context.campaigns.avgOpenRate}%
- Gem. click rate: ${context.campaigns.avgClickRate}%

SEIZOEN:
- Huidig: ${context.seasonality.currentSeason}
- Maand: ${context.seasonality.currentMonth}
- Aankomende feestdagen: ${context.seasonality.upcomingHolidays.map((h: any) => `${h.name} (${h.daysUntil} dagen)`).join(', ')}

INZICHTEN:
- Lage voorraad alert: ${context.insights.lowStockAlert ? 'JA' : 'NEE'}
- Win-back potentieel: ${context.insights.winBackOpportunity} klanten
- Hoge engagement segment: ${context.insights.highEngagementSegment || 'Geen'}

Baseer je suggesties op de data. Prioriteer op basis van potentiële impact en urgentie.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dataPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit overschreden. Probeer het over een minuut opnieuw.' }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const generatedText = aiResult.choices?.[0]?.message?.content?.trim() || '[]';

    let suggestions: any[] = [];
    try {
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Error parsing suggestions:", e);
    }

    // Add default campaign types if AI didn't provide enough
    if (suggestions.length < 3) {
      if (context.products.lowStock.length > 0) {
        suggestions.push({
          type: 'low_stock',
          title: 'Laatste Kans Campagne',
          description: `${context.products.lowStock.length} producten zijn bijna uitverkocht`,
          targetAudience: 'Alle nieuwsbrief abonnees',
          estimatedReach: context.customers.subscribers,
          urgency: 'high',
          confidenceScore: 85,
        });
      }
      if (context.insights.winBackOpportunity > 10) {
        suggestions.push({
          type: 'win_back',
          title: 'Win-back Campagne',
          description: `${context.insights.winBackOpportunity} inactieve klanten kunnen worden teruggewonnen`,
          targetAudience: 'Klanten zonder recente aankoop',
          estimatedReach: context.insights.winBackOpportunity,
          urgency: 'medium',
          confidenceScore: 75,
        });
      }
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-campaign-suggestions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

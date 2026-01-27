import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  fieldType: 'title' | 'subtitle' | 'cta' | 'button' | 'description';
  sectionType: 'hero' | 'newsletter' | 'text_image' | 'featured_products' | 'testimonials';
  currentValue?: string;
  action: 'generate' | 'rewrite' | 'shorter' | 'longer';
  tenantContext?: {
    businessName?: string;
    industry?: string;
    tone?: string;
  };
}

interface MarketingContext {
  business: {
    name: string;
    currency: string;
    country: string;
  };
  products: {
    bestsellers: Array<{ name: string }>;
    featured: Array<{ name: string }>;
  };
  seasonality: {
    currentMonth: string;
    currentSeason: string;
    upcomingHolidays: Array<{ name: string; daysUntil: number }>;
  };
}

interface SEOKeyword {
  keyword: string;
  is_primary: boolean;
  intent: string | null;
  search_volume_estimate: string | null;
}

interface LearningPattern {
  pattern_type: string;
  learned_value: {
    preference?: string;
    last_example?: string;
  };
  confidence_score: number;
}

// Fetch marketing context for the tenant
async function fetchMarketingContext(supabase: SupabaseClient, tenantId: string): Promise<Partial<MarketingContext>> {
  try {
    const [tenantResult, bestsellersResult, featuredResult] = await Promise.all([
      supabase.from('tenants').select('name, currency, country').eq('id', tenantId).single(),
      supabase.from('products')
        .select('name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('products')
        .select('name')
        .eq('tenant_id', tenantId)
        .eq('is_featured', true)
        .eq('is_active', true)
        .limit(5),
    ]);

    const now = new Date();
    const month = now.getMonth();
    const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 
                        'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
    
    let season = 'winter';
    if (month >= 2 && month <= 4) season = 'lente';
    else if (month >= 5 && month <= 7) season = 'zomer';
    else if (month >= 8 && month <= 10) season = 'herfst';

    const holidays = [
      { name: 'Valentijnsdag', month: 1, day: 14 },
      { name: 'Pasen', month: 3, day: 20 },
      { name: 'Moederdag', month: 4, day: 11 },
      { name: 'Vaderdag', month: 5, day: 15 },
      { name: 'Black Friday', month: 10, day: 29 },
      { name: 'Sinterklaas', month: 11, day: 5 },
      { name: 'Kerstmis', month: 11, day: 25 },
    ];

    const upcomingHolidays = holidays
      .map(h => {
        let holidayDate = new Date(now.getFullYear(), h.month, h.day);
        if (holidayDate < now) {
          holidayDate = new Date(now.getFullYear() + 1, h.month, h.day);
        }
        const daysUntil = Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { name: h.name, daysUntil };
      })
      .filter(h => h.daysUntil <= 45)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 2);

    return {
      business: {
        name: tenantResult.data?.name || '',
        currency: tenantResult.data?.currency || 'EUR',
        country: tenantResult.data?.country || 'BE',
      },
      products: {
        bestsellers: (bestsellersResult.data || []).map(p => ({ name: p.name })),
        featured: (featuredResult.data || []).map(p => ({ name: p.name })),
      },
      seasonality: {
        currentMonth: monthNames[month],
        currentSeason: season,
        upcomingHolidays,
      },
    };
  } catch (error) {
    console.error('Error fetching marketing context:', error);
    return {};
  }
}

// Fetch primary SEO keywords for the tenant
async function fetchSEOKeywords(supabase: SupabaseClient, tenantId: string): Promise<SEOKeyword[]> {
  try {
    const { data, error } = await supabase
      .from('seo_keywords')
      .select('keyword, is_primary, intent, search_volume_estimate')
      .eq('tenant_id', tenantId)
      .eq('is_primary', true)
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching SEO keywords:', error);
    return [];
  }
}

// Fetch learning patterns for the tenant (and optionally user)
async function fetchLearningPatterns(
  supabase: SupabaseClient, 
  tenantId: string, 
  userId?: string
): Promise<LearningPattern[]> {
  try {
    // Fetch tenant-level patterns
    const { data: tenantPatterns } = await supabase
      .from('ai_learning_patterns')
      .select('pattern_type, learned_value, confidence_score')
      .eq('tenant_id', tenantId)
      .gte('confidence_score', 0.5);

    // Fetch user-level patterns if userId is provided
    let userPatterns: LearningPattern[] = [];
    if (userId) {
      const { data } = await supabase
        .from('ai_user_learning_patterns')
        .select('pattern_type, learned_value, confidence_score')
        .eq('user_id', userId)
        .gte('confidence_score', 0.5);
      userPatterns = data || [];
    }

    // Merge patterns, preferring user-level patterns over tenant-level
    const patternMap = new Map<string, LearningPattern>();
    
    (tenantPatterns || []).forEach(p => {
      patternMap.set(p.pattern_type, p as LearningPattern);
    });
    
    userPatterns.forEach(p => {
      patternMap.set(p.pattern_type, p as LearningPattern);
    });

    return Array.from(patternMap.values());
  } catch (error) {
    console.error('Error fetching learning patterns:', error);
    return [];
  }
}

// Build an enhanced system prompt with all context
function buildEnhancedSystemPrompt(
  marketingContext: Partial<MarketingContext>,
  seoKeywords: SEOKeyword[],
  learningPatterns: LearningPattern[],
  tenantContext?: GenerateRequest['tenantContext']
): string {
  const parts: string[] = [];

  // Base prompt
  parts.push(`Je bent een Nederlandse copywriter gespecialiseerd in e-commerce en webshops.
Je schrijft beknopte, pakkende teksten die conversie stimuleren.`);

  // Business context
  if (marketingContext.business?.name || tenantContext?.businessName) {
    parts.push(`\nBEDRIJFSCONTEXT:`);
    parts.push(`- Webshop: ${marketingContext.business?.name || tenantContext?.businessName || 'Onbekend'}`);
    if (tenantContext?.industry) {
      parts.push(`- Branche: ${tenantContext.industry}`);
    }
    if (marketingContext.products?.bestsellers?.length) {
      parts.push(`- Populaire producten: ${marketingContext.products.bestsellers.slice(0, 3).map(p => p.name).join(', ')}`);
    }
    if (marketingContext.products?.featured?.length) {
      parts.push(`- Uitgelichte producten: ${marketingContext.products.featured.slice(0, 3).map(p => p.name).join(', ')}`);
    }
  }

  // SEO guidelines
  if (seoKeywords.length > 0) {
    parts.push(`\nSEO RICHTLIJNEN:`);
    const primaryKWs = seoKeywords.map(k => k.keyword).slice(0, 5);
    parts.push(`- Belangrijke zoekwoorden: ${primaryKWs.join(', ')}`);
    
    // Dominant intent
    const intents = seoKeywords.filter(k => k.intent).map(k => k.intent);
    const intentCounts = intents.reduce((acc, i) => {
      acc[i!] = (acc[i!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const dominantIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    if (dominantIntent) {
      const intentDescriptions: Record<string, string> = {
        'transactional': 'koopgericht (gebruikers willen kopen)',
        'commercial': 'vergelijkend (gebruikers onderzoeken opties)',
        'informational': 'informatief (gebruikers zoeken kennis)',
        'navigational': 'navigerend (gebruikers zoeken specifieke pagina)',
      };
      parts.push(`- Zoekintentie: ${intentDescriptions[dominantIntent] || dominantIntent}`);
    }
    parts.push(`- Verwerk keywords natuurlijk, niet geforceerd`);
  }

  // Seasonality
  if (marketingContext.seasonality) {
    parts.push(`\nSEIZOENALITEIT:`);
    parts.push(`- Seizoen: ${marketingContext.seasonality.currentSeason} (${marketingContext.seasonality.currentMonth})`);
    
    if (marketingContext.seasonality.upcomingHolidays?.length) {
      const holidays = marketingContext.seasonality.upcomingHolidays;
      holidays.forEach(h => {
        if (h.daysUntil <= 14) {
          parts.push(`- 🎉 ${h.name} over ${h.daysUntil} dagen! (Overweeg hier naar te verwijzen)`);
        } else {
          parts.push(`- ${h.name} over ${h.daysUntil} dagen`);
        }
      });
    }
  }

  // Learning patterns / personal style
  const relevantPatterns = learningPatterns.filter(p => p.confidence_score >= 0.5);
  if (relevantPatterns.length > 0) {
    parts.push(`\nPERSOONLIJKE STIJL (geleerd van eerdere bewerkingen):`);
    
    relevantPatterns.forEach(p => {
      const preference = p.learned_value?.preference;
      if (!preference || preference === 'unchanged' || preference === 'same') return;

      if (p.pattern_type.includes('tone')) {
        const toneMap: Record<string, string> = {
          'formal': 'formeel en zakelijk',
          'casual': 'informeel en vriendelijk',
          'playful': 'speels en creatief',
          'professional': 'professioneel maar toegankelijk',
        };
        parts.push(`- Toon: ${toneMap[preference] || preference}`);
      }
      if (p.pattern_type.includes('length')) {
        const lengthMap: Record<string, string> = {
          'shorter': 'liever kortere teksten',
          'longer': 'liever uitgebreidere teksten',
        };
        if (lengthMap[preference]) parts.push(`- Lengte: ${lengthMap[preference]}`);
      }
      if (p.pattern_type.includes('emoji')) {
        const emojiMap: Record<string, string> = {
          'more': 'gebruik gerust emoji\'s',
          'less': 'minimaal emoji gebruik',
          'none': 'geen emoji\'s gebruiken',
        };
        if (emojiMap[preference]) parts.push(`- Emoji: ${emojiMap[preference]}`);
      }
    });
  }

  // Tone (fallback)
  if (tenantContext?.tone && !relevantPatterns.some(p => p.pattern_type.includes('tone'))) {
    parts.push(`\nSTIJL:`);
    parts.push(`- Gewenste toon: ${tenantContext.tone}`);
  }

  // Final instruction
  parts.push(`\nAntwoord ALLEEN met de gegenereerde tekst, zonder aanhalingstekens, uitleg of extra opmaak.`);

  return parts.join('\n');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get tenant from auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tenantId: string | null = null;
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        tenantId = userRole?.tenant_id;
      }
    }

    const { fieldType, sectionType, currentValue, action, tenantContext }: GenerateRequest = await req.json();

    // Fetch context in parallel
    let marketingContext: Partial<MarketingContext> = {};
    let seoKeywords: SEOKeyword[] = [];
    let learningPatterns: LearningPattern[] = [];

    if (tenantId) {
      [marketingContext, seoKeywords, learningPatterns] = await Promise.all([
        fetchMarketingContext(supabase, tenantId),
        fetchSEOKeywords(supabase, tenantId),
        fetchLearningPatterns(supabase, tenantId, userId || undefined),
      ]);
    }

    // Build enhanced system prompt
    const systemPrompt = buildEnhancedSystemPrompt(
      marketingContext,
      seoKeywords,
      learningPatterns,
      tenantContext
    );

    // Build the field-specific prompt
    const prompts: Record<string, Record<string, string>> = {
      hero: {
        title: "een krachtige, aandachttrekkende hero titel voor een webshop homepage",
        subtitle: "een ondersteunende subtitel die de waardepropositie verduidelijkt",
        cta: "een overtuigende call-to-action knoptekst",
        button: "een korte, actiegerichte knoptekst",
      },
      newsletter: {
        title: "een uitnodigende titel voor een nieuwsbrief aanmeldsectie",
        subtitle: "een korte beschrijving waarom mensen zich moeten aanmelden",
        button: "een aanmoedigende aanmeldknoptekst",
      },
      text_image: {
        title: "een pakkende sectietitel",
        subtitle: "een informatieve ondertitel",
        description: "een overtuigende paragraaf",
        button: "een relevante call-to-action",
      },
      featured_products: {
        title: "een aantrekkelijke titel voor uitgelichte producten",
        subtitle: "een korte introductie voor de productenselectie",
      },
      testimonials: {
        title: "een vertrouwenwekkende titel voor de reviews sectie",
        subtitle: "een korte introductie voor klantbeoordelingen",
      },
    };

    const fieldDescription = prompts[sectionType]?.[fieldType] || `een ${fieldType} voor een ${sectionType} sectie`;

    let userPrompt = '';
    
    switch (action) {
      case 'generate':
        userPrompt = `Genereer ${fieldDescription}.${fieldType === 'title' ? ' Maximaal 8 woorden.' : fieldType === 'subtitle' ? ' Maximaal 15 woorden.' : fieldType === 'cta' || fieldType === 'button' ? ' Maximaal 3 woorden.' : ' Maximaal 25 woorden.'}`;
        break;
      case 'rewrite':
        userPrompt = `Herschrijf de volgende tekst professioneler en overtuigender: "${currentValue}"\n\nBehoud dezelfde lengte en intentie.`;
        break;
      case 'shorter':
        userPrompt = `Maak de volgende tekst korter maar behoud de essentie: "${currentValue}"\n\nMaximaal de helft van de originele lengte.`;
        break;
      case 'longer':
        userPrompt = `Breid de volgende tekst uit met meer detail of overtuigingskracht: "${currentValue}"\n\nMaak het ongeveer 50% langer.`;
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit bereikt. Probeer het later opnieuw." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Geen AI credits meer beschikbaar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Log AI usage if tenant is identified
    if (tenantId) {
      await supabase.from("ai_usage_log").insert({
        tenant_id: tenantId,
        feature: "storefront_copy",
        credits_used: 1,
        model_used: "google/gemini-3-flash-preview",
        metadata: { 
          fieldType, 
          sectionType, 
          action,
          hadSEOContext: seoKeywords.length > 0,
          hadLearningPatterns: learningPatterns.length > 0,
        },
      });

      // Use credits
      await supabase.rpc("use_ai_credits", {
        p_tenant_id: tenantId,
        p_credits_needed: 1,
      });
    }

    return new Response(
      JSON.stringify({ text: generatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-storefront-copy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

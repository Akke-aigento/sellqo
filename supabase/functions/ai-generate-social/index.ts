import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface GenerateSocialRequest {
  tenantId: string;
  context: any;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  contentType: 'product_highlight' | 'low_stock_alert' | 'new_arrival' | 'seasonal' | 'custom';
  productIds?: string[];
  customPrompt?: string;
  tone?: 'professional' | 'casual' | 'playful' | 'urgent';
  language?: 'nl' | 'en' | 'de' | 'fr';
}

const languageInstructions: Record<string, string> = {
  nl: 'Schrijf in het Nederlands (informeel, Vlaams/Nederlands)',
  en: 'Write in English (British English preferred)',
  de: 'Schreibe auf Deutsch (Sie-Form)',
  fr: 'Écris en français (vouvoiement)',
};

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

    const body: GenerateSocialRequest = await req.json();
    const { tenantId, context, platform, contentType, productIds, customPrompt, tone = 'casual', language = 'nl' } = body;

    // Check credits
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 2,
      p_feature: 'social_post',
      p_model: 'google/gemini-3-flash-preview',
      p_metadata: { platform, contentType },
    });

    if (!hasCredits) {
      return new Response(JSON.stringify({ error: 'Onvoldoende AI credits' }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get specific products if IDs provided
    let selectedProducts: any[] = [];
    if (productIds && productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, description, short_description, featured_image, tags')
        .in('id', productIds);
      selectedProducts = products || [];
    }

    // Build prompt based on content type
    let contentPrompt = '';
    switch (contentType) {
      case 'product_highlight':
        const product = selectedProducts[0] || context.products.featured?.[0] || context.products.bestsellers?.[0];
        contentPrompt = `
Maak een aansprekende social media post voor dit product:
- Naam: ${product?.name || 'Product'}
- Prijs: €${product?.price || 0}
- Beschrijving: ${product?.short_description || product?.description || 'Een geweldig product'}
- Tags: ${product?.tags?.join(', ') || ''}

Focus op de voordelen en creëer een duidelijke call-to-action.`;
        break;
      
      case 'low_stock_alert':
        const lowStockItems = context.products.lowStock.slice(0, 3);
        contentPrompt = `
Creëer een urgente "bijna uitverkocht" post voor deze producten:
${lowStockItems.map((p: any) => `- ${p.name} (nog ${p.stock} stuks voor €${p.price})`).join('\n')}

Creëer FOMO (fear of missing out) en urgentie zonder pushy te zijn.`;
        break;
      
      case 'new_arrival':
        const newItems = context.products.newArrivals.slice(0, 3);
        contentPrompt = `
Kondig deze nieuwe producten aan:
${newItems.map((p: any) => `- ${p.name} - €${p.price}`).join('\n')}

Maak het enthousiast en uitnodigend om te ontdekken.`;
        break;
      
      case 'seasonal':
        const season = context.seasonality;
        const holiday = season.upcomingHolidays[0];
        contentPrompt = `
Maak een seizoensgebonden post voor ${season.currentSeason}${holiday ? ` met focus op ${holiday.name} (over ${holiday.daysUntil} dagen)` : ''}.

Gebruik relevante producten uit deze categorieën:
${context.products.featured.slice(0, 3).map((p: any) => `- ${p.name}`).join('\n')}

Maak het feestelijk en relevant voor het seizoen.`;
        break;
      
      case 'custom':
        contentPrompt = customPrompt || 'Maak een algemene promotionele post.';
        break;
    }

    // Platform-specific guidelines
    const platformGuidelines: Record<string, string> = {
      instagram: `
Instagram richtlijnen:
- Maximaal 2200 tekens, maar houd het kort en krachtig (150-300 tekens ideaal)
- Gebruik 3-5 relevante hashtags
- Gebruik emoji's strategisch
- Eindig met een call-to-action
- Schrijf in een visuele, inspirerende stijl`,
      facebook: `
Facebook richtlijnen:
- 100-250 tekens werkt het beste
- Kan langer zijn als het echt waardevol is
- Vraag engagement (likes, comments, shares)
- Emoji's zijn welkom maar niet overdrijven
- Link hint in de post`,
      linkedin: `
LinkedIn richtlijnen:
- Professionele toon
- 150-300 tekens voor de hook
- Gebruik bullet points of nummering
- Eindig met een thought-provoking vraag of CTA
- Minimaal emoji gebruik`,
      twitter: `
Twitter/X richtlijnen:
- Maximaal 280 tekens!
- Kort, puntig en deelbaar
- 1-2 hashtags maximaal
- Emoji's werken goed
- Creëer urgentie of nieuwsgierigheid`,
    };

    const toneDescriptions: Record<string, string> = {
      professional: 'Professioneel en betrouwbaar, zakelijke toon',
      casual: 'Vriendelijk en toegankelijk, alsof je met een vriend praat',
      playful: 'Speels en creatief, met humor en emoji',
      urgent: 'Dringend en actiegericht, creëer FOMO',
    };

    const systemPrompt = `Je bent een expert social media marketeer voor ${context.business.name}.
${languageInstructions[language] || languageInstructions.nl}
Je kent de doelgroep en weet wat werkt op social media.

Bedrijfscontext:
- Bedrijf: ${context.business.name}
- Land: ${context.business.country}
- Valuta: ${context.business.currency}
- ${context.customers.total} klanten, ${context.customers.subscribers} nieuwsbriefabonnees
- Gemiddelde orderwaarde: €${context.orders.avgOrderValue}

${platformGuidelines[platform]}

Toon: ${toneDescriptions[tone]}

Antwoord ALLEEN met de post tekst, zonder extra uitleg of quotes.`;

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
          { role: "user", content: contentPrompt },
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit overschreden. Probeer het over een minuut opnieuw.' }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const generatedContent = aiResult.choices?.[0]?.message?.content?.trim() || '';

    // Save generated content
    const { data: savedContent, error: saveError } = await supabase
      .from('ai_generated_content')
      .insert({
        tenant_id: tenantId,
        content_type: 'social_post',
        platform,
        title: `${platform} - ${contentType}`,
        content_text: generatedContent,
        product_ids: productIds || [],
        language,
        metadata: {
          contentType,
          tone,
          language,
          context: {
            businessName: context.business.name,
            productCount: selectedProducts.length,
          },
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving content:", saveError);
    }

    // Generate alternative versions
    const alternativesPrompt = `Geef 2 alternatieve versies van deze ${platform} post, elk met een andere invalshoek:

Origineel:
${generatedContent}

Geef de alternatieven als JSON array: ["alternatief 1", "alternatief 2"]`;

    const altResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Je geeft alternatieve social media posts in JSON format." },
          { role: "user", content: alternativesPrompt },
        ],
        max_tokens: 600,
        temperature: 0.9,
      }),
    });

    let alternatives: string[] = [];
    if (altResponse.ok) {
      const altResult = await altResponse.json();
      const altText = altResult.choices?.[0]?.message?.content || '[]';
      try {
        // Try to extract JSON from the response
        const jsonMatch = altText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          alternatives = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing alternatives:", e);
      }
    }

    return new Response(JSON.stringify({
      content: generatedContent,
      alternatives,
      platform,
      contentType,
      savedId: savedContent?.id,
      suggestedImages: selectedProducts.map((p: any) => p.featured_image).filter(Boolean),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-generate-social:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

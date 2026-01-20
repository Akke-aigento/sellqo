import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface GenerateEmailRequest {
  tenantId: string;
  context: any;
  campaignType: 'newsletter' | 'promotion' | 'win_back' | 'new_product' | 'low_stock' | 'custom';
  segmentId?: string;
  productIds?: string[];
  customPrompt?: string;
  includeDiscount?: boolean;
  discountPercentage?: number;
}

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

    const body: GenerateEmailRequest = await req.json();
    const { tenantId, context, campaignType, segmentId, productIds, customPrompt, includeDiscount, discountPercentage } = body;

    // Check credits (3 for email)
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 3,
      p_feature: 'email_content',
      p_model: 'google/gemini-3-flash-preview',
      p_metadata: { campaignType },
    });

    if (!hasCredits) {
      return new Response(JSON.stringify({ error: 'Onvoldoende AI credits' }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get segment info if provided
    let segmentInfo = null;
    if (segmentId) {
      const { data } = await supabase
        .from('customer_segments')
        .select('name, description, member_count')
        .eq('id', segmentId)
        .single();
      segmentInfo = data;
    }

    // Get products if provided
    let selectedProducts: any[] = [];
    if (productIds && productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, description, short_description, featured_image')
        .in('id', productIds);
      selectedProducts = products || [];
    }

    // Build campaign-specific prompt
    let contentPrompt = '';
    switch (campaignType) {
      case 'newsletter':
        contentPrompt = `
Maak een maandelijkse nieuwsbrief met:
- Update over nieuwe producten (${context.products.newArrivals.length} nieuwe items)
- Highlight van bestsellers
- Eventuele seizoensgerelateerde content (${context.seasonality.currentSeason})
${context.seasonality.upcomingHolidays[0] ? `- Vermelding van aankomend: ${context.seasonality.upcomingHolidays[0].name}` : ''}`;
        break;

      case 'promotion':
        contentPrompt = `
Maak een promotie-email:
${includeDiscount ? `- Korting: ${discountPercentage || 10}% op geselecteerde producten` : '- Algemene promotie zonder specifieke korting'}
- Uitgelichte producten: ${selectedProducts.length > 0 ? selectedProducts.map(p => p.name).join(', ') : context.products.featured.map((p: any) => p.name).join(', ')}
- Creëer urgentie met een beperkte tijdsaanbieding`;
        break;

      case 'win_back':
        contentPrompt = `
Maak een win-back email voor inactieve klanten:
- ${context.insights.winBackOpportunity} klanten zijn niet geabonneerd
- Herinner hen aan wat ze missen
- Eventueel een speciale "we missen je" korting
- Toon nieuwe of populaire producten die ze gemist hebben`;
        break;

      case 'new_product':
        const newProducts = selectedProducts.length > 0 ? selectedProducts : context.products.newArrivals;
        contentPrompt = `
Maak een nieuwe product aankondiging:
${newProducts.map((p: any) => `- ${p.name}: €${p.price} - ${p.short_description || p.description || ''}`).join('\n')}
- Creëer enthousiasme en exclusiviteit
- Early bird voordeel voor snelle bestellers`;
        break;

      case 'low_stock':
        contentPrompt = `
Maak een urgente "bijna uitverkocht" email:
${context.products.lowStock.slice(0, 5).map((p: any) => `- ${p.name}: nog ${p.stock} stuks`).join('\n')}
- Creëer FOMO
- Duidelijke CTA om nu te bestellen
- Urgente maar niet opdringerige toon`;
        break;

      case 'custom':
        contentPrompt = customPrompt || 'Maak een algemene marketing email.';
        break;
    }

    const systemPrompt = `Je bent een expert email marketeer voor ${context.business.name}.
Je schrijft professionele maar warme marketing emails in het Nederlands.

Bedrijfscontext:
- Bedrijf: ${context.business.name}
- ${context.customers.total} klanten
- Gemiddelde orderwaarde: €${context.orders.avgOrderValue}
- Beste campagne open rate: ${context.campaigns.avgOpenRate}%

${segmentInfo ? `Doelgroep segment: ${segmentInfo.name} (${segmentInfo.member_count} klanten) - ${segmentInfo.description}` : ''}

Geef je antwoord in het volgende JSON formaat:
{
  "subjectLines": ["onderwerp 1", "onderwerp 2", "onderwerp 3"],
  "previewText": "preview tekst voor inbox",
  "greeting": "Beste {{first_name}}",
  "body": "De HTML body van de email (gebruik <p>, <h2>, <ul>, <li> tags)",
  "cta": {
    "text": "CTA button tekst",
    "url": "{{shop_url}}"
  },
  "closing": "Afsluitende tekst met groet"
}`;

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
        max_tokens: 1500,
        temperature: 0.7,
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
    const generatedText = aiResult.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON response
    let emailContent: any = {};
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        emailContent = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Error parsing email JSON:", e);
      // Fallback structure
      emailContent = {
        subjectLines: ["Nieuws van " + context.business.name],
        previewText: "Ontdek wat we voor je hebben",
        greeting: "Beste {{first_name}}",
        body: generatedText,
        cta: { text: "Bekijk onze shop", url: "{{shop_url}}" },
        closing: "Met vriendelijke groet,\n" + context.business.name,
      };
    }

    // Build HTML template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="padding: 20px;">
    <p style="font-size: 16px; margin-bottom: 20px;">${emailContent.greeting || 'Beste klant'},</p>
    
    <div style="margin-bottom: 24px;">
      ${emailContent.body || ''}
    </div>
    
    ${emailContent.cta ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${emailContent.cta.url}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        ${emailContent.cta.text}
      </a>
    </div>
    ` : ''}
    
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
      <p style="margin: 0; white-space: pre-line;">${emailContent.closing || ''}</p>
    </div>
  </div>
</body>
</html>`;

    // Save generated content
    await supabase.from('ai_generated_content').insert({
      tenant_id: tenantId,
      content_type: 'email_campaign',
      platform: 'email',
      title: emailContent.subjectLines?.[0] || 'Email Campagne',
      content_text: emailContent.body,
      html_content: htmlContent,
      segment_id: segmentId,
      product_ids: productIds || [],
      metadata: { campaignType, emailContent },
    });

    return new Response(JSON.stringify({
      ...emailContent,
      htmlContent,
      campaignType,
      segmentName: segmentInfo?.name,
      productCount: selectedProducts.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-generate-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

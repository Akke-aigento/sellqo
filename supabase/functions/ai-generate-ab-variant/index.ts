import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface GenerateABVariantRequest {
  tenantId: string;
  originalCampaignId: string;
  variationType: 'subject' | 'tone' | 'cta' | 'full';
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

    const body: GenerateABVariantRequest = await req.json();
    const { tenantId, originalCampaignId, variationType = 'subject' } = body;

    // Get original campaign
    const { data: originalCampaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', originalCampaignId)
      .single();

    if (campaignError || !originalCampaign) {
      throw new Error('Original campaign not found');
    }

    // Check credits
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 3,
      p_feature: 'ab_variant',
      p_model: 'google/gemini-3-flash-preview',
      p_metadata: { variationType, originalId: originalCampaignId },
    });

    if (!hasCredits) {
      return new Response(JSON.stringify({ error: 'Onvoldoende AI credits' }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt based on variation type
    let variationPrompt = '';
    switch (variationType) {
      case 'subject':
        variationPrompt = `
Maak een alternatieve onderwerpregel voor deze email campagne.
Originele onderwerpregel: "${originalCampaign.subject}"

Geef een compleet andere invalshoek die:
- Net zo aantrekkelijk is maar met een andere emotionele trigger
- Andere woorden gebruikt
- Eventueel een andere lengte heeft

Geef alleen de nieuwe onderwerpregel, zonder uitleg.`;
        break;

      case 'tone':
        variationPrompt = `
Herschrijf deze email content met een andere toon:
---
${originalCampaign.html_content}
---

Als de originele toon formeel is, maak het casual. Als het casual is, maak het meer urgent.
Behoud de kernboodschap maar verander de stijl.

Geef je antwoord als JSON: {"subject": "nieuwe onderwerpregel", "html_content": "<html content>"}`;
        break;

      case 'cta':
        variationPrompt = `
Herschrijf deze email met een andere call-to-action benadering:
---
${originalCampaign.html_content}
---

Verander de CTA button tekst en de manier waarop de actie wordt aangemoedigd.
Als de originele CTA direct is, maak het subtieler. Als het subtiel is, maak het urgenter.

Geef je antwoord als JSON: {"subject": "nieuwe onderwerpregel", "html_content": "<html content>"}`;
        break;

      case 'full':
        variationPrompt = `
Maak een compleet alternatieve versie van deze email campagne:
---
Onderwerp: ${originalCampaign.subject}
Content: ${originalCampaign.html_content}
---

Behoud het doel en de kernboodschap, maar gebruik:
- Een andere invalshoek
- Andere woorden en zinsbouw
- Een andere toon
- Een andere CTA formulering

Geef je antwoord als JSON: {"subject": "nieuwe onderwerpregel", "preview_text": "preview tekst", "html_content": "<complete html content>"}`;
        break;
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: "Je bent een expert email marketeer. Je maakt A/B test varianten die significant verschillen van het origineel maar even effectief kunnen zijn."
          },
          { role: "user", content: variationPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const generatedText = aiResult.choices?.[0]?.message?.content?.trim() || '';

    // Parse response based on variation type
    let variantData: any = {};
    
    if (variationType === 'subject') {
      variantData = {
        subject: generatedText.replace(/^["']|["']$/g, ''),
        html_content: originalCampaign.html_content,
        preview_text: originalCampaign.preview_text,
      };
    } else {
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          variantData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing variant JSON:", e);
        variantData = {
          subject: originalCampaign.subject + ' (Variant)',
          html_content: generatedText,
          preview_text: originalCampaign.preview_text,
        };
      }
    }

    // Create the B variant campaign
    const { data: variantCampaign, error: createError } = await supabase
      .from('email_campaigns')
      .insert({
        tenant_id: tenantId,
        name: `${originalCampaign.name} - Variant B`,
        subject: variantData.subject || originalCampaign.subject,
        preview_text: variantData.preview_text || originalCampaign.preview_text,
        html_content: variantData.html_content || originalCampaign.html_content,
        template_id: originalCampaign.template_id,
        segment_id: originalCampaign.segment_id,
        status: 'draft',
        is_ab_test: true,
        variant_label: 'B',
        ab_variant_of: originalCampaignId,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update original campaign
    await supabase
      .from('email_campaigns')
      .update({ is_ab_test: true, variant_label: 'A' })
      .eq('id', originalCampaignId);

    return new Response(JSON.stringify({
      variantCampaign,
      variationType,
      originalCampaignId,
      changes: {
        subject: variantData.subject !== originalCampaign.subject,
        content: variantData.html_content !== originalCampaign.html_content,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-generate-ab-variant:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

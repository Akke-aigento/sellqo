import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromoKitRequest {
  tenantId: string;
  productId: string;
  productName: string;
  productDescription?: string;
  productPrice: number;
  productImageUrl?: string;
  tone: 'urgent' | 'casual' | 'professional' | 'playful';
  includeDiscount?: boolean;
  discountPercentage?: number;
  language: 'nl' | 'en' | 'de' | 'fr';
  generateImages?: boolean;
}

const toneDescriptions = {
  urgent: 'Creëer urgentie met woorden als "Nu", "Beperkte tijd", "Op=Op", "Laatste kans". Gebruik krachtige action words.',
  casual: 'Gebruik een vriendelijke, relaxte toon. Spreek de lezer aan als vriend. Gebruik emoji\'s sparingly.',
  professional: 'Zakelijke, formele toon. Focus op waarde en kwaliteit. Geen emoji\'s, wel professionele taal.',
  playful: 'Speelse, energieke toon. Gebruik emoji\'s, creatieve woordspelingen, en enthousiaste taal.',
};

const languageNames = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const {
      tenantId,
      productId,
      productName,
      productDescription,
      productPrice,
      productImageUrl,
      tone,
      includeDiscount,
      discountPercentage,
      language,
      generateImages = true,
    }: PromoKitRequest = await req.json();

    if (!tenantId || !productId || !productName || !tone || !language) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the comprehensive prompt
    const discountText = includeDiscount && discountPercentage 
      ? `Er is een korting van ${discountPercentage}% die benadrukt moet worden.`
      : 'Er is geen specifieke korting.';

    const prompt = `
Je bent een expert marketing copywriter. Genereer een complete marketing kit voor het volgende product.

PRODUCT INFORMATIE:
- Naam: ${productName}
- Beschrijving: ${productDescription || 'Geen beschrijving beschikbaar'}
- Prijs: €${productPrice.toFixed(2)}
${includeDiscount && discountPercentage ? `- Korting: ${discountPercentage}%` : ''}
${includeDiscount && discountPercentage ? `- Actieprijs: €${(productPrice * (1 - discountPercentage / 100)).toFixed(2)}` : ''}

TOON: ${tone.toUpperCase()}
${toneDescriptions[tone]}

KORTING: ${discountText}

TAAL: Schrijf ALLES in het ${languageNames[language]}

Genereer de volgende content:

1. INSTAGRAM POST
- Caption (max 200 karakters voor de fold, daarna meer)
- Relevante hashtags (5-10)

2. FACEBOOK POST
- Langere post tekst (200-300 woorden)
- Sterke opening en call-to-action

3. LINKEDIN POST
- Professionele post (150-250 woorden)
- Focus op waarde propositie

4. X/TWITTER POST
- Korte tweet (max 280 karakters inclusief link placeholder)
- Puntig en engaging

5. EMAIL CONTENT
- 3 onderwerp regels (A/B test varianten)
- Preview tekst (max 90 karakters)
- Body tekst (kort intro paragraph)

6. MARKETING SLOGANS
- 3 korte, pakkende slogans

7. POSTING TIMING
- Beste dag om te posten
- Beste tijd om te posten
- Korte uitleg waarom

Antwoord ALLEEN met een JSON object in dit exacte format (geen markdown, geen backticks):
{
  "social": {
    "instagram": {
      "caption": "...",
      "hashtags": ["...", "..."]
    },
    "facebook": {
      "post": "..."
    },
    "linkedin": {
      "post": "..."
    },
    "twitter": {
      "tweet": "..."
    }
  },
  "email": {
    "subjectLines": ["...", "...", "..."],
    "previewText": "...",
    "bodySnippet": "..."
  },
  "slogans": ["...", "...", "..."],
  "suggestedTiming": {
    "bestDay": "...",
    "bestTime": "...",
    "reason": "..."
  }
}
`;

    console.log('Generating promo kit for product:', productName);

    // Generate text content
    const textResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Je bent een expert marketing copywriter. Antwoord altijd met valide JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error('AI gateway error:', textResponse.status, errorText);
      
      if (textResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (textResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Insufficient AI credits. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Failed to generate content');
    }

    const textData = await textResponse.json();
    let contentText = textData.choices?.[0]?.message?.content || '';
    
    // Clean up the response - remove markdown code blocks if present
    contentText = contentText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(contentText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', contentText);
      throw new Error('Failed to parse AI response');
    }

    // Prepare images array
    const images: { original: string | null; enhanced: string | null; generated: string | null } = {
      original: productImageUrl || null,
      enhanced: null,
      generated: null,
    };

    // Generate enhanced and new images if requested
    if (generateImages && productImageUrl) {
      try {
        // Generate enhanced image with lifestyle setting
        const enhancePrompt = `Transform this product photo into a professional marketing lifestyle image. 
Add an appealing ${tone === 'casual' ? 'relaxed home' : tone === 'professional' ? 'clean studio' : tone === 'urgent' ? 'dynamic promotional' : 'playful colorful'} background setting.
Keep the product clearly visible as the focal point.
Make it look like a high-end advertisement.`;

        const enhancedResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: enhancePrompt },
                  { type: 'image_url', image_url: { url: productImageUrl } }
                ]
              }
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json();
          const enhancedImageUrl = enhancedData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (enhancedImageUrl) {
            images.enhanced = enhancedImageUrl;
          }
        }
      } catch (imageError) {
        console.error('Failed to generate enhanced image:', imageError);
        // Continue without enhanced image
      }

      try {
        // Generate completely new marketing image
        const generatePrompt = `Create a stunning marketing advertisement image for: ${productName}.
${productDescription ? `Product: ${productDescription}` : ''}
Style: ${tone === 'urgent' ? 'Bold, dynamic, with urgency elements like sale badges' : 
         tone === 'casual' ? 'Warm, inviting, lifestyle focused' :
         tone === 'professional' ? 'Clean, minimal, premium feel' :
         'Fun, colorful, energetic'}
${includeDiscount && discountPercentage ? `Include subtle visual hint of ${discountPercentage}% discount.` : ''}
Make it Instagram-worthy and eye-catching. Square format, high quality.`;

        const generatedResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              { role: 'user', content: generatePrompt }
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (generatedResponse.ok) {
          const generatedData = await generatedResponse.json();
          const generatedImageUrl = generatedData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (generatedImageUrl) {
            images.generated = generatedImageUrl;
          }
        }
      } catch (imageError) {
        console.error('Failed to generate new image:', imageError);
        // Continue without generated image
      }
    }

    // Calculate credits used
    let creditsUsed = 5; // Base for text
    if (images.enhanced) creditsUsed += 5;
    if (images.generated) creditsUsed += 5;

    const result = {
      productId,
      productName,
      tone,
      language,
      images,
      ...parsedContent,
      creditsUsed,
      generatedAt: new Date().toISOString(),
    };

    console.log('Promo kit generated successfully');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-product-promo-kit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

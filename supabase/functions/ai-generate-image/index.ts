import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface GenerateImageRequest {
  tenantId: string;
  prompt: string;
  style?: 'realistic' | 'illustration' | 'minimalist' | 'abstract' | 'vintage';
  width?: number;
  height?: number;
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

    const body: GenerateImageRequest = await req.json();
    const { tenantId, prompt, style = 'realistic', width = 1024, height = 1024 } = body;

    // Check credits (5 for image)
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 5,
      p_feature: 'image_generation',
      p_model: 'google/gemini-3-pro-image-preview',
      p_metadata: { style, dimensions: `${width}x${height}` },
    });

    if (!hasCredits) {
      return new Response(JSON.stringify({ error: 'Onvoldoende AI credits' }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Style-specific prompt enhancements
    const stylePrompts: Record<string, string> = {
      realistic: 'Ultra high resolution, photorealistic, professional photography, sharp details',
      illustration: 'Digital illustration style, vibrant colors, clean lines, artistic',
      minimalist: 'Minimalist design, clean and simple, plenty of white space, modern',
      abstract: 'Abstract art style, creative interpretation, bold colors and shapes',
      vintage: 'Vintage aesthetic, retro style, muted colors, nostalgic feel',
    };

    const enhancedPrompt = `${prompt}. ${stylePrompts[style] || stylePrompts.realistic}. Aspect ratio: ${width > height ? 'landscape' : width < height ? 'portrait' : 'square'}.`;

    console.log("Generating image with prompt:", enhancedPrompt);

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: enhancedPrompt }
        ],
        modalities: ["image", "text"],
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
    console.log("AI result structure:", JSON.stringify(Object.keys(aiResult)));

    // Extract the image from the response
    const imageData = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error("No image in response:", JSON.stringify(aiResult));
      throw new Error("Failed to generate image - no image in response");
    }

    // Upload to Supabase Storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = decode(base64Data);
    
    const fileName = `${tenantId}/${Date.now()}-${style}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('ai-images')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('ai-images')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // Save to database
    const { data: savedImage, error: saveError } = await supabase
      .from('ai_generated_images')
      .insert({
        tenant_id: tenantId,
        prompt,
        image_url: imageUrl,
        storage_path: fileName,
        width,
        height,
        style,
        credits_used: 5,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Save error:", saveError);
    }

    return new Response(JSON.stringify({
      imageUrl,
      storagePath: fileName,
      savedId: savedImage?.id,
      prompt,
      style,
      width,
      height,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-generate-image:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

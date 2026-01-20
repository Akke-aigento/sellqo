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
  // New: Product enhancement fields
  sourceImageUrl?: string;
  sourceProductId?: string;
  settingPreset?: string;
  marketingText?: string;
  platformPreset?: 'instagram_post' | 'instagram_story' | 'facebook_banner' | 'email_header' | 'linkedin_post' | 'custom';
  enhancementType?: 'generate' | 'enhance' | 'background_remove' | 'overlay';
}

// Platform preset dimensions
const platformDimensions: Record<string, { width: number; height: number }> = {
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  facebook_banner: { width: 1200, height: 628 },
  email_header: { width: 600, height: 200 },
  linkedin_post: { width: 1200, height: 627 },
  custom: { width: 1024, height: 1024 },
};

// Setting presets for product context
const settingPresets: Record<string, string> = {
  lifestyle: 'in a lifestyle setting with a person naturally using it, warm and inviting atmosphere',
  summer: 'on a beautiful sunny beach with golden sand and clear blue water, summer vibes',
  winter: 'in a cozy winter setting with snow, warm lighting, and holiday decorations',
  spring: 'surrounded by fresh spring flowers and soft natural light, fresh and vibrant',
  kitchen: 'in a modern, clean kitchen with marble countertops and natural lighting',
  living_room: 'in a stylish living room with modern furniture and soft ambient lighting',
  office: 'in a professional office setting with clean desk and modern decor',
  outdoor: 'in a beautiful outdoor setting with natural greenery and soft sunlight',
  studio: 'in a professional photography studio with clean white background and perfect lighting',
  gradient: 'with a smooth gradient background transitioning from elegant colors',
  geometric: 'with abstract geometric shapes in the background, modern and eye-catching',
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

    const body: GenerateImageRequest = await req.json();
    const { 
      tenantId, 
      prompt, 
      style = 'realistic', 
      sourceImageUrl,
      sourceProductId,
      settingPreset,
      marketingText,
      platformPreset,
      enhancementType = sourceImageUrl ? 'enhance' : 'generate',
    } = body;

    // Determine dimensions based on platform preset or manual input
    let width = body.width || 1024;
    let height = body.height || 1024;
    
    if (platformPreset && platformDimensions[platformPreset]) {
      width = platformDimensions[platformPreset].width;
      height = platformDimensions[platformPreset].height;
    }

    // Determine credit cost based on enhancement type
    const creditCost = enhancementType === 'background_remove' ? 3 : 5;

    // Check credits
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: creditCost,
      p_feature: 'image_generation',
      p_model: 'google/gemini-3-pro-image-preview',
      p_metadata: { 
        style, 
        dimensions: `${width}x${height}`,
        enhancementType,
        hasSourceImage: !!sourceImageUrl,
        platformPreset,
      },
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

    // Build the enhanced prompt based on enhancement type
    let enhancedPrompt: string;
    
    if (sourceImageUrl && enhancementType === 'enhance') {
      // Product enhancement: place product in new setting
      const settingDescription = settingPreset && settingPresets[settingPreset] 
        ? settingPresets[settingPreset] 
        : settingPreset || 'in a professional marketing context';
      
      enhancedPrompt = `Take this product and place it ${settingDescription}. ${prompt}. Keep the product as the main focal point. Professional marketing photography style.`;
      
      if (marketingText) {
        enhancedPrompt += ` Add the text "${marketingText}" in a modern, eye-catching font that complements the image.`;
      }
    } else if (sourceImageUrl && enhancementType === 'background_remove') {
      enhancedPrompt = `Remove the background from this image and replace it with a clean, professional ${prompt || 'white'} background. Keep the main subject perfectly intact.`;
    } else if (sourceImageUrl && enhancementType === 'overlay') {
      enhancedPrompt = `Add marketing overlay to this image. ${prompt}. ${marketingText ? `Include the text: "${marketingText}"` : ''}. Professional marketing style.`;
    } else {
      // Standard generation
      enhancedPrompt = `${prompt}. ${stylePrompts[style] || stylePrompts.realistic}. Aspect ratio: ${width > height ? 'landscape' : width < height ? 'portrait' : 'square'}.`;
    }

    console.log("Generating image with prompt:", enhancedPrompt);
    console.log("Enhancement type:", enhancementType);
    console.log("Has source image:", !!sourceImageUrl);

    // Build the message content
    const messageContent: any[] = [{ type: "text", text: enhancedPrompt }];
    
    // Add source image if provided (for editing)
    if (sourceImageUrl) {
      messageContent.push({
        type: "image_url",
        image_url: { url: sourceImageUrl }
      });
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: messageContent }
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
    
    const fileName = `${tenantId}/${Date.now()}-${enhancementType}-${style}.png`;
    
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

    // Save to database with new fields
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
        credits_used: creditCost,
        source_image_url: sourceImageUrl || null,
        source_product_id: sourceProductId || null,
        enhancement_type: enhancementType,
        marketing_text: marketingText || null,
        platform_preset: platformPreset || null,
        setting_preset: settingPreset || null,
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
      enhancementType,
      platformPreset,
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LearnRequest {
  tenantId: string;
  feedbackId: string;
  userId?: string;
  originalContent: string;
  editedContent: string;
  contentType: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenantId, feedbackId, userId, originalContent, editedContent, contentType }: LearnRequest = await req.json();

    if (!tenantId || !originalContent || !editedContent) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to analyze the edit and extract patterns
    let patterns: Record<string, unknown> = {};

    if (lovableApiKey) {
      try {
        const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are an AI learning assistant that analyzes user edits to AI-generated content to extract preferences and patterns.
                
Analyze the before/after content and identify:
1. Tone preferences (formal, casual, playful, professional)
2. Length preferences (shorter, longer, same)
3. Emoji usage preferences (more, less, same)
4. CTA style preferences (direct, subtle, none)
5. Language style (simple, technical, storytelling)

Return ONLY a JSON object with these fields:
{
  "tone": "formal" | "casual" | "playful" | "professional" | "unchanged",
  "length": "shorter" | "longer" | "same",
  "emoji_usage": "more" | "less" | "same" | "none",
  "cta_style": "direct" | "subtle" | "none" | "unchanged",
  "language_style": "simple" | "technical" | "storytelling" | "unchanged",
  "key_changes": ["list", "of", "specific", "changes", "made"]
}`
              },
              {
                role: 'user',
                content: `Content type: ${contentType}

ORIGINAL (AI generated):
${originalContent}

EDITED (User modified):
${editedContent}

Analyze the changes and extract learning patterns.`
              }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'extract_patterns',
                  description: 'Extract learning patterns from the edit analysis',
                  parameters: {
                    type: 'object',
                    properties: {
                      tone: { type: 'string', enum: ['formal', 'casual', 'playful', 'professional', 'unchanged'] },
                      length: { type: 'string', enum: ['shorter', 'longer', 'same'] },
                      emoji_usage: { type: 'string', enum: ['more', 'less', 'same', 'none'] },
                      cta_style: { type: 'string', enum: ['direct', 'subtle', 'none', 'unchanged'] },
                      language_style: { type: 'string', enum: ['simple', 'technical', 'storytelling', 'unchanged'] },
                      key_changes: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['tone', 'length', 'emoji_usage', 'cta_style', 'language_style', 'key_changes']
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'extract_patterns' } }
          }),
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            patterns = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        // Continue with basic pattern detection
      }
    }

    // Basic pattern detection fallback
    if (Object.keys(patterns).length === 0) {
      const originalLength = originalContent.length;
      const editedLength = editedContent.length;
      const lengthDiff = editedLength - originalLength;

      patterns = {
        length: lengthDiff < -50 ? 'shorter' : lengthDiff > 50 ? 'longer' : 'same',
        emoji_usage: 
          (editedContent.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length >
          (originalContent.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length ? 'more' : 'same',
      };
    }

    // Update tenant-level learning patterns for significant changes
    const significantPatterns = Object.entries(patterns).filter(
      ([key, value]) => value !== 'unchanged' && value !== 'same' && key !== 'key_changes'
    );

    for (const [patternType, value] of significantPatterns) {
      // Tenant-level learning
      const { error } = await supabase.rpc('update_ai_learning_pattern', {
        p_tenant_id: tenantId,
        p_pattern_type: `${contentType}_${patternType}`,
        p_learned_value: { preference: value, last_example: editedContent.substring(0, 200) }
      });

      if (error) {
        console.error(`Error updating tenant pattern ${patternType}:`, error);
      }

      // User-level learning (if userId is provided)
      if (userId) {
        const { error: userError } = await supabase.rpc('update_user_learning_pattern', {
          p_user_id: userId,
          p_tenant_id: tenantId,
          p_pattern_type: patternType,
          p_learned_value: { preference: value, last_example: editedContent.substring(0, 200) },
          p_sample_count: 1
        });

        if (userError) {
          console.error(`Error updating user pattern ${patternType}:`, userError);
        }
      }
    }

    // Log the learning event
    console.log(`Learning from feedback ${feedbackId}:`, patterns, userId ? `(user: ${userId})` : '(tenant only)');

    return new Response(
      JSON.stringify({ 
        success: true, 
        patterns,
        patternsUpdated: significantPatterns.length,
        userLearning: !!userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Learning error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

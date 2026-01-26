import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  tenant_id: string;
  session_id: string;
  message: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id, session_id, message, conversation_history }: ChatRequest = await req.json();

    if (!tenant_id || !session_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AI assistant config
    const { data: config } = await supabase
      .from('ai_assistant_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!config?.chatbot_enabled) {
      return new Response(
        JSON.stringify({ error: 'Chatbot is not enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check AI credits (1 for regular, 2 for web research)
    const creditsNeeded = config.web_research_enabled ? 2 : 1;
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenant_id,
      p_credits_needed: creditsNeeded
    });

    if (!hasCredits) {
      return new Response(
        JSON.stringify({ error: 'Insufficient AI credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, domain, support_email, support_phone')
      .eq('id', tenant_id)
      .single();

    // Get relevant knowledge from index
    const { data: knowledge } = await supabase
      .from('ai_knowledge_index')
      .select('title, content_summary, source_type')
      .eq('tenant_id', tenant_id)
      .limit(15);

    let knowledgeContext = knowledge?.map(k => `[${k.source_type}] ${k.title}: ${k.content_summary}`).join('\n') || '';

    // Web research if enabled and configured
    let webResearch: string | null = null;
    let webResearchUsed = false;

    if (config.web_research_enabled && perplexityApiKey) {
      // Check if we should do web research
      const shouldResearch = config.web_research_mode === 'always' || 
        (config.web_research_mode === 'fallback' && (!knowledge || knowledge.length < 3));

      if (shouldResearch) {
        try {
          const allowedTopics = config.web_research_allowed_topics || ['product_advice', 'general_knowledge'];
          const topicFilter = allowedTopics.includes('product_advice') ? 
            `Zoek informatie over producten en categorieën gerelateerd aan: ${message}` :
            message;

          const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                { 
                  role: 'system', 
                  content: 'Je bent een onderzoeksassistent. Geef beknopte, feitelijke informatie. Antwoord in het Nederlands.' 
                },
                { role: 'user', content: topicFilter }
              ],
            }),
          });

          if (perplexityResponse.ok) {
            const perplexityData = await perplexityResponse.json();
            webResearch = perplexityData.choices?.[0]?.message?.content;
            webResearchUsed = true;
          }
        } catch (e) {
          console.error('Perplexity error:', e);
          // Continue without web research
        }
      }
    }

    // Build system prompt
    const systemPrompt = `Je bent ${config.chatbot_name || 'de AI assistent'} van ${tenant?.name || 'de webshop'}.

## Jouw taak
Beantwoord klantvragen op een ${config.reply_suggestions_tone === 'friendly' ? 'vriendelijke en warme' : config.reply_suggestions_tone === 'formal' ? 'formele en correcte' : 'professionele'} manier.

## Beschikbare kennis over de webshop
${knowledgeContext || 'Geen specifieke kennisbank geladen.'}

${webResearch ? `## Aanvullende informatie (web research)
${webResearch}` : ''}

## Contactgegevens
${tenant?.support_email ? `E-mail: ${tenant.support_email}` : ''}
${tenant?.support_phone ? `Telefoon: ${tenant.support_phone}` : ''}
${tenant?.domain ? `Website: ${tenant.domain}` : ''}

## Regels
- Wees behulpzaam en oplossingsgericht
- Gebruik de beschikbare kennis om accurate antwoorden te geven
- Bij complexe vragen of klachten: verwijs naar de klantenservice
- Houd antwoorden beknopt maar volledig
${config.knowledge_forbidden_topics ? `- NOOIT bespreken: ${config.knowledge_forbidden_topics}` : ''}

## Welkomstbericht
${config.chatbot_welcome_message || 'Hallo! Hoe kan ik je helpen?'}`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversation_history || []),
      { role: 'user', content: message }
    ];

    // Call AI API
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return new Response(
        JSON.stringify({ error: 'No response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create conversation record
    const messageCount = (conversation_history?.length || 0) + 2; // +2 for new user msg and reply
    const isFirstMessage = !conversation_history || conversation_history.length === 0;

    if (isFirstMessage) {
      await supabase.from('ai_chatbot_conversations').insert({
        tenant_id,
        session_id,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: reply }
        ],
        message_count: 2,
        initial_question: message,
        web_research_used: webResearchUsed
      });
    } else {
      await supabase
        .from('ai_chatbot_conversations')
        .update({
          messages: [
            ...(conversation_history || []),
            { role: 'user', content: message },
            { role: 'assistant', content: reply }
          ],
          message_count: messageCount,
          web_research_used: webResearchUsed
        })
        .eq('session_id', session_id)
        .eq('tenant_id', tenant_id);
    }

    // Log usage
    await supabase.from('ai_usage_log').insert({
      tenant_id,
      feature: 'chatbot',
      credits_used: creditsNeeded,
      model_used: 'gemini-2.5-flash',
      metadata: {
        session_id,
        message_count: messageCount,
        web_research_used: webResearchUsed
      }
    });

    // Check if we should ask for feedback
    const shouldAskFeedback = config.chatbot_feedback_enabled && messageCount >= 4;

    return new Response(
      JSON.stringify({ 
        reply,
        ask_feedback: shouldAskFeedback,
        web_research_used: webResearchUsed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chatbot error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

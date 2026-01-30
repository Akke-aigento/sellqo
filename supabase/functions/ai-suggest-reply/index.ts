import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestRequest {
  tenant_id: string;
  conversation_id: string;
  message_id?: string;
  customer_message: string;
  customer_name?: string;
  channel: 'email' | 'whatsapp';
  force_regenerate?: boolean;
  context?: {
    orderId?: string;
    orderNumber?: string;
    subject?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: claims } = await supabase.auth.getClaims(token);
      userId = claims?.claims?.sub as string || null;
    }

    const { 
      tenant_id, 
      conversation_id,
      message_id,
      customer_message, 
      customer_name, 
      channel, 
      force_regenerate,
      context 
    }: SuggestRequest = await req.json();

    if (!tenant_id || !customer_message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for cached suggestion (if message_id provided and not forcing regeneration)
    if (message_id && !force_regenerate) {
      const { data: cached } = await supabase
        .from('ai_reply_suggestions')
        .select('suggestion_text, model_used, created_at')
        .eq('tenant_id', tenant_id)
        .eq('conversation_id', conversation_id)
        .eq('message_id', message_id)
        .maybeSingle();

      if (cached) {
        console.log('Returning cached suggestion for message:', message_id);
        return new Response(
          JSON.stringify({ 
            suggestion: cached.suggestion_text,
            cached: true,
            cached_at: cached.created_at,
            user_patterns_applied: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check AI credits (only if we need to generate)
    const { data: hasCredits } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenant_id,
      p_credits_needed: 1
    });

    if (!hasCredits) {
      return new Response(
        JSON.stringify({ error: 'Insufficient AI credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AI assistant config
    const { data: config } = await supabase
      .from('ai_assistant_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, support_email, support_phone')
      .eq('id', tenant_id)
      .single();

    // Get user learning patterns if user is logged in
    let userPatterns: Record<string, unknown> = {};
    if (userId) {
      const { data: patterns } = await supabase
        .from('ai_user_learning_patterns')
        .select('pattern_type, learned_value, confidence_score')
        .eq('user_id', userId)
        .gte('confidence_score', 0.5);
      
      if (patterns) {
        for (const p of patterns) {
          userPatterns[p.pattern_type] = p.learned_value;
        }
      }
    }

    // Get relevant knowledge from index
    const { data: knowledge } = await supabase
      .from('ai_knowledge_index')
      .select('title, content_summary')
      .eq('tenant_id', tenant_id)
      .limit(10);

    // Build context sections
    const knowledgeContext = knowledge?.map(k => `- ${k.title}: ${k.content_summary}`).join('\n') || '';
    
    // Build user preferences section
    let userPrefsSection = '';
    if (Object.keys(userPatterns).length > 0) {
      const prefs: string[] = [];
      if (userPatterns.signature) {
        const sig = userPatterns.signature as { preference?: string };
        if (sig.preference) prefs.push(`- Onderteken met: "${sig.preference}"`);
      }
      if (userPatterns.greeting) {
        const greet = userPatterns.greeting as { preference?: string };
        if (greet.preference) prefs.push(`- Begroeting: "${greet.preference}"`);
      }
      if (userPatterns.tone) {
        const tone = userPatterns.tone as { preference?: string };
        if (tone.preference) prefs.push(`- Toon: ${tone.preference}`);
      }
      if (userPatterns.emoji_usage) {
        const emoji = userPatterns.emoji_usage as { preference?: string };
        if (emoji.preference) prefs.push(`- Emoji gebruik: ${emoji.preference}`);
      }
      if (prefs.length > 0) {
        userPrefsSection = `\n## Voorkeuren van deze medewerker (automatisch geleerd)\n${prefs.join('\n')}`;
      }
    }

    const tone = config?.reply_suggestions_tone || 'professional';
    const toneDescriptions: Record<string, string> = {
      professional: 'professioneel en zakelijk',
      friendly: 'vriendelijk en warm',
      formal: 'formeel en correct'
    };
    const toneDescription = toneDescriptions[tone] || 'professioneel';

    const systemPrompt = `Je bent een klantenservice assistent voor ${tenant?.name || 'de webshop'}.

## Jouw taak
Schrijf een ${channel === 'email' ? 'e-mail' : 'WhatsApp bericht'} als antwoord op de klantvraag.

## Stijl
- Toon: ${toneDescription}
- Taal: Nederlands
- ${channel === 'whatsapp' ? 'Kort en bondig, max 3 alinea\'s' : 'Duidelijk gestructureerd met alinea\'s'}

## Kennisbank
${knowledgeContext || 'Geen specifieke kennisbank beschikbaar.'}
${userPrefsSection}

## Contactgegevens
${tenant?.support_email ? `E-mail: ${tenant.support_email}` : ''}
${tenant?.support_phone ? `Telefoon: ${tenant.support_phone}` : ''}

## Regels
- Antwoord alleen op basis van beschikbare informatie
- Bij twijfel: verwijs naar klantenservice
- Wees altijd behulpzaam en oplossingsgericht
${config?.knowledge_forbidden_topics ? `- NOOIT bespreken: ${config.knowledge_forbidden_topics}` : ''}`;

    const userPrompt = `Klantnaam: ${customer_name || 'Onbekend'}
${context?.orderNumber ? `Bestelnummer: ${context.orderNumber}` : ''}
${context?.subject ? `Onderwerp: ${context.subject}` : ''}

Klant bericht:
${customer_message}

Schrijf een passend antwoord.`;

    // Call AI API
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate suggestion' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content;

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: 'No suggestion generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache the suggestion if message_id is provided
    if (message_id) {
      const { error: cacheError } = await supabase
        .from('ai_reply_suggestions')
        .upsert({
          tenant_id,
          conversation_id,
          message_id,
          suggestion_text: suggestion,
          model_used: 'gemini-2.5-flash',
          regenerated_at: force_regenerate ? new Date().toISOString() : null,
        }, {
          onConflict: 'tenant_id,conversation_id,message_id',
        });

      if (cacheError) {
        console.error('Failed to cache suggestion:', cacheError);
        // Don't fail the request, just log the error
      } else {
        console.log('Cached suggestion for message:', message_id);
      }
    }

    // Log usage
    await supabase.from('ai_usage_log').insert({
      tenant_id,
      feature: 'reply_suggestion',
      credits_used: 1,
      model_used: 'gemini-2.5-flash',
      metadata: {
        channel,
        conversation_id,
        message_id,
        user_id: userId,
        has_user_patterns: Object.keys(userPatterns).length > 0,
        was_regeneration: force_regenerate || false,
      }
    });

    return new Response(
      JSON.stringify({ 
        suggestion,
        cached: false,
        user_patterns_applied: Object.keys(userPatterns).length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Suggest reply error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslationRequest {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  entityTypes?: string[];
  entityIds?: string[];
  targetLanguages: string[];
  mode?: 'all' | 'missing' | 'outdated';
  fields?: string[];
}

const FIELD_CONFIGS: Record<string, string[]> = {
  product: ['name', 'description', 'short_description', 'meta_title', 'meta_description'],
  category: ['name', 'description', 'meta_title', 'meta_description'],
};

const LANGUAGE_NAMES: Record<string, string> = {
  nl: 'Dutch', en: 'English', de: 'German', fr: 'French',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, entityType, entityId, entityTypes, entityIds, targetLanguages, mode = 'missing', fields: requestedFields } =
      await req.json() as TranslationRequest;


    const auth = await authenticateRequest(req, tenantId);
    if (!tenantId || !targetLanguages?.length) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const { data: settings } = await supabase
      .from('translation_settings')
      .select('source_language')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const sourceLanguage = settings?.source_language || 'nl';
    const entitiesToTranslate: Array<{ type: string; id: string; fields: Record<string, string> }> = [];

    if (entityId && entityType) {
      const table = entityType === 'product' ? 'products' : 'categories';
      const allFields = FIELD_CONFIGS[entityType] || [];
      const fields = requestedFields?.length
        ? allFields.filter(f => requestedFields.includes(f))
        : allFields;
      
      const { data: entity } = await supabase.from(table).select('*').eq('id', entityId).single();

      if (entity) {
        const entityFields: Record<string, string> = {};
        for (const field of fields) {
          const value = (entity as Record<string, unknown>)[field];
          if (value && typeof value === 'string') entityFields[field] = value;
        }
        if (Object.keys(entityFields).length > 0) {
          entitiesToTranslate.push({ type: entityType, id: entityId, fields: entityFields });
        }
      }
    } else if (entityTypes?.length) {
      for (const type of entityTypes) {
        const table = type === 'product' ? 'products' : 'categories';
        const allFields = FIELD_CONFIGS[type] || [];
        const fields = requestedFields?.length
          ? allFields.filter(f => requestedFields.includes(f))
          : allFields;

        let query = supabase.from(table).select('*')
          .eq('tenant_id', tenantId).eq('is_active', true);
        if (entityIds?.length) {
          query = query.in('id', entityIds);
        } else {
          query = query.limit(50);
        }
        const { data: entities } = await query;

        for (const entity of (entities || [])) {
          const rec = entity as Record<string, unknown>;
          const entityFields: Record<string, string> = {};
          for (const field of fields) {
            const value = rec[field];
            if (value && typeof value === 'string') entityFields[field] = value;
          }
          if (Object.keys(entityFields).length > 0) {
            entitiesToTranslate.push({ type, id: rec.id as string, fields: entityFields });
          }
        }
      }
    }

    // When mode === 'missing', look up existing translations so we can skip already-translated combos
    let existingSet = new Set<string>();
    if (mode === 'missing' && entitiesToTranslate.length > 0) {
      const ids = entitiesToTranslate.map(e => e.id);
      const { data: existing } = await supabase
        .from('content_translations')
        .select('entity_id, entity_type, field_name, target_language, translated_content')
        .eq('tenant_id', tenantId)
        .in('entity_id', ids);
      existingSet = new Set(
        (existing || [])
          .filter((t: any) => t.translated_content)
          .map((t: any) => `${t.entity_type}:${t.entity_id}:${t.field_name}:${t.target_language}`)
      );
    }

    if (entitiesToTranslate.length === 0) {
      return new Response(JSON.stringify({ success: true, translationsCreated: 0, creditsUsed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let creditsNeeded = 0;
    for (const e of entitiesToTranslate) {
      for (const field of Object.keys(e.fields)) {
        for (const lang of targetLanguages) {
          if (mode === 'missing' && existingSet.has(`${e.type}:${e.id}:${field}:${lang}`)) continue;
          creditsNeeded++;
        }
      }
    }

    if (creditsNeeded === 0) {
      return new Response(JSON.stringify({ success: true, translationsCreated: 0, creditsUsed: 0, itemsQueued: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!auth.is_platform_admin) {
      const { data: creditResult } = await supabase.rpc('use_ai_credits', {
        p_tenant_id: tenantId,
        p_credits_needed: creditsNeeded,
      });
      if (!creditResult) {
        return new Response(JSON.stringify({
          error: "insufficient_credits",
          message: "Onvoldoende AI credits",
          creditsNeeded,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let translationsCreated = 0;

    for (const entity of entitiesToTranslate) {
      for (const targetLang of targetLanguages) {
        const fieldsToTranslate = Object.entries(entity.fields).filter(
          ([field]) => mode !== 'missing' || !existingSet.has(`${entity.type}:${entity.id}:${field}:${targetLang}`)
        );
        if (fieldsToTranslate.length === 0) continue;
        
        const systemPrompt = `You are a professional translator. Translate from ${LANGUAGE_NAMES[sourceLanguage]} to ${LANGUAGE_NAMES[targetLang]}. Return JSON with same keys.`;
        const userPrompt = `Translate: ${JSON.stringify(Object.fromEntries(fieldsToTranslate))}`;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            }),
          });

          if (!aiResponse.ok) continue;
          const aiResult = await aiResponse.json();
          const translatedContent = JSON.parse(aiResult.choices[0].message.content);

          for (const [fieldName, sourceContent] of fieldsToTranslate) {
            const translatedValue = translatedContent[fieldName];
            if (translatedValue) {
              await supabase.from('content_translations').upsert({
                tenant_id: tenantId, entity_type: entity.type, entity_id: entity.id,
                field_name: fieldName, source_language: sourceLanguage, target_language: targetLang,
                source_content: sourceContent, translated_content: translatedValue,
                is_auto_translated: true, translated_at: new Date().toISOString(),
              }, { onConflict: 'tenant_id,entity_type,entity_id,field_name,target_language' });
              translationsCreated++;
            }
          }
        } catch { /* continue on error */ }
      }
    }

    return new Response(JSON.stringify({ success: true, translationsCreated, creditsUsed: creditsNeeded, itemsQueued: entitiesToTranslate.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

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

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function stripJsonFences(s: string): string {
  let out = s.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/,'').trim();
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, entityType, entityId, entityTypes, entityIds, targetLanguages, mode = 'missing', fields: requestedFields } =
      await req.json() as TranslationRequest;


    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin', 'staff', 'marketing']);
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
      
      const { data: entity } = await supabase
        .from(table)
        .select('*')
        .eq('id', entityId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

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

        if (entityIds?.length) {
          const { data: entities } = await supabase.from(table).select('*')
            .eq('tenant_id', tenantId).eq('is_active', true)
            .in('id', entityIds);
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
        } else {
          // Keyset pagination — pull ALL active entities for the tenant.
          const PAGE = 200;
          let lastId = '00000000-0000-0000-0000-000000000000';
          while (true) {
            const { data: page } = await supabase.from(table).select('*')
              .eq('tenant_id', tenantId).eq('is_active', true)
              .gt('id', lastId).order('id', { ascending: true }).limit(PAGE);
            if (!page || page.length === 0) break;
            for (const entity of page) {
              const rec = entity as Record<string, unknown>;
              const entityFields: Record<string, string> = {};
              for (const field of fields) {
                const value = rec[field];
                if (value && typeof value === 'string') entityFields[field] = value;
              }
              if (Object.keys(entityFields).length > 0) {
                entitiesToTranslate.push({ type, id: rec.id as string, fields: entityFields });
              }
              lastId = rec.id as string;
            }
            if (page.length < PAGE) break;
          }
        }
      }
    }

    // Always fetch existing translations so we can respect locks in every mode
    // AND resolve outdated combos via source-hash comparison.
    const existingSet = new Set<string>();       // has a non-empty translated_content
    const lockedSet = new Set<string>();         // is_locked = true (skip in all modes)
    const existingMap = new Map<string, { hash: string | null; source: string | null }>();
    if (entitiesToTranslate.length > 0) {
      const ids = entitiesToTranslate.map(e => e.id);
      const { data: existing } = await supabase
        .from('content_translations')
        .select('entity_id, entity_type, field_name, target_language, translated_content, is_locked, last_source_hash, source_content')
        .eq('tenant_id', tenantId)
        .in('entity_id', ids);
      for (const t of (existing || []) as any[]) {
        const key = `${t.entity_type}:${t.entity_id}:${t.field_name}:${t.target_language}`;
        if (t.translated_content) existingSet.add(key);
        if (t.is_locked) lockedSet.add(key);
        existingMap.set(key, { hash: t.last_source_hash ?? null, source: t.source_content ?? null });
      }
    }

    if (entitiesToTranslate.length === 0) {
      return new Response(JSON.stringify({ success: true, translationsCreated: 0, creditsUsed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Precompute hashes for all source values.
    const hashCache = new Map<string, string>(); // `${type}:${id}:${field}` -> hash
    for (const e of entitiesToTranslate) {
      for (const [field, value] of Object.entries(e.fields)) {
        hashCache.set(`${e.type}:${e.id}:${field}`, await sha256Hex(value));
      }
    }

    const shouldSkip = (type: string, id: string, field: string, lang: string, sourceValue: string): boolean => {
      const key = `${type}:${id}:${field}:${lang}`;
      if (lockedSet.has(key)) return true;
      if (mode === 'missing' && existingSet.has(key)) return true;
      if (mode === 'outdated') {
        // Only translate when a translation exists and its hash differs from current.
        if (!existingSet.has(key)) return true;
        const meta = existingMap.get(key);
        if (!meta) return true;
        const currentHash = hashCache.get(`${type}:${id}:${field}`)!;
        if (meta.hash) {
          if (meta.hash === currentHash) return true;
        } else {
          // Fallback: compare stored source_content
          if (meta.source === sourceValue) return true;
        }
      }
      return false;
    };

    let creditsNeeded = 0;
    for (const e of entitiesToTranslate) {
      for (const [field, value] of Object.entries(e.fields)) {
        for (const lang of targetLanguages) {
          if (shouldSkip(e.type, e.id, field, lang, value)) continue;
          creditsNeeded++;
        }
      }
    }

    if (creditsNeeded === 0) {
      return new Response(JSON.stringify({ success: true, translationsCreated: 0, creditsUsed: 0, itemsQueued: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pre-check credits without deducting. Skip for platform admins and internal tenants.
    let isInternal = false;
    if (!auth.is_platform_admin) {
      const { data: tenantRow } = await supabase
        .from('tenants').select('is_internal_tenant').eq('id', tenantId).maybeSingle();
      isInternal = !!tenantRow?.is_internal_tenant;

      if (!isInternal) {
        const { data: creditsRow } = await supabase
          .from('tenant_ai_credits')
          .select('credits_total, credits_used, credits_purchased')
          .eq('tenant_id', tenantId).maybeSingle();
        const available = (creditsRow?.credits_total ?? 0) + (creditsRow?.credits_purchased ?? 0) - (creditsRow?.credits_used ?? 0);
        if (available < creditsNeeded) {
          return new Response(JSON.stringify({
            error: "insufficient_credits",
            message: "Onvoldoende AI credits",
            creditsNeeded,
          }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Create translation job row (best-effort — we still run if this fails).
    const jobType = entityId ? 'single' : 'bulk';
    const createdBy = auth.user_id === 'service_role' ? null : auth.user_id;
    const { data: jobRow } = await supabase.from('translation_jobs').insert({
      tenant_id: tenantId,
      job_type: jobType,
      status: 'processing',
      entity_types: entityTypes ?? (entityType ? [entityType] : []),
      target_languages: targetLanguages,
      total_items: creditsNeeded,
      processed_items: 0,
      failed_items: 0,
      credits_used: 0,
      error_log: [],
      started_at: new Date().toISOString(),
      created_by: createdBy,
    }).select('id').maybeSingle();
    const jobId = jobRow?.id as string | undefined;

    let translationsCreated = 0;
    let failedItems = 0;
    const errorLog: Array<{ entity_id: string; target_language: string; reason: string }> = [];
    const pushError = (entity_id: string, target_language: string, reason: string) => {
      if (errorLog.length < 50) errorLog.push({ entity_id, target_language, reason });
    };

    for (const entity of entitiesToTranslate) {
      let entityProcessed = 0;
      let entityFailed = 0;
      for (const targetLang of targetLanguages) {
        const fieldsToTranslate = Object.entries(entity.fields).filter(
          ([field, value]) => !shouldSkip(entity.type, entity.id, field, targetLang, value)
        );
        if (fieldsToTranslate.length === 0) continue;
        
        const systemPrompt = `You are a professional translator. Translate from ${LANGUAGE_NAMES[sourceLanguage]} to ${LANGUAGE_NAMES[targetLang]}. Return JSON with same keys. Preserve all HTML tags, attributes and structure exactly; translate only human-readable text. Do not translate brand names, SKUs or product codes. Return ONLY valid JSON, no markdown fences.`;
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

          if (!aiResponse.ok) {
            for (const [, ] of fieldsToTranslate) { entityFailed++; }
            pushError(entity.id, targetLang, `ai_http_${aiResponse.status}`);
            continue;
          }
          const aiResult = await aiResponse.json();
          let translatedContent: Record<string, string>;
          try {
            translatedContent = JSON.parse(stripJsonFences(aiResult.choices?.[0]?.message?.content ?? ''));
          } catch {
            entityFailed += fieldsToTranslate.length;
            pushError(entity.id, targetLang, 'ai_parse_error');
            continue;
          }

          for (const [fieldName, sourceContent] of fieldsToTranslate) {
            const translatedValue = translatedContent[fieldName];
            if (translatedValue) {
              const hash = hashCache.get(`${entity.type}:${entity.id}:${fieldName}`) ?? null;
              const { error: upsertErr } = await supabase.from('content_translations').upsert({
                tenant_id: tenantId, entity_type: entity.type, entity_id: entity.id,
                field_name: fieldName, source_language: sourceLanguage, target_language: targetLang,
                source_content: sourceContent, translated_content: translatedValue,
                is_auto_translated: true, translated_at: new Date().toISOString(),
                last_source_hash: hash,
              }, { onConflict: 'tenant_id,entity_type,entity_id,field_name,target_language' });
              if (upsertErr) {
                entityFailed++;
                pushError(entity.id, targetLang, `upsert_error:${upsertErr.message}`);
              } else {
                translationsCreated++;
                entityProcessed++;
              }
            } else {
              entityFailed++;
              pushError(entity.id, targetLang, `missing_field_${fieldName}`);
            }
          }
        } catch (e) {
          entityFailed += fieldsToTranslate.length;
          pushError(entity.id, targetLang, `exception:${(e as Error).message}`);
        }
      }
      failedItems += entityFailed;
      if (jobId) {
        await supabase.from('translation_jobs').update({
          processed_items: translationsCreated,
          failed_items: failedItems,
        }).eq('id', jobId);
      }
    }

    // Deduct credits after the fact — only for the actual successes, and only
    // when the tenant isn't internal / caller isn't a platform admin.
    let creditsUsed = 0;
    if (translationsCreated > 0 && !auth.is_platform_admin && !isInternal) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('use_ai_credits', {
        p_tenant_id: tenantId,
        p_credits: translationsCreated,
        p_feature: 'translation',
        p_metadata: jobId ? { job_id: jobId } : {},
      });
      if (rpcErr || rpcData === false) {
        console.error('[ai-translate-content] use_ai_credits failed:', rpcErr);
        if (jobId) {
          await supabase.from('translation_jobs').update({
            error_log: [...errorLog, { entity_id: '-', target_language: '-', reason: `credits_deduct_failed:${rpcErr?.message ?? 'rpc_false'}` }].slice(0, 50),
          }).eq('id', jobId);
        }
      } else {
        creditsUsed = translationsCreated;
      }
    }

    const finalStatus = failedItems > 0 ? 'completed_with_errors' : 'completed';
    if (jobId) {
      await supabase.from('translation_jobs').update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        credits_used: creditsUsed,
        processed_items: translationsCreated,
        failed_items: failedItems,
        error_log: errorLog,
      }).eq('id', jobId);
    }

    return new Response(JSON.stringify({
      success: true,
      translationsCreated,
      creditsUsed,
      itemsQueued: entitiesToTranslate.length,
      failedItems,
      jobId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

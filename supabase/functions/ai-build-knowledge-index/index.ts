import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexRequest {
  tenant_id: string;
  full_rebuild?: boolean;
}

// Simple hash function for content comparison
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Extract keywords from text
function extractKeywords(text: string): string[] {
  const stopwords = new Set(['de', 'het', 'een', 'en', 'van', 'in', 'is', 'op', 'te', 'voor', 'met', 'aan', 'dat', 'die', 'zijn', 'wordt', 'door', 'naar', 'bij', 'om', 'als', 'of', 'kan', 'je', 'we', 'u', 'uw', 'ook', 'nog', 'maar', 'dan', 'wel', 'niet', 'zo', 'al']);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  
  // Count frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  
  // Sort by frequency and take top 10
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Summarize content
function summarize(text: string, maxLength: number = 500): string {
  // Strip HTML if present
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= maxLength) return stripped;
  
  // Find a good break point
  const truncated = stripped.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id, full_rebuild }: IndexRequest = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AI config to see what to index
    const { data: config } = await supabase
      .from('ai_assistant_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (full_rebuild) {
      // Clear existing index
      await supabase
        .from('ai_knowledge_index')
        .delete()
        .eq('tenant_id', tenant_id);
    }

    const indexed: { type: string; count: number }[] = [];

    // Index products if enabled
    if (config?.knowledge_include_products !== false) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, description, price, sku, tags')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .limit(500);

      if (products && products.length > 0) {
        const productRecords = products.map(p => {
          const content = `${p.name}. ${p.description || ''} Prijs: €${p.price}. ${p.sku ? `SKU: ${p.sku}` : ''}`;
          return {
            tenant_id,
            source_type: 'product',
            source_id: p.id,
            title: p.name,
            content_summary: summarize(content),
            content_hash: simpleHash(content),
            keywords: [...extractKeywords(content), ...(p.tags || [])]
          };
        });

        await supabase.from('ai_knowledge_index').upsert(productRecords, {
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false
        });

        indexed.push({ type: 'products', count: products.length });
      }
    }

    // Index categories if enabled
    if (config?.knowledge_include_categories !== false) {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, description')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true);

      if (categories && categories.length > 0) {
        const categoryRecords = categories.map(c => {
          const content = `${c.name}. ${c.description || ''}`;
          return {
            tenant_id,
            source_type: 'category',
            source_id: c.id,
            title: c.name,
            content_summary: summarize(content),
            content_hash: simpleHash(content),
            keywords: extractKeywords(content)
          };
        });

        await supabase.from('ai_knowledge_index').upsert(categoryRecords, {
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false
        });

        indexed.push({ type: 'categories', count: categories.length });
      }
    }

    // Index pages if enabled
    if (config?.knowledge_include_pages !== false) {
      const { data: pages } = await supabase
        .from('pages')
        .select('id, title, content, slug')
        .eq('tenant_id', tenant_id)
        .eq('is_published', true);

      if (pages && pages.length > 0) {
        const pageRecords = pages.map(p => {
          const content = `${p.title}. ${p.content || ''}`;
          return {
            tenant_id,
            source_type: 'page',
            source_id: p.id,
            title: p.title,
            content_summary: summarize(content),
            content_hash: simpleHash(content),
            keywords: extractKeywords(content)
          };
        });

        await supabase.from('ai_knowledge_index').upsert(pageRecords, {
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false
        });

        indexed.push({ type: 'pages', count: pages.length });
      }
    }

    // Index shipping methods if enabled
    if (config?.knowledge_include_shipping !== false) {
      const { data: shipping } = await supabase
        .from('shipping_methods')
        .select('id, name, description, price, estimated_days_min, estimated_days_max')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true);

      if (shipping && shipping.length > 0) {
        const shippingRecords = shipping.map(s => {
          const deliveryTime = s.estimated_days_min && s.estimated_days_max 
            ? `Levertijd: ${s.estimated_days_min}-${s.estimated_days_max} dagen.` 
            : '';
          const content = `${s.name}. ${s.description || ''} Kosten: €${s.price}. ${deliveryTime}`;
          return {
            tenant_id,
            source_type: 'shipping',
            source_id: s.id,
            title: s.name,
            content_summary: summarize(content),
            content_hash: simpleHash(content),
            keywords: extractKeywords(content)
          };
        });

        await supabase.from('ai_knowledge_index').upsert(shippingRecords, {
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false
        });

        indexed.push({ type: 'shipping', count: shipping.length });
      }
    }

    // Add custom instructions if present
    if (config?.knowledge_custom_instructions) {
      const customContent = config.knowledge_custom_instructions;
      await supabase.from('ai_knowledge_index').upsert({
        tenant_id,
        source_type: 'custom',
        source_id: null,
        title: 'Aangepaste instructies',
        content_summary: summarize(customContent, 1000),
        content_hash: simpleHash(customContent),
        keywords: extractKeywords(customContent)
      }, {
        onConflict: 'tenant_id,source_type,source_id',
        ignoreDuplicates: false
      });
      
      indexed.push({ type: 'custom', count: 1 });
    }

    // Get total indexed count
    const { count } = await supabase
      .from('ai_knowledge_index')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        indexed,
        total_items: count || 0,
        full_rebuild: full_rebuild || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Knowledge index error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Accept hostname from query param or body
    let hostname = '';
    if (req.method === 'GET') {
      const url = new URL(req.url);
      hostname = (url.searchParams.get('hostname') || '').toLowerCase().trim();
    } else {
      const body = await req.json();
      hostname = (body.hostname || '').toLowerCase().trim();
    }

    if (!hostname) {
      return new Response(
        JSON.stringify({ success: false, error: 'hostname parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up domain
    const { data: domain, error } = await supabase
      .from('tenant_domains')
      .select('id, tenant_id, domain, locale, is_canonical, is_active, dns_verified, ssl_active')
      .eq('domain', hostname)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain not registered', resolved: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, slug, name, store_name, logo_url, currency, country')
      .eq('id', domain.tenant_id)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get theme settings
    const { data: themeSettings } = await supabase
      .from('tenant_theme_settings')
      .select('use_custom_frontend, custom_frontend_url')
      .eq('tenant_id', domain.tenant_id)
      .maybeSingle();

    // Get all active domains for hreflang
    const { data: allDomains } = await supabase
      .from('tenant_domains')
      .select('domain, locale, is_canonical')
      .eq('tenant_id', domain.tenant_id)
      .eq('is_active', true);

    // Build Storefront API URL
    const storefrontApiUrl = `${supabaseUrl}/functions/v1/storefront-api`;

    return new Response(
      JSON.stringify({
        success: true,
        resolved: true,
        data: {
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          tenant_name: tenant.store_name || tenant.name,
          logo_url: tenant.logo_url,
          currency: tenant.currency || 'EUR',
          country: tenant.country || 'NL',
          locale: domain.locale,
          is_canonical: domain.is_canonical,
          use_custom_frontend: themeSettings?.use_custom_frontend || false,
          custom_frontend_url: themeSettings?.custom_frontend_url || null,
          storefront_api_url: storefrontApiUrl,
          all_domains: (allDomains || []).map((d: any) => ({
            domain: d.domain,
            locale: d.locale,
            is_canonical: d.is_canonical,
          })),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Storefront resolve error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

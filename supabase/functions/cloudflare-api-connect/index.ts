import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELLQO_IP = '185.158.133.1';

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface Zone {
  id: string;
  name: string;
  status: string;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, domain, api_token } = await req.json();

    if (!tenant_id || !domain || !api_token) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, domain en api_token zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Verify API token
    const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { 'Authorization': `Bearer ${api_token}` }
    });
    const verifyData = await verifyResponse.json() as CloudflareResponse<{ status: string }>;

    if (!verifyData.success || verifyData.result?.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Het API token is ongeldig. Controleer of je het volledige token hebt gekopieerd.',
          error_type: 'invalid_token'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get zones accessible by this token
    const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones', {
      headers: { 'Authorization': `Bearer ${api_token}` }
    });
    const zonesData = await zonesResponse.json() as CloudflareResponse<Zone[]>;

    if (!zonesData.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Dit token mist de benodigde permissies. Gebruik de "Edit zone DNS" template.',
          error_type: 'missing_permissions'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Find zone matching domain
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    const zone = zonesData.result.find((z: Zone) => {
      // Check if domain matches zone or is a subdomain of zone
      return cleanDomain === z.name || cleanDomain.endsWith(`.${z.name}`);
    });

    if (!zone) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Dit token heeft geen toegang tot het domein "${cleanDomain}". Selecteer het juiste domein bij 'Zone Resources' in Cloudflare.`,
          error_type: 'domain_not_found',
          available_zones: zonesData.result.map((z: Zone) => z.name)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Get tenant verification token
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('domain_verification_token')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenantData) {
      return new Response(
        JSON.stringify({ error: 'Tenant niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verificationToken = tenantData.domain_verification_token || crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Step 5: Check existing DNS records
    const existingRecordsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?name=${cleanDomain}`,
      { headers: { 'Authorization': `Bearer ${api_token}` } }
    );
    const existingRecordsData = await existingRecordsResponse.json() as CloudflareResponse<DnsRecord[]>;

    // Step 6: Create/Update DNS records
    const recordsToCreate = [
      { type: 'A', name: cleanDomain, content: SELLQO_IP, ttl: 1, proxied: false },
      { type: 'A', name: `www.${cleanDomain}`, content: SELLQO_IP, ttl: 1, proxied: false },
      { type: 'TXT', name: `_sellqo.${cleanDomain}`, content: `sellqo-verify=${verificationToken}`, ttl: 1 },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    for (const record of recordsToCreate) {
      // Check if record already exists
      const existingRecord = existingRecordsData.result?.find(
        (r: DnsRecord) => r.type === record.type && r.name === record.name
      );

      if (existingRecord) {
        // Update existing record
        const updateResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records/${existingRecord.id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${api_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(record),
          }
        );
        const updateData = await updateResponse.json() as CloudflareResponse<DnsRecord>;
        if (updateData.success) {
          recordsUpdated++;
        } else {
          errors.push(`Kon ${record.type} record voor ${record.name} niet updaten`);
        }
      } else {
        // Create new record
        const createResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${api_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(record),
          }
        );
        const createData = await createResponse.json() as CloudflareResponse<DnsRecord>;
        if (createData.success) {
          recordsCreated++;
        } else {
          errors.push(`Kon ${record.type} record voor ${record.name} niet aanmaken: ${createData.errors?.[0]?.message || 'Onbekende fout'}`);
        }
      }
    }

    // Step 7: Update tenant with domain info and mark as verified
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        custom_domain: cleanDomain,
        domain_verified: true,
        domain_verification_token: verificationToken,
      })
      .eq('id', tenant_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'DNS records zijn aangemaakt maar tenant kon niet worden bijgewerkt',
          records_created: recordsCreated,
          records_updated: recordsUpdated
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        domain: cleanDomain,
        zone_name: zone.name,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cloudflare-api-connect:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Er is een onverwachte fout opgetreden'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

interface RecordAction {
  record: string;
  type: string;
  action: 'created' | 'updated' | 'deleted_and_created' | 'error';
  detail?: string;
}

async function deleteRecord(zoneId: string, recordId: string, apiToken: string): Promise<boolean> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${apiToken}` } }
  );
  const data = await res.json() as CloudflareResponse<unknown>;
  return data.success;
}

async function createRecord(zoneId: string, record: Record<string, unknown>, apiToken: string): Promise<CloudflareResponse<DnsRecord>> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }
  );
  return await res.json() as CloudflareResponse<DnsRecord>;
}

async function updateRecord(zoneId: string, recordId: string, record: Record<string, unknown>, apiToken: string): Promise<CloudflareResponse<DnsRecord>> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }
  );
  return await res.json() as CloudflareResponse<DnsRecord>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Step 5: Fetch ALL existing DNS records for the zone (no name filter)
    const existingRecordsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=500`,
      { headers: { 'Authorization': `Bearer ${api_token}` } }
    );
    const existingRecordsData = await existingRecordsResponse.json() as CloudflareResponse<DnsRecord[]>;
    const allRecords = existingRecordsData.result || [];

    // Step 6: Create/Update DNS records with conflict handling
    const recordsToCreate = [
      { type: 'A', name: cleanDomain, content: SELLQO_IP, ttl: 1, proxied: false },
      { type: 'A', name: `www.${cleanDomain}`, content: SELLQO_IP, ttl: 1, proxied: false },
      { type: 'TXT', name: `_sellqo.${cleanDomain}`, content: `sellqo-verify=${verificationToken}`, ttl: 1 },
    ];

    const actions: RecordAction[] = [];

    for (const record of recordsToCreate) {
      const recordLabel = `${record.type} ${record.name}`;

      // Find existing record with same name+type
      const existingRecord = allRecords.find(
        (r: DnsRecord) => r.type === record.type && r.name === record.name
      );

      // Check for conflicting CNAME on www
      if (record.name === `www.${cleanDomain}` && record.type === 'A') {
        const conflictingCname = allRecords.find(
          (r: DnsRecord) => r.type === 'CNAME' && r.name === record.name
        );
        if (conflictingCname) {
          const deleted = await deleteRecord(zone.id, conflictingCname.id, api_token);
          if (!deleted) {
            actions.push({ record: recordLabel, type: record.type, action: 'error', detail: 'Kon conflicterende CNAME niet verwijderen' });
            continue;
          }
        }
      }

      if (existingRecord) {
        // For TXT records with wrong value, delete and recreate
        if (record.type === 'TXT' && existingRecord.content !== record.content) {
          const deleted = await deleteRecord(zone.id, existingRecord.id, api_token);
          if (deleted) {
            const createRes = await createRecord(zone.id, record, api_token);
            actions.push({
              record: recordLabel,
              type: record.type,
              action: createRes.success ? 'deleted_and_created' : 'error',
              detail: createRes.success ? undefined : createRes.errors?.[0]?.message,
            });
          } else {
            actions.push({ record: recordLabel, type: record.type, action: 'error', detail: 'Kon bestaand TXT record niet verwijderen' });
          }
        } else {
          // PATCH update existing record
          const updateRes = await updateRecord(zone.id, existingRecord.id, record, api_token);
          actions.push({
            record: recordLabel,
            type: record.type,
            action: updateRes.success ? 'updated' : 'error',
            detail: updateRes.success ? undefined : updateRes.errors?.[0]?.message,
          });
        }
      } else {
        // Create new record
        const createRes = await createRecord(zone.id, record, api_token);
        actions.push({
          record: recordLabel,
          type: record.type,
          action: createRes.success ? 'created' : 'error',
          detail: createRes.success ? undefined : createRes.errors?.[0]?.message,
        });
      }
    }

    const hasErrors = actions.some(a => a.action === 'error');
    const recordsCreated = actions.filter(a => a.action === 'created' || a.action === 'deleted_and_created').length;
    const recordsUpdated = actions.filter(a => a.action === 'updated').length;

    // Step 7: Update tenant with domain info
    if (!hasErrors) {
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
            records_updated: recordsUpdated,
            actions,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: !hasErrors,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        domain: cleanDomain,
        zone_name: zone.name,
        actions,
        errors: hasErrors ? actions.filter(a => a.action === 'error').map(a => `${a.record}: ${a.detail}`) : undefined,
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

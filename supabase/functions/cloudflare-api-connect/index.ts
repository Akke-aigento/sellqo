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

interface Zone { id: string; name: string; status: string; }
interface DnsRecord { id: string; type: string; name: string; content: string; }

interface RecordResult {
  name: string;
  type: string;
  success: boolean;
  action: 'patched' | 'created' | 'deleted_and_created' | 'skipped' | 'error';
  record_id?: string;
  error?: string;
}

// ─── Cloudflare API helpers ───

async function cfFetch<T>(path: string, apiToken: string, init?: RequestInit): Promise<CloudflareResponse<T>> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  return await res.json() as CloudflareResponse<T>;
}

async function cfDelete(zoneId: string, recordId: string, token: string): Promise<boolean> {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, token, { method: 'DELETE' });
  return r.success;
}

async function cfPatch(zoneId: string, recordId: string, body: Record<string, unknown>, token: string) {
  return cfFetch<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, token, { method: 'PATCH', body: JSON.stringify(body) });
}

async function cfPost(zoneId: string, body: Record<string, unknown>, token: string) {
  return cfFetch<DnsRecord>(`/zones/${zoneId}/dns_records`, token, { method: 'POST', body: JSON.stringify(body) });
}

// ─── Per-record processors (each touches ONLY its specific record) ───

async function processRootA(zoneId: string, domain: string, allRecords: DnsRecord[], token: string): Promise<RecordResult> {
  const label = `A ${domain}`;
  try {
    const existing = allRecords.find(r => r.type === 'A' && r.name.toLowerCase() === domain);

    if (existing) {
      if (existing.content === SELLQO_IP) {
        return { name: label, type: 'A', success: true, action: 'skipped', record_id: existing.id };
      }
      const res = await cfPatch(zoneId, existing.id, { content: SELLQO_IP }, token);
      return res.success
        ? { name: label, type: 'A', success: true, action: 'patched', record_id: existing.id }
        : { name: label, type: 'A', success: false, action: 'error', error: res.errors?.[0]?.message };
    }

    const res = await cfPost(zoneId, { type: 'A', name: domain, content: SELLQO_IP, ttl: 1, proxied: false }, token);
    return res.success
      ? { name: label, type: 'A', success: true, action: 'created', record_id: res.result?.id }
      : { name: label, type: 'A', success: false, action: 'error', error: res.errors?.[0]?.message };
  } catch (e) {
    return { name: label, type: 'A', success: false, action: 'error', error: String(e) };
  }
}

async function processWwwA(zoneId: string, domain: string, allRecords: DnsRecord[], token: string): Promise<RecordResult> {
  const wwwName = `www.${domain}`;
  const label = `A ${wwwName}`;
  try {
    const existing = allRecords.find(r => r.name.toLowerCase() === wwwName);

    if (existing) {
      if (existing.type === 'CNAME') {
        // Delete the CNAME, then create A
        console.log(`Deleting CNAME for www (id: ${existing.id}, content: ${existing.content})`);
        const deleted = await cfDelete(zoneId, existing.id, token);
        if (!deleted) return { name: label, type: 'A', success: false, action: 'error', error: 'Kon CNAME voor www niet verwijderen' };
        const res = await cfPost(zoneId, { type: 'A', name: wwwName, content: SELLQO_IP, ttl: 1, proxied: false }, token);
        return res.success
          ? { name: label, type: 'A', success: true, action: 'deleted_and_created', record_id: res.result?.id }
          : { name: label, type: 'A', success: false, action: 'error', error: res.errors?.[0]?.message };
      }

      if (existing.type === 'A') {
        if (existing.content === SELLQO_IP) {
          return { name: label, type: 'A', success: true, action: 'skipped', record_id: existing.id };
        }
        const res = await cfPatch(zoneId, existing.id, { content: SELLQO_IP }, token);
        return res.success
          ? { name: label, type: 'A', success: true, action: 'patched', record_id: existing.id }
          : { name: label, type: 'A', success: false, action: 'error', error: res.errors?.[0]?.message };
      }

      // Some other type exists on www — don't touch it, just create A alongside
      console.log(`Unexpected record type ${existing.type} on www, creating A alongside`);
    }

    const res = await cfPost(zoneId, { type: 'A', name: wwwName, content: SELLQO_IP, ttl: 1, proxied: false }, token);
    return res.success
      ? { name: label, type: 'A', success: true, action: 'created', record_id: res.result?.id }
      : { name: label, type: 'A', success: false, action: 'error', error: res.errors?.[0]?.message };
  } catch (e) {
    return { name: label, type: 'A', success: false, action: 'error', error: String(e) };
  }
}

async function processSellqoTxt(zoneId: string, domain: string, verificationToken: string, allRecords: DnsRecord[], token: string): Promise<RecordResult> {
  const txtName = `_sellqo.${domain}`;
  const txtContent = `sellqo-verify=${verificationToken}`;
  const label = `TXT ${txtName}`;
  try {
    const existing = allRecords.find(r => r.type === 'TXT' && r.name.toLowerCase() === txtName);

    if (existing) {
      // Always delete + recreate TXT to guarantee correct value
      const existingContent = existing.content.replace(/^"|"$/g, '');
      if (existingContent === txtContent) {
        return { name: label, type: 'TXT', success: true, action: 'skipped', record_id: existing.id };
      }
      console.log(`Deleting old _sellqo TXT (id: ${existing.id}, content: "${existingContent}")`);
      const deleted = await cfDelete(zoneId, existing.id, token);
      if (!deleted) return { name: label, type: 'TXT', success: false, action: 'error', error: 'Kon bestaand _sellqo TXT niet verwijderen' };
      const res = await cfPost(zoneId, { type: 'TXT', name: txtName, content: txtContent, ttl: 1 }, token);
      return res.success
        ? { name: label, type: 'TXT', success: true, action: 'deleted_and_created', record_id: res.result?.id }
        : { name: label, type: 'TXT', success: false, action: 'error', error: res.errors?.[0]?.message };
    }

    const res = await cfPost(zoneId, { type: 'TXT', name: txtName, content: txtContent, ttl: 1 }, token);
    return res.success
      ? { name: label, type: 'TXT', success: true, action: 'created', record_id: res.result?.id }
      : { name: label, type: 'TXT', success: false, action: 'error', error: res.errors?.[0]?.message };
  } catch (e) {
    return { name: label, type: 'TXT', success: false, action: 'error', error: String(e) };
  }
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { tenant_id, domain, api_token } = await req.json();
    if (!tenant_id || !domain || !api_token) {
      return new Response(JSON.stringify({ error: 'tenant_id, domain en api_token zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Verify token
    const verifyData = await cfFetch<{ status: string }>('/user/tokens/verify', api_token);
    if (!verifyData.success || verifyData.result?.status !== 'active') {
      return new Response(JSON.stringify({ success: false, error: 'Het API token is ongeldig of inactief.', error_type: 'invalid_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Find zone
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    const zonesData = await cfFetch<Zone[]>(`/zones?name=${encodeURIComponent(cleanDomain)}`, api_token);
    if (!zonesData.success || !zonesData.result?.length) {
      // Fallback: list all zones for error message
      const allZones = await cfFetch<Zone[]>('/zones', api_token);
      return new Response(JSON.stringify({
        success: false,
        error: `Zone "${cleanDomain}" niet gevonden. Controleer of het token toegang heeft tot dit domein.`,
        error_type: 'domain_not_found',
        available_zones: allZones.result?.map((z: Zone) => z.name) || [],
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const zone = zonesData.result[0];

    // 3. Get verification token from tenant
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('domain_verification_token')
      .eq('id', tenant_id)
      .single();
    if (tenantError || !tenantData) {
      return new Response(JSON.stringify({ error: 'Tenant niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const verificationToken = tenantData.domain_verification_token || crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // 4. Fetch ALL existing DNS records (once)
    const recordsData = await cfFetch<DnsRecord[]>(`/zones/${zone.id}/dns_records?per_page=500`, api_token);
    const allRecords = recordsData.result || [];
    console.log(`Fetched ${allRecords.length} existing DNS records for zone ${zone.name}`);

    // 5. Process exactly 3 records — nothing else
    const [rootResult, wwwResult, txtResult] = await Promise.all([
      processRootA(zone.id, cleanDomain, allRecords, api_token),
      processWwwA(zone.id, cleanDomain, allRecords, api_token),
      processSellqoTxt(zone.id, cleanDomain, verificationToken, allRecords, api_token),
    ]);

    const results = [rootResult, wwwResult, txtResult];
    const allSuccess = results.every(r => r.success);

    console.log('DNS sync results:', JSON.stringify(results));

    // 6. Update tenant only if all 3 succeeded
    if (allSuccess) {
      await supabase.from('tenants').update({
        custom_domain: cleanDomain,
        domain_verified: true,
        domain_verification_token: verificationToken,
      }).eq('id', tenant_id);
    }

    return new Response(JSON.stringify({
      success: allSuccess,
      domain: cleanDomain,
      zone_name: zone.name,
      records: results,
      records_created: results.filter(r => r.action === 'created' || r.action === 'deleted_and_created').length,
      records_updated: results.filter(r => r.action === 'patched' || r.action === 'skipped').length,
      errors: allSuccess ? undefined : results.filter(r => !r.success).map(r => `${r.name}: ${r.error}`),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in cloudflare-api-connect:', error);
    return new Response(JSON.stringify({ success: false, error: 'Er is een onverwachte fout opgetreden' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELLQO_IP = '185.158.133.1';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareDNSRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const clientId = Deno.env.get('CLOUDFLARE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('CLOUDFLARE_CLIENT_SECRET')!;

  const response = await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getZones(accessToken: string): Promise<CloudflareZone[]> {
  const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch zones');
  }

  const data = await response.json();
  return data.result || [];
}

async function findZoneForDomain(accessToken: string, domain: string): Promise<CloudflareZone | null> {
  const zones = await getZones(accessToken);
  
  // Try exact match first
  let zone = zones.find(z => z.name.toLowerCase() === domain.toLowerCase());
  
  // Try parent domain if exact match not found
  if (!zone) {
    const parts = domain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.');
      zone = zones.find(z => z.name.toLowerCase() === parentDomain.toLowerCase());
      if (zone) break;
    }
  }
  
  return zone || null;
}

async function createOrUpdateDNSRecord(
  accessToken: string,
  zoneId: string,
  record: CloudflareDNSRecord
): Promise<void> {
  // First, check if record already exists
  const listResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to list DNS records');
  }

  const listData = await listResponse.json();
  const existingRecords = listData.result || [];

  if (existingRecords.length > 0) {
    // Update existing record
    const existingRecord = existingRecords[0];
    const updateResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied,
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update DNS record: ${error}`);
    }
  } else {
    // Create new record
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create DNS record: ${error}`);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Build redirect URL helper
    const buildRedirectUrl = (success: boolean, message: string) => {
      const baseUrl = supabaseUrl.replace('supabase.co', 'lovable.app').replace('/functions/v1', '');
      return `${baseUrl}/admin/settings?domain_status=${success ? 'success' : 'error'}&message=${encodeURIComponent(message)}`;
    };

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(buildRedirectUrl(false, 'OAuth werd geannuleerd of is mislukt'), 302);
    }

    if (!code || !stateParam) {
      return Response.redirect(buildRedirectUrl(false, 'Ongeldige OAuth callback'), 302);
    }

    // Decode state
    let state: { tenant_id: string; domain: string; redirect_uri: string; timestamp: number };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return Response.redirect(buildRedirectUrl(false, 'Ongeldige state parameter'), 302);
    }

    // Verify state is not too old (15 minutes)
    if (Date.now() - state.timestamp > 15 * 60 * 1000) {
      return Response.redirect(buildRedirectUrl(false, 'OAuth sessie verlopen'), 302);
    }

    console.log(`Processing OAuth callback for domain: ${state.domain}, tenant: ${state.tenant_id}`);

    // Get tenant verification token
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('domain_verification_token')
      .eq('id', state.tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return Response.redirect(buildRedirectUrl(false, 'Tenant niet gevonden'), 302);
    }

    // Exchange code for access token
    const callbackUrl = `${supabaseUrl}/functions/v1/cloudflare-oauth-callback`;
    const accessToken = await exchangeCodeForToken(code, callbackUrl);
    console.log('Successfully exchanged code for access token');

    // Find zone for domain
    const zone = await findZoneForDomain(accessToken, state.domain);
    if (!zone) {
      console.error('Zone not found for domain:', state.domain);
      return Response.redirect(
        buildRedirectUrl(false, `Domein ${state.domain} niet gevonden in je Cloudflare account`), 
        302
      );
    }

    console.log(`Found zone: ${zone.name} (${zone.id})`);

    // Create DNS records
    const records: CloudflareDNSRecord[] = [
      {
        type: 'A',
        name: state.domain,
        content: SELLQO_IP,
        ttl: 1, // Auto TTL
        proxied: false, // Don't proxy through Cloudflare for SSL
      },
      {
        type: 'A',
        name: `www.${state.domain}`,
        content: SELLQO_IP,
        ttl: 1,
        proxied: false,
      },
      {
        type: 'TXT',
        name: `_sellqo.${state.domain}`,
        content: `sellqo-verify=${tenant.domain_verification_token}`,
        ttl: 1,
      },
    ];

    for (const record of records) {
      console.log(`Creating/updating DNS record: ${record.type} ${record.name}`);
      await createOrUpdateDNSRecord(accessToken, zone.id, record);
    }

    // Update tenant as verified
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        domain_verified: true,
        domain_provider: 'cloudflare',
        domain_auto_configured: true,
      })
      .eq('id', state.tenant_id);

    if (updateError) {
      console.error('Failed to update tenant:', updateError);
      return Response.redirect(buildRedirectUrl(false, 'DNS records aangemaakt, maar verificatie update mislukt'), 302);
    }

    console.log('Successfully configured domain via Cloudflare OAuth');
    return Response.redirect(
      buildRedirectUrl(true, `Domein ${state.domain} is succesvol gekoppeld via Cloudflare`), 
      302
    );
  } catch (error) {
    console.error('Error in Cloudflare OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Onbekende fout';
    const baseUrl = supabaseUrl.replace('supabase.co', 'lovable.app').replace('/functions/v1', '');
    return Response.redirect(
      `${baseUrl}/admin/settings?domain_status=error&message=${encodeURIComponent(errorMessage)}`, 
      302
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationResult {
  success: boolean;
  a_record_valid: boolean;
  txt_record_valid: boolean;
  current_a_record: string | null;
  current_txt_record: string | null;
  error?: string;
  error_type?: 'wrong_ip' | 'cname_conflict' | 'not_propagated' | 'domain_not_found' | 'unknown';
  error_details?: string;
}

const EXPECTED_IP = '185.158.133.1';

async function resolveCNAME(domain: string): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=CNAME`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.Answer || data.Answer.length === 0) return [];
    return data.Answer.map((answer: { data: string }) => answer.data.replace(/"/g, ''));
  } catch {
    return [];
  }
}

async function resolveDNS(domain: string, type: 'A' | 'TXT'): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.Answer || data.Answer.length === 0) return [];
    return data.Answer.map((answer: { data: string }) => answer.data.replace(/"/g, ''));
  } catch (error) {
    console.error(`DNS resolution error for ${domain} (${type}):`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, domain: preCheckDomain, domain_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let domainToCheck: string | null = null;
    let verificationToken: string | null = null;

    // Multi-domain path: use domain_id to look up from tenant_domains
    if (domain_id) {
      const { data: domainRecord, error: domainError } = await supabase
        .from('tenant_domains')
        .select('domain, verification_token, tenant_id')
        .eq('id', domain_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (domainError || !domainRecord) {
        return new Response(
          JSON.stringify({ error: 'Domain not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      domainToCheck = domainRecord.domain;
      verificationToken = domainRecord.verification_token;
    } else {
      // Legacy path: use tenants table
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('custom_domain, domain_verification_token')
        .eq('id', tenant_id)
        .single();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      domainToCheck = preCheckDomain || tenant.custom_domain;
      verificationToken = tenant.domain_verification_token;
    }

    if (!domainToCheck) {
      return new Response(
        JSON.stringify({ error: 'No domain configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying domain: ${domainToCheck} (domain_id: ${domain_id || 'legacy'})`);

    const aRecords = await resolveDNS(domainToCheck, 'A');
    const txtRecords = await resolveDNS(`_sellqo.${domainToCheck}`, 'TXT');
    const cnameRecords = await resolveCNAME(domainToCheck);
    const hasCnameConflict = cnameRecords.length > 0;

    console.log(`A records: ${aRecords}, TXT records: ${txtRecords}, CNAME: ${cnameRecords}`);

    const aRecordValid = aRecords.includes(EXPECTED_IP);
    const expectedTxtValue = `sellqo-verify=${verificationToken}`;
    const txtRecordValid = txtRecords.some(record => record === expectedTxtValue);

    const result: VerificationResult = {
      success: aRecordValid && txtRecordValid,
      a_record_valid: aRecordValid,
      txt_record_valid: txtRecordValid,
      current_a_record: aRecords.length > 0 ? aRecords[0] : null,
      current_txt_record: txtRecords.length > 0 ? txtRecords[0] : null,
    };

    if (!result.success) {
      if (hasCnameConflict) {
        result.error_type = 'cname_conflict';
        result.error = 'CNAME conflict gevonden';
        result.error_details = `Er staat een CNAME record op je root domein (${cnameRecords[0]}). Verwijder dit record eerst voordat je een A-record kunt toevoegen.`;
      } else if (aRecords.length > 0 && !aRecordValid) {
        result.error_type = 'wrong_ip';
        result.error = 'Verkeerd IP-adres';
        result.error_details = `Je A-record wijst naar ${aRecords[0]} maar moet naar ${EXPECTED_IP} wijzen.`;
      } else if (aRecords.length === 0) {
        result.error_type = 'not_propagated';
        result.error = 'DNS nog niet gevonden';
        result.error_details = 'De DNS records zijn nog niet gepropageerd. Dit kan tot 48 uur duren. Probeer het later opnieuw.';
      }

      // Add specific TXT mismatch info when A is OK but TXT fails
      if (aRecordValid && !txtRecordValid) {
        const currentTxt = txtRecords.length > 0 ? txtRecords[0] : null;
        if (currentTxt) {
          result.error_type = result.error_type || 'unknown';
          result.error = 'TXT verificatie mislukt';
          result.error_details = `Het _sellqo TXT record bevat "${currentTxt}" maar verwacht wordt "${expectedTxtValue}". Verwijder het oude record en voeg het juiste toe, of gebruik de automatische koppeling.`;
        } else {
          result.error_type = result.error_type || 'not_propagated';
          result.error = result.error || 'TXT record niet gevonden';
          result.error_details = result.error_details || `Het _sellqo TXT record is nog niet gevonden. Voeg een TXT record toe met naam "_sellqo" en waarde "${expectedTxtValue}".`;
        }
      }
    }

    // Update verification status
    if (result.success && !preCheckDomain) {
      if (domain_id) {
        // Multi-domain: update tenant_domains
        await supabase
          .from('tenant_domains')
          .update({ dns_verified: true })
          .eq('id', domain_id);
      } else {
        // Legacy: update tenants
        await supabase
          .from('tenants')
          .update({ domain_verified: true, ssl_status: 'pending' })
          .eq('id', tenant_id);
      }
    }

    console.log('Verification result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in verify-domain:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
}

const EXPECTED_IP = '185.158.133.1';

async function resolveDNS(domain: string, type: 'A' | 'TXT'): Promise<string[]> {
  try {
    // Use Google's DNS-over-HTTPS API for DNS resolution
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.error(`DNS query failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.Answer || data.Answer.length === 0) {
      return [];
    }
    
    // Extract the data field from each answer
    return data.Answer.map((answer: { data: string }) => answer.data.replace(/"/g, ''));
  } catch (error) {
    console.error(`DNS resolution error for ${domain} (${type}):`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, domain: preCheckDomain } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant data
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

    const domainToCheck = preCheckDomain || tenant.custom_domain;
    const verificationToken = tenant.domain_verification_token;

    if (!domainToCheck) {
      return new Response(
        JSON.stringify({ error: 'No domain configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying domain: ${domainToCheck}`);

    // Resolve A record for the domain
    const aRecords = await resolveDNS(domainToCheck, 'A');
    console.log(`A records for ${domainToCheck}:`, aRecords);
    
    // Also check www subdomain
    const wwwARecords = await resolveDNS(`www.${domainToCheck}`, 'A');
    console.log(`A records for www.${domainToCheck}:`, wwwARecords);

    // Resolve TXT record for verification
    const txtRecords = await resolveDNS(`_sellqo.${domainToCheck}`, 'TXT');
    console.log(`TXT records for _sellqo.${domainToCheck}:`, txtRecords);

    // Check if A record points to our IP
    const aRecordValid = aRecords.includes(EXPECTED_IP);
    
    // Check if TXT record contains our verification token
    const expectedTxtValue = `sellqo-verify=${verificationToken}`;
    const txtRecordValid = txtRecords.some(record => record === expectedTxtValue);

    const result: VerificationResult = {
      success: aRecordValid && txtRecordValid,
      a_record_valid: aRecordValid,
      txt_record_valid: txtRecordValid,
      current_a_record: aRecords.length > 0 ? aRecords[0] : null,
      current_txt_record: txtRecords.length > 0 ? txtRecords[0] : null,
    };

    // If verification successful, update the tenant
    if (result.success && !preCheckDomain) {
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ domain_verified: true })
        .eq('id', tenant_id);

      if (updateError) {
        console.error('Error updating domain_verified:', updateError);
        result.error = 'Verification succeeded but failed to update status';
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

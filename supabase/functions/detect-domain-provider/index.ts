import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderInfo {
  provider: string;
  provider_name: string;
  supports_auto_connect: boolean;
  connect_method: string | null;
  nameservers: string[];
}

// Known DNS provider patterns
const PROVIDER_PATTERNS: Array<{
  pattern: RegExp;
  provider: string;
  provider_name: string;
  supports_auto_connect: boolean;
  connect_method: string | null;
}> = [
  {
    pattern: /\.ns\.cloudflare\.com$/i,
    provider: 'cloudflare',
    provider_name: 'Cloudflare',
    supports_auto_connect: true,
    connect_method: 'cloudflare_oauth',
  },
  {
    pattern: /\.domaincontrol\.com$/i,
    provider: 'godaddy',
    provider_name: 'GoDaddy',
    supports_auto_connect: true,
    connect_method: 'domain_connect',
  },
  {
    pattern: /ns\d*\.transip\.(nl|eu|be)$/i,
    provider: 'transip',
    provider_name: 'TransIP',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /ns\d*\.combell\.(net|be)$/i,
    provider: 'combell',
    provider_name: 'Combell',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.versio\.(nl|uk|org)$/i,
    provider: 'versio',
    provider_name: 'Versio',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /ns\d*\.one\.com$/i,
    provider: 'one.com',
    provider_name: 'one.com',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.hostinger\.(com|nl|be)$/i,
    provider: 'hostinger',
    provider_name: 'Hostinger',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.namecheap\.com$/i,
    provider: 'namecheap',
    provider_name: 'Namecheap',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.registrar-servers\.com$/i,
    provider: 'namecheap',
    provider_name: 'Namecheap',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.awsdns-\d+\.(com|net|org|co\.uk)$/i,
    provider: 'aws',
    provider_name: 'Amazon Route 53',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /ns\d*\.digitalocean\.com$/i,
    provider: 'digitalocean',
    provider_name: 'DigitalOcean',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /dns\d*\.ovh\.(net|com)$/i,
    provider: 'ovh',
    provider_name: 'OVH',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /ns\d*\.ionos\.(com|de|nl)$/i,
    provider: 'ionos',
    provider_name: 'IONOS',
    supports_auto_connect: true,
    connect_method: 'domain_connect',
  },
  {
    pattern: /\.google\.com$/i,
    provider: 'google',
    provider_name: 'Google Domains',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.strato\.(de|nl|com)$/i,
    provider: 'strato',
    provider_name: 'Strato',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.active24\.(cz|com)$/i,
    provider: 'active24',
    provider_name: 'Active24',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.mijndomein\.nl$/i,
    provider: 'mijndomein',
    provider_name: 'Mijn Domein',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.antagonist\.nl$/i,
    provider: 'antagonist',
    provider_name: 'Antagonist',
    supports_auto_connect: false,
    connect_method: null,
  },
  {
    pattern: /\.neostrada\.(nl|be)$/i,
    provider: 'neostrada',
    provider_name: 'Neostrada',
    supports_auto_connect: false,
    connect_method: null,
  },
];

async function resolveNS(domain: string): Promise<string[]> {
  try {
    // Use Cloudflare's DNS-over-HTTPS API for NS lookup
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`,
      {
        headers: {
          'Accept': 'application/dns-json',
        },
      }
    );

    if (!response.ok) {
      console.error('DNS query failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.Answer || !Array.isArray(data.Answer)) {
      return [];
    }

    // Extract NS records
    const nsRecords = data.Answer
      .filter((record: any) => record.type === 2) // NS record type
      .map((record: any) => record.data?.toLowerCase().replace(/\.$/, '') || '');

    return nsRecords.filter(Boolean);
  } catch (error) {
    console.error('Error resolving NS records:', error);
    return [];
  }
}

function detectProvider(nameservers: string[]): ProviderInfo {
  for (const ns of nameservers) {
    for (const providerPattern of PROVIDER_PATTERNS) {
      if (providerPattern.pattern.test(ns)) {
        return {
          provider: providerPattern.provider,
          provider_name: providerPattern.provider_name,
          supports_auto_connect: providerPattern.supports_auto_connect,
          connect_method: providerPattern.connect_method,
          nameservers,
        };
      }
    }
  }

  return {
    provider: 'unknown',
    provider_name: 'Onbekend',
    supports_auto_connect: false,
    connect_method: null,
    nameservers,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain || typeof domain !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the domain
    const cleanDomain = domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '')
      .trim();

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(cleanDomain)) {
      return new Response(
        JSON.stringify({ error: 'Invalid domain format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Detecting provider for domain: ${cleanDomain}`);

    // Resolve NS records
    const nameservers = await resolveNS(cleanDomain);
    console.log(`Found nameservers: ${nameservers.join(', ')}`);

    // Detect provider from nameservers
    const providerInfo = detectProvider(nameservers);
    console.log(`Detected provider: ${providerInfo.provider_name}`);

    return new Response(
      JSON.stringify(providerInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error detecting provider:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to detect provider',
        provider: 'unknown',
        provider_name: 'Onbekend',
        supports_auto_connect: false,
        connect_method: null,
        nameservers: [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

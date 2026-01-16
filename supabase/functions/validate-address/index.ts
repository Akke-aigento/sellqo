import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TomTomAddress {
  streetNumber?: string;
  streetName?: string;
  municipality?: string;
  countrySubdivision?: string;
  postalCode?: string;
  countryCode?: string;
  country?: string;
  freeformAddress?: string;
}

interface TomTomResult {
  type: string;
  id: string;
  score: number;
  matchConfidence?: {
    score: number;
  };
  address: TomTomAddress;
  position: {
    lat: number;
    lon: number;
  };
}

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[ADDRESS-VALIDATE] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { street, city, postal_code, country, query } = await req.json();
    logStep('Received request', { street, city, postal_code, country, query });

    const tomtomApiKey = Deno.env.get('TOMTOM_API_KEY');
    if (!tomtomApiKey) {
      logStep('TomTom API key not configured');
      return new Response(
        JSON.stringify({ error: 'TomTom API key niet geconfigureerd' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    let searchQuery: string;
    
    if (query) {
      // Autocomplete mode - use query directly
      searchQuery = query;
    } else {
      // Validation mode - build full address
      const addressParts = [street, postal_code, city, country].filter(Boolean);
      searchQuery = addressParts.join(', ');
    }

    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: 'Geen adresgegevens opgegeven' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call TomTom Search API
    const tomtomUrl = new URL('https://api.tomtom.com/search/2/search/' + encodeURIComponent(searchQuery) + '.json');
    tomtomUrl.searchParams.set('key', tomtomApiKey);
    tomtomUrl.searchParams.set('limit', query ? '5' : '1'); // More results for autocomplete
    tomtomUrl.searchParams.set('typeahead', 'true');
    
    // Prefer results in specific country if provided
    if (country) {
      tomtomUrl.searchParams.set('countrySet', country);
    } else {
      // Default to EU countries
      tomtomUrl.searchParams.set('countrySet', 'NL,BE,DE,FR,AT,LU,ES,IT,PT,IE,UK,DK,SE,FI,NO,CH,PL,CZ,HU');
    }

    logStep('Calling TomTom API', { url: tomtomUrl.toString().replace(tomtomApiKey, '***') });

    const tomtomResponse = await fetch(tomtomUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!tomtomResponse.ok) {
      logStep('TomTom API error', { status: tomtomResponse.status });
      throw new Error(`TomTom API returned status ${tomtomResponse.status}`);
    }

    const tomtomData = await tomtomResponse.json();
    logStep('TomTom response received', { numResults: tomtomData.results?.length || 0 });

    if (!tomtomData.results || tomtomData.results.length === 0) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Adres niet gevonden',
          suggestions: [] 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process results
    const suggestions = tomtomData.results
      .filter((result: TomTomResult) => result.type === 'Point Address' || result.type === 'Address Range' || result.type === 'Street')
      .map((result: TomTomResult) => ({
        street: [result.address.streetName, result.address.streetNumber].filter(Boolean).join(' '),
        city: result.address.municipality || '',
        postal_code: result.address.postalCode || '',
        country: result.address.countryCode || '',
        country_name: result.address.country || '',
        full_address: result.address.freeformAddress || '',
        confidence: result.matchConfidence?.score || result.score,
        position: result.position,
      }));

    // For autocomplete, return all suggestions
    if (query) {
      return new Response(
        JSON.stringify({
          suggestions,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For validation, check the best match
    const bestMatch = suggestions[0];
    const isValid = bestMatch && bestMatch.confidence > 0.5;

    return new Response(
      JSON.stringify({
        valid: isValid,
        validated_address: isValid ? bestMatch : null,
        original_address: { street, city, postal_code, country },
        confidence: bestMatch?.confidence || 0,
        suggestions: suggestions.slice(0, 3),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Er is een fout opgetreden bij het valideren van het adres' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

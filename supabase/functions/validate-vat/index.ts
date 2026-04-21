import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ViesResponse {
  isValid: boolean;
  requestDate: string;
  userError: string;
  name: string;
  address: string;
  requestIdentifier: string;
  vatNumber: string;
  viesApproximate?: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    companyType: string;
    matchName: number;
    matchStreet: number;
    matchPostalCode: number;
    matchCity: number;
    matchCompanyType: number;
  };
}

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[VIES-VALIDATE] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vat_number } = await req.json();
    logStep('Received request', { vat_number });

    if (!vat_number) {
      return new Response(
        JSON.stringify({ error: 'BTW-nummer is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the VAT number - remove spaces and convert to uppercase
    const cleanVat = vat_number.replace(/[\s.-]/g, '').toUpperCase();
    logStep('Cleaned VAT number', { cleanVat });

    // Extract country code (first 2 characters)
    const countryCode = cleanVat.substring(0, 2);
    const vatNumberWithoutCountry = cleanVat.substring(2);

    // Validate country code is EU member state
    const euCountries = [
      'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
      'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
      'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI' // XI = Northern Ireland
    ];

    if (!euCountries.includes(countryCode)) {
      logStep('Invalid country code', { countryCode });
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Ongeldige landcode: ${countryCode}. Alleen EU-landen worden ondersteund.` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call VIES REST API
    const viesUrl = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumberWithoutCountry}`;
    logStep('Calling VIES API', { viesUrl });

    const viesResponse = await fetch(viesUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!viesResponse.ok) {
      logStep('VIES API error', { status: viesResponse.status });
      
      // Check if it's a specific VIES error
      if (viesResponse.status === 400) {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'Ongeldig BTW-nummer formaat' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (viesResponse.status === 503) {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'VIES service tijdelijk niet beschikbaar. Probeer later opnieuw.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`VIES API returned status ${viesResponse.status}`);
    }

    const viesData: ViesResponse = await viesResponse.json();
    logStep('VIES response received', { isValid: viesData.isValid, name: viesData.name });

    return new Response(
      JSON.stringify({
        valid: viesData.isValid,
        vat_number: cleanVat,
        country_code: countryCode,
        company_name: viesData.name || null,
        address: viesData.address || null,
        request_date: viesData.requestDate,
        request_identifier: viesData.requestIdentifier,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Er is een fout opgetreden bij het valideren van het BTW-nummer' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

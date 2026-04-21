import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaCatalog {
  id: string;
  name: string;
  product_count: number;
  vertical: string;
}

interface MetaBusiness {
  id: string;
  name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_token } = await req.json();

    if (!access_token) {
      return new Response(
        JSON.stringify({ error: 'access_token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get user's businesses
    const businessesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/businesses?access_token=${access_token}`
    );
    const businessesData = await businessesResponse.json();

    if (businessesData.error) {
      return new Response(
        JSON.stringify({ error: businessesData.error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const businesses: MetaBusiness[] = businessesData.data || [];
    const result: Array<MetaBusiness & { catalogs: MetaCatalog[] }> = [];

    // 2. For each business, get owned catalogs
    for (const business of businesses) {
      const catalogsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${business.id}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${access_token}`
      );
      const catalogsData = await catalogsResponse.json();

      const catalogs: MetaCatalog[] = (catalogsData.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        product_count: c.product_count || 0,
        vertical: c.vertical || 'commerce',
      }));

      result.push({
        id: business.id,
        name: business.name,
        catalogs,
      });
    }

    // Also try to get catalogs from user's pages (for smaller businesses without Business Manager)
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${access_token}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.data && pagesData.data.length > 0) {
      // User has pages but might not have Business Manager set up
      // They can still create a catalog via the Commerce Manager
    }

    return new Response(
      JSON.stringify({ 
        businesses: result,
        can_create_catalog: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fetch catalogs error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

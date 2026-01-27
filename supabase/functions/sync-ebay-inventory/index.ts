import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EbayCredentials {
  ebayAppId: string;
  ebayCertId: string;
  ebayRefreshToken: string;
  ebayMarketplaceId?: string;
}

async function getAccessToken(credentials: EbayCredentials): Promise<string> {
  const authString = btoa(`${credentials.ebayAppId}:${credentials.ebayCertId}`);
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.ebayRefreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    
    if (!connectionId) {
      throw new Error('connectionId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      throw new Error('Connection not found');
    }

    const credentials = connection.credentials as unknown as EbayCredentials;
    const settings = connection.settings || {};
    const safetyStock = settings.safetyStock || 0;
    
    // Get access token
    const accessToken = await getAccessToken(credentials);
    const marketplaceId = credentials.ebayMarketplaceId || 'EBAY_NL';

    // Fetch products with eBay SKU mappings
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, stock, track_inventory')
      .eq('tenant_id', connection.tenant_id)
      .eq('track_inventory', true)
      .not('sku', 'is', null);

    if (productsError) {
      throw new Error('Failed to fetch products');
    }

    let productsSynced = 0;
    let productsFailed = 0;

    for (const product of products || []) {
      if (!product.sku) continue;

      // Calculate available quantity (stock - safety stock, minimum 0)
      const availableQuantity = Math.max(0, (product.stock || 0) - safetyStock);

      try {
        // Update inventory item in eBay
        const updateResponse = await fetch(
          `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(product.sku)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            },
            body: JSON.stringify({
              availability: {
                shipToLocationAvailability: {
                  quantity: availableQuantity,
                },
              },
            }),
          }
        );

        if (updateResponse.ok || updateResponse.status === 204) {
          productsSynced++;
          
          // Log the sync
          await supabase
            .from('inventory_sync_logs')
            .insert({
              tenant_id: connection.tenant_id,
              product_id: product.id,
              marketplace_connection_id: connectionId,
              marketplace_type: 'ebay',
              old_quantity: product.stock || 0,
              new_quantity: availableQuantity,
              sync_status: 'success',
            });
        } else {
          // Product might not exist in eBay, that's okay
          const errorText = await updateResponse.text();
          console.log(`eBay inventory update for SKU ${product.sku}: ${updateResponse.status} - ${errorText}`);
          
          // Only count as failed if it's a real error (not 404)
          if (updateResponse.status !== 404) {
            productsFailed++;
          }
        }
      } catch (err) {
        console.error(`Failed to sync product ${product.sku}:`, err);
        productsFailed++;
      }
    }

    // Update connection last sync
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: productsFailed > 0 ? `${productsFailed} producten konden niet worden gesynchroniseerd` : null,
      })
      .eq('id', connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        productsSynced,
        productsFailed,
        totalProducts: products?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('eBay inventory sync error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

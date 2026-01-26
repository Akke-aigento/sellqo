import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  featured_image: string | null;
  images: string[] | null;
  slug: string;
  is_active: boolean;
  social_channels: Record<string, boolean> | null;
}

interface SyncResult {
  success: boolean;
  products_synced: number;
  errors: Array<{ product_id: string; product_name: string; error: string }>;
}

async function syncProductToMeta(
  product: Product,
  catalogId: string,
  accessToken: string,
  storeUrl: string,
  brandName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const availability = product.stock > 0 ? 'in stock' : 'out of stock';
    const imageUrl = product.featured_image || (product.images && product.images[0]) || '';
    
    // Format price in cents for Meta
    const priceValue = Math.round(product.price * 100);
    
    const productData = {
      retailer_id: product.id,
      availability,
      brand: brandName,
      condition: 'new',
      description: product.description || product.name,
      image_link: imageUrl,
      link: `${storeUrl}/products/${product.slug}`,
      title: product.name,
      price: `${priceValue} EUR`,
      ...(product.compare_at_price && product.compare_at_price > product.price && {
        sale_price: `${priceValue} EUR`,
        price: `${Math.round(product.compare_at_price * 100)} EUR`,
      }),
      ...(product.barcode && { gtin: product.barcode }),
      ...(product.sku && { mpn: product.sku }),
    };

    // First try to update, if it fails, create new
    const updateResponse = await fetch(
      `https://graph.facebook.com/v18.0/${catalogId}/products`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          requests: [{
            method: 'UPDATE',
            retailer_id: product.id,
            data: productData,
          }],
        }),
      }
    );

    const updateResult = await updateResponse.json();
    
    // If product doesn't exist, create it
    if (updateResult.error?.code === 100 || updateResult.handles?.[0]?.errors) {
      const createResponse = await fetch(
        `https://graph.facebook.com/v18.0/${catalogId}/products`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            requests: [{
              method: 'CREATE',
              retailer_id: product.id,
              data: productData,
            }],
          }),
        }
      );
      
      const createResult = await createResponse.json();
      if (createResult.error) {
        return { success: false, error: createResult.error.message };
      }
    } else if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body
    const { connection_id, full_sync = false } = await req.json();

    if (!connection_id) {
      return new Response(
        JSON.stringify({ error: 'connection_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the connection details
    const { data: connection, error: connError } = await supabase
      .from('social_channel_connections')
      .select('*')
      .eq('id', connection_id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = connection.credentials as any;
    const catalogId = connection.catalog_id || credentials?.catalogId;
    const accessToken = credentials?.accessToken;

    if (!catalogId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing catalog_id or access_token in connection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update sync status to 'syncing'
    await supabase
      .from('social_channel_connections')
      .update({ sync_status: 'syncing' })
      .eq('id', connection_id);

    // Get tenant info for store URL and brand name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('store_url, company_name')
      .eq('id', connection.tenant_id)
      .single();

    const storeUrl = tenant?.store_url || `https://${connection.tenant_id}.sellqo.com`;
    const brandName = tenant?.company_name || 'SellQo Store';

    // Get products to sync
    const channelType = connection.channel_type;
    let query = supabase
      .from('products')
      .select('id, name, description, price, compare_at_price, sku, barcode, stock, featured_image, images, slug, is_active, social_channels')
      .eq('tenant_id', connection.tenant_id)
      .eq('is_active', true);

    const { data: products, error: prodError } = await query;

    if (prodError) {
      await supabase
        .from('social_channel_connections')
        .update({ 
          sync_status: 'error',
          last_error: prodError.message,
        })
        .eq('id', connection_id);

      return new Response(
        JSON.stringify({ error: 'Failed to fetch products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter products that have this channel enabled (or sync all if no filter set)
    const productsToSync = products?.filter(p => {
      if (!p.social_channels) return true; // Sync all if no channel preferences set
      return p.social_channels[channelType] === true;
    }) || [];

    console.log(`Syncing ${productsToSync.length} products to Meta catalog ${catalogId}`);

    // Sync products in batches
    const batchSize = 20;
    const syncResult: SyncResult = { success: true, products_synced: 0, errors: [] };

    for (let i = 0; i < productsToSync.length; i += batchSize) {
      const batch = productsToSync.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(product => 
          syncProductToMeta(product as Product, catalogId, accessToken, storeUrl, brandName)
        )
      );

      results.forEach((result, index) => {
        const product = batch[index];
        if (result.success) {
          syncResult.products_synced++;
        } else {
          syncResult.errors.push({
            product_id: product.id,
            product_name: product.name,
            error: result.error || 'Unknown error',
          });
        }
      });

      // Small delay between batches to respect rate limits
      if (i + batchSize < productsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update connection with results
    const syncErrors = syncResult.errors.map(e => ({
      product_id: e.product_id,
      product_name: e.product_name,
      message: e.error,
      timestamp: new Date().toISOString(),
    }));

    await supabase
      .from('social_channel_connections')
      .update({
        sync_status: syncResult.errors.length > 0 ? 'error' : 'synced',
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: full_sync ? new Date().toISOString() : connection.last_full_sync_at,
        products_in_catalog: syncResult.products_synced,
        products_synced: syncResult.products_synced,
        sync_errors: syncErrors,
        last_error: syncResult.errors.length > 0 
          ? `${syncResult.errors.length} producten konden niet worden gesynchroniseerd`
          : null,
      })
      .eq('id', connection_id);

    return new Response(
      JSON.stringify({
        success: true,
        products_synced: syncResult.products_synced,
        errors_count: syncResult.errors.length,
        errors: syncResult.errors.slice(0, 10), // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

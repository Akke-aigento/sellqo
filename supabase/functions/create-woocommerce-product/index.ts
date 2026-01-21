import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WooCommerceCredentials {
  siteUrl: string
  consumerKey: string
  consumerSecret: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { product_id, tenant_id, connection_id } = await req.json()

    if (!product_id || !tenant_id || !connection_id) {
      throw new Error('product_id, tenant_id, and connection_id are required')
    }

    // Get the product
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (prodError || !product) {
      throw new Error('Product not found')
    }

    // Get the connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = connection.credentials as WooCommerceCredentials

    // Normalize site URL
    let siteUrl = credentials.siteUrl.trim()
    siteUrl = siteUrl.replace(/\/+$/, '')
    if (!siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`
    }

    const authString = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`)

    // Build WooCommerce product payload
    const wooProduct: any = {
      name: product.woocommerce_optimized_title || product.name,
      type: 'simple',
      regular_price: product.price.toString(),
      description: product.woocommerce_optimized_description || product.description || '',
      short_description: product.short_description || '',
      sku: product.sku || undefined,
      manage_stock: product.track_inventory,
      stock_quantity: product.stock || 0,
      status: product.is_active ? 'publish' : 'draft',
      // Yoast SEO meta_data - compatible with Yoast SEO and RankMath plugins
      meta_data: [
        ...(product.meta_title ? [{ key: '_yoast_wpseo_title', value: product.meta_title }] : []),
        ...(product.meta_description ? [{ key: '_yoast_wpseo_metadesc', value: product.meta_description }] : []),
        // Also add RankMath keys for compatibility
        ...(product.meta_title ? [{ key: 'rank_math_title', value: product.meta_title }] : []),
        ...(product.meta_description ? [{ key: 'rank_math_description', value: product.meta_description }] : []),
      ],
    }

    // Add images if available
    if (product.images && product.images.length > 0) {
      wooProduct.images = product.images.map((url: string, index: number) => ({
        src: url,
        position: index,
      }))
    }

    // Add compare at price as sale price
    if (product.compare_at_price && product.compare_at_price > product.price) {
      wooProduct.sale_price = product.price.toString()
      wooProduct.regular_price = product.compare_at_price.toString()
    }

    // Add weight if available
    if (product.weight) {
      wooProduct.weight = product.weight.toString()
    }

    console.log('Creating WooCommerce product:', wooProduct.name)

    // Create product in WooCommerce
    const response = await fetch(`${siteUrl}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wooProduct),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('WooCommerce API error:', response.status, errorText)
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          woocommerce_listing_status: 'error',
          woocommerce_listing_error: `API Error: ${response.status}`,
        })
        .eq('id', product_id)

      throw new Error(`WooCommerce API error: ${response.status}`)
    }

    const createdProduct = await response.json()
    console.log('Created WooCommerce product:', createdProduct.id)

    // Update product with WooCommerce ID
    await supabase
      .from('products')
      .update({
        woocommerce_product_id: createdProduct.id.toString(),
        woocommerce_listing_status: 'listed',
        woocommerce_listing_error: null,
        woocommerce_last_synced_at: new Date().toISOString(),
      })
      .eq('id', product_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        woocommerce_product_id: createdProduct.id,
        permalink: createdProduct.permalink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating WooCommerce product:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

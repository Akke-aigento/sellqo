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
    const { product_id, tenant_id, connection_id, update_type = 'all' } = await req.json()

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

    if (!product.woocommerce_product_id) {
      throw new Error('Product is not linked to WooCommerce')
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
    const settings = connection.settings as { safetyStock?: number } | null
    const safetyStock = settings?.safetyStock || 0

    // Build update payload based on update_type
    const updatePayload: any = {}

    if (update_type === 'all' || update_type === 'content') {
      updatePayload.name = product.woocommerce_optimized_title || product.name
      updatePayload.description = product.woocommerce_optimized_description || product.description || ''
      updatePayload.short_description = product.short_description || ''
      updatePayload.status = product.is_active ? 'publish' : 'draft'
    }

    if (update_type === 'all' || update_type === 'price') {
      if (product.compare_at_price && product.compare_at_price > product.price) {
        updatePayload.regular_price = product.compare_at_price.toString()
        updatePayload.sale_price = product.price.toString()
      } else {
        updatePayload.regular_price = product.price.toString()
        updatePayload.sale_price = ''
      }
    }

    if (update_type === 'all' || update_type === 'inventory') {
      const stockToSync = Math.max(0, (product.stock || 0) - safetyStock)
      updatePayload.manage_stock = product.track_inventory
      updatePayload.stock_quantity = stockToSync
    }

    // SEO update - sync Yoast SEO and RankMath meta_data
    if (update_type === 'all' || update_type === 'seo') {
      updatePayload.meta_data = [
        ...(product.meta_title ? [{ key: '_yoast_wpseo_title', value: product.meta_title }] : []),
        ...(product.meta_description ? [{ key: '_yoast_wpseo_metadesc', value: product.meta_description }] : []),
        // Also add RankMath keys for compatibility
        ...(product.meta_title ? [{ key: 'rank_math_title', value: product.meta_title }] : []),
        ...(product.meta_description ? [{ key: 'rank_math_description', value: product.meta_description }] : []),
      ]
    }

    console.log(`Updating WooCommerce product ${product.woocommerce_product_id}:`, update_type)

    // Update product in WooCommerce
    const response = await fetch(
      `${siteUrl}/wp-json/wc/v3/products/${product.woocommerce_product_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('WooCommerce API error:', response.status, errorText)
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          woocommerce_listing_status: 'error',
          woocommerce_listing_error: `Sync error: ${response.status}`,
        })
        .eq('id', product_id)

      throw new Error(`WooCommerce API error: ${response.status}`)
    }

    const updatedProduct = await response.json()
    console.log('Updated WooCommerce product:', updatedProduct.id)

    // Update product sync timestamp
    await supabase
      .from('products')
      .update({
        woocommerce_listing_status: 'listed',
        woocommerce_listing_error: null,
        woocommerce_last_synced_at: new Date().toISOString(),
      })
      .eq('id', product_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        woocommerce_product_id: updatedProduct.id,
        update_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating WooCommerce product:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

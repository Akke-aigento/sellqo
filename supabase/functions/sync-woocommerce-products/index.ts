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

interface SyncRequest {
  connectionId: string
  direction?: 'import' | 'export'
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
    const { connectionId, direction = 'import' } = await req.json() as SyncRequest

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      throw new Error('Marketplace verbinding niet gevonden')
    }

    const credentials = connection.credentials as WooCommerceCredentials

    // Normalize site URL
    let siteUrl = credentials.siteUrl.trim()
    siteUrl = siteUrl.replace(/\/+$/, '')
    if (!siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`
    }

    const authString = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`)

    console.log(`Syncing WooCommerce products for ${siteUrl}, direction: ${direction}`)

    let productsImported = 0
    let productsUpdated = 0
    let productsExported = 0
    const errors: string[] = []

    if (direction === 'import') {
      // Fetch products from WooCommerce
      const productsUrl = `${siteUrl}/wp-json/wc/v3/products?per_page=100`
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }

      const wooProducts = await response.json()

      console.log(`Found ${wooProducts.length} products in WooCommerce`)

      for (const wooProduct of wooProducts) {
        // Check if product already exists by WooCommerce ID or SKU
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', connection.tenant_id)
          .or(`woocommerce_product_id.eq.${wooProduct.id},sku.eq.${wooProduct.sku || ''}`)
          .single()

        // Extract SEO data from WooCommerce meta_data (Yoast SEO / RankMath)
        const metaData = wooProduct.meta_data || []
        const yoastTitle = metaData.find((m: any) => m.key === '_yoast_wpseo_title')?.value || null
        const yoastDesc = metaData.find((m: any) => m.key === '_yoast_wpseo_metadesc')?.value || null
        const rankMathTitle = metaData.find((m: any) => m.key === 'rank_math_title')?.value || null
        const rankMathDesc = metaData.find((m: any) => m.key === 'rank_math_description')?.value || null

        // Use Yoast first, then RankMath as fallback
        const seoTitle = yoastTitle || rankMathTitle || null
        const seoDescription = yoastDesc || rankMathDesc || null

        const productData = {
          tenant_id: connection.tenant_id,
          name: wooProduct.name,
          description: wooProduct.description?.replace(/<[^>]*>/g, '') || null,
          short_description: wooProduct.short_description?.replace(/<[^>]*>/g, '') || null,
          price: parseFloat(wooProduct.price || wooProduct.regular_price || '0'),
          compare_at_price: wooProduct.sale_price ? parseFloat(wooProduct.regular_price || '0') : null,
          sku: wooProduct.sku || null,
          barcode: wooProduct.barcode || null,
          stock: wooProduct.stock_quantity || 0,
          track_inventory: wooProduct.manage_stock || false,
          weight: wooProduct.weight ? parseFloat(wooProduct.weight) : null,
          images: wooProduct.images?.map((img: any) => img.src) || [],
          tags: wooProduct.tags?.map((t: any) => t.name) || [],
          is_active: wooProduct.status === 'publish',
          // SEO fields
          meta_title: seoTitle,
          meta_description: seoDescription,
          // WooCommerce-specific optimized content
          woocommerce_optimized_title: seoTitle || wooProduct.name,
          woocommerce_optimized_description: seoDescription || wooProduct.short_description?.replace(/<[^>]*>/g, '').substring(0, 160) || null,
          // WooCommerce IDs and sync status
          woocommerce_product_id: wooProduct.id.toString(),
          woocommerce_listing_status: 'listed',
          woocommerce_last_synced_at: new Date().toISOString(),
        }

        try {
          if (existingProduct) {
            // Update existing product
            await supabase
              .from('products')
              .update(productData)
              .eq('id', existingProduct.id)
            productsUpdated++
          } else {
            // Insert new product
            await supabase
              .from('products')
              .insert(productData)
            productsImported++
          }
        } catch (err) {
          console.error(`Error syncing product ${wooProduct.name}:`, err)
          errors.push(`${wooProduct.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    } else if (direction === 'export') {
      // Export products from SellQo to WooCommerce
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', connection.tenant_id)
        .is('woocommerce_product_id', null)
        .eq('is_active', true)

      if (productsError) {
        throw new Error(`Failed to fetch products: ${productsError.message}`)
      }

      console.log(`Found ${products?.length || 0} products to export`)

      for (const product of products || []) {
        try {
          const wooProductData = {
            name: product.woocommerce_optimized_title || product.name,
            type: 'simple',
            regular_price: product.price.toString(),
            description: product.description || '',
            short_description: product.short_description || '',
            sku: product.sku || '',
            manage_stock: product.track_inventory || false,
            stock_quantity: product.stock || 0,
            status: product.is_active ? 'publish' : 'draft',
            images: product.images?.map((url: string) => ({ src: url })) || [],
            // Yoast SEO meta_data
            meta_data: [
              ...(product.meta_title ? [{ key: '_yoast_wpseo_title', value: product.meta_title }] : []),
              ...(product.meta_description ? [{ key: '_yoast_wpseo_metadesc', value: product.meta_description }] : []),
              // Also add RankMath keys for compatibility
              ...(product.meta_title ? [{ key: 'rank_math_title', value: product.meta_title }] : []),
              ...(product.meta_description ? [{ key: 'rank_math_description', value: product.meta_description }] : []),
            ],
          }

          const createUrl = `${siteUrl}/wp-json/wc/v3/products`
          const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(wooProductData),
          })

          if (response.ok) {
            const createdProduct = await response.json()

            // Update SellQo product with WooCommerce ID
            await supabase
              .from('products')
              .update({
                woocommerce_product_id: createdProduct.id.toString(),
                woocommerce_listing_status: 'listed',
                woocommerce_last_synced_at: new Date().toISOString(),
              })
              .eq('id', product.id)

            productsExported++
          } else {
            const errorText = await response.text()
            console.error(`Failed to create product in WooCommerce: ${errorText}`)
            errors.push(`${product.name}: ${errorText.substring(0, 100)}`)
          }
        } catch (err) {
          console.error(`Error exporting product ${product.name}:`, err)
          errors.push(`${product.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      })
      .eq('id', connectionId)

    console.log(`WooCommerce product sync complete: ${productsImported} imported, ${productsUpdated} updated, ${productsExported} exported`)

    return new Response(
      JSON.stringify({
        success: true,
        productsImported,
        productsUpdated,
        productsExported,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    console.error('WooCommerce product sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

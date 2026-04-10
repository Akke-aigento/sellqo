import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const credentials = connection.credentials as { storeUrl: string; accessToken: string }
    
    // Normalize store URL
    let storeUrl = credentials.storeUrl.trim().toLowerCase()
    storeUrl = storeUrl.replace(/^https?:\/\//, '')
    storeUrl = storeUrl.replace(/\/+$/, '')

    console.log(`Syncing Shopify products for store ${storeUrl}, direction: ${direction}`)

    let productsImported = 0
    let productsUpdated = 0
    let productsExported = 0
    const errors: string[] = []

    if (direction === 'import') {
      // Fetch products from Shopify
      const productsUrl = `https://${storeUrl}/admin/api/2024-01/products.json?limit=250`
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }

      const data = await response.json()
      const shopifyProducts = data.products || []

      console.log(`Found ${shopifyProducts.length} products in Shopify`)

      for (const shopifyProduct of shopifyProducts) {
        const mainVariant = shopifyProduct.variants?.[0]
        
        // Sort images by position (1 = main image in Shopify)
        const sortedImages = (shopifyProduct.images || [])
          .sort((a: any, b: any) => (a.position ?? 999) - (b.position ?? 999))
        const imageUrls = sortedImages.map((img: any) => img.src)
        
        // Check if product already exists by Shopify ID or SKU
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', connection.tenant_id)
          .or(`shopify_product_id.eq.${shopifyProduct.id},sku.eq.${mainVariant?.sku || ''}`)
          .single()

        // Extract SEO data from Shopify product
        // Shopify stores SEO in metafields_global_title_tag and metafields_global_description_tag
        const seoTitle = shopifyProduct.metafields_global_title_tag || null
        const seoDescription = shopifyProduct.metafields_global_description_tag || null

        const productData = {
          tenant_id: connection.tenant_id,
          name: shopifyProduct.title,
          description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '') || null,
          price: parseFloat(mainVariant?.price || '0'),
          compare_at_price: mainVariant?.compare_at_price ? parseFloat(mainVariant.compare_at_price) : null,
          sku: mainVariant?.sku || null,
          barcode: mainVariant?.barcode || null,
          stock: mainVariant?.inventory_quantity || 0,
          weight: mainVariant?.weight ? parseFloat(mainVariant.weight) : null,
          images: imageUrls,
          featured_image: imageUrls[0] || null,
          tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) : [],
          is_active: shopifyProduct.status === 'active',
          // SEO fields
          meta_title: seoTitle,
          meta_description: seoDescription,
          // Shopify-specific optimized titles (use SEO data if available)
          shopify_optimized_title: seoTitle || shopifyProduct.title,
          shopify_optimized_description: seoDescription || shopifyProduct.body_html?.replace(/<[^>]*>/g, '').substring(0, 160) || null,
          // Shopify IDs and sync status
          shopify_product_id: shopifyProduct.id.toString(),
          shopify_variant_id: mainVariant?.id?.toString() || null,
          shopify_listing_status: 'synced',
          shopify_last_synced_at: new Date().toISOString(),
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
          console.error(`Error syncing product ${shopifyProduct.title}:`, err)
          errors.push(`${shopifyProduct.title}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    } else if (direction === 'export') {
      // Export products from SellQo to Shopify
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', connection.tenant_id)
        .is('shopify_product_id', null)
        .eq('is_active', true)

      if (productsError) {
        throw new Error(`Failed to fetch products: ${productsError.message}`)
      }

      console.log(`Found ${products?.length || 0} products to export`)

      for (const product of products || []) {
        try {
          const shopifyProductData = {
            product: {
              title: product.shopify_optimized_title || product.name,
              body_html: product.description || '',
              vendor: '',
              product_type: '',
              tags: product.tags?.join(', ') || '',
              status: product.is_active ? 'active' : 'draft',
              variants: [
                {
                  price: product.price.toString(),
                  compare_at_price: product.compare_at_price?.toString() || null,
                  sku: product.sku || '',
                  barcode: product.barcode || '',
                  inventory_quantity: product.stock || 0,
                  weight: product.weight || 0,
                  weight_unit: 'kg',
                  inventory_management: 'shopify',
                },
              ],
              images: product.images?.map((url: string) => ({ src: url })) || [],
              // SEO metafields
              metafields_global_title_tag: product.meta_title || product.shopify_optimized_title || undefined,
              metafields_global_description_tag: product.meta_description || product.shopify_optimized_description || undefined,
            },
          }

          const createUrl = `https://${storeUrl}/admin/api/2024-01/products.json`
          const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': credentials.accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(shopifyProductData),
          })

          if (response.ok) {
            const createdData = await response.json()
            const createdProduct = createdData.product
            const createdVariant = createdProduct.variants?.[0]

            // Update SellQo product with Shopify IDs
            await supabase
              .from('products')
              .update({
                shopify_product_id: createdProduct.id.toString(),
                shopify_variant_id: createdVariant?.id?.toString() || null,
                shopify_listing_status: 'synced',
                shopify_last_synced_at: new Date().toISOString(),
              })
              .eq('id', product.id)

            productsExported++
          } else {
            const errorText = await response.text()
            console.error(`Failed to create product in Shopify: ${errorText}`)
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

    console.log(`Product sync complete: ${productsImported} imported, ${productsUpdated} updated, ${productsExported} exported`)

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
    console.error('Shopify product sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

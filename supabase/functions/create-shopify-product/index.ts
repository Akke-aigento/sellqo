import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateProductRequest {
  product_id: string
  tenant_id: string
  connection_id: string
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
    const { product_id, tenant_id, connection_id } = await req.json() as CreateProductRequest

    if (!product_id || !tenant_id || !connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product ID, Tenant ID en Connection ID zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connectionError || !connection) {
      throw new Error('Marketplace verbinding niet gevonden')
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (productError || !product) {
      throw new Error('Product niet gevonden')
    }

    const credentials = connection.credentials as { storeUrl: string; accessToken: string }
    
    // Normalize store URL
    let storeUrl = credentials.storeUrl.trim().toLowerCase()
    storeUrl = storeUrl.replace(/^https?:\/\//, '')
    storeUrl = storeUrl.replace(/\/+$/, '')

    console.log(`Creating product in Shopify: ${product.name}`)

    // Update product status to pending
    await supabase
      .from('products')
      .update({
        shopify_listing_status: 'pending',
        shopify_listing_error: null,
      })
      .eq('id', product_id)

    // Create product in Shopify
    const shopifyProductData = {
      product: {
        title: product.shopify_optimized_title || product.name,
        body_html: product.description || '',
        vendor: '',
        product_type: product.category?.name || '',
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
            requires_shipping: true,
          },
        ],
        images: product.images?.map((url: string) => ({ src: url })) || [],
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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Shopify create product error:', errorText)

      // Update product with error
      await supabase
        .from('products')
        .update({
          shopify_listing_status: 'error',
          shopify_listing_error: `Shopify fout: ${errorText.substring(0, 200)}`,
        })
        .eq('id', product_id)

      throw new Error(`Shopify API error: ${errorText.substring(0, 200)}`)
    }

    const createdData = await response.json()
    const createdProduct = createdData.product
    const createdVariant = createdProduct.variants?.[0]

    console.log(`Product created in Shopify with ID: ${createdProduct.id}`)

    // Update SellQo product with Shopify IDs
    await supabase
      .from('products')
      .update({
        shopify_product_id: createdProduct.id.toString(),
        shopify_variant_id: createdVariant?.id?.toString() || null,
        shopify_listing_status: 'listed',
        shopify_listing_error: null,
        shopify_last_synced_at: new Date().toISOString(),
      })
      .eq('id', product_id)

    return new Response(
      JSON.stringify({
        success: true,
        shopify_product_id: createdProduct.id.toString(),
        shopify_variant_id: createdVariant?.id?.toString() || null,
        message: 'Product succesvol gepubliceerd naar Shopify',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create product'
    console.error('Create Shopify product error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

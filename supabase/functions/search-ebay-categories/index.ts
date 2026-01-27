import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  query: string
  tenant_id: string
  connection_id: string
}

interface EbayCategoryResponse {
  category_tree_id: string
  category_tree_version: string
  category_suggestions?: Array<{
    category: {
      categoryId: string
      categoryName: string
    }
    categoryTreeNodeAncestors?: Array<{
      categoryId: string
      categoryName: string
      categoryTreeNodeLevel: number
    }>
    categoryTreeNodeLevel: number
    relevancy: string
  }>
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
    const { query, tenant_id, connection_id } = await req.json() as SearchRequest

    if (!query || !tenant_id || !connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query, tenant_id, and connection_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the eBay connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) {
      throw new Error('eBay connection not found')
    }

    const credentials = connection.credentials as {
      ebayAppId: string
      ebayCertId: string
      ebayRefreshToken: string
      ebayMarketplaceId: string
      accessToken?: string
      accessTokenExpires?: string
    }

    // Get or refresh access token
    let accessToken = credentials.accessToken
    const tokenExpires = credentials.accessTokenExpires ? new Date(credentials.accessTokenExpires) : null

    if (!accessToken || !tokenExpires || tokenExpires <= new Date()) {
      // Refresh access token using OAuth
      const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${credentials.ebayAppId}:${credentials.ebayCertId}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.ebayRefreshToken,
          scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('eBay token refresh failed:', errorText)
        throw new Error('Failed to refresh eBay access token')
      }

      const tokenData = await tokenResponse.json()
      accessToken = tokenData.access_token
      const expiresIn = tokenData.expires_in || 7200

      // Update connection with new token
      await supabase
        .from('marketplace_connections')
        .update({
          credentials: {
            ...credentials,
            accessToken,
            accessTokenExpires: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
          },
        })
        .eq('id', connection_id)
    }

    // Map marketplace ID to category tree ID
    // https://developer.ebay.com/api-docs/commerce/taxonomy/resources/category_tree/methods/getCategoryTree
    const categoryTreeMap: Record<string, string> = {
      'EBAY_NL': '146',  // Netherlands
      'EBAY_BE': '123',  // Belgium
      'EBAY_DE': '77',   // Germany
      'EBAY_FR': '71',   // France
      'EBAY_UK': '3',    // UK
      'EBAY_US': '0',    // US
      'EBAY_ES': '186',  // Spain
      'EBAY_IT': '101',  // Italy
      'EBAY_AT': '16',   // Austria
    }

    const categoryTreeId = categoryTreeMap[credentials.ebayMarketplaceId || 'EBAY_NL'] || '146'

    console.log(`Searching eBay categories for: "${query}" in tree ${categoryTreeId}`)

    // Call eBay Taxonomy API - getCategorySuggestions
    const searchUrl = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(query)}`
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': credentials.ebayMarketplaceId || 'EBAY_NL',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('eBay category search failed:', response.status, errorText)
      
      // If no suggestions found, return empty array (not an error)
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: true, categories: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`eBay API error: ${response.status}`)
    }

    const data = await response.json() as EbayCategoryResponse

    // Transform response to simplified format
    const categories = (data.category_suggestions || []).map((suggestion) => {
      // Build full path from ancestors
      const ancestors = (suggestion.categoryTreeNodeAncestors || [])
        .sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel)
        .map((a) => a.categoryName)
      
      const fullPath = [...ancestors, suggestion.category.categoryName].join(' > ')

      return {
        id: suggestion.category.categoryId,
        name: suggestion.category.categoryName,
        path: fullPath,
        level: suggestion.categoryTreeNodeLevel,
        relevancy: suggestion.relevancy,
      }
    })

    console.log(`Found ${categories.length} category suggestions`)

    return new Response(
      JSON.stringify({ success: true, categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error searching eBay categories:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

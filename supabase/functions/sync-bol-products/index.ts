import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BOL_API_BASE = 'https://api.bol.com/retailer'
const BOL_TOKEN_URL = 'https://login.bol.com/token'

interface BolCredentials {
  clientId: string
  clientSecret: string
  accessToken?: string
  tokenExpiry?: string
}

interface BolOfferItem {
  offerId: string
  ean: string
  reference?: string
  onHoldByRetailer: boolean
  unknownProductTitle: string
  pricing: {
    bundlePrices: Array<{
      quantity: number
      unitPrice: number
    }>
  }
  stock: {
    amount: number
    managedByRetailer: boolean
  }
  fulfilment: {
    method: string
    deliveryCode?: string
  }
}

interface BolOffersListResponse {
  offers: BolOfferItem[]
}

type RequestMode = 'list' | 'import' | 'list-sellqo' | 'export' | 'sync-settings'

interface SyncRequest {
  connectionId: string
  mode: RequestMode
  selectedOfferIds?: string[]
  selectedProductIds?: string[]
  syncDirection?: 'import' | 'export' | 'bidirectional'
  conflictStrategy?: string
  productSyncSettings?: Array<{ productId: string; syncEnabled: boolean }>
}

async function getBolAccessToken(credentials: BolCredentials): Promise<string> {
  const { clientId, clientSecret, accessToken, tokenExpiry } = credentials

  if (accessToken && tokenExpiry) {
    const expiry = new Date(tokenExpiry)
    if (expiry > new Date()) {
      return accessToken
    }
  }

  const authString = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch(BOL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token request failed:', errorText)
    throw new Error(`Token request failed: ${response.statusText}`)
  }

  const tokenData = await response.json()
  return tokenData.access_token
}

async function fetchAllOffers(accessToken: string): Promise<BolOfferItem[]> {
  const allOffers: BolOfferItem[] = []
  let page = 1
  const pageSize = 50
  let hasMore = true

  while (hasMore) {
    console.log(`Fetching offers page ${page}...`)
    
    const listResponse = await fetch(
      `${BOL_API_BASE}/offers?page=${page}&size=${pageSize}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.retailer.v10+json'
        }
      }
    )

    if (!listResponse.ok) {
      if (listResponse.status === 404 && page > 1) {
        hasMore = false
        break
      }
      const errorText = await listResponse.text()
      console.error(`Error fetching offers page ${page}:`, listResponse.status, errorText)
      throw new Error(`Failed to fetch offers: ${listResponse.statusText}`)
    }

    const data: BolOffersListResponse = await listResponse.json()
    
    if (!data.offers || data.offers.length === 0) {
      hasMore = false
    } else {
      allOffers.push(...data.offers)
      if (data.offers.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  console.log(`Total offers fetched: ${allOffers.length}`)
  return allOffers
}

async function handleList(supabase: any, connection: any, accessToken: string) {
  const bolOffers = await fetchAllOffers(accessToken)

  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, bol_ean, bol_offer_id, stock, sync_inventory')
    .eq('tenant_id', connection.tenant_id)

  const existingEanMap = new Map<string, { id: string; name: string; bol_offer_id: string | null; sync_inventory: boolean }>()
  for (const p of existingProducts || []) {
    if (p.bol_ean) {
      existingEanMap.set(p.bol_ean, { id: p.id, name: p.name, bol_offer_id: p.bol_offer_id, sync_inventory: p.sync_inventory })
    }
  }

  const offersForFrontend = bolOffers.map(offer => {
    const existing = existingEanMap.get(offer.ean)
    const price = offer.pricing?.bundlePrices?.[0]?.unitPrice || 0
    
    return {
      offerId: offer.offerId,
      ean: offer.ean,
      title: offer.unknownProductTitle || offer.reference || `EAN: ${offer.ean}`,
      price,
      stock: offer.stock?.amount || 0,
      fulfilmentMethod: offer.fulfilment?.method || 'FBR',
      alreadyLinked: !!existing,
      existingProductId: existing?.id || null,
      existingProductName: existing?.name || null,
      syncEnabled: existing?.sync_inventory ?? false,
    }
  })

  return {
    success: true,
    offers: offersForFrontend,
    totalOffers: offersForFrontend.length,
    alreadyLinked: offersForFrontend.filter(o => o.alreadyLinked).length,
  }
}

async function handleListSellqo(supabase: any, connection: any) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, bol_ean, bol_offer_id, price, stock, sync_inventory, marketplace_mappings, status')
    .eq('tenant_id', connection.tenant_id)
    .eq('status', 'active')

  if (error) throw new Error(`Failed to fetch products: ${error.message}`)

  const productsForFrontend = (products || []).map((p: any) => ({
    productId: p.id,
    name: p.name,
    ean: p.bol_ean || '',
    price: p.price || 0,
    stock: p.stock || 0,
    alreadyOnBol: !!p.bol_offer_id,
    bolOfferId: p.bol_offer_id || null,
    syncEnabled: p.sync_inventory ?? false,
  }))

  return {
    success: true,
    products: productsForFrontend,
    totalProducts: productsForFrontend.length,
    alreadyOnBol: productsForFrontend.filter((p: any) => p.alreadyOnBol).length,
  }
}

async function handleImport(supabase: any, connection: any, accessToken: string, selectedOfferIds: string[]) {
  const bolOffers = await fetchAllOffers(accessToken)
  const offersToImport = bolOffers.filter(o => selectedOfferIds.includes(o.offerId))
  console.log(`Importing ${offersToImport.length} selected offers`)

  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, bol_ean, bol_offer_id')
    .eq('tenant_id', connection.tenant_id)

  const existingEanMap = new Map<string, string>()
  for (const p of existingProducts || []) {
    if (p.bol_ean) existingEanMap.set(p.bol_ean, p.id)
  }

  let imported = 0, linked = 0, errors = 0

  for (const offer of offersToImport) {
    try {
      const existingId = existingEanMap.get(offer.ean)
      const price = offer.pricing?.bundlePrices?.[0]?.unitPrice || 0
      const mappings = {
        bol_com: {
          offerId: offer.offerId,
          lastSync: new Date().toISOString(),
          autoLinked: true,
        }
      }

      if (existingId) {
        await supabase
          .from('products')
          .update({
            bol_offer_id: offer.offerId,
            marketplace_mappings: mappings,
            sync_inventory: true,
          })
          .eq('id', existingId)
        linked++
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            tenant_id: connection.tenant_id,
            name: offer.unknownProductTitle || offer.reference || `Bol.com Product (${offer.ean})`,
            bol_ean: offer.ean,
            bol_offer_id: offer.offerId,
            price,
            stock: offer.stock?.amount || 0,
            sync_inventory: true,
            marketplace_mappings: mappings,
            status: 'active',
          })
        if (insertError) { errors++; continue }
        imported++
      }
    } catch { errors++ }
  }

  return { success: true, imported, linked, errors, totalProcessed: imported + linked }
}

async function handleExport(supabase: any, connection: any, accessToken: string, selectedProductIds: string[]) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, bol_ean, bol_offer_id, price, stock')
    .eq('tenant_id', connection.tenant_id)
    .in('id', selectedProductIds)

  if (error) throw new Error(`Failed to fetch products: ${error.message}`)

  let exported = 0, alreadyExists = 0, errors = 0

  for (const product of products || []) {
    try {
      if (product.bol_offer_id) {
        alreadyExists++
        continue
      }

      if (!product.bol_ean) {
        console.error(`Product ${product.id} has no EAN, skipping export`)
        errors++
        continue
      }

      // Create offer on Bol.com
      const offerBody = {
        ean: product.bol_ean,
        condition: { name: 'NEW' },
        reference: product.name?.substring(0, 100) || '',
        onHoldByRetailer: false,
        unknownProductTitle: product.name || '',
        pricing: {
          bundlePrices: [{ quantity: 1, unitPrice: product.price || 0 }]
        },
        stock: {
          amount: product.stock || 0,
          managedByRetailer: true,
        },
        fulfilment: {
          method: 'FBR',
          deliveryCode: '1-2d',
        },
      }

      const createResponse = await fetch(`${BOL_API_BASE}/offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.retailer.v10+json',
          'Content-Type': 'application/vnd.retailer.v10+json',
        },
        body: JSON.stringify(offerBody),
      })

      if (!createResponse.ok) {
        const errText = await createResponse.text()
        console.error(`Failed to create offer for product ${product.id}:`, errText)
        errors++
        continue
      }

      const result = await createResponse.json()
      const newOfferId = result.offerId || result.processStatusId

      // Update product with Bol offer ID
      if (newOfferId) {
        await supabase
          .from('products')
          .update({
            bol_offer_id: newOfferId,
            sync_inventory: true,
            marketplace_mappings: {
              bol_com: {
                offerId: newOfferId,
                lastSync: new Date().toISOString(),
                exported: true,
              }
            }
          })
          .eq('id', product.id)
      }

      exported++
      console.log(`Exported product ${product.id} to Bol.com`)
    } catch (err) {
      console.error(`Error exporting product ${product.id}:`, err)
      errors++
    }
  }

  return { success: true, exported, alreadyExists, errors, totalProcessed: exported + alreadyExists }
}

async function handleSyncSettings(supabase: any, connection: any, settings: Array<{ productId: string; syncEnabled: boolean }>) {
  let updated = 0, errors = 0

  for (const setting of settings) {
    const { error } = await supabase
      .from('products')
      .update({ sync_inventory: setting.syncEnabled })
      .eq('id', setting.productId)
      .eq('tenant_id', connection.tenant_id)

    if (error) { errors++; continue }
    updated++
  }

  return { success: true, updated, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body: SyncRequest = await req.json()
    const { connectionId, mode = 'list', selectedOfferIds, selectedProductIds, productSyncSettings } = body

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = connection.credentials as BolCredentials
    let result: any

    if (mode === 'list') {
      const accessToken = await getBolAccessToken(credentials)
      result = await handleList(supabase, connection, accessToken)
    } else if (mode === 'list-sellqo') {
      result = await handleListSellqo(supabase, connection)
    } else if (mode === 'import') {
      if (!selectedOfferIds || selectedOfferIds.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No offers selected for import' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const accessToken = await getBolAccessToken(credentials)
      result = await handleImport(supabase, connection, accessToken, selectedOfferIds)
    } else if (mode === 'export') {
      if (!selectedProductIds || selectedProductIds.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No products selected for export' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const accessToken = await getBolAccessToken(credentials)
      result = await handleExport(supabase, connection, accessToken, selectedProductIds)
    } else if (mode === 'sync-settings') {
      if (!productSyncSettings || productSyncSettings.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No sync settings provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      result = await handleSyncSettings(supabase, connection, productSyncSettings)
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown mode: ${mode}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in sync-bol-products:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AMAZON_SP_API_BASE = 'https://sellingpartnerapi-eu.amazon.com'

interface AmazonCredentials {
  accessToken?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  sellerId?: string
  marketplaceId?: string
}

interface ShippingService {
  shippingServiceId: string
  shippingServiceName: string
  carrierName: string
  rate: {
    amount: number
    currencyCode: string
  }
  earliestEstimatedDeliveryDate?: string
  latestEstimatedDeliveryDate?: string
  requiresAdditionalSellerInputs: boolean
}

async function getAmazonAccessToken(credentials: AmazonCredentials): Promise<string> {
  if (!credentials.refreshToken || !credentials.clientId || !credentials.clientSecret) {
    throw new Error('Missing Amazon credentials')
  }

  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get Amazon access token: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
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

    const { order_id, connection_id, strategy = 'cheapest' } = await req.json()

    if (!order_id || !connection_id) {
      throw new Error('order_id and connection_id are required')
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`)
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`)
    }

    // Get tenant info for ship-from address
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', order.tenant_id)
      .single()

    const credentials = connection.credentials as AmazonCredentials
    const accessToken = await getAmazonAccessToken(credentials)

    const amazonOrderId = order.marketplace_order_id
    if (!amazonOrderId) {
      throw new Error('No Amazon order ID found')
    }

    // Build ship from address
    const shipFromAddress = {
      name: tenant?.name || 'Seller',
      addressLine1: tenant?.address || '',
      city: tenant?.city || '',
      postalCode: tenant?.postal_code || '',
      countryCode: tenant?.country || 'NL'
    }

    // Build item list from order items
    const itemList = order.order_items?.map((item: { product_sku: string; quantity: number }) => ({
      orderItemId: item.product_sku,
      quantity: item.quantity
    })) || []

    // Step 1: Get eligible shipping services
    console.log('Getting eligible shipping services for order:', amazonOrderId)
    
    const eligibleServicesPayload = {
      amazonOrderId,
      itemList,
      shipFromAddress,
      packageDimensions: {
        length: 30,
        width: 20,
        height: 10,
        unit: 'centimeters'
      },
      weight: {
        value: 1,
        unit: 'kg'
      },
      shippingServiceOptions: {
        deliveryExperience: 'DeliveryConfirmationWithoutSignature',
        carrierWillPickUp: false
      }
    }

    const eligibleResponse = await fetch(
      `${AMAZON_SP_API_BASE}/mfn/v0/eligibleShippingServices`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken
        },
        body: JSON.stringify(eligibleServicesPayload)
      }
    )

    if (!eligibleResponse.ok) {
      const errorText = await eligibleResponse.text()
      console.error('Failed to get eligible services:', errorText)
      throw new Error(`Failed to get eligible shipping services: ${errorText}`)
    }

    const eligibleData = await eligibleResponse.json()
    const shippingServices: ShippingService[] = eligibleData.payload?.shippingServiceList || []

    if (shippingServices.length === 0) {
      throw new Error('No eligible shipping services found')
    }

    console.log(`Found ${shippingServices.length} eligible shipping services`)

    // Step 2: Select service based on strategy
    let selectedService: ShippingService
    
    if (strategy === 'cheapest') {
      selectedService = shippingServices.reduce((cheapest, current) => 
        current.rate.amount < cheapest.rate.amount ? current : cheapest
      )
    } else if (strategy === 'fastest') {
      selectedService = shippingServices.reduce((fastest, current) => {
        const fastestDate = fastest.earliestEstimatedDeliveryDate ? new Date(fastest.earliestEstimatedDeliveryDate) : new Date('9999-12-31')
        const currentDate = current.earliestEstimatedDeliveryDate ? new Date(current.earliestEstimatedDeliveryDate) : new Date('9999-12-31')
        return currentDate < fastestDate ? current : fastest
      })
    } else {
      selectedService = shippingServices[0]
    }

    console.log(`Selected service: ${selectedService.shippingServiceName} (${selectedService.carrierName})`)

    // Step 3: Create shipment
    const createShipmentPayload = {
      shipmentRequestDetails: {
        amazonOrderId,
        itemList,
        shipFromAddress,
        packageDimensions: {
          length: 30,
          width: 20,
          height: 10,
          unit: 'centimeters'
        },
        weight: {
          value: 1,
          unit: 'kg'
        },
        shippingServiceOptions: {
          deliveryExperience: 'DeliveryConfirmationWithoutSignature',
          carrierWillPickUp: false
        }
      },
      shippingServiceId: selectedService.shippingServiceId
    }

    const createShipmentResponse = await fetch(
      `${AMAZON_SP_API_BASE}/mfn/v0/shipments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken
        },
        body: JSON.stringify(createShipmentPayload)
      }
    )

    if (!createShipmentResponse.ok) {
      const errorText = await createShipmentResponse.text()
      console.error('Failed to create shipment:', errorText)
      throw new Error(`Failed to create Amazon shipment: ${errorText}`)
    }

    const shipmentData = await createShipmentResponse.json()
    const shipment = shipmentData.payload

    console.log('Shipment created:', shipment.shipmentId)

    // Step 4: Store label in Supabase Storage
    let labelUrl = null
    if (shipment.label?.fileContents?.contents) {
      const labelBytes = Uint8Array.from(atob(shipment.label.fileContents.contents), c => c.charCodeAt(0))
      const fileName = `${order.tenant_id}/${order_id}/amazon-label-${Date.now()}.pdf`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shipping-labels')
        .upload(fileName, labelBytes, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadError) {
        console.error('Failed to upload label:', uploadError)
      } else {
        const { data: urlData } = supabase.storage
          .from('shipping-labels')
          .getPublicUrl(fileName)
        labelUrl = urlData.publicUrl
      }
    }

    // Step 5: Create shipping_labels record
    const { data: labelRecord, error: labelError } = await supabase
      .from('shipping_labels')
      .insert({
        tenant_id: order.tenant_id,
        order_id: order_id,
        carrier: selectedService.carrierName,
        tracking_number: shipment.trackingId,
        label_url: labelUrl,
        label_format: 'pdf',
        provider: 'amazon_buy_shipping',
        raw_response: shipment
      })
      .select()
      .single()

    if (labelError) {
      console.error('Failed to create label record:', labelError)
    }

    // Step 6: Update order with tracking info
    await supabase
      .from('orders')
      .update({
        tracking_number: shipment.trackingId,
        shipping_carrier: selectedService.carrierName,
        fulfillment_status: 'fulfilled',
        status: 'shipped',
        sync_status: 'synced',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    return new Response(
      JSON.stringify({
        success: true,
        shipmentId: shipment.shipmentId,
        trackingId: shipment.trackingId,
        carrier: selectedService.carrierName,
        serviceName: selectedService.shippingServiceName,
        rate: selectedService.rate,
        labelUrl,
        labelId: labelRecord?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in create-amazon-buy-shipping-label:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

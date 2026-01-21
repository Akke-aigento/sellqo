import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  connectionId: string
  sinceDate?: string
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
    const { connectionId, sinceDate } = await req.json() as SyncRequest

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

    // Calculate date range for updated customers
    let updatedAtMin = ''
    if (sinceDate) {
      updatedAtMin = `&updated_at_min=${encodeURIComponent(sinceDate)}`
    } else if (connection.last_sync_at) {
      updatedAtMin = `&updated_at_min=${encodeURIComponent(connection.last_sync_at)}`
    }

    console.log(`Syncing Shopify customers for store ${storeUrl}`)

    // Fetch customers from Shopify
    const customersUrl = `https://${storeUrl}/admin/api/2024-01/customers.json?limit=250${updatedAtMin}`
    const response = await fetch(customersUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': credentials.accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch customers: ${response.status}`)
    }

    const data = await response.json()
    const customers = data.customers || []

    console.log(`Found ${customers.length} customers in Shopify`)

    let customersImported = 0
    let customersUpdated = 0
    const errors: string[] = []

    for (const shopifyCustomer of customers) {
      try {
        // Check if customer already exists by Shopify ID or email
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', connection.tenant_id)
          .or(`shopify_customer_id.eq.${shopifyCustomer.id},email.eq.${shopifyCustomer.email || ''}`)
          .single()

        const defaultAddress = shopifyCustomer.default_address

        const customerData = {
          tenant_id: connection.tenant_id,
          email: shopifyCustomer.email || null,
          name: `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim() || shopifyCustomer.email,
          first_name: shopifyCustomer.first_name || null,
          last_name: shopifyCustomer.last_name || null,
          phone: shopifyCustomer.phone || defaultAddress?.phone || null,
          company: defaultAddress?.company || null,
          street: defaultAddress?.address1 || null,
          street2: defaultAddress?.address2 || null,
          city: defaultAddress?.city || null,
          postal_code: defaultAddress?.zip || null,
          country: defaultAddress?.country_code || null,
          tags: shopifyCustomer.tags ? shopifyCustomer.tags.split(',').map((t: string) => t.trim()) : [],
          notes: shopifyCustomer.note || null,
          total_orders: shopifyCustomer.orders_count || 0,
          total_spent: parseFloat(shopifyCustomer.total_spent || '0'),
          accepts_marketing: shopifyCustomer.accepts_marketing || false,
          shopify_customer_id: shopifyCustomer.id.toString(),
          shopify_last_synced_at: new Date().toISOString(),
        }

        if (existingCustomer) {
          // Update existing customer
          await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existingCustomer.id)
          customersUpdated++
        } else {
          // Insert new customer
          await supabase
            .from('customers')
            .insert(customerData)
          customersImported++
        }
      } catch (err) {
        console.error(`Error syncing customer ${shopifyCustomer.email}:`, err)
        errors.push(`${shopifyCustomer.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
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

    console.log(`Customer sync complete: ${customersImported} imported, ${customersUpdated} updated`)

    return new Response(
      JSON.stringify({
        success: true,
        customersImported,
        customersUpdated,
        totalProcessed: customers.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    console.error('Shopify customer sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

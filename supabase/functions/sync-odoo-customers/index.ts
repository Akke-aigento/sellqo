import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OdooCredentials {
  odooUrl: string
  odooDatabase: string
  odooUsername: string
  odooApiKey: string
}

interface OdooJsonRpcResponse {
  jsonrpc: string
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: { message: string } }
}

function normalizeOdooUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http')) normalized = `https://${normalized}`
  return normalized
}

async function odooAuthenticate(credentials: OdooCredentials): Promise<{ uid: number; sessionId: string } | null> {
  const normalizedUrl = normalizeOdooUrl(credentials.odooUrl)
  const response = await fetch(`${normalizedUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: credentials.odooDatabase, login: credentials.odooUsername, password: credentials.odooApiKey },
      id: 1,
    }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  const result = data.result as { uid?: number } | null
  if (!result?.uid) return null

  const cookies = response.headers.get('set-cookie') || ''
  const sessionMatch = cookies.match(/session_id=([^;]+)/)
  return { uid: result.uid, sessionId: sessionMatch?.[1] || '' }
}

async function odooCallMethod(
  credentials: OdooCredentials,
  sessionId: string,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<unknown> {
  const normalizedUrl = normalizeOdooUrl(credentials.odooUrl)
  const response = await fetch(`${normalizedUrl}/web/dataset/call_kw/${model}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs }, id: Date.now() }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  if (data.error) throw new Error(data.error.data?.message || data.error.message)
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { connectionId, customerIds, direction = 'push' } = await req.json()

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) throw new Error('Connection not found')

    const credentials = connection.credentials as OdooCredentials
    const settings = connection.settings as Record<string, unknown>

    // Check if accounting module is enabled (customers sync is part of accounting)
    if (settings.odooModuleAccounting === false) {
      console.log('Odoo accounting module not enabled, skipping customer sync')
      return new Response(
        JSON.stringify({ success: true, customersSynced: 0, direction, message: 'Accounting module not enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate with Odoo
    const auth = await odooAuthenticate(credentials)
    if (!auth) throw new Error('Odoo authentication failed')

    let syncedCount = 0

    if (direction === 'push') {
      // Push SellQo customers to Odoo as res.partner
      let customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', connection.tenant_id)

      if (customerIds?.length) {
        customersQuery = customersQuery.in('id', customerIds)
      }

      const { data: customers, error: customersError } = await customersQuery.limit(100)
      if (customersError) throw customersError

      for (const customer of customers || []) {
        try {
          // Check if customer already exists in Odoo (by email)
          let partnerId: number | null = null
          
          if (customer.email) {
            const existingPartners = await odooCallMethod(
              credentials,
              auth.sessionId,
              'res.partner',
              'search',
              [[['email', '=', customer.email]]],
              { limit: 1 }
            ) as number[]

            if (existingPartners.length > 0) {
              partnerId = existingPartners[0]
            }
          }

          const partnerData = {
            name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
            email: customer.email || false,
            phone: customer.phone || false,
            street: customer.billing_address?.street || false,
            city: customer.billing_address?.city || false,
            zip: customer.billing_address?.postal_code || false,
            vat: customer.vat_number || false,
            customer_rank: 1,
            company_type: customer.company_name ? 'company' : 'person',
          }

          if (partnerId) {
            // Update existing partner
            await odooCallMethod(credentials, auth.sessionId, 'res.partner', 'write', [[partnerId], partnerData])
          } else {
            // Create new partner
            partnerId = await odooCallMethod(credentials, auth.sessionId, 'res.partner', 'create', [partnerData]) as number
          }

          // Log the sync
          await supabase.from('odoo_customer_sync_log').insert({
            tenant_id: connection.tenant_id,
            marketplace_connection_id: connectionId,
            customer_id: customer.id,
            odoo_partner_id: partnerId.toString(),
            sync_status: 'synced',
            sync_direction: 'push',
            synced_at: new Date().toISOString(),
          })

          syncedCount++
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          await supabase.from('odoo_customer_sync_log').insert({
            tenant_id: connection.tenant_id,
            marketplace_connection_id: connectionId,
            customer_id: customer.id,
            sync_status: 'failed',
            sync_direction: 'push',
            error_message: errorMessage,
            synced_at: new Date().toISOString(),
          })
        }
      }
    } else {
      // Pull customers from Odoo
      const partnerIds = await odooCallMethod(
        credentials,
        auth.sessionId,
        'res.partner',
        'search',
        [[['customer_rank', '>', 0]]],
        { limit: 100 }
      ) as number[]

      if (partnerIds.length > 0) {
        const partners = await odooCallMethod(
          credentials,
          auth.sessionId,
          'res.partner',
          'read',
          [partnerIds],
          { fields: ['name', 'email', 'phone', 'street', 'city', 'zip', 'country_id', 'vat'] }
        ) as Array<{
          id: number
          name: string
          email: string | false
          phone: string | false
          street: string | false
          city: string | false
          zip: string | false
          country_id: [number, string] | false
          vat: string | false
        }>

        for (const partner of partners) {
          if (!partner.email) continue

          // Check if customer already exists
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', connection.tenant_id)
            .eq('email', partner.email)
            .single()

          if (existingCustomer) {
            // Update existing
            await supabase
              .from('customers')
              .update({
                name: partner.name,
                phone: partner.phone || null,
                vat_number: partner.vat || null,
                billing_address: {
                  street: partner.street || '',
                  city: partner.city || '',
                  postal_code: partner.zip || '',
                  country: partner.country_id ? partner.country_id[1] : '',
                  phone: partner.phone || '',
                },
              })
              .eq('id', existingCustomer.id)
          } else {
            // Create new customer
            await supabase.from('customers').insert({
              tenant_id: connection.tenant_id,
              name: partner.name,
              email: partner.email,
              phone: partner.phone || null,
              vat_number: partner.vat || null,
              billing_address: {
                street: partner.street || '',
                city: partner.city || '',
                postal_code: partner.zip || '',
                country: partner.country_id ? partner.country_id[1] : '',
                phone: partner.phone || '',
              },
            })
          }

          syncedCount++
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq('id', connectionId)

    return new Response(
      JSON.stringify({ success: true, customersSynced: syncedCount, direction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing customers with Odoo:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

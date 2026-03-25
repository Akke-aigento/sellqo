import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ManualSyncRequest {
  connectionId: string
  dataType: 'orders' | 'products' | 'inventory' | 'customers' | 'shipments' | 'returns'
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
    const { connectionId, dataType, direction = 'import' } = await req.json() as ManualSyncRequest

    if (!connectionId || !dataType) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId and dataType are required' }),
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
      throw new Error('Connection not found')
    }

    const startedAt = new Date().toISOString()
    let recordsProcessed = 0
    let recordsFailed = 0
    let errorDetails: string[] = []

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sync_activity_log')
      .insert({
        tenant_id: connection.tenant_id,
        connection_id: connectionId,
        data_type: dataType,
        direction,
        status: 'running',
        started_at: startedAt,
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Failed to create log entry:', logError)
    }

    try {
      // Determine which sync function to call based on platform and data type
      const platformType = connection.marketplace_type as string
      const projectUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      let syncFunctionName: string | null = null

      // Map platform + dataType to edge function
      if (platformType === 'shopify') {
        switch (dataType) {
          case 'orders': syncFunctionName = 'sync-shopify-orders'; break
          case 'products': syncFunctionName = 'sync-shopify-products'; break
          case 'inventory': syncFunctionName = 'sync-shopify-inventory'; break
          case 'customers': syncFunctionName = 'sync-shopify-customers'; break
        }
      } else if (platformType === 'woocommerce') {
        switch (dataType) {
          case 'orders': syncFunctionName = 'sync-woocommerce-orders'; break
          case 'products': syncFunctionName = 'sync-woocommerce-products'; break
          case 'inventory': syncFunctionName = 'sync-woocommerce-inventory'; break
        }
      } else if (platformType === 'bol_com') {
        switch (dataType) {
          case 'orders': syncFunctionName = 'sync-bol-orders'; break
          case 'products': syncFunctionName = 'sync-bol-products'; break
          case 'inventory': syncFunctionName = 'sync-bol-inventory'; break
          case 'shipments': syncFunctionName = 'update-bol-tracking'; break
          case 'returns': syncFunctionName = 'sync-bol-returns'; break
        }
      } else if (platformType === 'amazon') {
        switch (dataType) {
          case 'orders': syncFunctionName = 'sync-amazon-orders'; break
          case 'inventory': syncFunctionName = 'sync-amazon-inventory'; break
        }
      }

      if (syncFunctionName) {
        // Call the actual sync function
        const syncResponse = await fetch(`${projectUrl}/functions/v1/${syncFunctionName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectionId,
            direction,
          }),
        })

        const syncResult = await syncResponse.json()

        if (syncResult.success) {
          recordsProcessed = syncResult.ordersImported ?? syncResult.ordersUpdated ?? 
                            syncResult.productsImported ?? syncResult.productsUpdated ??
                            syncResult.productsSynced ?? syncResult.customersImported ??
                            syncResult.totalProcessed ?? 0
          
          if (syncResult.errors && syncResult.errors.length > 0) {
            recordsFailed = syncResult.errors.length
            errorDetails = syncResult.errors
          }
        } else {
          throw new Error(syncResult.error || 'Sync failed')
        }
      } else {
        // No sync function available for this combination
        throw new Error(`No sync function available for ${platformType} ${dataType}`)
      }

      // Update log entry with success
      if (logEntry?.id) {
        await supabase
          .from('sync_activity_log')
          .update({
            status: recordsFailed > 0 ? 'partial' : 'success',
            records_processed: recordsProcessed,
            records_failed: recordsFailed,
            error_details: errorDetails.length > 0 ? { errors: errorDetails } : null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          recordsProcessed,
          recordsFailed,
          duration: Date.now() - new Date(startedAt).getTime(),
          errors: errorDetails.length > 0 ? errorDetails : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error'
      
      // Update log entry with failure
      if (logEntry?.id) {
        await supabase
          .from('sync_activity_log')
          .update({
            status: 'failed',
            records_processed: recordsProcessed,
            records_failed: recordsFailed,
            error_details: { error: errorMessage },
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.id)
      }

      throw syncError
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Manual sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

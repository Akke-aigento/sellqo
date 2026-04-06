// Bol.com heeft geen accept endpoint — orders zijn automatisch geaccepteerd
// zodra ze verschijnen in de order list. Deze functie bestaat alleen nog
// als wrapper voor backward compatibility met bestaande callers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const { order_id } = await req.json()

    if (order_id) {
      console.log(`Marking order ${order_id} as accepted (no Bol.com API call needed — orders are auto-accepted)`)
      
      await supabase
        .from('orders')
        .update({
          sync_status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order marked as accepted (Bol.com auto-accepts orders)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in accept-bol-order:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

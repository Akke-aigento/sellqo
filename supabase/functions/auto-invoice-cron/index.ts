import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-INVOICE-CRON] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    logStep("Starting auto-invoice cron job");

    // Step 1: Get all order_ids that already have an invoice
    const { data: existingInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('order_id')
      .not('order_id', 'is', null);

    if (invoicesError) {
      throw new Error(`Failed to fetch existing invoices: ${invoicesError.message}`);
    }

    const invoicedOrderIds = (existingInvoices || []).map(i => i.order_id).filter(Boolean);
    logStep(`Found ${invoicedOrderIds.length} orders that already have invoices`);

    // Step 2: Get paid orders WITHOUT invoices, newest first
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        tenant_id,
        tenants!inner (
          id,
          auto_generate_invoice,
          auto_send_invoice_email
        )
      `)
      .eq('payment_status', 'paid')
      .eq('tenants.auto_generate_invoice', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Apply NOT IN filter if there are existing invoiced orders
    if (invoicedOrderIds.length > 0) {
      query = query.not('id', 'in', `(${invoicedOrderIds.join(',')})`);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      logStep("No orders to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No orders require invoices" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep(`Found ${orders.length} orders without invoices to process`);

    let invoicesGenerated = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const tenant = order.tenants as any;
        const autoSendEmail = tenant?.auto_send_invoice_email ?? false;

        logStep("Generating invoice for order", { 
          order_id: order.id, 
          order_number: order.order_number,
          auto_send_email: autoSendEmail 
        });

        // Call generate-invoice edge function
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ 
            order_id: order.id,
            auto_send_email: autoSendEmail
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            invoicesGenerated++;
            logStep("Invoice generated", { 
              order_id: order.id, 
              invoice_id: result.invoice_id,
              email_sent: result.email_sent
            });
          }
        } else {
          const errorText = await response.text();
          logStep("Failed to generate invoice", { 
            order_id: order.id, 
            error: errorText 
          });
          errors++;
        }
      } catch (orderError: any) {
        logStep("Error processing order", { 
          order_id: order.id, 
          error: orderError.message 
        });
        errors++;
      }
    }

    logStep("Cron job completed", { 
      invoicesGenerated, 
      errors,
      total: orders.length 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: orders.length,
        invoicesGenerated,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("Cron job failed", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

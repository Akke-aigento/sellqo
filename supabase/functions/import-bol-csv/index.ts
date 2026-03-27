import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BolOrderRow {
  orderId: string;
  orderDate: string | null;
  shippedAt: string | null;
  ean: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  shippingCost: number;
  commission: number;
  customerName: string | null;
  customerEmail: string | null;
  shippingStreet: string | null;
  shippingHouseNumber: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  fulfillmentMethod: string | null;
  sku: string | null;
}

function findMatchingHeader(headers: string[], labels: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  for (const label of labels) {
    const index = normalizedHeaders.indexOf(label.toLowerCase());
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

function parseBolDate(value: string): string | null {
  if (!value) return null;
  
  // Try DD-MM-YYYY format (most common for Bol.com)
  const dmyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD (ISO format)
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return value.split(' ')[0];
  }
  
  // Try DD/MM/YYYY format
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseDecimal(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function parseCsvRow(row: Record<string, string>, headers: string[]): BolOrderRow | null {
  const orderIdHeader = findMatchingHeader(headers, ['Bestelnummer', 'Order ID', 'Ordernummer']);
  if (!orderIdHeader || !row[orderIdHeader]) {
    return null;
  }
  
  const findValue = (labels: string[]): string => {
    const header = findMatchingHeader(headers, labels);
    return header ? (row[header] || '') : '';
  };
  
  return {
    orderId: row[orderIdHeader],
    orderDate: parseBolDate(findValue(['Besteldatum', 'Orderdatum'])),
    shippedAt: parseBolDate(findValue(['Verzonden op', 'Verzenddatum'])),
    ean: findValue(['EAN']) || null,
    productName: findValue(['Titel', 'Productnaam', 'Product']) || 'Onbekend product',
    quantity: parseInt(findValue(['Aantal', 'Quantity'])) || 1,
    unitPrice: parseDecimal(findValue(['Prijs', 'Prijs (incl. BTW)', 'Verkoopprijs'])),
    shippingCost: parseDecimal(findValue(['Verzendkosten'])),
    commission: parseDecimal(findValue(['Commissie', 'Bol.com commissie'])),
    customerName: findValue(['Naam', 'Klantnaam']) || null,
    customerEmail: findValue(['E-mail', 'Email']) || null,
    shippingStreet: findValue(['Straat']) || null,
    shippingHouseNumber: findValue(['Huisnummer']) || null,
    shippingPostalCode: findValue(['Postcode']) || null,
    shippingCity: findValue(['Plaats', 'Stad']) || null,
    shippingCountry: findValue(['Land']) || 'NL',
    fulfillmentMethod: findValue(['Fulfilment', 'Fulfilment methode']) || null,
    sku: findValue(['SKU', 'Artikelnummer']) || null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { connectionId, headers, rows } = await req.json();
    
    if (!connectionId || !headers || !rows) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: connectionId, headers, rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('tenant_id, marketplace_type')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = connection.tenant_id;
    
    // Group rows by order ID (Bol.com exports have one row per order item)
    const orderGroups: Map<string, BolOrderRow[]> = new Map();
    
    for (const row of rows) {
      const parsed = parseCsvRow(row, headers);
      if (!parsed) continue;
      
      const existing = orderGroups.get(parsed.orderId) || [];
      existing.push(parsed);
      orderGroups.set(parsed.orderId, existing);
    }

    let ordersImported = 0;
    let ordersSkipped = 0;
    let ordersFailed = 0;
    const errors: string[] = [];

    // Process each unique order
    for (const [orderId, items] of orderGroups) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('marketplace_order_id', orderId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existingOrder) {
          ordersSkipped++;
          continue;
        }

        // Calculate order totals
        const firstItem = items[0];
        const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const shippingCost = firstItem.shippingCost;
        const total = subtotal + shippingCost;
        const totalCommission = items.reduce((sum, item) => sum + item.commission, 0);

        // Build shipping address
        const shippingAddress = {
          street: firstItem.shippingStreet || '',
          house_number: firstItem.shippingHouseNumber || '',
          postal_code: firstItem.shippingPostalCode || '',
          city: firstItem.shippingCity || '',
          country: firstItem.shippingCountry || 'NL',
        };

        // Generate order number
        const { data: orderNumberData } = await supabase
          .rpc('generate_order_number', { _tenant_id: tenantId });
        
        const orderNumber = orderNumberData || `#BOL-${orderId.slice(-6)}`;

        // Create the order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            tenant_id: tenantId,
            order_number: orderNumber,
            marketplace_source: 'bol_com',
            marketplace_order_id: orderId,
            marketplace_connection_id: connectionId,
            customer_name: firstItem.customerName || 'Bol.com Klant',
            customer_email: firstItem.customerEmail,
            shipping_address: shippingAddress,
            subtotal,
            shipping_cost: shippingCost,
            total,
            status: 'shipped',
            fulfillment_status: 'shipped',
            payment_status: 'paid',
            created_at: firstItem.orderDate ? `${firstItem.orderDate}T12:00:00Z` : new Date().toISOString(),
            shipped_at: firstItem.shippedAt ? `${firstItem.shippedAt}T12:00:00Z` : null,
            raw_marketplace_data: {
              source: 'csv_import',
              fulfillment_method: firstItem.fulfillmentMethod,
              commission_total: totalCommission,
              imported_at: new Date().toISOString(),
            },
          })
          .select('id')
          .single();

        if (orderError || !newOrder) {
          throw new Error(orderError?.message || 'Failed to create order');
        }

        // Create order items
        const orderItems = items.map(item => ({
          order_id: newOrder.id,
          tenant_id: tenantId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.unitPrice * item.quantity,
          sku: item.sku,
          ean: item.ean,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error(`Error creating order items for ${orderId}:`, itemsError);
          // Don't fail the entire order, just log
        }

        ordersImported++;
      } catch (error) {
        ordersFailed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Order ${orderId}: ${message}`);
        console.error(`Error processing order ${orderId}:`, error);
      }
    }

    // Log sync activity
    try {
      await supabase.from('sync_activity_log').insert({
        tenant_id: tenantId,
        connection_id: connectionId,
        data_type: 'orders',
        direction: 'import',
        status: ordersFailed > 0 ? 'partial' : 'success',
        records_processed: orderGroups.size,
        records_created: ordersImported,
        records_updated: 0,
        records_failed: ordersFailed,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_details: errors.length > 0 ? { errors } : null,
      });
    } catch (logError) {
      console.error('Error logging sync activity:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported,
        ordersSkipped,
        ordersFailed,
        totalProcessed: orderGroups.size,
        errors: errors.slice(0, 10), // Limit errors in response
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in import-bol-csv:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

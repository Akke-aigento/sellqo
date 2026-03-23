import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTrackingUrl } from "../_shared/carrierTrackingUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConfirmShipmentRequest {
  order_id: string;
  tracking_number?: string | null;
  carrier: string;
  tracking_url?: string;
  marketplace_order_id?: string;
  marketplace_order_item_ids?: string[];
}

const CARRIER_MAPPING: Record<string, string> = {
  'postnl': 'TNT',
  'dhl': 'DHL',
  'dpd': 'DPD-NL',
  'ups': 'UPS',
  'gls': 'GLS',
  'bpost': 'BPOST_BE',
  'bpost_be': 'BPOST_BE',
  'fedex': 'FEDEX',
};

async function getBolAccessToken(credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const authString = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
  
  const response = await fetch("https://login.bol.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": `Basic ${authString}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Bol.com access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch tracking from shipments API if not provided
async function fetchTrackingFromShipments(accessToken: string, marketplaceOrderId: string): Promise<string | null> {
  try {
    console.log("Fetching tracking from shipments API for order:", marketplaceOrderId);
    const res = await fetch(
      `https://api.bol.com/retailer/shipments?order-id=${marketplaceOrderId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.retailer.v10+json",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      for (const shipment of (data.shipments || [])) {
        const tt = shipment.transport?.trackAndTrace;
        if (tt) {
          console.log("Found tracking from shipments API:", tt);
          return tt;
        }
      }
    }
  } catch (e) {
    console.error("Shipments API fetch failed:", e instanceof Error ? e.message : e);
  }
  return null;
}

Deno.serve(async (req) => {
  console.log("=== CONFIRM-BOL-SHIPMENT v3 (v10 API) ===");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, tracking_number, carrier, tracking_url, marketplace_order_id, marketplace_order_item_ids }: ConfirmShipmentRequest = await req.json();

    console.log("Request params:", JSON.stringify({ order_id, carrier, tracking_number, marketplace_order_id, marketplace_order_item_ids }));

    if (!order_id || !carrier) {
      return new Response(
        JSON.stringify({ error: "order_id and carrier are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with marketplace info AND order_items
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.marketplace_source !== 'bol_com' || !order.marketplace_connection_id) {
      return new Response(
        JSON.stringify({ error: "This is not a Bol.com order" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bolOrderId = order.marketplace_order_id || marketplace_order_id;
    if (!bolOrderId) {
      return new Response(
        JSON.stringify({ error: "Order has no Bol.com order ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch marketplace connection for credentials
    const { data: connection, error: connectionError } = await supabase
      .from("marketplace_connections")
      .select("credentials")
      .eq("id", order.marketplace_connection_id)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: "Marketplace connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = connection.credentials as { clientId: string; clientSecret: string };
    if (!credentials.clientId || !credentials.clientSecret) {
      return new Response(
        JSON.stringify({ error: "Bol.com credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const accessToken = await getBolAccessToken(credentials);

    // Resolve tracking number: use provided, or fetch from shipments API
    let resolvedTracking = tracking_number || null;
    if (!resolvedTracking) {
      resolvedTracking = await fetchTrackingFromShipments(accessToken, bolOrderId);
    }

    // Map carrier to Bol.com transporter code
    const transporterCode = CARRIER_MAPPING[carrier.toLowerCase()] || carrier.toUpperCase();

    // Build order items list from multiple sources
    let itemIds: string[] = [];

    // Source 1: Explicitly passed IDs (most reliable - from VVB label function)
    if (marketplace_order_item_ids && marketplace_order_item_ids.length > 0) {
      itemIds = marketplace_order_item_ids;
      console.log(`Using ${itemIds.length} explicitly passed marketplace_order_item_ids`);
    }

    // Source 2: From DB order_items
    if (itemIds.length === 0) {
      const orderItems = order.order_items || [];
      console.log(`Checking ${orderItems.length} order_items from DB...`);
      
      itemIds = orderItems
        .filter((item: any) => item.marketplace_order_item_id)
        .map((item: any) => item.marketplace_order_item_id);
      
      if (itemIds.length > 0) {
        console.log(`Found ${itemIds.length} items with marketplace_order_item_id from DB`);
      }
    }

    if (itemIds.length === 0) {
      console.error("No order item IDs found - cannot create shipment");
      console.error("DEBUG order_items:", JSON.stringify(order.order_items, null, 2));
      return new Response(
        JSON.stringify({ error: "No marketplace order item IDs found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Bol.com v10 API: POST /retailer/shipments =====
    // In v10, transport is at the TOP level (not per order item)
    // and orderItems only contain orderItemId + quantity
    const shipmentBody: Record<string, unknown> = {
      orderItems: itemIds.map((orderItemId: string) => ({
        orderItemId: orderItemId,
        quantity: 1,  // Default to 1, as each orderItemId represents one unit
      })),
    };

    // Add transport info if we have tracking
    if (resolvedTracking) {
      shipmentBody.transport = {
        transporterCode: transporterCode,
        trackAndTrace: resolvedTracking,
      };
    } else {
      // v10 allows creating shipment without tracking, track & trace can be added later
      // via PUT /retailer/transports/{transportId}
      console.log("No tracking available yet - creating shipment without track & trace");
      shipmentBody.transport = {
        transporterCode: transporterCode,
      };
    }

    console.log(`Creating shipment at Bol.com (v10) for order ${bolOrderId}, carrier: ${transporterCode}, tracking: ${resolvedTracking || 'none'}, items: ${itemIds.length}`);
    console.log("Shipment body:", JSON.stringify(shipmentBody));

    const shipmentResponse = await fetch(
      `https://api.bol.com/retailer/shipments`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          "Accept": "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify(shipmentBody),
      }
    );

    const responseText = await shipmentResponse.text();

    if (!shipmentResponse.ok) {
      console.error("Bol.com shipment error:", shipmentResponse.status, responseText);
      
      // If 409 (conflict) or contains "already shipped", that's actually success for VVB orders
      if (shipmentResponse.status === 409 || responseText.includes('shipped') || responseText.includes('already') || shipmentResponse.status === 404) {
        console.log("Order already shipped at Bol.com - treating as success");
        
        const orderUpdate: Record<string, unknown> = {
          sync_status: 'shipped',
          marketplace_sync_error: null,
          carrier: carrier,
          status: 'shipped',
          fulfillment_status: 'shipped',
          shipped_at: new Date().toISOString(),
        };
        if (resolvedTracking) {
          orderUpdate.tracking_number = resolvedTracking;
          orderUpdate.tracking_url = tracking_url || generateTrackingUrl(carrier || '', resolvedTracking);
        }
        await supabase.from("orders").update(orderUpdate).eq("id", order_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Order already shipped at Bol.com",
            tracking_number: resolvedTracking,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      await supabase
        .from("orders")
        .update({
          marketplace_sync_error: `Bol.com shipment failed: ${shipmentResponse.status} - ${responseText}`,
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Bol.com API error: ${shipmentResponse.status}`,
          details: responseText 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let shipmentData;
    try {
      shipmentData = JSON.parse(responseText);
    } catch {
      shipmentData = { raw: responseText };
    }

    console.log("Bol.com shipment response:", JSON.stringify(shipmentData));

    // Update order with final state
    const orderUpdate: Record<string, unknown> = {
      // If no tracking available, mark as awaiting so update-bol-tracking can push it later
      sync_status: resolvedTracking ? 'shipped' : 'shipped_awaiting_tracking',
      marketplace_sync_error: null,
      carrier: carrier,
      status: 'shipped',
      fulfillment_status: 'shipped',
      shipped_at: new Date().toISOString(),
    };
    if (resolvedTracking) {
      orderUpdate.tracking_number = resolvedTracking;
      orderUpdate.tracking_url = tracking_url || generateTrackingUrl(carrier || '', resolvedTracking);
    }
    await supabase.from("orders").update(orderUpdate).eq("id", order_id);

    // If no tracking was available, log that it needs to be updated later
    if (!resolvedTracking) {
      console.log(`Order ${order.order_number}: shipped without tracking - marked as shipped_awaiting_tracking`);
    }

    console.log(`Successfully confirmed shipment to Bol.com for order ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Shipment confirmed to Bol.com (v10)",
        tracking_number: resolvedTracking,
        bol_response: shipmentData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error confirming Bol.com shipment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

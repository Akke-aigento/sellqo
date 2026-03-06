import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

const CARRIER_MAPPING: Record<string, string> = {
  'postnl': 'TNT',
  'dhl': 'DHL',
  'dpd': 'DPD-NL',
  'ups': 'UPS',
  'gls': 'GLS',
  'bpost': 'BPOST_BE',
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, tracking_number, carrier, tracking_url, marketplace_order_id }: ConfirmShipmentRequest = await req.json();

    if (!order_id || !carrier) {
      return new Response(
        JSON.stringify({ error: "order_id and carrier are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with marketplace info
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

    // Build shipment request
    const orderItems = order.order_items || [];
    const shipmentItems = orderItems
      .filter((item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id)
      .map((item: { marketplace_order_item_id: string }) => {
        const shipmentItem: Record<string, unknown> = {
          orderItemId: item.marketplace_order_item_id,
        };
        // Only include transport if we have tracking
        if (resolvedTracking) {
          shipmentItem.transport = {
            trackAndTrace: resolvedTracking,
            transporterCode: transporterCode,
          };
        }
        return shipmentItem;
      });

    if (shipmentItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No order items with Bol.com IDs found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Bol.com shipment API
    console.log(`Confirming shipment for Bol order ${bolOrderId}, tracking: ${resolvedTracking || 'none'}`);
    const shipmentResponse = await fetch(
      `https://api.bol.com/retailer/orders/${bolOrderId}/shipment`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          "Accept": "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify({
          orderItems: shipmentItems,
        }),
      }
    );

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text();
      console.error("Bol.com shipment error:", errorText);
      
      await supabase
        .from("orders")
        .update({
          marketplace_sync_error: `Bol.com shipment confirmation failed: ${errorText}`,
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Bol.com API error: ${shipmentResponse.status}`,
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shipmentData = await shipmentResponse.json();

    // Update order with final state
    const orderUpdate: Record<string, unknown> = {
      sync_status: 'shipped',
      marketplace_sync_error: null,
      carrier: carrier,
    };
    if (resolvedTracking) {
      orderUpdate.tracking_number = resolvedTracking;
      orderUpdate.tracking_url = tracking_url || `https://jfrfracking.info/track/nl-NL/?B=${resolvedTracking}`;
    }
    await supabase.from("orders").update(orderUpdate).eq("id", order_id);

    console.log(`Successfully confirmed shipment to Bol.com for order ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Shipment confirmed to Bol.com",
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
};

serve(handler);

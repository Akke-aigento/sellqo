import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// BUG 4 FIX: Extended CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConfirmShipmentRequest {
  order_id: string;
  tracking_number: string;
  carrier: string;
  tracking_url?: string;
}

// Map common carrier names to Bol.com transporter codes
const CARRIER_MAPPING: Record<string, string> = {
  'postnl': 'TNT',
  'dhl': 'DHL',
  'dpd': 'DPD-NL',
  'ups': 'UPS',
  'gls': 'GLS',
  'bpost': 'BPOST_BE',
  'fedex': 'FEDEX',
};

// BUG 3 FIX: Standardized token method (Content-Type + body)
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, tracking_number, carrier, tracking_url }: ConfirmShipmentRequest = await req.json();

    if (!order_id || !tracking_number || !carrier) {
      return new Response(
        JSON.stringify({ error: "order_id, tracking_number, and carrier are required" }),
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

    // Verify this is a Bol.com order
    if (order.marketplace_source !== 'bol_com' || !order.marketplace_connection_id) {
      return new Response(
        JSON.stringify({ error: "This is not a Bol.com order" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.marketplace_order_id) {
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

    // Map carrier to Bol.com transporter code
    const transporterCode = CARRIER_MAPPING[carrier.toLowerCase()] || carrier.toUpperCase();

    // Build shipment request
    const orderItems = order.order_items || [];
    const shipmentItems = orderItems
      .filter((item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id)
      .map((item: { marketplace_order_item_id: string }) => ({
        orderItemId: item.marketplace_order_item_id,
        transport: {
          trackAndTrace: tracking_number,
          transporterCode: transporterCode,
        },
      }));

    if (shipmentItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No order items with Bol.com IDs found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Bol.com shipment API
    const shipmentResponse = await fetch(
      `https://api.bol.com/retailer/orders/${order.marketplace_order_id}/shipment`,
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
      
      // Update order with error
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

    // BUG 5 FIX: Use sync_status consistently
    await supabase
      .from("orders")
      .update({
        sync_status: 'shipped',
        marketplace_sync_error: null,
        tracking_number: tracking_number,
        tracking_url: tracking_url,
        carrier: carrier,
      })
      .eq("id", order_id);

    console.log(`Successfully confirmed shipment to Bol.com for order ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Shipment confirmed to Bol.com",
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

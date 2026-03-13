import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("=== UPDATE-BOL-TRACKING v1 DEPLOYED ===");

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
    throw new Error(`Failed to get Bol.com access token: ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

async function getTransportId(accessToken: string, bolOrderId: string): Promise<{ transportId: number; shipmentId: number } | null> {
  try {
    const res = await fetch(
      `https://api.bol.com/retailer/shipments?order-id=${bolOrderId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.retailer.v10+json",
        },
      }
    );
    if (!res.ok) {
      console.error("Failed to fetch shipments:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const shipment = data?.shipments?.[0];
    if (!shipment) return null;

    const transportId = shipment.transport?.transportId;
    if (!transportId) {
      console.log("No transportId found in shipment:", JSON.stringify(shipment.transport));
      return null;
    }
    return { transportId, shipmentId: shipment.shipmentId };
  } catch (e) {
    console.error("Error fetching transport ID:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Mode 1: Single order update (called from tracking-webhook or poll-tracking-status)
    if (body.order_id) {
      const result = await updateSingleOrder(supabase, body.order_id, body.tracking_number, body.carrier);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Batch - find all orders awaiting tracking and update them
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, tracking_number, carrier, marketplace_order_id, marketplace_connection_id")
      .eq("marketplace_source", "bol_com")
      .eq("sync_status", "shipped_awaiting_tracking")
      .not("tracking_number", "is", null)
      .neq("tracking_number", "")
      .limit(20);

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ message: "No orders awaiting tracking update", updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${orders.length} orders awaiting tracking update at Bol.com`);
    let updated = 0;

    for (const order of orders) {
      try {
        const result = await updateSingleOrder(supabase, order.id, order.tracking_number, order.carrier);
        if (result.success) updated++;
      } catch (e) {
        console.error(`Error updating order ${order.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, updated, total: orders.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in update-bol-tracking:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function updateSingleOrder(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  trackingNumber?: string | null,
  carrier?: string | null,
): Promise<{ success: boolean; message: string }> {
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, tracking_number, carrier, marketplace_order_id, marketplace_connection_id, marketplace_source, sync_status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, message: "Order not found" };
  }

  if (order.marketplace_source !== "bol_com" || !order.marketplace_connection_id) {
    return { success: false, message: "Not a Bol.com order" };
  }

  const finalTracking = trackingNumber || order.tracking_number;
  const finalCarrier = carrier || order.carrier;

  if (!finalTracking) {
    return { success: false, message: "No tracking number available" };
  }

  if (!order.marketplace_order_id) {
    return { success: false, message: "No Bol.com order ID" };
  }

  // Get credentials
  const { data: connection } = await supabase
    .from("marketplace_connections")
    .select("credentials")
    .eq("id", order.marketplace_connection_id)
    .single();

  if (!connection?.credentials) {
    return { success: false, message: "Connection credentials not found" };
  }

  const credentials = connection.credentials as { clientId: string; clientSecret: string };
  const accessToken = await getBolAccessToken(credentials);

  // Get transport ID from Bol.com shipments API
  const transportInfo = await getTransportId(accessToken, order.marketplace_order_id);
  if (!transportInfo) {
    return { success: false, message: "Could not find transportId at Bol.com" };
  }

  const transporterCode = CARRIER_MAPPING[(finalCarrier || "").toLowerCase()] || (finalCarrier || "").toUpperCase();

  console.log(`Updating transport ${transportInfo.transportId} with tracking ${finalTracking}, carrier ${transporterCode}`);

  // PUT /retailer/transports/{transportId}
  const updateRes = await fetch(
    `https://api.bol.com/retailer/transports/${transportInfo.transportId}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/vnd.retailer.v10+json",
        "Accept": "application/vnd.retailer.v10+json",
      },
      body: JSON.stringify({
        transporterCode: transporterCode,
        trackAndTrace: finalTracking,
      }),
    }
  );

  const responseText = await updateRes.text();

  if (!updateRes.ok) {
    console.error(`Bol.com transport update failed: ${updateRes.status}`, responseText);
    
    // Store error but don't fail permanently
    await supabase.from("orders").update({
      marketplace_sync_error: `Tracking update failed: ${updateRes.status} - ${responseText}`,
    }).eq("id", orderId);

    return { success: false, message: `Bol.com API error: ${updateRes.status}` };
  }

  console.log(`Successfully updated tracking at Bol.com for order ${orderId}`);

  // Update order sync status
  await supabase.from("orders").update({
    sync_status: "shipped",
    marketplace_sync_error: null,
  }).eq("id", orderId);

  return { success: true, message: "Tracking updated at Bol.com" };
}

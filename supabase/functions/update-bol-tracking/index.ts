import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("=== UPDATE-BOL-TRACKING v2 DEPLOYED ===");

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

interface ShipmentInfo {
  transportId: number;
  shipmentId: number;
  trackingCode?: string;
  transporterCode?: string;
}

async function getShipmentInfo(accessToken: string, bolOrderId: string): Promise<ShipmentInfo | null> {
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

    const transport = shipment.transport;
    const transportId = transport?.transportId;
    if (!transportId) {
      console.log("No transportId found in shipment:", JSON.stringify(transport));
      return null;
    }
    return {
      transportId,
      shipmentId: shipment.shipmentId,
      trackingCode: transport?.trackAndTrace || undefined,
      transporterCode: transport?.transporterCode || undefined,
    };
  } catch (e) {
    console.error("Error fetching shipment info:", e);
    return null;
  }
}

async function getTrackingFromLabel(
  accessToken: string,
  shippingLabelId: string
): Promise<{ trackingCode: string; transporterCode: string } | null> {
  try {
    console.log(`HEAD /retailer/shipping-labels/${shippingLabelId} for tracking...`);
    const res = await fetch(
      `https://api.bol.com/retailer/shipping-labels/${shippingLabelId}`,
      {
        method: "HEAD",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.retailer.v10+pdf",
        },
      }
    );
    if (!res.ok) {
      console.error(`HEAD shipping-labels failed: ${res.status}`);
      return null;
    }
    const trackingCode = res.headers.get("X-Track-And-Trace-Code");
    const transporterCode = res.headers.get("X-Transporter-Code");
    if (trackingCode) {
      console.log(`Got tracking from label HEAD: ${trackingCode} / ${transporterCode}`);
      return { trackingCode, transporterCode: transporterCode || "TNT" };
    }
    console.log("HEAD returned no X-Track-And-Trace-Code header");
    return null;
  } catch (e) {
    console.error("Error in getTrackingFromLabel:", e);
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

    // Mode 1: Single order update
    if (body.order_id) {
      const result = await updateSingleOrder(supabase, body.order_id, body.tracking_number, body.carrier);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Batch — push tracking for orders that have tracking but haven't synced it
    const { data: pushOrders, error: pushError } = await supabase
      .from("orders")
      .select("id, tracking_number, carrier, marketplace_order_id, marketplace_connection_id")
      .eq("marketplace_source", "bol_com")
      .in("sync_status", ["shipped_awaiting_tracking", "accepted", "shipped"])
      .not("tracking_number", "is", null)
      .neq("tracking_number", "")
      .limit(20);

    // Mode 3: Pull — fetch tracking from Bol.com for VVB orders missing tracking
    const { data: pullOrders, error: pullError } = await supabase
      .from("orders")
      .select("id, tracking_number, carrier, marketplace_order_id, marketplace_connection_id")
      .eq("marketplace_source", "bol_com")
      .in("sync_status", ["shipped_awaiting_tracking", "accepted", "shipped"])
      .or("tracking_number.is.null,tracking_number.eq.")
      .not("marketplace_order_id", "is", null)
      .limit(20);

    if (pushError) throw pushError;
    if (pullError) throw pullError;

    const allOrders = [...(pushOrders || []), ...(pullOrders || [])];
    // Deduplicate
    const seen = new Set<string>();
    const uniqueOrders = allOrders.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    if (uniqueOrders.length === 0) {
      return new Response(JSON.stringify({ message: "No orders need tracking update", updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${uniqueOrders.length} orders for tracking sync (${pushOrders?.length || 0} push, ${pullOrders?.length || 0} pull)`);
    let updated = 0;

    for (const order of uniqueOrders) {
      try {
        const result = await updateSingleOrder(supabase, order.id, order.tracking_number, order.carrier);
        if (result.success) updated++;
      } catch (e) {
        console.error(`Error updating order ${order.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, updated, total: uniqueOrders.length }), {
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

  // Get shipment info from Bol.com (includes tracking if available)
  const shipmentInfo = await getShipmentInfo(accessToken, order.marketplace_order_id);
  if (!shipmentInfo) {
    return { success: false, message: "Could not find shipment at Bol.com" };
  }

  // Determine tracking: use provided > local > pulled from Bol.com
  let finalTracking = trackingNumber || order.tracking_number || shipmentInfo.trackingCode;
  let finalCarrier = carrier || order.carrier;

  // If we pulled tracking from Bol.com that we didn't have locally, save it
  if (!order.tracking_number && shipmentInfo.trackingCode) {
    console.log(`Pulled tracking ${shipmentInfo.trackingCode} from Bol.com for order ${orderId}`);
    await supabase.from("orders").update({
      tracking_number: shipmentInfo.trackingCode,
      carrier: shipmentInfo.transporterCode || finalCarrier,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    finalTracking = shipmentInfo.trackingCode;
    if (shipmentInfo.transporterCode) finalCarrier = shipmentInfo.transporterCode;
  }

  // If Bol.com already has tracking, we're done — just update local status
  if (shipmentInfo.trackingCode) {
    console.log(`Bol.com already has tracking ${shipmentInfo.trackingCode} for order ${orderId}, marking as shipped`);
    await supabase.from("orders").update({
      sync_status: "shipped",
      tracking_number: finalTracking || shipmentInfo.trackingCode,
      marketplace_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    return { success: true, message: "Tracking already present at Bol.com" };
  }

  // No tracking available anywhere yet
  if (!finalTracking) {
    console.log(`No tracking available yet for order ${orderId} — will retry later`);
    // Ensure status is shipped_awaiting_tracking so we retry
    if (order.sync_status !== "shipped_awaiting_tracking") {
      await supabase.from("orders").update({
        sync_status: "shipped_awaiting_tracking",
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }
    return { success: false, message: "No tracking number available yet" };
  }

  // We have tracking locally but Bol.com doesn't — push it
  const transporterCode = CARRIER_MAPPING[(finalCarrier || "").toLowerCase()] || (finalCarrier || "").toUpperCase();

  console.log(`Pushing tracking ${finalTracking} (carrier: ${transporterCode}) to Bol.com transport ${shipmentInfo.transportId}`);

  const updateRes = await fetch(
    `https://api.bol.com/retailer/transports/${shipmentInfo.transportId}`,
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
    await supabase.from("orders").update({
      marketplace_sync_error: `Tracking update failed: ${updateRes.status} - ${responseText}`,
    }).eq("id", orderId);
    return { success: false, message: `Bol.com API error: ${updateRes.status}` };
  }

  console.log(`Successfully pushed tracking to Bol.com for order ${orderId}`);

  await supabase.from("orders").update({
    sync_status: "shipped",
    marketplace_sync_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", orderId);

  return { success: true, message: "Tracking updated at Bol.com" };
}

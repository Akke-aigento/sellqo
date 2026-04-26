import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Extended CORS headers (compatible with all Supabase client variants)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConfirmShipmentRequest {
  order_id: string;
  tracking_number?: string;
  carrier?: string;
  tracking_url?: string;
  // Optional explicit override - if not provided we auto-detect from DB
  shipping_label_id?: string;
}

// Map common carrier names to Bol.com transporter codes
// Reference: https://api.bol.com/retailer/public/Retailer-API/v10/functional/retailer-api/orders-shipments.html
const CARRIER_MAPPING: Record<string, string> = {
  postnl: "TNT",
  tnt: "TNT",
  dhl: "DHL",
  dhlforyou: "DHLFORYOU",
  dpd: "DPD-NL",
  "dpd-nl": "DPD-NL",
  "dpd-be": "DPD-BE",
  ups: "UPS",
  gls: "GLS",
  bpost: "BPOST_BE",
  bpost_be: "BPOST_BE",
  fedex: "FEDEX",
};

async function getBolAccessToken(credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const authString = btoa(`${credentials.clientId}:${credentials.clientSecret}`);

  const response = await fetch("https://login.bol.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${authString}`,
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

// Poll Bol process-status with short ceiling. We don't want to keep the caller
// waiting forever — Bol has accepted (202) the moment the body is valid, so
// failure here usually means a logical Bol-side rejection (e.g. order already
// shipped). Returns final status or null if still pending after timeout.
async function pollProcessStatus(
  processStatusId: string,
  selfHref: string | null,
  accessToken: string,
  maxAttempts = 6,
  intervalMs = 2000,
): Promise<{ status: string; errorMessage?: string } | null> {
  const url = selfHref || `https://api.bol.com/retailer/process-status/${processStatusId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.retailer.v10+json",
        },
      });
      if (!res.ok) {
        console.warn(`[confirm-bol-shipment] process-status poll ${attempt + 1} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      console.log(`[confirm-bol-shipment] process-status attempt ${attempt + 1}: ${data.status}`);
      if (data.status === "SUCCESS" || data.status === "FAILURE" || data.status === "TIMEOUT") {
        return { status: data.status, errorMessage: data.errorMessage };
      }
    } catch (e) {
      console.warn(`[confirm-bol-shipment] poll error attempt ${attempt + 1}:`, e instanceof Error ? e.message : e);
    }
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

    const { order_id, tracking_number, carrier, tracking_url, shipping_label_id }: ConfirmShipmentRequest =
      await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found", details: orderError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.marketplace_source !== "bol_com" || !order.marketplace_connection_id) {
      return new Response(JSON.stringify({ error: "This is not a Bol.com order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.marketplace_order_id) {
      return new Response(JSON.stringify({ error: "Order has no Bol.com order ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Detect VVB mode ===
    // If a shipping_labels row exists for this order with provider='bol_vvb' and
    // an external_id, we ship via shippingLabelId. Otherwise we use transport.
    let resolvedShippingLabelId: string | null = shipping_label_id || null;
    if (!resolvedShippingLabelId) {
      const { data: vvbLabel } = await supabase
        .from("shipping_labels")
        .select("external_id")
        .eq("order_id", order_id)
        .eq("provider", "bol_vvb")
        .not("external_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vvbLabel?.external_id) {
        resolvedShippingLabelId = vvbLabel.external_id as string;
        console.log(`[confirm-bol-shipment] VVB mode detected via DB lookup, label id: ${resolvedShippingLabelId}`);
      }
    }

    const isVvb = Boolean(resolvedShippingLabelId);

    if (!isVvb && (!tracking_number || !carrier)) {
      return new Response(
        JSON.stringify({
          error: "Non-VVB shipment requires tracking_number and carrier (or pass shipping_label_id for a VVB shipment)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch credentials
    const { data: connection, error: connectionError } = await supabase
      .from("marketplace_connections")
      .select("credentials")
      .eq("id", order.marketplace_connection_id)
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: "Marketplace connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentials = connection.credentials as { clientId: string; clientSecret: string };
    if (!credentials?.clientId || !credentials?.clientSecret) {
      return new Response(JSON.stringify({ error: "Bol.com credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getBolAccessToken(credentials);

    // Build orderItems array for v10 — { orderItemId, quantity } only
    const orderItems = order.order_items || [];
    const shipmentOrderItems = orderItems
      .filter((item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id)
      .map((item: { marketplace_order_item_id: string; quantity?: number }) => ({
        orderItemId: item.marketplace_order_item_id,
        quantity: item.quantity || 1,
      }));

    if (shipmentOrderItems.length === 0) {
      console.error(
        `[confirm-bol-shipment] No marketplace_order_item_id on order_items for order ${order.order_number}`,
      );
      return new Response(JSON.stringify({ error: "No order items with Bol.com IDs found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build v10 body (transport at root for own-label, shippingLabelId for VVB)
    let body: Record<string, unknown>;
    let transporterCode: string | null = null;

    if (isVvb) {
      body = {
        orderItems: shipmentOrderItems,
        shippingLabelId: resolvedShippingLabelId,
      };
      console.log(
        `[confirm-bol-shipment] VVB body: ${JSON.stringify(body)} for order ${order.order_number} (${order.marketplace_order_id})`,
      );
    } else {
      transporterCode = CARRIER_MAPPING[(carrier as string).toLowerCase()] || (carrier as string).toUpperCase();
      body = {
        orderItems: shipmentOrderItems,
        transport: {
          transporterCode,
          trackAndTrace: tracking_number,
        },
      };
      console.log(
        `[confirm-bol-shipment] own-label body: ${JSON.stringify(body)} for order ${order.order_number} (${order.marketplace_order_id})`,
      );
    }

    // === V10 endpoint: POST /retailer/shipments ===
    // (replaces deprecated v9 PUT /retailer/orders/{orderId}/shipment)
    const shipmentResponse = await fetch("https://api.bol.com/retailer/shipments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/vnd.retailer.v10+json",
        Accept: "application/vnd.retailer.v10+json",
      },
      body: JSON.stringify(body),
    });

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text();
      console.error(
        `[confirm-bol-shipment] Bol API ${shipmentResponse.status} for order ${order.order_number}:`,
        errorText,
      );
      await supabase
        .from("orders")
        .update({
          marketplace_sync_error: `Bol shipment confirmation failed (${shipmentResponse.status}): ${errorText.slice(0, 500)}`,
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Bol.com API error: ${shipmentResponse.status}`,
          details: errorText,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // V10 returns 202 ACCEPTED with { processStatusId, eventType, links: [...] }
    const shipmentData = await shipmentResponse.json();
    const processStatusId: string | undefined = shipmentData.processStatusId;
    const selfLink: string | null =
      (shipmentData.links || []).find((l: { rel?: string }) => l.rel === "self")?.href || null;

    console.log(
      `[confirm-bol-shipment] Bol accepted shipment for order ${order.order_number}, processStatusId: ${processStatusId}`,
    );

    // Poll process-status (short ceiling) so we know if Bol processed it
    let finalStatus: string = "PENDING";
    let finalError: string | undefined;
    if (processStatusId) {
      const polled = await pollProcessStatus(processStatusId, selfLink, accessToken);
      if (polled) {
        finalStatus = polled.status;
        finalError = polled.errorMessage;
      }
    }

    if (finalStatus === "FAILURE") {
      console.error(
        `[confirm-bol-shipment] Bol rejected shipment async for order ${order.order_number}: ${finalError}`,
      );
      await supabase
        .from("orders")
        .update({
          marketplace_sync_error: `Bol shipment FAILURE: ${finalError || "unknown"}`,
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Bol.com rejected the shipment",
          details: finalError,
          processStatusId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update order — clear any prior sync error, mark as shipped
    const orderUpdate: Record<string, unknown> = {
      sync_status: "shipped",
      marketplace_sync_error: null,
    };
    if (tracking_number) orderUpdate.tracking_number = tracking_number;
    if (tracking_url) orderUpdate.tracking_url = tracking_url;
    if (transporterCode) orderUpdate.carrier = carrier;

    await supabase.from("orders").update(orderUpdate).eq("id", order_id);

    console.log(
      `[confirm-bol-shipment] Order ${order.order_number} confirmed (mode: ${isVvb ? "VVB" : "own-label"}, async: ${finalStatus})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Shipment confirmed to Bol.com",
        mode: isVvb ? "vvb" : "own-label",
        processStatusId,
        async_status: finalStatus,
        bol_response: shipmentData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[confirm-bol-shipment] FATAL:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);

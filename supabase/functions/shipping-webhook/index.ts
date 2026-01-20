import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map provider status to our normalized status
const STATUS_MAP: Record<string, Record<string, string>> = {
  sendcloud: {
    "1000": "pending",
    "1001": "created",
    "1002": "printed",
    "2000": "shipped",
    "3000": "delivered",
    "4000": "cancelled",
    "99": "error",
  },
  myparcel: {
    "1": "pending",
    "2": "created",
    "3": "shipped",
    "4": "shipped",
    "7": "delivered",
    "32": "cancelled",
    "34": "error",
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Provider query param required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    console.log(`Received ${provider} webhook:`, JSON.stringify(payload));

    let processedEvents = 0;

    switch (provider) {
      case "sendcloud": {
        // Sendcloud webhook format
        const action = payload.action;
        const parcel = payload.parcel;

        if (!parcel) {
          return new Response(
            JSON.stringify({ error: "No parcel data in webhook" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find the label by external_id
        const { data: label, error: labelError } = await supabase
          .from("shipping_labels")
          .select("*, orders(*)")
          .eq("external_id", String(parcel.id))
          .eq("provider", "sendcloud")
          .single();

        if (labelError || !label) {
          console.log("Label not found for parcel:", parcel.id);
          return new Response(
            JSON.stringify({ message: "Label not found, ignoring webhook" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const statusCode = String(parcel.status?.id || "");
        const normalizedStatus = STATUS_MAP.sendcloud[statusCode] || "pending";

        // Create status update record
        await supabase.from("shipping_status_updates").insert([{
          tenant_id: label.tenant_id,
          label_id: label.id,
          order_id: label.order_id,
          provider: "sendcloud",
          external_event_id: `${parcel.id}-${action}`,
          status: normalizedStatus,
          status_message: parcel.status?.message,
          location: parcel.tracking?.carrier_detail?.location,
          carrier_status: parcel.status?.message,
          event_timestamp: new Date().toISOString(),
          raw_payload: payload,
        }]);

        // Update label status
        await supabase
          .from("shipping_labels")
          .update({
            status: normalizedStatus,
            tracking_url: parcel.tracking_url || label.tracking_url,
          })
          .eq("id", label.id);

        // Update order status if significant change
        if (normalizedStatus === "shipped" || normalizedStatus === "delivered") {
          const orderUpdate: Record<string, unknown> = {
            fulfillment_status: normalizedStatus,
          };
          
          if (normalizedStatus === "delivered") {
            orderUpdate.status = "delivered";
            orderUpdate.delivered_at = new Date().toISOString();
          }

          await supabase
            .from("orders")
            .update(orderUpdate)
            .eq("id", label.order_id);
        }

        processedEvents = 1;
        break;
      }

      case "myparcel": {
        // MyParcel webhook format
        const hooks = payload.data?.hooks || [payload];

        for (const hook of hooks) {
          const shipmentId = hook.shipment_id;
          const statusId = String(hook.status || "");

          if (!shipmentId) continue;

          // Find the label
          const { data: label, error: labelError } = await supabase
            .from("shipping_labels")
            .select("*")
            .eq("external_id", String(shipmentId))
            .eq("provider", "myparcel")
            .single();

          if (labelError || !label) {
            console.log("Label not found for shipment:", shipmentId);
            continue;
          }

          const normalizedStatus = STATUS_MAP.myparcel[statusId] || "pending";

          // Create status update
          await supabase.from("shipping_status_updates").insert([{
            tenant_id: label.tenant_id,
            label_id: label.id,
            order_id: label.order_id,
            provider: "myparcel",
            external_event_id: hook.hook_id || `${shipmentId}-${statusId}`,
            status: normalizedStatus,
            status_message: hook.status_text,
            event_timestamp: hook.time ? new Date(hook.time * 1000).toISOString() : new Date().toISOString(),
            raw_payload: hook,
          }]);

          // Update label
          await supabase
            .from("shipping_labels")
            .update({ status: normalizedStatus })
            .eq("id", label.id);

          // Update order if needed
          if (normalizedStatus === "delivered") {
            await supabase
              .from("orders")
              .update({
                status: "delivered",
                delivered_at: new Date().toISOString(),
                fulfillment_status: "delivered",
              })
              .eq("id", label.order_id);
          }

          processedEvents++;
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, processed_events: processedEvents }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing shipping webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("POLL-TRACKING-STATUS v1 DEPLOYED");

// Map 17TRACK track_info.latest_status → our normalized status
const STATUS_17TRACK: Record<number, string> = {
  0: "not_found",
  10: "in_transit",
  20: "expired",
  30: "picked_up",
  35: "undelivered",
  40: "delivered",
  50: "exception",
};

// Map our carrier IDs → 17TRACK carrier codes (num)
const CARRIER_CODE_MAP: Record<string, number> = {
  postnl: 100003,
  dhl: 100001,
  dpd: 100005,
  ups: 100002,
  gls: 100012,
  bpost: 100009,
  fedex: 100003,
  tnt: 100028,
  budbee: 190271,
};

// Friendly Dutch names for statuses
const STATUS_LABELS: Record<string, string> = {
  not_found: "Niet gevonden",
  in_transit: "Onderweg",
  picked_up: "Opgehaald",
  out_for_delivery: "In bezorging",
  delivered: "Bezorgd",
  exception: "Probleem",
  expired: "Verlopen",
  undelivered: "Niet bezorgd",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all tenants with auto-poll enabled and an API key
    const { data: settings, error: settingsError } = await supabase
      .from("tenant_tracking_settings")
      .select("*")
      .eq("auto_poll_17track", true)
      .not("api_key_17track", "is", null);

    if (settingsError) {
      console.error("Error fetching tracking settings:", settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log("No tenants with auto-poll enabled");
      return new Response(
        JSON.stringify({ message: "No tenants to poll", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpdated = 0;

    for (const setting of settings) {
      const pollInterval = setting.poll_interval_hours || 4;
      const cutoff = new Date(Date.now() - pollInterval * 60 * 60 * 1000).toISOString();

      // 2. Get shipped orders that need checking
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, tracking_number, carrier, tracking_status, order_number, customer_email, customer_name")
        .eq("tenant_id", setting.tenant_id)
        .in("status", ["shipped", "processing"])
        .not("tracking_number", "is", null)
        .neq("tracking_number", "")
        .or(`last_tracking_check.is.null,last_tracking_check.lt.${cutoff}`)
        .neq("tracking_status", "delivered")
        .limit(40); // Max 40 per batch to stay within API limits

      if (ordersError) {
        console.error(`Error fetching orders for tenant ${setting.tenant_id}:`, ordersError);
        continue;
      }

      if (!orders || orders.length === 0) {
        console.log(`No orders to poll for tenant ${setting.tenant_id}`);
        continue;
      }

      console.log(`Polling ${orders.length} orders for tenant ${setting.tenant_id}`);

      // 3. Call 17TRACK API in batches of 40
      const trackItems = orders.map((order) => ({
        number: order.tracking_number!,
        carrier: CARRIER_CODE_MAP[order.carrier || ""] || undefined,
      }));

      let trackResults: any[] = [];
      try {
        const response = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
          method: "POST",
          headers: {
            "17token": setting.api_key_17track!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trackItems),
        });

        if (!response.ok) {
          console.error(`17TRACK API error: ${response.status} ${await response.text()}`);
          continue;
        }

        const result = await response.json();
        trackResults = result.data?.accepted || [];
      } catch (apiError) {
        console.error(`17TRACK API call failed for tenant ${setting.tenant_id}:`, apiError);
        continue;
      }

      // 4. Process results
      for (const track of trackResults) {
        const trackingNumber = track.number;
        const order = orders.find((o) => o.tracking_number === trackingNumber);
        if (!order) continue;

        const latestStatus = track.track_info?.latest_status ?? -1;
        const latestEvent = track.track_info?.latest_event;
        const newStatus = STATUS_17TRACK[latestStatus] || "in_transit";

        // Only update if status actually changed
        const statusChanged = order.tracking_status !== newStatus;

        const orderUpdate: Record<string, unknown> = {
          tracking_status: newStatus,
          last_tracking_check: new Date().toISOString(),
        };

        // Auto-update order status on delivery
        if (newStatus === "delivered" && order.tracking_status !== "delivered") {
          orderUpdate.status = "delivered";
          orderUpdate.delivered_at = new Date().toISOString();
          orderUpdate.fulfillment_status = "delivered";
        }

        // Update the order
        await supabase
          .from("orders")
          .update(orderUpdate)
          .eq("id", order.id);

        // Log status change
        if (statusChanged) {
          await supabase.from("shipping_status_updates").insert([{
            tenant_id: setting.tenant_id,
            order_id: order.id,
            provider: "17track",
            external_event_id: `17t-${trackingNumber}-${latestStatus}-${Date.now()}`,
            status: newStatus,
            status_message: latestEvent?.description || STATUS_LABELS[newStatus] || newStatus,
            location: latestEvent?.location,
            event_timestamp: latestEvent?.time_iso
              ? new Date(latestEvent.time_iso).toISOString()
              : new Date().toISOString(),
            raw_payload: track,
          }]);

          // Trigger notifications based on tenant settings
          if (
            (newStatus === "delivered" && setting.notify_on_delivered) ||
            (newStatus === "exception" && setting.notify_on_exception) ||
            (newStatus === "out_for_delivery" && setting.notify_on_out_for_delivery) ||
            (newStatus === "in_transit" && setting.notify_on_shipped)
          ) {
            // Create a notification for the tenant
            try {
              await supabase.from("notifications").insert([{
                tenant_id: setting.tenant_id,
                category: "shipping",
                type: `tracking_${newStatus}`,
                title: `Verzending ${STATUS_LABELS[newStatus] || newStatus}: ${order.order_number}`,
                message: `Bestelling ${order.order_number} (${order.customer_name || order.customer_email}) is nu "${STATUS_LABELS[newStatus] || newStatus}"`,
                priority: newStatus === "exception" ? "high" : "low",
                action_url: `/admin/orders/${order.id}`,
                data: {
                  order_id: order.id,
                  tracking_number: trackingNumber,
                  tracking_status: newStatus,
                },
              }]);
            } catch (notifErr) {
              console.error("Error creating notification:", notifErr);
            }
          }

          totalUpdated++;
        }
      }
    }

    console.log(`Polling complete. ${totalUpdated} orders updated.`);
    return new Response(
      JSON.stringify({ success: true, updated: totalUpdated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in poll-tracking-status:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

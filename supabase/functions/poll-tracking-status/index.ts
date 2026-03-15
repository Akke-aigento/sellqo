import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("POLL-TRACKING-STATUS v4 CARRIER-NORMALIZATION DEPLOYED");

// ── Status labels (Dutch) ──
const STATUS_LABELS: Record<string, string> = {
  pending: "In afwachting",
  in_transit: "Onderweg",
  out_for_delivery: "In bezorging",
  delivered: "Bezorgd",
  exception: "Probleem",
  not_found: "Niet gevonden",
};

// ── Carrier detection from tracking number ──
function detectCarrier(trackingNumber: string, existingCarrier?: string | null): string | null {
  const tn = (trackingNumber || "").trim().toUpperCase();

  // PostNL: starts with 3S
  if (/^3S/.test(tn)) return "postnl";

  // DHL: starts with JD + 18 digits total, or JVGL
  if (/^JD\d{16,}$/.test(tn) || /^JVGL/.test(tn)) return "dhl";

  // bpost: starts with CD or LX
  if (/^(CD|LX)/.test(tn)) return "bpost";

  // DPD: starts with 00340 or is exactly 14-15 digits
  if (/^00340/.test(tn) || /^\d{14,15}$/.test(tn)) return "dpd";

  // GLS: starts with GLS or 8-11 pure digits (but not caught by DPD)
  if (/^GLS/.test(tn) || /^\d{8,11}$/.test(tn)) return "gls";

  // Fall back to existing carrier if set
  if (existingCarrier) return existingCarrier.toLowerCase();

  return null;
}

// ── Normalize status from various carrier responses ──
function normalizeStatus(raw: string): string {
  const s = (raw || "").toLowerCase();

  if (/deliver|bezorgd|zugestellt|afgeleverd/.test(s)) return "delivered";
  if (/out.for.delivery|in.bezorging|onderweg.naar/.test(s)) return "out_for_delivery";
  if (/transit|onderweg|vervoer|sorting|gesorteerd|hub|depot|transport/.test(s)) return "in_transit";
  if (/exception|problem|retour|return|damage|schade|refused|geweigerd|mislukt|failed/.test(s)) return "exception";
  if (/picked.up|opgehaald|aangemeld|registered|accepted|aangenomen|collected/.test(s)) return "in_transit";
  if (/not.found|geen.info|unknown/.test(s)) return "not_found";

  return "in_transit";
}

// ── Carrier-specific tracking fetchers ──

async function fetchPostNL(trackingNumber: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    const res = await fetch(
      `https://jouw.postnl.nl/track-and-trace/api/trackAndTrace/${trackingNumber}?language=nl`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // PostNL returns colli array
    const colli = data?.colli?.[trackingNumber] || data?.colli?.[0];
    if (!colli) return null;

    const lastEvent = colli.statusPhase?.toString() || "";
    const status = colli.status?.toString() || "";

    // PostNL statusPhase: 1=Aangemeld, 2=Gesorteerd, 3=In bezorging, 4=Bezorgd, 99=Probleem
    let normalized = "in_transit";
    const phase = parseInt(lastEvent);
    if (phase === 4) normalized = "delivered";
    else if (phase === 3) normalized = "out_for_delivery";
    else if (phase === 99) normalized = "exception";
    else if (phase >= 1) normalized = "in_transit";

    return {
      status: normalized,
      description: status || STATUS_LABELS[normalized] || normalized,
      location: colli.deliveryAddress?.city,
      timestamp: colli.deliveryDate || new Date().toISOString(),
    };
  } catch (e) {
    console.error("PostNL fetch error:", e);
    return null;
  }
}

async function fetchDHL(trackingNumber: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    // DHL public tracking API (no key required for basic tracking)
    const res = await fetch(
      `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) {
      // Try alternative DHL endpoint
      const altRes = await fetch(
        `https://www.dhl.com/utapi?trackingNumber=${trackingNumber}&language=nl&requesterCountryCode=NL`,
        { headers: { "Accept": "application/json" } }
      );
      if (!altRes.ok) return null;
      const altData = await altRes.json();
      const shipment = altData?.sendungen?.[0];
      if (!shipment) return null;

      const lastEvent = shipment.sendungsdetails?.sendungsverlauf?.events?.[0];
      return {
        status: normalizeStatus(lastEvent?.status || shipment.sendungsdetails?.sendungsstatus?.statusText || ""),
        description: lastEvent?.status || shipment.sendungsdetails?.sendungsstatus?.statusText || "",
        location: lastEvent?.ort,
        timestamp: lastEvent?.datum || new Date().toISOString(),
      };
    }

    const data = await res.json();
    const shipment = data?.shipments?.[0];
    if (!shipment) return null;

    const lastEvent = shipment.events?.[0];
    const statusText = shipment.status?.statusCode || lastEvent?.description || "";

    return {
      status: normalizeStatus(statusText),
      description: lastEvent?.description || shipment.status?.status || statusText,
      location: lastEvent?.location?.address?.addressLocality,
      timestamp: lastEvent?.timestamp || new Date().toISOString(),
    };
  } catch (e) {
    console.error("DHL fetch error:", e);
    return null;
  }
}

async function fetchBpost(trackingNumber: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    const res = await fetch(
      `https://track.bpost.cloud/btr/web/api/items?itemIdentifier=${trackingNumber}&language=nl`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const item = data?.items?.[0];
    if (!item) return null;

    const lastEvent = item.events?.[0];
    const statusKey = item.stateInfo?.stateDescription || lastEvent?.key || "";

    return {
      status: normalizeStatus(statusKey),
      description: lastEvent?.description || statusKey,
      location: lastEvent?.location?.name,
      timestamp: lastEvent?.date || new Date().toISOString(),
    };
  } catch (e) {
    console.error("bpost fetch error:", e);
    return null;
  }
}

async function fetchDPD(trackingNumber: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    const res = await fetch(
      `https://tracking.dpd.de/rest/plc/en_US/${trackingNumber}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const parcel = data?.parcellifecycleResponse?.parcelLifeCycleData?.shipmentInfo?.[0];
    if (!parcel) return null;

    const statusInfo = parcel.statusInfo;
    const lastScan = parcel.scanInfo?.scan?.[0];

    return {
      status: normalizeStatus(statusInfo?.status || lastScan?.scanDescription?.content || ""),
      description: statusInfo?.label?.content || lastScan?.scanDescription?.content || "",
      location: lastScan?.scanData?.location,
      timestamp: lastScan?.scanData?.date ? `${lastScan.scanData.date}T${lastScan.scanData.time || "00:00:00"}` : new Date().toISOString(),
    };
  } catch (e) {
    console.error("DPD fetch error:", e);
    return null;
  }
}

async function fetchGLS(trackingNumber: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    const res = await fetch(
      `https://gls-group.eu/app/service/open/rest/EU/en/rstt001?match=${trackingNumber}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const tuStatus = data?.tuStatus?.[0];
    if (!tuStatus) return null;

    const lastEvent = tuStatus.history?.[0];
    const overallStatus = tuStatus.progressBar?.statusInfo || "";

    return {
      status: normalizeStatus(overallStatus || lastEvent?.evtDscr || ""),
      description: lastEvent?.evtDscr || overallStatus || "",
      location: lastEvent?.address?.city,
      timestamp: lastEvent?.date && lastEvent?.time
        ? `${lastEvent.date.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1")}T${lastEvent.time}`
        : new Date().toISOString(),
    };
  } catch (e) {
    console.error("GLS fetch error:", e);
    return null;
  }
}

// ── Main fetch dispatcher ──
async function fetchTrackingStatus(
  carrier: string,
  trackingNumber: string
): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  switch (carrier) {
    case "postnl": return fetchPostNL(trackingNumber);
    case "dhl": return fetchDHL(trackingNumber);
    case "bpost": return fetchBpost(trackingNumber);
    case "dpd": return fetchDPD(trackingNumber);
    case "gls": return fetchGLS(trackingNumber);
    default:
      console.log(`No free API available for carrier: ${carrier}`);
      return null;
  }
}

// ── Main handler ──
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all tenants with auto-poll enabled (no API key needed anymore)
    const { data: settings, error: settingsError } = await supabase
      .from("tenant_tracking_settings")
      .select("*")
      .eq("auto_poll_17track", true);

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

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, tracking_number, carrier, tracking_status, order_number, customer_email, customer_name")
        .eq("tenant_id", setting.tenant_id)
        .in("status", ["shipped", "processing"])
        .not("tracking_number", "is", null)
        .neq("tracking_number", "")
        .or(`last_tracking_check.is.null,last_tracking_check.lt.${cutoff}`)
        .neq("tracking_status", "delivered")
        .limit(40);

      if (ordersError) {
        console.error(`Error fetching orders for tenant ${setting.tenant_id}:`, ordersError);
        continue;
      }

      if (!orders || orders.length === 0) continue;

      console.log(`Polling ${orders.length} orders for tenant ${setting.tenant_id}`);

      for (const order of orders) {
        const carrier = detectCarrier(order.tracking_number!, order.carrier);
        if (!carrier) {
          console.log(`Cannot detect carrier for ${order.tracking_number}`);
          continue;
        }

        const result = await fetchTrackingStatus(carrier, order.tracking_number!);
        if (!result) continue;

        const newStatus = result.status;
        const statusChanged = order.tracking_status !== newStatus;

        const orderUpdate: Record<string, unknown> = {
          tracking_status: newStatus,
          last_tracking_check: new Date().toISOString(),
          carrier: carrier, // auto-fill detected carrier
        };

        if (newStatus === "delivered" && order.tracking_status !== "delivered") {
          orderUpdate.status = "delivered";
          orderUpdate.delivered_at = new Date().toISOString();
          orderUpdate.fulfillment_status = "delivered";
        }

        await supabase.from("orders").update(orderUpdate).eq("id", order.id);

        // If this is a Bol.com order and tracking just became available, push it to Bol.com
        if (statusChanged) {
          const { data: orderMeta } = await supabase
            .from("orders")
            .select("marketplace_source, marketplace_connection_id, sync_status")
            .eq("id", order.id)
            .single();

          if (orderMeta?.marketplace_source === 'bol_com' && orderMeta?.marketplace_connection_id &&
              (orderMeta?.sync_status === 'shipped_awaiting_tracking' || orderMeta?.sync_status === 'shipped')) {
            try {
              await supabase.functions.invoke('update-bol-tracking', {
                body: {
                  order_id: order.id,
                  tracking_number: order.tracking_number,
                  carrier: carrier,
                },
              });
              console.log(`Triggered Bol.com tracking update for order ${order.order_number}`);
            } catch (bolErr) {
              console.error(`Bol.com tracking update error (non-fatal) for ${order.id}:`, bolErr);
            }
          }
        }

        if (statusChanged) {
          await supabase.from("shipping_status_updates").insert([{
            tenant_id: setting.tenant_id,
            order_id: order.id,
            provider: carrier,
            external_event_id: `${carrier}-${order.tracking_number}-${newStatus}-${Date.now()}`,
            status: newStatus,
            status_message: result.description || STATUS_LABELS[newStatus] || newStatus,
            location: result.location,
            event_timestamp: result.timestamp || new Date().toISOString(),
            raw_payload: result,
          }]);

          // Trigger notifications based on tenant settings
          if (
            (newStatus === "delivered" && setting.notify_on_delivered) ||
            (newStatus === "exception" && setting.notify_on_exception) ||
            (newStatus === "out_for_delivery" && setting.notify_on_out_for_delivery) ||
            (newStatus === "in_transit" && setting.notify_on_shipped)
          ) {
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
                  tracking_number: order.tracking_number,
                  tracking_status: newStatus,
                  carrier: carrier,
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

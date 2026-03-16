import { createClient } from "https://esm.sh/@supabase/supabase-js@2?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("POLL-TRACKING-STATUS v6 BPOST-FIX DEPLOYED");

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

  if (/^3S/.test(tn)) return "postnl";
  if (/^JD\d{16,}$/.test(tn) || /^JVGL/.test(tn)) return "dhl";
  if (/^(CD|LX)/.test(tn)) return "bpost";
  if (/^3232\d{20,}$/.test(tn)) return "bpost";
  if (/^00340/.test(tn) || /^\d{14,15}$/.test(tn)) return "dpd";
  if (/^GLS/.test(tn) || /^\d{8,11}$/.test(tn)) return "gls";

  if (existingCarrier) {
    const norm = existingCarrier.toLowerCase().replace(/[_-]/g, '');
    if (norm.includes('bpost')) return 'bpost';
    if (norm.includes('postnl') || norm === 'tnt') return 'postnl';
    if (norm.includes('dhl')) return 'dhl';
    if (norm.includes('dpd')) return 'dpd';
    if (norm.includes('gls')) return 'gls';
    return existingCarrier.toLowerCase().replace(/[_-]/g, '');
  }

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
    const colli = data?.colli?.[trackingNumber] || data?.colli?.[0];
    if (!colli) return null;
    const lastEvent = colli.statusPhase?.toString() || "";
    const status = colli.status?.toString() || "";
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
    const res = await fetch(
      `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) {
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

async function fetchBpost(trackingNumber: string, postalCode?: string): Promise<{ status: string; description: string; location?: string; timestamp?: string } | null> {
  try {
    let url = `https://track.bpost.cloud/track/items?itemIdentifier=${trackingNumber}`;
    if (postalCode) {
      const normalizedPostal = postalCode.replace(/\s+/g, '').toUpperCase();
      url += `&postalCode=${normalizedPostal}`;
    }
    console.log(`bpost fetch: ${url}`);

    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`bpost HTTP ${res.status}: ${body.substring(0, 200)}`);
      return null;
    }

    const text = await res.text();
    if (!text || text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
      console.error(`bpost returned HTML instead of JSON: ${text.substring(0, 100)}`);
      return null;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`bpost JSON parse error: ${text.substring(0, 200)}`);
      return null;
    }

    const items = data?.items as Array<Record<string, unknown>> | undefined;
    const item = items?.[0];
    if (!item) {
      console.log(`bpost: no items found for ${trackingNumber}`);
      return null;
    }

    const events = item.events as Array<Record<string, unknown>> | undefined;
    const lastEvent = events?.[0];

    // Extract description from nested key structure (NL > EN > FR > DE fallback)
    let description = '';
    if (lastEvent?.key && typeof lastEvent.key === 'object') {
      const keyObj = lastEvent.key as Record<string, Record<string, string>>;
      description = keyObj?.NL?.description || keyObj?.EN?.description ||
                    keyObj?.FR?.description || keyObj?.DE?.description || '';
    }
    if (!description && typeof lastEvent?.key === 'string') {
      description = lastEvent.key as string;
    }

    // Also check stateInfo for status
    const stateInfo = item.stateInfo as Record<string, unknown> | undefined;
    const stateDescription = stateInfo?.stateDescription as string || '';

    const statusKey = description || stateDescription || '';
    console.log(`bpost status for ${trackingNumber}: "${statusKey}"`);

    return {
      status: normalizeStatus(statusKey),
      description: description || stateDescription || 'Status onbekend',
      location: lastEvent?.location ? (lastEvent.location as Record<string, string>)?.name : undefined,
      timestamp: (lastEvent?.date as string) || new Date().toISOString(),
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

// ── Process a single order ──
async function processOrder(
  supabase: ReturnType<typeof createClient>,
  order: Record<string, unknown>,
  setting: Record<string, unknown>,
): Promise<boolean> {
  const carrier = detectCarrier(order.tracking_number as string, order.carrier as string | null);
  if (!carrier) {
    console.log(`Cannot detect carrier for ${order.tracking_number}`);
    return false;
  }

  const result = await fetchTrackingStatus(carrier, order.tracking_number as string);
  if (!result) return false;

  const newStatus = result.status;
  const statusChanged = order.tracking_status !== newStatus;

  const orderUpdate: Record<string, unknown> = {
    tracking_status: newStatus,
    last_tracking_check: new Date().toISOString(),
    carrier: carrier,
  };

  if (newStatus === "delivered" && order.tracking_status !== "delivered") {
    orderUpdate.status = "delivered";
    orderUpdate.delivered_at = new Date().toISOString();
    orderUpdate.fulfillment_status = "delivered";
  }

  await supabase.from("orders").update(orderUpdate).eq("id", order.id);

  if (statusChanged) {
    // Check Bol.com sync
    const { data: orderMeta } = await supabase
      .from("orders")
      .select("marketplace_source, marketplace_connection_id, sync_status")
      .eq("id", order.id)
      .single();

    if (orderMeta?.marketplace_source === 'bol_com' && orderMeta?.marketplace_connection_id &&
        (orderMeta?.sync_status === 'shipped_awaiting_tracking' || orderMeta?.sync_status === 'shipped')) {
      try {
        await supabase.functions.invoke('update-bol-tracking', {
          body: { order_id: order.id, tracking_number: order.tracking_number, carrier },
        });
        console.log(`Triggered Bol.com tracking update for order ${order.order_number}`);
      } catch (bolErr) {
        console.error(`Bol.com tracking update error (non-fatal) for ${order.id}:`, bolErr);
      }
    }

    // Log status update
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

    // Trigger merchant notifications
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
            carrier,
          },
        }]);
      } catch (notifErr) {
        console.error("Error creating notification:", notifErr);
      }
    }

    return true;
  }

  return false;
}

// ── Parallel batch processor (max concurrency) ──
async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        .or("tracking_status.is.null,tracking_status.neq.delivered")
        .limit(10);

      if (ordersError) {
        console.error(`Error fetching orders for tenant ${setting.tenant_id}:`, ordersError);
        continue;
      }

      if (!orders || orders.length === 0) continue;

      console.log(`Polling ${orders.length} orders for tenant ${setting.tenant_id}`);

      // Process up to 5 orders in parallel
      const results = await processInBatches(orders, 5, (order) =>
        processOrder(supabase, order, setting)
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) totalUpdated++;
        if (r.status === "rejected") console.error("Order processing failed:", r.reason);
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
});

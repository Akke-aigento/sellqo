import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// LAZY IMPORT: pdf-lib only when needed (heavy library, can crash isolate on boot)
let PDFDocument: any = null;
async function loadPdfLib() {
  if (!PDFDocument) {
    const module = await import("https://esm.sh/pdf-lib@1.17.1?bundle");
    PDFDocument = module.PDFDocument;
  }
  return PDFDocument;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VVBLabelRequest {
  order_id: string;
  carrier?: string;
  delivery_code?: string;
  retry?: boolean;
  label_id?: string;
  force_new?: boolean; // NEW: force create a new label, ignore stuck ones
}

// Crop A4 PDF to A6 (label is positioned top-left)
async function cropToA6(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const PDFDoc = await loadPdfLib();
  const pdfDoc = await PDFDoc.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  // Bol.com VVB labels span full A4 width but only use the top portion
  const LABEL_WIDTH = 595.28;  // Full A4 width (210mm)
  const LABEL_HEIGHT = 419.53; // Half A4 height (148mm)
  const { height } = page.getSize();

  page.setCropBox(0, height - LABEL_HEIGHT, LABEL_WIDTH, LABEL_HEIGHT);
  page.setMediaBox(0, height - LABEL_HEIGHT, LABEL_WIDTH, LABEL_HEIGHT);

  const newPdf = await PDFDoc.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);

  return await newPdf.save();
}

// Fetch with timeout to prevent hanging requests
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getBolAccessToken(credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const authString = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
  console.log("Requesting Bol.com access token, clientId starts with:", credentials.clientId.substring(0, 8) + "...");

  const response = await fetchWithTimeout(
    "https://login.bol.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: "grant_type=client_credentials",
    },
    15000,
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Token request failed:", response.status, error);
    throw new Error(`Failed to get Bol.com access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log("Got Bol.com access token, expires in:", data.expires_in);
  return data.access_token;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('=== VVB LABEL v2 DEPLOYED ===');
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      order_id,
      carrier = "POSTNL",
      delivery_code = "1-2d",
      retry = false,
      label_id,
      force_new = false,
    }: VVBLabelRequest = await req.json();
    console.log("Request received:", JSON.stringify({ order_id, carrier, retry, label_id, force_new }));

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order with items
    console.log("Fetching order from database...");
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return new Response(JSON.stringify({ error: "Order not found", details: orderError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Order found:", order.order_number, "marketplace:", order.marketplace_source);

    // Verify this is a Bol.com order
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

    // Fetch marketplace connection for credentials and settings
    console.log("Fetching marketplace connection...");
    const { data: connection, error: connectionError } = await supabase
      .from("marketplace_connections")
      .select("credentials, settings")
      .eq("id", order.marketplace_connection_id)
      .single();

    if (connectionError || !connection) {
      console.error("Connection fetch error:", connectionError);
      return new Response(JSON.stringify({ error: "Marketplace connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentials = connection.credentials as { clientId: string; clientSecret: string };
    if (!credentials.clientId || !credentials.clientSecret) {
      return new Response(JSON.stringify({ error: "Bol.com credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings for default carrier and label format
    const settings =
      (connection.settings as {
        vvbDefaultCarrier?: string;
        vvbDefaultDeliveryCode?: string;
        vvbLabelFormat?: "a4_original" | "a6_cropped";
      }) || {};
    const finalCarrier = carrier || settings.vvbDefaultCarrier || "POSTNL";
    const labelFormat = settings.vvbLabelFormat || "a6_cropped";

    // Get access token
    const accessToken = await getBolAccessToken(credentials);

    // ===== RETRY MODE: Skip label creation, just download PDF + fetch tracking =====
    if (retry && label_id && !force_new) {
      console.log(`Retry mode: fetching PDF and tracking for existing label ${label_id}`);

      // Get the existing shipping_labels record to find external_id
      console.log("Looking up existing label in database...");
      let existingLabel: any = null;
      let labelLookupError: any = null;

      try {
        const result = await supabase.from("shipping_labels").select("*").eq("id", label_id).single();
        existingLabel = result.data;
        labelLookupError = result.error;
        console.log(
          "Label lookup result:",
          existingLabel
            ? `found (external_id: ${existingLabel.external_id}, status: ${existingLabel.status})`
            : "not found",
          labelLookupError ? `error: ${labelLookupError.message}` : "no error",
        );
      } catch (dbError) {
        console.error("FATAL: Database query threw exception:", dbError);
        return new Response(
          JSON.stringify({
            error: "Database query failed",
            details: dbError instanceof Error ? dbError.message : String(dbError),
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (labelLookupError || !existingLabel) {
        console.error("Label not found in database, label_id:", label_id);
        return new Response(JSON.stringify({ error: "Label record not found", label_id }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let retryLabelId = existingLabel.external_id;
      
      // If no external_id stored, try to find the label via Bol.com order API
      if (!retryLabelId) {
        console.log("No external_id stored, looking up existing label via Bol.com order API...");
        try {
          const orderLookupResponse = await fetchWithTimeout(
            `https://api.bol.com/retailer/orders/${order.marketplace_order_id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.retailer.v10+json",
              },
            },
            15000,
          );
          
          if (orderLookupResponse.ok) {
            const orderData = await orderLookupResponse.json();
            console.log("Bol.com order data received, checking for transport info...");
            
            // Extract transport info from order items
            let foundTracking: string | null = null;
            let foundCarrier: string | null = null;
            let foundTransportId: string | null = null;
            
            for (const item of (orderData.orderItems || [])) {
              const transport = item.fulfilment?.transport;
              if (transport) {
                if (transport.trackAndTrace) foundTracking = transport.trackAndTrace;
                if (transport.transporterCode) foundCarrier = transport.transporterCode;
                if (transport.transportId) foundTransportId = transport.transportId;
                console.log("Found transport info:", JSON.stringify(transport));
                break;
              }
            }
            
            // Update label record with any found info
            const updateData: Record<string, unknown> = {};
            if (foundTracking) updateData.tracking_number = foundTracking;
            if (foundCarrier) updateData.carrier = foundCarrier;
            if (foundTransportId) {
              updateData.external_id = foundTransportId;
              retryLabelId = foundTransportId;
            }
            
            if (Object.keys(updateData).length > 0) {
              await supabase.from("shipping_labels").update(updateData).eq("id", label_id);
              console.log("Updated label with Bol.com data:", JSON.stringify(updateData));
            }
            
            // Also update the order with tracking info
            if (foundTracking) {
              const orderUpdate: Record<string, unknown> = { tracking_number: foundTracking };
              if (foundCarrier) orderUpdate.carrier = foundCarrier;
              if (foundTracking) {
                orderUpdate.tracking_url = `https://jfrfracking.info/track/nl-NL/?B=${foundTracking}`;
              }
              await supabase.from("orders").update(orderUpdate).eq("id", order.id);
              console.log("Updated order with tracking:", foundTracking);
            }
            
            // If we still don't have an external_id, we can't fetch the PDF
            if (!retryLabelId) {
              console.log("No transportId found in Bol.com order data");
              return new Response(
                JSON.stringify({
                  error: "Label nog niet beschikbaar bij Bol.com. Probeer het over een paar minuten opnieuw.",
                  status: "pending",
                  message: "Het label wordt nog verwerkt door Bol.com. Probeer over een paar minuten opnieuw.",
                  tracking_number: foundTracking,
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
          } else {
            console.error("Bol.com order lookup failed:", orderLookupResponse.status);
            return new Response(
              JSON.stringify({
                error: "Kan label niet ophalen bij Bol.com. Probeer het later opnieuw.",
                status: "pending",
                message: "Label nog niet beschikbaar bij Bol.com.",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } catch (lookupError) {
          console.error("Bol.com order lookup error:", lookupError instanceof Error ? lookupError.message : lookupError);
          return new Response(
            JSON.stringify({
              error: "Fout bij ophalen label informatie. Probeer het later opnieuw.",
              status: "pending",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Race condition guard: if label already has a URL, another instance already fetched it
      if (existingLabel.label_url) {
        console.log("Label already has a URL, returning existing data");
        return new Response(
          JSON.stringify({
            success: true,
            label_url: existingLabel.label_url,
            tracking_number: existingLabel.tracking_number,
            retried: true,
            already_fetched: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let retryPdfUrl: string | null = null;
      let retryTracking: string | null = existingLabel.tracking_number;

      // Fetch PDF from Bol.com with timeout
      try {
        console.log("Fetching PDF from Bol.com, labelId:", retryLabelId);
        const pdfResponse = await fetchWithTimeout(
          `https://api.bol.com/retailer/shipping-labels/${retryLabelId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.retailer.v10+pdf",
            },
          },
          30000,
        );
        console.log("PDF response status:", pdfResponse.status);

        if (pdfResponse.status === 404) {
          console.log("Label not found at Bol.com (404) - marking as failed");
          await supabase
            .from("shipping_labels")
            .update({
              status: "failed",
            })
            .eq("id", label_id);

          return new Response(
            JSON.stringify({
              error: "Label niet gevonden bij Bol.com. Het label is mogelijk verlopen.",
              suggestion: "Maak een nieuw label aan.",
              shouldCreateNew: true,
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!pdfResponse.ok) {
          const errText = await pdfResponse.text();
          console.error("PDF fetch failed:", pdfResponse.status, errText);
          throw new Error(`PDF fetch failed: ${pdfResponse.status} - ${errText}`);
        }

        console.log("Reading PDF binary data...");
        const pdfBlob = await pdfResponse.blob();
        let pdfBuffer = await pdfBlob.arrayBuffer();
        console.log("PDF downloaded, size:", pdfBuffer.byteLength, "bytes");

        // Crop to A6 if needed
        if (labelFormat === "a6_cropped") {
          try {
            console.log("Cropping PDF to A6...");
            const croppedPdf = await cropToA6(pdfBuffer);
            pdfBuffer = new Uint8Array(croppedPdf).buffer as ArrayBuffer;
            console.log("PDF cropped to A6 successfully");
          } catch (cropError) {
            console.error("Error cropping PDF to A6 (using original):", cropError);
          }
        }

        // Upload to storage
        console.log("Uploading PDF to Supabase Storage...");
        const formatSuffix = labelFormat === "a6_cropped" ? "-a6" : "";
        const safeOrderNumber = (order.order_number || '').replace(/#/g, '');
        const fileName = `bol-vvb-${safeOrderNumber}${formatSuffix}-retry-${Date.now()}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("shipping-labels")
          .upload(`${order.tenant_id}/${fileName}`, pdfBuffer, { contentType: "application/pdf", upsert: true });

        if (uploadError) {
          console.error("PDF upload to storage failed:", uploadError);
          // Fallback: try to get existing file URL on 409
          if ((uploadError as any)?.statusCode === '409') {
            const { data: urlData } = supabase.storage
              .from("shipping-labels")
              .getPublicUrl(`${order.tenant_id}/${fileName}`);
            retryPdfUrl = urlData?.publicUrl || null;
            console.log("409 fallback - using existing URL:", retryPdfUrl);
          }
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("shipping-labels")
            .getPublicUrl(`${order.tenant_id}/${fileName}`);
          retryPdfUrl = urlData?.publicUrl || null;
          console.log("PDF uploaded, URL:", retryPdfUrl);
        }
      } catch (pdfError) {
        const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
        const errorStack = pdfError instanceof Error ? pdfError.stack : "";
        console.error("ERROR in retry PDF fetch:", errorMsg);
        console.error("Stack:", errorStack);

        // Check if it was an abort (timeout)
        if (errorMsg.includes("abort") || errorMsg.includes("AbortError")) {
          return new Response(
            JSON.stringify({
              error: "Bol.com API timeout - probeer later opnieuw",
              details: "Request timed out after 30 seconds",
            }),
            { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ error: "Failed to fetch shipping label", details: errorMsg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get tracking via HEAD (with timeout)
      if (!retryTracking) {
        try {
          console.log("Fetching tracking via HEAD request...");
          const headRes = await fetchWithTimeout(
            `https://api.bol.com/retailer/shipping-labels/${retryLabelId}`,
            {
              method: "HEAD",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.retailer.v10+json",
              },
            },
            15000,
          );
          retryTracking = headRes.headers.get("X-Track-And-Trace-Code") || null;
          console.log(`Retry HEAD tracking: ${retryTracking}, status: ${headRes.status}`);
        } catch (e) {
          console.error("Retry HEAD request failed (non-fatal):", e instanceof Error ? e.message : e);
        }
      }

      // If still no tracking, try fetching from order data (Bol.com may need time)
      if (!retryTracking) {
        try {
          console.log("No tracking from HEAD, fetching from Bol.com order data...");
          const orderTrackResponse = await fetchWithTimeout(
            `https://api.bol.com/retailer/orders/${order.marketplace_order_id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.retailer.v10+json",
              },
            },
            15000,
          );
          if (orderTrackResponse.ok) {
            const orderTrackData = await orderTrackResponse.json();
            for (const item of (orderTrackData.orderItems || [])) {
              const transport = item.fulfilment?.transport;
              if (transport?.trackAndTrace) {
                retryTracking = transport.trackAndTrace;
                console.log("Got tracking from order data:", retryTracking);
                break;
              }
            }
          }
        } catch (e) {
          console.error("Order tracking fetch failed (non-fatal):", e instanceof Error ? e.message : e);
        }
      }

      // Update the label record
      console.log("Updating label record in database...");
      const updateFields: Record<string, unknown> = {};
      if (retryPdfUrl) updateFields.label_url = retryPdfUrl;
      if (retryTracking) updateFields.tracking_number = retryTracking;
      if (retryPdfUrl) updateFields.status = "created"; // Mark as completed

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabase.from("shipping_labels").update(updateFields).eq("id", label_id);
        if (updateError) {
          console.error("Failed to update label record:", updateError);
        } else {
          console.log("Label record updated:", JSON.stringify(updateFields));
        }
      }

      // Update order if tracking found
      if (retryTracking) {
        const orderUpdateFields: Record<string, unknown> = {
          tracking_number: retryTracking,
          carrier: existingLabel.carrier,
          tracking_url: `https://jfrfracking.info/track/nl-NL/?B=${retryTracking}`,
        };
        await supabase
          .from("orders")
          .update(orderUpdateFields)
          .eq("id", order.id);
      }

      console.log("Retry completed successfully");
      return new Response(
        JSON.stringify({
          success: true,
          label_url: retryPdfUrl,
          tracking_number: retryTracking,
          retried: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== FORCE NEW: Delete stuck label and create fresh =====
    if (force_new && label_id) {
      console.log(`Force new mode: deleting stuck label ${label_id}`);
      await supabase.from("shipping_labels").delete().eq("id", label_id);
    }

    // ===== AUTO-ACCEPT: Mark order as accepted locally =====
    // Bol.com v10 FBR orders are auto-accepted. No API call needed.
    const currentSyncStatus = order.sync_status;
    if (currentSyncStatus !== "accepted" && currentSyncStatus !== "shipped") {
      console.log(
        `Order ${order.order_number} not yet accepted (sync_status: ${currentSyncStatus}), marking as accepted locally...`,
      );
      await supabase.from("orders").update({
        sync_status: "accepted",
        updated_at: new Date().toISOString(),
      }).eq("id", order_id);
    }

    // Get order items with Bol.com IDs
    const orderItems = order.order_items || [];
    const bolOrderItems = orderItems.filter(
      (item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id,
    );

    if (bolOrderItems.length === 0) {
      return new Response(JSON.stringify({ error: "No order items with Bol.com IDs found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get available shipping label offers
    console.log("Fetching delivery options from Bol.com...");
    const offersResponse = await fetchWithTimeout(
      `https://api.bol.com/retailer/shipping-labels/delivery-options`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          Accept: "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify({
          orderItems: bolOrderItems.map((item: { marketplace_order_item_id: string; quantity?: number }) => ({
            orderItemId: item.marketplace_order_item_id,
            quantity: item.quantity || 1,
          })),
        }),
      },
      30000,
    );

    if (!offersResponse.ok) {
      const errorText = await offersResponse.text();
      console.error("Bol.com delivery-options error:", offersResponse.status, errorText);
      
      // Detect "already shipped" scenario
      const alreadyShipped = offersResponse.status === 404 && errorText.includes('shipped already');
      if (alreadyShipped) {
        // Update order status to reflect reality
        await supabase.from('orders').update({ 
          sync_status: 'shipped', 
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        }).eq('id', order_id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Deze bestelling is al verzonden via Bol.com. Status is bijgewerkt.',
            code: 'ALREADY_SHIPPED',
            details: errorText,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to get shipping label offers: ${offersResponse.status}`,
          details: errorText,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const offersData = await offersResponse.json();
    console.log("Bol.com delivery-options response:", JSON.stringify(offersData));

    const deliveryOptions = offersData.deliveryOptions || [];
    console.log(`Found ${deliveryOptions.length} delivery options`);

    const allOffers = deliveryOptions.map((option: any) => ({
      shippingLabelOfferId: option.shippingLabelOfferId,
      transporterCode: option.transporterCode,
      labelType: option.labelType,
      labelPrice: option.labelPrice,
      packageRestrictions: option.packageRestrictions,
    }));
    console.log(
      `Mapped ${allOffers.length} offers:`,
      JSON.stringify(allOffers.map((o: any) => ({ id: o.shippingLabelOfferId, carrier: o.transporterCode }))),
    );

    let selectedOffer = allOffers.find(
      (offer: any) => (offer.transporterCode || "").toUpperCase() === finalCarrier.toUpperCase(),
    );

    if (!selectedOffer && allOffers.length > 0) {
      selectedOffer = allOffers[0];
      console.log(`Carrier ${finalCarrier} not found, using first available: ${selectedOffer.transporterCode}`);
    }

    if (!selectedOffer) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No shipping label offers available for this order",
          available_offers: deliveryOptions,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Create the shipping label
    console.log(
      `Creating shipping label with offerId: ${selectedOffer.shippingLabelOfferId}, carrier: ${selectedOffer.transporterCode}`,
    );
    const bolOrderItemIds = bolOrderItems.map(
      (item: { marketplace_order_item_id: string }) => item.marketplace_order_item_id,
    );
    const labelResponse = await fetchWithTimeout(
      `https://api.bol.com/retailer/shipping-labels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          Accept: "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify({
          orderItems: bolOrderItemIds.map((id: string) => ({ orderItemId: id })),
          shippingLabelOfferId: selectedOffer.shippingLabelOfferId,
        }),
      },
      30000,
    );

    if (!labelResponse.ok) {
      const errorText = await labelResponse.text();
      console.error("Bol.com create shipping-label error:", labelResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create transporter label: ${labelResponse.status}`,
          details: errorText,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const labelData = await labelResponse.json();
    console.log("Label creation response:", JSON.stringify(labelData));

    const processStatusId = labelData.processStatusId;
    let labelPdfUrl: string | null = null;
    let trackingNumber: string | null = null;
    let transporterLabelId: string | null = null;

    // Poll for process status (VVB labels are async)
    if (processStatusId) {
      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log(`Polling process-status attempt ${attempts + 1}/${maxAttempts}...`);

        const statusResponse = await fetchWithTimeout(
          `https://api.bol.com/shared/process-status/${processStatusId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.retailer.v10+json",
            },
          },
          15000,
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`Process status: ${statusData.status}`);

          if (statusData.status === "SUCCESS") {
            console.log("Process status SUCCESS, full response:", JSON.stringify(statusData));

            transporterLabelId = statusData.entityId || null;

            if (!transporterLabelId) {
              const links = statusData.links || [];
              const labelLink = links.find((l: { rel: string }) => l.rel === "self" || l.rel === "get");
              if (labelLink) {
                transporterLabelId = labelLink.href.split("/").pop();
              }
            }

            console.log("Extracted transporterLabelId:", transporterLabelId);
            break;
          } else if (statusData.status === "FAILURE") {
            console.error("VVB label creation failed:", JSON.stringify(statusData));
            return new Response(
              JSON.stringify({
                success: false,
                error: "VVB label creation failed at Bol.com",
                details: statusData.errorMessage || statusData,
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } else {
          console.error("Process status poll failed:", statusResponse.status);
        }

        attempts++;
      }

      if (attempts >= maxAttempts && !transporterLabelId) {
        console.warn("Max polling attempts reached without SUCCESS");
      }
    }

    // Step 3: Get the label PDF if we have the label ID
    if (transporterLabelId) {
      console.log("Fetching label PDF from Bol.com...");
      try {
        const pdfResponse = await fetchWithTimeout(
          `https://api.bol.com/retailer/shipping-labels/${transporterLabelId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.retailer.v10+pdf",
            },
          },
          30000,
        );

        console.log("PDF response status:", pdfResponse.status);

        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();
          let pdfBuffer = await pdfBlob.arrayBuffer();
          console.log("PDF downloaded, size:", pdfBuffer.byteLength);

          if (labelFormat === "a6_cropped") {
            try {
              const croppedPdf = await cropToA6(pdfBuffer);
              pdfBuffer = new Uint8Array(croppedPdf).buffer as ArrayBuffer;
              console.log("Successfully cropped PDF to A6 format");
            } catch (cropError) {
              console.error("Error cropping PDF to A6, using original:", cropError);
            }
          }

          const formatSuffix = labelFormat === "a6_cropped" ? "-a6" : "";
          const safeOrderNumber = (order.order_number || '').replace(/#/g, '');
          const fileName = `bol-vvb-${safeOrderNumber}${formatSuffix}-${Date.now()}.pdf`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("shipping-labels")
            .upload(`${order.tenant_id}/${fileName}`, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from("shipping-labels")
              .getPublicUrl(`${order.tenant_id}/${fileName}`);
            labelPdfUrl = urlData?.publicUrl || null;
            console.log("PDF uploaded to storage:", labelPdfUrl);
          } else if (uploadError) {
            console.error("PDF upload error:", uploadError);
            // Fallback: get existing file URL on 409
            if ((uploadError as any)?.statusCode === '409') {
              const { data: urlData } = supabase.storage
                .from("shipping-labels")
                .getPublicUrl(`${order.tenant_id}/${fileName}`);
              labelPdfUrl = urlData?.publicUrl || null;
              console.log("409 fallback - using existing URL:", labelPdfUrl);
            }
          }
        } else {
          console.error("PDF fetch failed:", pdfResponse.status, await pdfResponse.text());
        }
      } catch (pdfError) {
        console.error("Error fetching/storing PDF:", pdfError instanceof Error ? pdfError.message : pdfError);
      }

      // Get tracking info via HEAD request
      try {
        console.log("Fetching tracking info via HEAD...");
        const headResponse = await fetchWithTimeout(
          `https://api.bol.com/retailer/shipping-labels/${transporterLabelId}`,
          {
            method: "HEAD",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.retailer.v10+json",
            },
          },
          15000,
        );

        const headerTracking = headResponse.headers.get("X-Track-And-Trace-Code");
        console.log(`HEAD tracking header: ${headerTracking}, status: ${headResponse.status}`);
        if (headerTracking) {
          trackingNumber = headerTracking;
        }
      } catch (headError) {
        console.error("HEAD request for tracking failed:", headError instanceof Error ? headError.message : headError);
      }

      // If no tracking yet, wait 5 seconds and try fetching from order data
      if (!trackingNumber) {
        console.log("No tracking yet, waiting 5s for Bol.com to assign...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          const orderTrackResponse = await fetchWithTimeout(
            `https://api.bol.com/retailer/orders/${order.marketplace_order_id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.retailer.v10+json",
              },
            },
            15000,
          );
          if (orderTrackResponse.ok) {
            const orderTrackData = await orderTrackResponse.json();
            for (const item of (orderTrackData.orderItems || [])) {
              const transport = item.fulfilment?.transport;
              if (transport?.trackAndTrace) {
                trackingNumber = transport.trackAndTrace;
                console.log("Got delayed tracking from order data:", trackingNumber);
                break;
              }
            }
          }
        } catch (e) {
          console.error("Delayed tracking fetch failed:", e instanceof Error ? e.message : e);
        }
      }
    }

    // Create shipping label record
    console.log("Saving shipping label to database...");
    const { data: label, error: labelError } = await supabase
      .from("shipping_labels")
      .insert([
        {
          tenant_id: order.tenant_id,
          order_id: order.id,
          provider: "bol_vvb",
          external_id: transporterLabelId,
          carrier: selectedOffer.transporterCode,
          tracking_number: trackingNumber,
          label_url: labelPdfUrl,
          status: transporterLabelId ? "created" : "pending",
        },
      ])
      .select()
      .single();

    if (labelError) {
      console.error("Error saving label:", labelError);
    } else {
      console.log("Label saved, id:", label?.id);
    }

    // Update order status based on result
    if (transporterLabelId && trackingNumber) {
      console.log("Label complete with tracking, marking order as shipped...");
      await supabase
        .from("orders")
        .update({
          carrier: selectedOffer.transporterCode,
          tracking_number: trackingNumber,
          status: "shipped",
          shipped_at: new Date().toISOString(),
          fulfillment_status: "shipped",
          sync_status: "shipped",
        })
        .eq("id", order.id);

      // Confirm shipment at Bol.com
      try {
        console.log(`Confirming shipment to Bol.com for order ${order.order_number}...`);
        const confirmRes = await fetchWithTimeout(
          `${supabaseUrl}/functions/v1/confirm-bol-shipment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: order.id,
              tracking_number: trackingNumber,
              carrier: selectedOffer.transporterCode,
            }),
          },
          30000,
        );
        const confirmBody = await confirmRes.text();
        if (confirmRes.ok) {
          console.log(`Shipment confirmed to Bol.com`);
        } else {
          console.error(`Failed to confirm shipment: ${confirmRes.status} ${confirmBody}`);
          await supabase
            .from("orders")
            .update({
              marketplace_sync_error: `Shipment confirmation failed: ${confirmBody}`,
            })
            .eq("id", order.id);
        }
      } catch (confirmError) {
        console.error(
          "Shipment confirmation error (non-blocking):",
          confirmError instanceof Error ? confirmError.message : confirmError,
        );
      }
    } else {
      console.warn(`VVB label incomplete: transporterLabelId=${transporterLabelId}, trackingNumber=${trackingNumber}`);
      const partialUpdate: Record<string, unknown> = {
        carrier: selectedOffer.transporterCode,
      };
      if (trackingNumber) partialUpdate.tracking_number = trackingNumber;
      if (labelPdfUrl) partialUpdate.label_url = labelPdfUrl;

      await supabase.from("orders").update(partialUpdate).eq("id", order.id);
    }

    console.log(`Successfully completed VVB label flow for order ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        label: label,
        tracking_number: trackingNumber,
        label_url: labelPdfUrl,
        carrier: selectedOffer.transporterCode,
        transporter_label_id: transporterLabelId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("FATAL Error creating VVB label:", errorMsg);
    console.error("Stack:", errorStack);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handler);

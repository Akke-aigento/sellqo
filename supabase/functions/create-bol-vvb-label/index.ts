import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VVBLabelRequest {
  order_id: string;
  carrier?: string;
  delivery_code?: string;
  retry?: boolean;
  label_id?: string;
}

// Crop A4 PDF to A6 (label is positioned top-left)
async function cropToA6(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  
  const A6_WIDTH = 297.64;
  const A6_HEIGHT = 419.53;
  const { height } = page.getSize();
  
  page.setCropBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  page.setMediaBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);
  
  return await newPdf.save();
}

async function getBolAccessToken(credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const authString = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
  console.log('Requesting Bol.com access token, clientId starts with:', credentials.clientId.substring(0, 8) + '...');
  
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
    console.error('Token request failed:', response.status, error);
    throw new Error(`Failed to get Bol.com access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Got Bol.com access token, expires in:', data.expires_in);
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

    const { order_id, carrier = 'POSTNL', delivery_code = '1-2d', retry = false, label_id }: VVBLabelRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with items
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

    // Fetch marketplace connection for credentials and settings
    const { data: connection, error: connectionError } = await supabase
      .from("marketplace_connections")
      .select("credentials, settings")
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

    // Get settings for default carrier and label format
    const settings = connection.settings as { 
      vvbDefaultCarrier?: string; 
      vvbDefaultDeliveryCode?: string;
      vvbLabelFormat?: 'a4_original' | 'a6_cropped';
    } || {};
    const finalCarrier = carrier || settings.vvbDefaultCarrier || 'POSTNL';
    const labelFormat = settings.vvbLabelFormat || 'a6_cropped';

    // Get access token
    const accessToken = await getBolAccessToken(credentials);

    // ===== RETRY MODE: Skip label creation, just download PDF + fetch tracking =====
    if (retry && label_id) {
      console.log(`Retry mode: fetching PDF and tracking for existing label ${label_id}`);
      
      // Get the existing shipping_labels record to find external_id
      const { data: existingLabel, error: labelLookupError } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('id', label_id)
        .single();
      
      if (labelLookupError || !existingLabel) {
        return new Response(
          JSON.stringify({ error: 'Label record not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const retryLabelId = existingLabel.external_id;
      if (!retryLabelId) {
        return new Response(
          JSON.stringify({ error: 'Label has no external_id (transporterLabelId)' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Race condition guard: if label already has a URL, another instance already fetched it
      if (existingLabel.label_url) {
        console.log('Label already has a URL, skipping retry (likely fetched by another instance)');
        return new Response(
          JSON.stringify({
            success: true,
            label_url: existingLabel.label_url,
            tracking_number: existingLabel.tracking_number,
            retried: true,
            already_fetched: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let retryPdfUrl: string | null = null;
      let retryTracking: string | null = existingLabel.tracking_number;

      try {
        // Download PDF
        console.log('Fetching PDF from Bol.com, labelId:', retryLabelId);
        const pdfResponse = await fetch(
          `https://api.bol.com/retailer/shipping-labels/${retryLabelId}`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/vnd.retailer.v10+pdf",
            },
          }
        );
        console.log('PDF response status:', pdfResponse.status);

        if (pdfResponse.status === 404) {
          console.log('Label not ready yet (404), returning 202 pending');
          return new Response(
            JSON.stringify({ 
              status: 'pending', 
              message: 'Label wordt nog verwerkt door Bol.com. Probeer over 30 seconden opnieuw.' 
            }),
            { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!pdfResponse.ok) {
          const errText = await pdfResponse.text();
          console.error('PDF fetch failed:', pdfResponse.status, errText);
          throw new Error(`PDF fetch failed: ${pdfResponse.status} - ${errText}`);
        }

        const pdfBlob = await pdfResponse.blob();
        let pdfBuffer = await pdfBlob.arrayBuffer();
        console.log('PDF downloaded, size:', pdfBuffer.byteLength);
        
        if (labelFormat === 'a6_cropped') {
          try {
            const croppedPdf = await cropToA6(pdfBuffer);
            pdfBuffer = new Uint8Array(croppedPdf).buffer as ArrayBuffer;
            console.log('PDF cropped to A6');
          } catch (cropError) {
            console.error('Error cropping PDF to A6:', cropError);
          }
        }
        
        const formatSuffix = labelFormat === 'a6_cropped' ? '-a6' : '';
        const fileName = `bol-vvb-${order.order_number}${formatSuffix}-retry-${Date.now()}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shipping-labels')
          .upload(`${order.tenant_id}/${fileName}`, pdfBuffer, { contentType: 'application/pdf' });

        if (uploadError) {
          console.error('PDF upload failed:', uploadError);
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('shipping-labels')
            .getPublicUrl(`${order.tenant_id}/${fileName}`);
          retryPdfUrl = urlData?.publicUrl || null;
          console.log('PDF uploaded, URL:', retryPdfUrl);
        }
      } catch (pdfError) {
        console.error('CRASH in retry PDF fetch:', pdfError instanceof Error ? pdfError.message : pdfError, pdfError instanceof Error ? pdfError.stack : '');
        return new Response(
          JSON.stringify({ error: 'Failed to fetch shipping label', details: pdfError instanceof Error ? pdfError.message : 'Unknown error' }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get tracking via HEAD
      if (!retryTracking) {
        try {
          console.log('Fetching tracking via HEAD request...');
          const headRes = await fetch(
            `https://api.bol.com/retailer/shipping-labels/${retryLabelId}`,
            {
              method: "HEAD",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/vnd.retailer.v10+json",
              },
            }
          );
          retryTracking = headRes.headers.get('X-Track-And-Trace-Code') || null;
          console.log(`Retry HEAD tracking: ${retryTracking}, status: ${headRes.status}`);
        } catch (e) {
          console.error('Retry HEAD request failed:', e);
        }
      }

      // Update the label record
      const updateFields: Record<string, unknown> = {};
      if (retryPdfUrl) updateFields.label_url = retryPdfUrl;
      if (retryTracking) updateFields.tracking_number = retryTracking;

      if (Object.keys(updateFields).length > 0) {
        await supabase.from('shipping_labels').update(updateFields).eq('id', label_id);
        console.log('Label record updated:', JSON.stringify(updateFields));
      }

      // Update order if tracking found
      if (retryTracking) {
        await supabase.from('orders').update({
          tracking_number: retryTracking,
          carrier: existingLabel.carrier,
        }).eq('id', order.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          label_url: retryPdfUrl,
          tracking_number: retryTracking,
          retried: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== BUG 2 FIX: Auto-accept order if not yet accepted =====
    const currentSyncStatus = order.sync_status;
    if (currentSyncStatus !== 'accepted' && currentSyncStatus !== 'shipped') {
      console.log(`Order ${order.order_number} not yet accepted (sync_status: ${currentSyncStatus}), auto-accepting first...`);
      try {
        const acceptRes = await fetch(`${supabaseUrl}/functions/v1/accept-bol-order`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: order.id,
            connection_id: order.marketplace_connection_id
          })
        });
        const acceptBody = await acceptRes.text();
        if (acceptRes.ok) {
          console.log(`Order ${order.order_number} auto-accepted successfully: ${acceptBody}`);
        } else if (acceptRes.status === 500 && acceptBody.includes('403')) {
          // 403 from Bol.com means already accepted manually
          console.log(`Order ${order.order_number} already accepted at Bol.com (403), continuing...`);
          await supabase.from('orders').update({ sync_status: 'accepted' }).eq('id', order.id);
        } else {
          console.error(`Failed to auto-accept order ${order.order_number}: ${acceptRes.status} ${acceptBody}`);
          // Don't block VVB label creation - continue anyway
        }
        // Small delay after accept before creating label
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (acceptError) {
        console.error('Auto-accept error (non-blocking):', acceptError);
      }
    }

    // Get order items with Bol.com IDs
    const orderItems = order.order_items || [];
    
    // BUG 7 FIX: Filter items WITH marketplace IDs and keep the full item for quantity access
    const bolOrderItems = orderItems.filter(
      (item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id
    );

    if (bolOrderItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No order items with Bol.com IDs found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get available shipping label offers
    // BUG 7 FIX: Use quantity from the filtered item directly instead of index-based lookup
    const offersResponse = await fetch(
      `https://api.bol.com/retailer/shipping-labels/delivery-options`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          "Accept": "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify({
          orderItems: bolOrderItems.map((item: { marketplace_order_item_id: string; quantity?: number }) => ({
            orderItemId: item.marketplace_order_item_id,
            quantity: item.quantity || 1,
          })),
        }),
      }
    );

    if (!offersResponse.ok) {
      const errorText = await offersResponse.text();
      console.error("Bol.com shipping-labels error:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to get shipping label offers: ${offersResponse.status}`,
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    console.log(`Mapped ${allOffers.length} offers:`, JSON.stringify(allOffers.map((o: any) => ({ id: o.shippingLabelOfferId, carrier: o.transporterCode }))));
    
    let selectedOffer = allOffers.find(
      (offer: any) => (offer.transporterCode || '').toUpperCase() === finalCarrier.toUpperCase()
    );
    
    if (!selectedOffer && allOffers.length > 0) {
      selectedOffer = allOffers[0];
    }

    if (!selectedOffer) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No shipping label offers available for this order",
          available_offers: deliveryOptions
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Create the shipping label
    console.log(`Creating shipping label with offerId: ${selectedOffer.shippingLabelOfferId}, carrier: ${selectedOffer.transporterCode}`);
    const bolOrderItemIds = bolOrderItems.map((item: { marketplace_order_item_id: string }) => item.marketplace_order_item_id);
    const labelResponse = await fetch(
      `https://api.bol.com/retailer/shipping-labels`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.retailer.v10+json",
          "Accept": "application/vnd.retailer.v10+json",
        },
        body: JSON.stringify({
          orderItems: bolOrderItemIds.map((id: string) => ({ orderItemId: id })),
          shippingLabelOfferId: selectedOffer.shippingLabelOfferId,
        }),
      }
    );

    if (!labelResponse.ok) {
      const errorText = await labelResponse.text();
      console.error("Bol.com shipping-labels error:", labelResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create transporter label: ${labelResponse.status}`,
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const labelData = await labelResponse.json();
    
    const processStatusId = labelData.processStatusId;
    let labelPdfUrl: string | null = null;
    let trackingNumber: string | null = null;
    let transporterLabelId: string | null = null;

    // Poll for process status (VVB labels are async)
    if (processStatusId) {
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`Polling process-status attempt ${attempts + 1}/${maxAttempts}...`);
        
        const statusResponse = await fetch(
          `https://api.bol.com/retailer/process-status/${processStatusId}`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/vnd.retailer.v10+json",
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'SUCCESS') {
            console.log('Process status SUCCESS, full response:', JSON.stringify(statusData));
            
            // Bol.com v10: entityId bevat het shipping label ID
            transporterLabelId = statusData.entityId || null;
            
            // Fallback: probeer uit links te halen
            if (!transporterLabelId) {
              const links = statusData.links || [];
              const labelLink = links.find((l: { rel: string }) => l.rel === 'self' || l.rel === 'get');
              if (labelLink) {
                transporterLabelId = labelLink.href.split('/').pop();
              }
            }
            
            console.log('Extracted transporterLabelId:', transporterLabelId);
            break;
          } else if (statusData.status === 'FAILURE') {
            console.error('VVB label creation failed:', JSON.stringify(statusData));
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "VVB label creation failed",
                details: statusData.errorMessage || statusData 
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // PENDING - continue polling
          console.log(`Process status: ${statusData.status}, attempt ${attempts + 1}/${maxAttempts}`);
        }
        
        attempts++;
      }
    }

    // Step 3: Get the label PDF if we have the label ID
    if (transporterLabelId) {
      const pdfResponse = await fetch(
        `https://api.bol.com/retailer/shipping-labels/${transporterLabelId}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/vnd.retailer.v10+pdf",
          },
        }
      );

      if (pdfResponse.ok) {
        const pdfBlob = await pdfResponse.blob();
        let pdfBuffer = await pdfBlob.arrayBuffer();
        
        if (labelFormat === 'a6_cropped') {
          try {
            const croppedPdf = await cropToA6(pdfBuffer);
            pdfBuffer = new Uint8Array(croppedPdf).buffer as ArrayBuffer;
            console.log('Successfully cropped PDF to A6 format');
          } catch (cropError) {
            console.error('Error cropping PDF to A6, using original:', cropError);
          }
        }
        
        const formatSuffix = labelFormat === 'a6_cropped' ? '-a6' : '';
        const fileName = `bol-vvb-${order.order_number}${formatSuffix}-${Date.now()}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shipping-labels')
          .upload(`${order.tenant_id}/${fileName}`, pdfBuffer, {
            contentType: 'application/pdf',
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('shipping-labels')
            .getPublicUrl(`${order.tenant_id}/${fileName}`);
          labelPdfUrl = urlData?.publicUrl || null;
        }
      }

      // Get tracking info via HEAD request (Bol.com v10: tracking in response header)
      try {
        const headResponse = await fetch(
          `https://api.bol.com/retailer/shipping-labels/${transporterLabelId}`,
          {
            method: "HEAD",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/vnd.retailer.v10+json",
            },
          }
        );
        
        const headerTracking = headResponse.headers.get('X-Track-And-Trace-Code');
        console.log(`HEAD tracking header: ${headerTracking}, status: ${headResponse.status}`);
        if (headerTracking) {
          trackingNumber = headerTracking;
        }
      } catch (headError) {
        console.error('HEAD request for tracking failed:', headError);
      }
    }

    // Create shipping label record
    const { data: label, error: labelError } = await supabase
      .from("shipping_labels")
      .insert([{
        tenant_id: order.tenant_id,
        order_id: order.id,
        provider: 'bol_vvb',
        external_id: transporterLabelId,
        carrier: selectedOffer.transporterCode,
        tracking_number: trackingNumber,
        label_url: labelPdfUrl,
        status: "created",
      }])
      .select()
      .single();

    if (labelError) {
      console.error("Error saving label:", labelError);
    }

    // ===== BUG 6 FIX: Only set "shipped" status if label + tracking were successful =====
    if (transporterLabelId && trackingNumber) {
      // ===== BUG 5 FIX: Use sync_status consistently =====
      await supabase
        .from("orders")
        .update({
          carrier: selectedOffer.transporterCode,
          tracking_number: trackingNumber,
          status: "shipped",
          shipped_at: new Date().toISOString(),
          fulfillment_status: "shipped",
          sync_status: 'shipped',
        })
        .eq("id", order.id);

      // ===== BUG 1 FIX: Confirm shipment at Bol.com =====
      try {
        console.log(`Confirming shipment to Bol.com for order ${order.order_number}...`);
        const confirmRes = await fetch(`${supabaseUrl}/functions/v1/confirm-bol-shipment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: order.id,
            tracking_number: trackingNumber,
            carrier: selectedOffer.transporterCode,
          })
        });
        const confirmBody = await confirmRes.text();
        if (confirmRes.ok) {
          console.log(`Shipment confirmed to Bol.com for order ${order.order_number}: ${confirmBody}`);
        } else {
          console.error(`Failed to confirm shipment to Bol.com: ${confirmRes.status} ${confirmBody}`);
          // Store error but don't fail the whole operation
          await supabase.from('orders').update({
            marketplace_sync_error: `Shipment confirmation failed: ${confirmBody}`,
          }).eq('id', order.id);
        }
      } catch (confirmError) {
        console.error('Shipment confirmation error (non-blocking):', confirmError);
      }
    } else {
      // Label created but incomplete - update what we have without marking as shipped
      console.warn(`VVB label incomplete for order ${order.order_number}: transporterLabelId=${transporterLabelId}, trackingNumber=${trackingNumber}`);
      const partialUpdate: Record<string, unknown> = {
        carrier: selectedOffer.transporterCode,
      };
      if (trackingNumber) partialUpdate.tracking_number = trackingNumber;
      if (labelPdfUrl) partialUpdate.label_url = labelPdfUrl;
      
      await supabase.from("orders").update(partialUpdate).eq("id", order.id);
    }

    console.log(`Successfully created VVB label for order ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        label: label,
        tracking_number: trackingNumber,
        label_url: labelPdfUrl,
        carrier: selectedOffer.transporterCode,
        transporter_label_id: transporterLabelId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error creating VVB label:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

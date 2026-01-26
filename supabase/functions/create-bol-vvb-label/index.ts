import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VVBLabelRequest {
  order_id: string;
  carrier?: string;
  delivery_code?: string;
}

// Crop A4 PDF to A6 (label is positioned top-left)
async function cropToA6(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  
  // A6 dimensions in PDF points (1 inch = 72 points)
  // A6 = 105mm × 148mm = 297.64 × 419.53 points
  const A6_WIDTH = 297.64;
  const A6_HEIGHT = 419.53;
  
  // Get page dimensions
  const { height } = page.getSize();
  
  // Crop box: top-left A6 portion
  // In PDF coordinates Y=0 is at bottom, so we calculate from top
  page.setCropBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  page.setMediaBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  
  // Create new PDF with only the cropped portion
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);
  
  return await newPdf.save();
}

async function getBolAccessToken(credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const response = await fetch("https://login.bol.com/token?grant_type=client_credentials", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
    },
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

    const { order_id, carrier = 'POSTNL', delivery_code = '1-2d' }: VVBLabelRequest = await req.json();

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

    // Get order items with Bol.com IDs
    const orderItems = order.order_items || [];
    const bolOrderItemIds = orderItems
      .filter((item: { marketplace_order_item_id?: string }) => item.marketplace_order_item_id)
      .map((item: { marketplace_order_item_id: string }) => item.marketplace_order_item_id);

    if (bolOrderItemIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No order items with Bol.com IDs found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get available shipping label offers
    const offersResponse = await fetch(
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
    
    // Find the best matching offer based on carrier preference
    const shippingLabelOffers = offersData.purchasableShippingLabels || [];
    let selectedOffer = shippingLabelOffers.find(
      (offer: { transporterCode: string }) => offer.transporterCode === finalCarrier
    );
    
    if (!selectedOffer && shippingLabelOffers.length > 0) {
      selectedOffer = shippingLabelOffers[0]; // Use first available offer
    }

    if (!selectedOffer) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No shipping label offers available for this order",
          available_offers: shippingLabelOffers
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Create the transporter label
    const labelResponse = await fetch(
      `https://api.bol.com/retailer/transporter-labels`,
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
      console.error("Bol.com transporter-labels error:", errorText);
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
    
    // The response contains a process status - we may need to poll for the label
    const processStatusId = labelData.processStatusId;
    let labelPdfUrl: string | null = null;
    let trackingNumber: string | null = null;
    let transporterLabelId: string | null = null;

    // Poll for process status (VVB labels are async)
    if (processStatusId) {
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
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
            // Get the label details from the links
            const links = statusData.links || [];
            const labelLink = links.find((l: { rel: string }) => l.rel === 'self');
            if (labelLink) {
              transporterLabelId = labelLink.href.split('/').pop();
            }
            break;
          } else if (statusData.status === 'FAILURE') {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "VVB label creation failed",
                details: statusData.errorMessage || statusData 
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        attempts++;
      }
    }

    // Step 3: Get the label PDF if we have the label ID
    if (transporterLabelId) {
      const pdfResponse = await fetch(
        `https://api.bol.com/retailer/transporter-labels/${transporterLabelId}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/pdf",
          },
        }
      );

      if (pdfResponse.ok) {
        // Store the PDF in Supabase storage
        const pdfBlob = await pdfResponse.blob();
        let pdfBuffer = await pdfBlob.arrayBuffer();
        
        // Crop to A6 if configured (default behavior)
        if (labelFormat === 'a6_cropped') {
          try {
            const croppedPdf = await cropToA6(pdfBuffer);
            pdfBuffer = new Uint8Array(croppedPdf).buffer as ArrayBuffer;
            console.log('Successfully cropped PDF to A6 format');
          } catch (cropError) {
            console.error('Error cropping PDF to A6, using original:', cropError);
            // Fall back to original PDF if cropping fails
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

      // Get tracking info from label details
      const detailsResponse = await fetch(
        `https://api.bol.com/retailer/transporter-labels/${transporterLabelId}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/vnd.retailer.v10+json",
          },
        }
      );

      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        trackingNumber = detailsData.trackAndTrace || null;
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

    // Update order with tracking info
    await supabase
      .from("orders")
      .update({
        carrier: selectedOffer.transporterCode,
        tracking_number: trackingNumber,
        status: "shipped",
        shipped_at: new Date().toISOString(),
        fulfillment_status: "shipped",
        marketplace_sync_status: 'shipped',
      })
      .eq("id", order.id);

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

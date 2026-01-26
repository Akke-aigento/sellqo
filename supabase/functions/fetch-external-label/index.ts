import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchLabelRequest {
  order_id: string;
  provider: "sendcloud" | "myparcel";
  search_type: "order_number" | "tracking_number";
  search_value: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, provider, search_type, search_value }: FetchLabelRequest = await req.json();

    if (!order_id || !provider || !search_type || !search_value) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order to find tenant_id
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tenant_id, order_number")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get shipping integration for this provider
    const { data: integration, error: integrationError } = await supabase
      .from("shipping_integrations")
      .select("*")
      .eq("tenant_id", order.tenant_id)
      .eq("provider", provider)
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: `Geen actieve ${provider} integratie gevonden` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parcelData: {
      tracking_number: string;
      carrier: string;
      label_url: string;
      external_id: string;
    } | null = null;

    // Fetch label based on provider
    if (provider === "sendcloud") {
      parcelData = await fetchSendcloudLabel(
        integration.api_key!,
        integration.api_secret!,
        search_type,
        search_value
      );
    } else if (provider === "myparcel") {
      parcelData = await fetchMyParcelLabel(
        integration.api_key!,
        search_type,
        search_value
      );
    }

    if (!parcelData) {
      return new Response(
        JSON.stringify({ error: "Geen label gevonden met deze zoekwaarde" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download and store the label PDF
    const labelResponse = await fetch(parcelData.label_url, {
      headers: provider === "sendcloud" 
        ? { Authorization: `Basic ${btoa(`${integration.api_key}:${integration.api_secret}`)}` }
        : { Authorization: `bearer ${integration.api_key}` },
    });

    if (!labelResponse.ok) {
      console.error("Failed to download label:", await labelResponse.text());
      // Continue anyway with the original URL
    }

    let storedLabelUrl = parcelData.label_url;

    // Try to store in Supabase Storage
    if (labelResponse.ok) {
      const pdfBytes = await labelResponse.arrayBuffer();
      const fileName = `${order.tenant_id}/${order_id}/${provider}-${parcelData.tracking_number}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("shipping-labels")
        .upload(fileName, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrl } = supabase.storage
          .from("shipping-labels")
          .getPublicUrl(fileName);
        storedLabelUrl = publicUrl.publicUrl;
      }
    }

    // Create shipping label record
    const { data: label, error: labelError } = await supabase
      .from("shipping_labels")
      .insert({
        tenant_id: order.tenant_id,
        order_id: order_id,
        integration_id: integration.id,
        provider,
        external_id: parcelData.external_id,
        carrier: parcelData.carrier,
        tracking_number: parcelData.tracking_number,
        label_url: storedLabelUrl,
        label_format: "pdf",
        status: "created",
        metadata: { fetched_from_external: true, original_url: parcelData.label_url },
      })
      .select()
      .single();

    if (labelError) {
      console.error("Error creating label record:", labelError);
      return new Response(
        JSON.stringify({ error: "Label record aanmaken mislukt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with tracking info
    await supabase
      .from("orders")
      .update({
        tracking_number: parcelData.tracking_number,
        carrier: parcelData.carrier,
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        success: true,
        label: {
          id: label.id,
          tracking_number: parcelData.tracking_number,
          carrier: parcelData.carrier,
          label_url: storedLabelUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in fetch-external-label:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchSendcloudLabel(
  apiKey: string,
  apiSecret: string,
  searchType: "order_number" | "tracking_number",
  searchValue: string
): Promise<{
  tracking_number: string;
  carrier: string;
  label_url: string;
  external_id: string;
} | null> {
  const authHeader = `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
  
  // Search for parcel
  const searchParam = searchType === "order_number" 
    ? `order_number=${encodeURIComponent(searchValue)}`
    : `tracking_number=${encodeURIComponent(searchValue)}`;

  const response = await fetch(
    `https://panel.sendcloud.sc/api/v2/parcels?${searchParam}`,
    {
      headers: { Authorization: authHeader },
    }
  );

  if (!response.ok) {
    console.error("Sendcloud API error:", await response.text());
    return null;
  }

  const data = await response.json();
  const parcels = data.parcels || [];

  if (parcels.length === 0) {
    return null;
  }

  // Take the most recent parcel
  const parcel = parcels[0];

  // Get label URL
  const labelUrl = parcel.label?.label_printer || 
                   parcel.label?.normal_printer ||
                   `https://panel.sendcloud.sc/api/v2/labels/label_printer/${parcel.id}`;

  return {
    tracking_number: parcel.tracking_number,
    carrier: parcel.carrier?.code || parcel.shipment?.name || "unknown",
    label_url: labelUrl,
    external_id: String(parcel.id),
  };
}

async function fetchMyParcelLabel(
  apiKey: string,
  searchType: "order_number" | "tracking_number",
  searchValue: string
): Promise<{
  tracking_number: string;
  carrier: string;
  label_url: string;
  external_id: string;
} | null> {
  const authHeader = `bearer ${apiKey}`;

  // Search for shipment
  const searchParam = searchType === "order_number"
    ? `reference_identifier=${encodeURIComponent(searchValue)}`
    : `barcode=${encodeURIComponent(searchValue)}`;

  const response = await fetch(
    `https://api.myparcel.nl/shipments?${searchParam}`,
    {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error("MyParcel API error:", await response.text());
    return null;
  }

  const data = await response.json();
  const shipments = data.data?.shipments || [];

  if (shipments.length === 0) {
    return null;
  }

  // Take the most recent shipment
  const shipment = shipments[0];
  const shipmentId = shipment.id;
  const barcode = shipment.barcode;

  // Get label URL - MyParcel uses a different endpoint
  const labelUrl = `https://api.myparcel.nl/shipment_labels/${shipmentId}?format=A6`;

  // Determine carrier
  let carrier = "postnl";
  if (shipment.carrier_id === 2) carrier = "bpost";
  if (shipment.carrier_id === 3) carrier = "dhl";
  if (shipment.carrier_id === 4) carrier = "dpd";

  return {
    tracking_number: barcode,
    carrier,
    label_url: labelUrl,
    external_id: String(shipmentId),
  };
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLabelRequest {
  order_id: string;
  integration_id?: string;
  carrier?: string;
  service_type?: string;
  weight_kg?: number;
  dimensions?: { length: number; width: number; height: number };
}

interface ShipmentAddress {
  name: string;
  company_name?: string;
  street: string;
  house_number?: string;
  city: string;
  postal_code: string;
  country: string;
  email?: string;
  phone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, integration_id, carrier, service_type, weight_kg, dimensions }: CreateLabelRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with customer info
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, customer:customers(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integration - either specified or default active one
    let integration;
    if (integration_id) {
      const { data, error } = await supabase
        .from("shipping_integrations")
        .select("*")
        .eq("id", integration_id)
        .single();
      if (error) throw error;
      integration = data;
    } else {
      const { data, error } = await supabase
        .from("shipping_integrations")
        .select("*")
        .eq("tenant_id", order.tenant_id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      integration = data;
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "No active shipping integration found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant for sender info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", order.tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse shipping address
    const shippingAddress = order.shipping_address as unknown as ShipmentAddress;
    if (!shippingAddress) {
      return new Response(
        JSON.stringify({ error: "Order has no shipping address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let labelResult: {
      success: boolean;
      tracking_number?: string;
      tracking_url?: string;
      label_url?: string;
      external_id?: string;
      external_parcel_id?: string;
      carrier?: string;
      error?: string;
    };

    // Check if order has service point
    const isServicePoint = order.delivery_type === 'service_point' && order.service_point_id;
    const servicePointData = order.service_point_data as { 
      id: string; 
      name: string; 
      carrier: string;
      address: { street: string; city: string; postal_code: string; country: string; house_number?: string };
    } | null;

    switch (integration.provider) {
      case "sendcloud": {
        const apiKey = integration.api_key;
        const apiSecret = integration.api_secret;

        if (!apiKey || !apiSecret) {
          labelResult = { success: false, error: "Sendcloud API credentials niet geconfigureerd" };
          break;
        }

        const credentials = btoa(`${apiKey}:${apiSecret}`);

        // Create parcel in Sendcloud
        const parcelData: Record<string, unknown> = {
          parcel: {
            name: order.customer_name || shippingAddress.name,
            company_name: shippingAddress.company_name || "",
            address: shippingAddress.street,
            city: shippingAddress.city,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country || "NL",
            email: order.customer_email,
            telephone: order.customer_phone || "",
            order_number: order.order_number,
            weight: Math.round((weight_kg || 1) * 1000), // Convert to grams
            request_label: true,
            shipment: {
              id: carrier ? parseInt(carrier) : 8, // Default to PostNL standard
            },
          },
        };

        // Add service point if selected
        if (isServicePoint && order.service_point_id) {
          (parcelData.parcel as Record<string, unknown>).to_service_point = parseInt(order.service_point_id);
        }

        const response = await fetch("https://panel.sendcloud.sc/api/v2/parcels", {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parcelData),
        });

        if (response.ok) {
          const data = await response.json();
          const parcel = data.parcel;
          labelResult = {
            success: true,
            tracking_number: parcel.tracking_number,
            tracking_url: parcel.tracking_url,
            label_url: parcel.label?.label_printer,
            external_id: String(parcel.id),
            carrier: parcel.carrier?.code,
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          labelResult = {
            success: false,
            error: errorData.error?.message || `Sendcloud error: ${response.status}`,
          };
        }
        break;
      }

      case "myparcel": {
        const apiKey = integration.api_key;

        if (!apiKey) {
          labelResult = { success: false, error: "MyParcel API key niet geconfigureerd" };
          break;
        }

        // MyParcel API format
        const shipmentData: Record<string, unknown> = {
          data: {
            shipments: [
              {
                recipient: {
                  cc: shippingAddress.country || "NL",
                  city: shippingAddress.city,
                  street: shippingAddress.street,
                  number: shippingAddress.house_number || "1",
                  postal_code: shippingAddress.postal_code,
                  person: order.customer_name || shippingAddress.name,
                  email: order.customer_email,
                  phone: order.customer_phone || "",
                },
                options: {
                  package_type: 1, // Package
                },
                carrier: 1, // PostNL
              },
            ],
          },
        };

        // Add pickup location if service point selected
        if (isServicePoint && servicePointData) {
          const shipments = (shipmentData.data as Record<string, unknown>).shipments as Record<string, unknown>[];
          shipments[0].pickup = {
            postal_code: servicePointData.address.postal_code,
            street: servicePointData.address.street,
            city: servicePointData.address.city,
            number: servicePointData.address.house_number || "1",
            location_name: servicePointData.name,
            location_code: order.service_point_id,
          };
        }

        const response = await fetch("https://api.myparcel.nl/shipments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(shipmentData),
        });

        if (response.ok) {
          const data = await response.json();
          const shipment = data.data?.shipments?.[0];
          labelResult = {
            success: true,
            tracking_number: shipment?.barcode,
            external_id: String(shipment?.id),
            carrier: "postnl",
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          labelResult = {
            success: false,
            error: errorData.message || `MyParcel error: ${response.status}`,
          };
        }
        break;
      }

      case "manual":
        labelResult = {
          success: false,
          error: "Handmatige modus ondersteunt geen automatische label generatie",
        };
        break;

      default:
        labelResult = {
          success: false,
          error: `Provider ${integration.provider} wordt nog niet ondersteund voor label generatie`,
        };
    }

    if (labelResult.success) {
      // Create shipping label record
      const { data: label, error: labelError } = await supabase
        .from("shipping_labels")
        .insert([{
          tenant_id: order.tenant_id,
          order_id: order.id,
          integration_id: integration.id,
          provider: integration.provider,
          external_id: labelResult.external_id,
          carrier: labelResult.carrier || carrier,
          service_type: service_type,
          tracking_number: labelResult.tracking_number,
          tracking_url: labelResult.tracking_url,
          label_url: labelResult.label_url,
          status: "created",
          weight_kg: weight_kg,
          dimensions: dimensions,
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
          carrier: labelResult.carrier || carrier,
          tracking_number: labelResult.tracking_number,
          tracking_url: labelResult.tracking_url,
          status: "shipped",
          shipped_at: new Date().toISOString(),
          fulfillment_status: "shipped",
        })
        .eq("id", order.id);

      return new Response(
        JSON.stringify({
          success: true,
          label: label,
          tracking_number: labelResult.tracking_number,
          tracking_url: labelResult.tracking_url,
          label_url: labelResult.label_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Save failed attempt
      await supabase
        .from("shipping_labels")
        .insert([{
          tenant_id: order.tenant_id,
          order_id: order.id,
          integration_id: integration.id,
          provider: integration.provider,
          status: "error",
          error_message: labelResult.error,
        }]);

      return new Response(
        JSON.stringify({ success: false, error: labelResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error creating shipping label:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

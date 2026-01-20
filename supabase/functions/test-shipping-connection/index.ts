import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestConnectionRequest {
  integration_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integration_id }: TestConnectionRequest = await req.json();

    if (!integration_id) {
      return new Response(
        JSON.stringify({ error: "integration_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the integration
    const { data: integration, error: fetchError } = await supabase
      .from("shipping_integrations")
      .select("*")
      .eq("id", integration_id)
      .single();

    if (fetchError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let testResult: { success: boolean; message: string; data?: unknown };

    switch (integration.provider) {
      case "sendcloud": {
        // Test Sendcloud API connection
        const apiKey = integration.api_key;
        const apiSecret = integration.api_secret;

        if (!apiKey || !apiSecret) {
          testResult = { success: false, message: "API Key en Secret zijn vereist" };
          break;
        }

        const credentials = btoa(`${apiKey}:${apiSecret}`);
        const response = await fetch("https://panel.sendcloud.sc/api/v2/user", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          testResult = {
            success: true,
            message: `Verbonden als ${data.user?.username || "gebruiker"}`,
            data: { username: data.user?.username, company: data.user?.company?.name },
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          testResult = {
            success: false,
            message: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        break;
      }

      case "myparcel": {
        // Test MyParcel API connection
        const apiKey = integration.api_key;

        if (!apiKey) {
          testResult = { success: false, message: "API Key is vereist" };
          break;
        }

        const response = await fetch("https://api.myparcel.nl/accounts", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          testResult = {
            success: true,
            message: "MyParcel verbinding succesvol",
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          testResult = {
            success: false,
            message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        break;
      }

      case "shippo": {
        // Test Shippo API connection
        const apiKey = integration.api_key;

        if (!apiKey) {
          testResult = { success: false, message: "API Key is vereist" };
          break;
        }

        const response = await fetch("https://api.goshippo.com/addresses/", {
          headers: {
            Authorization: `ShippoToken ${apiKey}`,
          },
        });

        if (response.ok) {
          testResult = {
            success: true,
            message: "Shippo verbinding succesvol",
          };
        } else {
          testResult = {
            success: false,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        break;
      }

      case "easypost": {
        // Test EasyPost API connection
        const apiKey = integration.api_key;

        if (!apiKey) {
          testResult = { success: false, message: "API Key is vereist" };
          break;
        }

        const credentials = btoa(`${apiKey}:`);
        const response = await fetch("https://api.easypost.com/v2/users", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        if (response.ok) {
          testResult = {
            success: true,
            message: "EasyPost verbinding succesvol",
          };
        } else {
          testResult = {
            success: false,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        break;
      }

      case "manual":
        testResult = {
          success: true,
          message: "Handmatige modus vereist geen API verbinding",
        };
        break;

      default:
        testResult = {
          success: false,
          message: `Onbekende provider: ${integration.provider}`,
        };
    }

    // Update last_sync_at if successful
    if (testResult.success) {
      await supabase
        .from("shipping_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration_id);
    }

    return new Response(JSON.stringify(testResult), {
      status: testResult.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error testing shipping connection:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestRequest {
  provider: "mailchimp" | "klaviyo";
  apiKey: string;
  serverPrefix?: string;
  audienceId?: string;
  listId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, apiKey, serverPrefix, audienceId, listId }: TestRequest = await req.json();

    if (provider === "mailchimp") {
      return await testMailchimp(apiKey, serverPrefix, audienceId);
    } else if (provider === "klaviyo") {
      return await testKlaviyo(apiKey, listId);
    }

    return new Response(
      JSON.stringify({ error: "Invalid provider" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Test connection error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testMailchimp(apiKey: string, serverPrefix?: string, audienceId?: string) {
  try {
    const server = serverPrefix || apiKey.split("-").pop();
    
    // Test API key by fetching account info
    const accountResponse = await fetch(
      `https://${server}.api.mailchimp.com/3.0/`,
      {
        headers: {
          "Authorization": `Basic ${btoa(`anystring:${apiKey}`)}`,
        },
      }
    );

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json();
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorData.detail || "Invalid API key",
          details: { apiKeyValid: false }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = await accountResponse.json();
    let audienceValid = false;
    let audienceInfo = null;

    // Test audience if provided
    if (audienceId) {
      const audienceResponse = await fetch(
        `https://${server}.api.mailchimp.com/3.0/lists/${audienceId}`,
        {
          headers: {
            "Authorization": `Basic ${btoa(`anystring:${apiKey}`)}`,
          },
        }
      );

      if (audienceResponse.ok) {
        audienceValid = true;
        const data = await audienceResponse.json();
        audienceInfo = {
          name: data.name,
          memberCount: data.stats.member_count,
        };
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        details: {
          apiKeyValid: true,
          accountName: accountData.account_name,
          email: accountData.email,
          audienceValid,
          audienceInfo,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function testKlaviyo(apiKey: string, listId?: string) {
  try {
    // Test API key by fetching account info
    const accountResponse = await fetch(
      `https://a.klaviyo.com/api/accounts/`,
      {
        headers: {
          "Authorization": `Klaviyo-API-Key ${apiKey}`,
          "revision": "2023-02-22",
        },
      }
    );

    if (!accountResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid API key",
          details: { apiKeyValid: false }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = await accountResponse.json();
    let listValid = false;
    let listInfo = null;

    // Test list if provided
    if (listId) {
      const listResponse = await fetch(
        `https://a.klaviyo.com/api/lists/${listId}`,
        {
          headers: {
            "Authorization": `Klaviyo-API-Key ${apiKey}`,
            "revision": "2023-02-22",
          },
        }
      );

      if (listResponse.ok) {
        listValid = true;
        const data = await listResponse.json();
        listInfo = {
          name: data.data.attributes.name,
        };
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        details: {
          apiKeyValid: true,
          accountName: accountData.data?.[0]?.attributes?.contact_information?.organization_name || "Klaviyo Account",
          listValid,
          listInfo,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

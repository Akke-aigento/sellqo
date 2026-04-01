import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_ADV_BASE = "https://api.bol.com/advertiser/sponsored-products/campaign-management";

const ADV_HEADERS = {
  Accept: "application/vnd.advertiser.v11+json",
  "Content-Type": "application/vnd.advertiser.v11+json",
};

async function getBolToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(BOL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function bolPut(token: string, url: string, body: unknown) {
  console.log(`PUT ${url}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, ...ADV_HEADERS },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok && res.status !== 207) throw new Error(`Bol API PUT (${res.status}): ${text.substring(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function bolPost(token: string, url: string, body: unknown) {
  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...ADV_HEADERS },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok && res.status !== 207) throw new Error(`Bol API POST (${res.status}): ${text.substring(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Action = "pause_campaign" | "resume_campaign" | "update_bid" | "add_negative_keyword" | "pause_keyword" | "resume_keyword" | "update_budget";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const { tenant_id, action, payload } = await req.json() as {
      tenant_id: string;
      action: Action;
      payload: Record<string, unknown>;
    };

    if (!tenant_id || !action || !payload) {
      return jsonRes({ error: "Missing tenant_id, action or payload" }, 400);
    }

    // Get Bol.com credentials
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("marketplace", "bolcom")
      .single();

    if (!conn) return jsonRes({ error: "Geen Bol.com connectie gevonden" }, 404);

    const creds = (conn.credentials || {}) as Record<string, string>;
    const clientId = creds.advertisingClientId || creds.client_id;
    const clientSecret = creds.advertisingClientSecret || creds.client_secret;
    if (!clientId || !clientSecret) return jsonRes({ error: "Bol.com advertising credentials ontbreken" }, 400);

    const token = await getBolToken(clientId, clientSecret);

    let detail: string;

    switch (action) {
      case "pause_campaign":
      case "resume_campaign": {
        const { campaign_id } = payload as { campaign_id: string };
        const { data: camp } = await supabase
          .from("ads_bolcom_campaigns")
          .select("bolcom_campaign_id")
          .eq("id", campaign_id)
          .eq("tenant_id", tenant_id)
          .single();
        if (!camp) return jsonRes({ error: "Campagne niet gevonden" }, 404);

        const newState = action === "pause_campaign" ? "PAUSED" : "ENABLED";
        await bolPut(token, `${BOL_ADV_BASE}/campaigns/${camp.bolcom_campaign_id}`, { state: newState });

        const dbStatus = action === "pause_campaign" ? "paused" : "active";
        await supabase
          .from("ads_bolcom_campaigns")
          .update({ status: dbStatus })
          .eq("id", campaign_id)
          .eq("tenant_id", tenant_id);

        detail = `Campaign ${dbStatus}`;
        break;
      }

      case "update_bid": {
        const { keyword_id, new_bid } = payload as { keyword_id: string; new_bid: number };
        const { data: kw } = await supabase
          .from("ads_bolcom_keywords")
          .select("bolcom_keyword_id")
          .eq("id", keyword_id)
          .eq("tenant_id", tenant_id)
          .single();

        if (kw?.bolcom_keyword_id) {
          await bolPut(token, `${BOL_ADV_BASE}/keywords/${kw.bolcom_keyword_id}`, { bid: new_bid });
        }

        await supabase
          .from("ads_bolcom_keywords")
          .update({ bid: new_bid })
          .eq("id", keyword_id)
          .eq("tenant_id", tenant_id);

        detail = `Bid updated to ${new_bid}`;
        break;
      }

      case "add_negative_keyword": {
        const { adgroup_id, keyword, match_type } = payload as { adgroup_id: string; keyword: string; match_type: string };
        const { data: ag } = await supabase
          .from("ads_bolcom_adgroups")
          .select("bolcom_adgroup_id")
          .eq("id", adgroup_id)
          .eq("tenant_id", tenant_id)
          .single();

        if (ag?.bolcom_adgroup_id) {
          try {
            await bolPost(token, `${BOL_ADV_BASE}/ad-groups/${ag.bolcom_adgroup_id}/negative-keywords`, {
              keywords: [{ keyword, matchType: match_type.toUpperCase() }],
            });
          } catch (e) {
            console.error("Bol API negative keyword error (continuing with local):", e);
          }
        }

        await supabase
          .from("ads_bolcom_keywords")
          .insert({
            adgroup_id,
            keyword,
            match_type,
            is_negative: true,
            status: "active",
            tenant_id,
          });

        detail = `Negative keyword '${keyword}' added`;
        break;
      }

      case "pause_keyword":
      case "resume_keyword": {
        const { keyword_id } = payload as { keyword_id: string };
        const { data: kw } = await supabase
          .from("ads_bolcom_keywords")
          .select("bolcom_keyword_id")
          .eq("id", keyword_id)
          .eq("tenant_id", tenant_id)
          .single();

        const kwState = action === "pause_keyword" ? "PAUSED" : "ENABLED";
        if (kw?.bolcom_keyword_id) {
          await bolPut(token, `${BOL_ADV_BASE}/keywords/${kw.bolcom_keyword_id}`, { state: kwState });
        }

        const dbStatus = action === "pause_keyword" ? "paused" : "active";
        await supabase
          .from("ads_bolcom_keywords")
          .update({ status: dbStatus })
          .eq("id", keyword_id)
          .eq("tenant_id", tenant_id);

        detail = `Keyword ${dbStatus}`;
        break;
      }

      case "update_budget": {
        const { campaign_id, daily_budget } = payload as { campaign_id: string; daily_budget: number };
        const { data: camp } = await supabase
          .from("ads_bolcom_campaigns")
          .select("bolcom_campaign_id")
          .eq("id", campaign_id)
          .eq("tenant_id", tenant_id)
          .single();
        if (!camp) return jsonRes({ error: "Campagne niet gevonden" }, 404);

        await bolPut(token, `${BOL_ADV_BASE}/campaigns/${camp.bolcom_campaign_id}`, { dailyBudget: daily_budget });

        await supabase
          .from("ads_bolcom_campaigns")
          .update({ daily_budget })
          .eq("id", campaign_id)
          .eq("tenant_id", tenant_id);

        detail = `Budget updated to ${daily_budget}`;
        break;
      }

      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }

    return jsonRes({ success: true, action, detail });
  } catch (err) {
    console.error("ads-bolcom-manage error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("RATE_LIMITED:")) {
      return jsonRes({ error: "Rate limited", retry_after: parseInt(msg.split(":")[1]) }, 429);
    }
    return jsonRes({ error: msg }, 500);
  }
});

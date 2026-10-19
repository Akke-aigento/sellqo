// MAIL-1a (19-10-2026) — zet een campagne in de wachtrij; de worker
// process-campaign-queue verstuurt. Vroeger verstuurde deze functie zelf,
// maximaal 50 mails per campagne, zie _shared/campaignQueue.ts.
//
// Body:
//   { campaign_id }                                   → versturen: { queued, total_recipients }
//   { campaign_id, mode: "count" }                    → { recipients, limit, sender_ok }
//   { mode: "segment_count", tenant_id, filter_rules, preset_key?, language? } → { recipients }
// Fouten: { error, code } met code PLAN_LIMIT | NO_SENDER | ALREADY_SENDING | NO_RECIPIENTS | NOT_FOUND.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest, requireRole, AuthError, authErrorResponse, type AppRole } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
import { getTenantBrand } from "../_shared/tenantEmail.ts";
import { resolveAudience } from "../_shared/campaignAudience.ts";
import { CampaignQueueError, countCampaign, enqueueCampaign } from "../_shared/campaignQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES: AppRole[] = ["tenant_admin", "staff", "marketing"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateRequest(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as string) || "send";

    // Telling van een segment (nog niet opgeslagen regels) voor de segmentbouwer.
    if (mode === "segment_count") {
      const tenantId = body?.tenant_id as string;
      if (!tenantId) return json({ error: "tenant_id is required" }, 400);
      requireRole(auth, tenantId, ROLES);
      const brand = await getTenantBrand(db, tenantId);
      const recipients = await resolveAudience(db, {
        tenantId,
        filterRules: (body?.filter_rules as Record<string, unknown>) || null,
        presetKey: (body?.preset_key as string) || null,
        language: (body?.language as string) || null,
        tenantLocale: brand.defaultLocale,
      });
      return json({ recipients: recipients.length });
    }

    const campaignId = body?.campaign_id as string;
    if (!campaignId) return json({ error: "campaign_id is required" }, 400);

    const { data: campaign } = await db.from("email_campaigns").select("tenant_id").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campagne niet gevonden.", code: "NOT_FOUND" }, 404);
    requireRole(auth, campaign.tenant_id, ROLES);

    if (mode === "count") {
      const r = await countCampaign(db, campaignId);
      return json({ recipients: r.recipients, limit: r.limit, sender_ok: r.sender_ok });
    }

    // BILLING-ENFORCE-1: versturen kan niet terwijl er een betaling openstaat.
    await requireBillingState(db, auth, campaign.tenant_id, "marketing");

    const result = await enqueueCampaign(db, campaignId);

    // De worker meteen starten, niet wachten op de cron.
    const kick = fetch(`${supabaseUrl}/functions/v1/process-campaign-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "send", campaign_id: campaignId }),
    }).catch((err) => console.error("[send-campaign-batch] worker starten mislukt (cron neemt over)", err));
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(kick);

    return json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    if (error instanceof CampaignQueueError) return json({ error: error.message, code: error.code }, error.status);
    console.error("[send-campaign-batch]", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

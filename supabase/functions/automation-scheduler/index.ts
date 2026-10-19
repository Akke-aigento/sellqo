// MAIL-2a (19-10-2026) — de motor van de e-mailautomations.
//
// Aangeroepen door cron `automation-scheduler` (elke minuut, enkel als er een actieve automation
// is; zie migratie 20261019230000). Enkel met x-cron-secret of de service-role key (cronAuth.ts).
// Alle logica staat in _shared/automationEngine.ts.
//
// Vroeger verstuurde deze functie zelf met resend@2 (fouten als "verzonden" geboekt) en zonder
// cron; er waren 0 automations. Nu zet ze automationmails in campaign_sends en start ze de
// campagneworker process-campaign-queue, die ze verstuurt zoals elke campagne.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from "../_shared/cronAuth.ts";
import { runAutomationEngine } from "../_shared/automationEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": CRON_ALLOWED_HEADERS,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  if (!(await isAuthorizedCronRequest(req, db))) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runAutomationEngine(db, { deadlineMs: 100_000 });

    // Mails in de wachtrij gezet: de worker meteen starten, niet wachten op zijn cron.
    if (Number(result.queued ?? 0) > 0) {
      const kick = fetch(`${supabaseUrl}/functions/v1/process-campaign-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: "automation" }),
      }).catch((err) => console.error("[automation-scheduler] worker starten mislukt (cron neemt over)", err));
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(kick);
    }

    console.log("[automation-scheduler]", JSON.stringify({ source: body?.source ?? null, ...result }));
    return json(result);
  } catch (error) {
    console.error("[automation-scheduler]", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

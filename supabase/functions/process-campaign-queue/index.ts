// MAIL-1a (19-10-2026) — worker van de campagnewachtrij.
//
// Aangeroepen door: send-campaign-batch ("Nu verzenden"), zichzelf (zolang er
// werk is) en cron `process-campaign-queue` (geplande campagnes + vangnet).
// Enkel met x-cron-secret of de service-role key (_shared/cronAuth.ts).
// Alle logica staat in _shared/campaignQueue.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from "../_shared/cronAuth.ts";
import { processQueue } from "../_shared/campaignQueue.ts";

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
    const hop = Number(body?.hop ?? 0);
    const result = await processQueue(db, { deadlineMs: 100_000 });

    // Nog werk? Zichzelf opnieuw starten (maximaal 30 keer na elkaar; daarna neemt de cron over).
    if (result.more && hop < 30) {
      const next = fetch(`${supabaseUrl}/functions/v1/process-campaign-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: "chain", hop: hop + 1 }),
      }).catch((err) => console.error("[process-campaign-queue] doorstarten mislukt (cron neemt over)", err));
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(next);
    }

    console.log("[process-campaign-queue]", JSON.stringify({ source: body?.source ?? null, hop, ...result }));
    return json(result);
  } catch (error) {
    console.error("[process-campaign-queue]", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

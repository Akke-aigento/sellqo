// Eén auth-pad voor cron-aangeroepen edge functions.
//
// Waarom dit bestaat: op 11 september 2026 bleek dat er drie verschillende
// mechanismen naast elkaar leefden, en twee ervan waren stuk.
//
//   1. `sync-cron-vault-key` — `x-cron-secret` tegen
//      `internal_config.internal_webhook_secret`. Werkte.
//   2. `ads-inventory-watch` — `X-Sync-Secret` tegen `Deno.env.CRON_SECRET`,
//      met als terugval `authenticateRequest()`. De cron stuurde die header
//      niet, viel terug op de gebruikersvalidatie, en een cron héét geen
//      gebruiker: elke run 401.
//   3. `ads-bolcom-scheduler` — letterlijke stringvergelijking van de
//      Authorization-header met `Bearer ${SUPABASE_ANON_KEY}` uit de eigen
//      omgeving. De sleutel in de cron-commando's is identiek aan die in .env
//      en in internal_config, dus de afwijking zit in wat Supabase in de
//      functieruntime injecteert. Elke run 401, en dat raakte drie jobs.
//
// Gevolg van 2 en 3: de bol.com-advertentieautomatisering lag stil sinds
// 6 mei 2026 zonder dat iets dat meldde. Zie docs/cron-inventaris.md.
//
// Waarom de anon-sleutel hier geen credential is: die staat in de frontend-
// bundel en is publiek. Ertegen vergelijken houdt niemand tegen — het was
// schijnveiligheid én stuk. Het secret uit `internal_config` is dat wel: die
// tabel heeft RLS aan zonder policies, dus alleen service-role komt erbij.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CRON_SECRET_HEADER = "x-cron-secret";
const CONFIG_KEY = "internal_webhook_secret";

/** Headers die een cron-aanroep mag meesturen. Neem deze op in je corsHeaders. */
export const CRON_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-cron-secret";

/** Vergelijkt zonder vroegtijdig af te breken, zodat de looptijd niets verraadt. */
function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length !== b.length ? 1 : 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Is dit een geldige cron-aanroep?
 *
 * Twee paden, allebei een echt geheim:
 *   - `x-cron-secret` gelijk aan `internal_config.internal_webhook_secret`
 *   - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
 *
 * Het tweede pad staat er zodat een handmatige aanroep met de service-key
 * blijft werken zonder eerst het secret op te zoeken. De anon-sleutel wordt
 * bewust NIET geaccepteerd.
 *
 * Geeft `false` bij elke twijfel — ook als de config-lookup faalt. Een
 * mislukte lookup mag nooit tot toegang leiden.
 *
 * @param admin een client met de service-role key; `internal_config` is voor
 *              niemand anders leesbaar.
 */
export async function isAuthorizedCronRequest(
  req: Request,
  admin: SupabaseClient,
): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (serviceKey && authHeader && constantTimeEquals(authHeader, `Bearer ${serviceKey}`)) {
    return true;
  }

  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;

  const { data, error } = await admin
    .from("internal_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  if (error || !data?.value) {
    // Bewust loggen zónder de reden aan de aanroeper te vertellen: een 401 die
    // "config ontbreekt" zegt, vertelt een aanvaller waar hij moet zoeken.
    console.error("[cronAuth] kon internal_webhook_secret niet lezen:", error?.message);
    return false;
  }

  return constantTimeEquals(provided, String(data.value));
}

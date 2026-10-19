// MAIL-1b (19-10-2026) — een winkel nodigt adressen uit voor de nieuwsbrief.
//
// Niemand wordt hier ingeschreven. Elk nieuw adres komt als `pending` in
// newsletter_subscribers (source 'admin_invite') en krijgt de bevestigingsmail;
// pas de klik in die mail (newsletter-confirm) zet email_subscribed = true.
//
// Body: { tenant_id, emails: string[], language?, consent: true }
// Antwoord: { invited, resent, skipped: { active, unsubscribed, recent, invalid, duplicate }, failed }
//
// Alle controles en de pending-rijen zitten in één transactie in de RPC
// `marketing_prepare_invites` (migratie 20261019220000): normaliseren
// (lower(trim)), overslaan van ingeschreven/uitgeschreven adressen
// (hoofdletterongevoelig), wie de laatste 7 dagen al een mail kreeg, maximaal 500
// per aanroep, 2.000 uitnodigingsmails per winkel per 24 uur (opnieuw sturen telt
// mee) en de maandlimiet voor marketingmails. De RPC legt ook de
// toestemmingsverklaring vast (metadata.consent_attested_at/_by). Deze functie
// mailt enkel de rijen die de RPC teruggeeft.
//
// De RPC draait met de JWT van de gebruiker: has_tenant_role en auth.uid()
// bepalen dan zelf wie uitnodigt; de edge function kan geen andere gebruiker als
// toestemmingsgever doorgeven.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest, requireRole, AuthError, authErrorResponse, type AppRole } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
import { getTenantBrand, type TenantLocale } from "../_shared/tenantEmail.ts";
import { buildInvitationEmail, pickConfirmLocale } from "../_shared/newsletterConfirm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES: AppRole[] = ["tenant_admin", "staff", "marketing"];
const MAX_PER_CALL = 500; // ook afgedwongen in de RPC
const MAX_PER_DAY = 2000; // idem
// Ruwe invoer begrenzen vóór de RPC (dubbels en ongeldige tellen nog mee).
const MAX_RAW = 5000;
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH = 100;
const RESEND_SPACING_MS = 600;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : "";
    if (!tenantId) return json({ error: "tenant_id is required" }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ROLES);

    if (body?.consent !== true) {
      return json({ error: "Bevestig dat je toestemming hebt om deze personen uit te nodigen.", code: "NO_CONSENT" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await requireBillingState(db, auth, tenantId, "marketing");

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "Resend API key not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (auth.user_id === "service_role" || !authHeader) {
      // Een toestemmingsverklaring hoort bij een echte gebruiker.
      return json({ error: "Uitnodigen kan enkel als ingelogde gebruiker.", code: "NO_USER" }, 403);
    }
    const userDb = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const raw: string[] = (Array.isArray(body?.emails) ? body.emails : [])
      .map((r: unknown) => String(r ?? "").trim())
      .filter((e: string) => e.length > 0);
    if (raw.length === 0) return json({ error: "Geen geldige e-mailadressen.", code: "NO_EMAILS" }, 400);
    if (raw.length > MAX_RAW) {
      return json({ error: `Maximaal ${MAX_PER_CALL} adressen per keer.`, code: "TOO_MANY" }, 400);
    }

    const brand = await getTenantBrand(db, tenantId);
    const fallbackLocale: TenantLocale = pickConfirmLocale(body?.language, brand.defaultLocale as TenantLocale);

    const { data: prep, error: prepErr } = await userDb.rpc("marketing_prepare_invites", {
      p_tenant: tenantId,
      p_emails: raw,
      p_attested_by: auth.user_id,
      p_language: typeof body?.language === "string" ? body.language : null,
    });
    if (prepErr) {
      const msg = prepErr.message || "";
      if (msg.includes("NO_ACCESS")) return json({ error: "Geen toegang.", code: "NO_ACCESS" }, 403);
      if (msg.includes("MAIL_INVITE_TOO_MANY")) {
        return json({ error: `Maximaal ${MAX_PER_CALL} adressen per keer.`, code: "TOO_MANY" }, 400);
      }
      const day = msg.match(/MAIL_INVITE_DAILY_LIMIT:(\d+)/);
      if (day) {
        const left = Math.max(0, MAX_PER_DAY - Number(day[1]));
        return json({ error: `Maximaal ${MAX_PER_DAY} uitnodigingen per 24 uur. Je kan er nu nog ${left} versturen.`, code: "DAILY_LIMIT" }, 429);
      }
      const plan = msg.match(/MAIL_PLAN_LIMIT:(\d+):(\d+)/);
      if (plan) {
        const left = Math.max(0, Number(plan[1]) - Number(plan[2]));
        return json({
          error: `Je plan laat deze maand nog ${left} marketingmails toe (${plan[2]} van ${plan[1]} gebruikt). Nodig minder adressen uit of upgrade je plan.`,
          code: "PLAN_LIMIT",
        }, 402);
      }
      throw new Error(`uitnodigingen voorbereiden mislukt: ${msg}`);
    }

    type PrepRow = { email: string; confirmation_token: string; first_name: string | null; language: string | null; is_new: boolean };
    const result = (prep ?? {}) as { to_mail?: PrepRow[]; skipped?: Record<string, number> };
    const toSend = (result.to_mail ?? []).filter((r) => r.email && r.confirmation_token);
    const sk = result.skipped ?? {};
    const skipped = {
      active: Number(sk.active ?? 0),
      unsubscribed: Number(sk.unsubscribed ?? 0),
      recent: Number(sk.recent ?? 0),
      invalid: Number(sk.invalid ?? 0),
      duplicate: Number(sk.duplicate ?? 0),
    };

    let invited = 0, resent = 0, failed = 0;
    for (let i = 0; i < toSend.length; i += BATCH) {
      if (i > 0) await sleep(RESEND_SPACING_MS);
      const chunk = toSend.slice(i, i + BATCH);
      const payload = chunk.map((r) => buildInvitationEmail({
        brand,
        tenantId,
        email: r.email,
        token: r.confirmation_token,
        locale: pickConfirmLocale(r.language, fallbackLocale),
        supabaseUrl,
      }));
      const res = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "x-batch-validation": "permissive" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[newsletter-invite] Resend weigerde batch", { tenantId, status: res.status, msg: out?.message });
        failed += chunk.length;
        continue;
      }
      const errIdx = new Set<number>((Array.isArray(out?.errors) ? out.errors : []).map((e: { index: number }) => e.index));
      chunk.forEach((r, idx) => {
        if (errIdx.has(idx)) failed++;
        else if (r.is_new) invited++;
        else resent++;
      });
    }

    console.log("[newsletter-invite]", { tenantId, invited, resent, failed, skipped });
    return json({ invited, resent, failed, skipped });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[newsletter-invite]", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

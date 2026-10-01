// PAY-LINK-1 — publieke functie achter sellqo.app/betalen/<token>.
//
// Geen login: wie de link heeft, mag betalen (net als een papieren factuur met
// overschrijvingsgegevens). Het token is 130 bit en niet raadbaar; de functie
// geeft nooit klantgegevens terug, alleen winkel, nummers en bedrag.
//
// `info`     → wat er openstaat (of waarom niet). Geen sessie: mailscanners
//              openen links automatisch, en elke scan zou anders een Stripe-
//              sessie maken en de vorige laten vervallen.
// `checkout` → verse Stripe-sessie, pas na een klik op "Betalen".
//
// Betaald, geannuleerd of in verwerking → nooit een sessie.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizePayToken, payPageBrand, withPendingSession, type PayState } from "../_shared/payLink.ts";
import { createLinkCheckout, isBillingTenant, loadLink, previousSessionStatus, resolveLink } from "../_shared/payCheckout.ts";
import { getTenantBrand } from "../_shared/tenantEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Rate-limit per instantie (zoals storefront-api): genoeg tegen gokken en
// herhaald klikken, geen vervanging van de onraadbaarheid van het token.
const hits = new Map<string, { count: number; resetAt: number }>();
function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
const TEN_MIN = 10 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allow(`ip:${ip}`, 60, TEN_MIN)) return json({ state: "rate_limited" }, 429);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "checkout" ? "checkout" : "info";
    const token = normalizePayToken(body?.token);
    if (!token) return json({ state: "not_found" }, 404);
    if (action === "checkout" && !allow(`checkout:${token}`, 10, TEN_MIN)) return json({ state: "rate_limited" }, 429);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const link = await loadLink(supabase, token);
    if (!link) return json({ state: "not_found" }, 404);

    const resolved = await resolveLink(supabase, link);
    let state: PayState | "nothing_open" = resolved.state;
    if (state === "open") state = withPendingSession(state, await previousSessionStatus(resolved));

    const brand = payPageBrand(
      await getTenantBrand(supabase, link.tenant_id),
      await isBillingTenant(supabase, link.tenant_id),
    );
    const summary = {
      state,
      kind: link.kind,
      brand,
      items: resolved.items.map((i) => ({ type: i.type, number: i.number, amount: i.amount })),
      total: resolved.total,
      currency: resolved.currency,
    };

    if (action === "info" || state !== "open") return json(summary);

    const url = await createLinkCheckout(supabase, resolved);
    console.log("[pay-link] sessie gemaakt", { kind: link.kind, items: resolved.items.length });
    return json({ ...summary, state: "redirect", url });
  } catch (e) {
    console.error("[pay-link] fout:", e instanceof Error ? e.message : String(e));
    return json({ state: "error" }, 500);
  }
});

// FEST-2 — publieke muntenkaart (/munten/<code>).
// De code (40 hex, uit de ticketmail) is het enige toegangsbewijs: wie de code heeft, ziet
// het saldo en kan de ongebruikte munten laten terugstorten. Geen e-mailadressen naar buiten.
// Acties:
//   - get:            winkel, muntnaam, saldo, geschiedenis, terugbetaalvoorwaarden;
//   - request_refund: maakt via request_token_refund een retour aan (Retouren in de admin).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const VERSION = "FEST-2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const WALLET_CODE_RE = /^[a-f0-9]{40}$/;

/** IBAN-controle (mod 97). Spaties mogen, hoofdletters niet verplicht. */
export function validIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action !== "get" && action !== "request_refund") return json({ success: false, error: "invalid action" }, 400);
    const code = String(body.code ?? "").trim().toLowerCase();
    if (!WALLET_CODE_RE.test(code)) return json({ success: false, error: "not_found" }, 404);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    if (action === "request_refund") {
      const iban = String(body.iban ?? "").trim();
      if (iban && !validIban(iban)) return json({ success: false, reason: "invalid_iban" });
      const { data, error } = await admin.rpc("request_token_refund", { p_code: code, p_iban: iban || null });
      if (error) {
        console.error("[TOKEN-WALLET] refund failed", error.message);
        return json({ success: false, error: "refund failed" }, 500);
      }
      const r = data as { ok: boolean; reason?: string; amount?: number; tokens?: number; method?: string };
      return json({ success: r.ok, reason: r.reason ?? null, amount: r.amount ?? null, tokens: r.tokens ?? null, method: r.method ?? null });
    }

    const { data: w } = await admin.from("token_wallets")
      .select("id, tenant_id, order_id, customer_name, purchased, balance, paid_amount, status, created_at")
      .eq("code", code).maybeSingle();
    if (!w) return json({ success: false, error: "not_found" }, 404);

    const [{ data: tenant }, { data: settings }, { data: order }, { data: txs }] = await Promise.all([
      admin.from("tenants").select("name, slug, logo_url, primary_color, custom_domain, currency").eq("id", w.tenant_id).maybeSingle(),
      admin.from("token_settings").select("token_name, token_name_plural, refund_enabled, refund_until, refund_fee").eq("tenant_id", w.tenant_id).maybeSingle(),
      w.order_id
        ? admin.from("orders").select("order_number, stripe_payment_intent_id").eq("id", w.order_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("token_transactions").select("delta, kind, balance_after, created_at")
        .eq("wallet_id", w.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const purchased = Number(w.purchased) || 0;
    const unit = purchased > 0 ? Math.round((Number(w.paid_amount) / purchased) * 10000) / 10000 : 0;
    const fee = Number(settings?.refund_fee ?? 0);
    const refundOpen = !!settings?.refund_enabled && (!settings?.refund_until || new Date(settings.refund_until as string).getTime() > Date.now());
    const estimate = Math.max(0, Math.round((Number(w.balance) * unit - fee) * 100) / 100);

    return json({
      success: true,
      shop: {
        name: tenant?.name ?? null,
        logo_url: tenant?.logo_url ?? null,
        primary_color: tenant?.primary_color ?? null,
        currency: tenant?.currency ?? "EUR",
      },
      token_name: settings?.token_name ?? "munt",
      token_name_plural: settings?.token_name_plural ?? "munten",
      wallet: {
        name: String(w.customer_name ?? "").trim().split(/\s+/)[0] || null,
        order_number: (order as { order_number?: string } | null)?.order_number ?? null,
        purchased,
        balance: Number(w.balance),
        status: w.status,
        unit_value: unit,
      },
      refund: {
        enabled: !!settings?.refund_enabled,
        open: refundOpen,
        until: settings?.refund_until ?? null,
        fee,
        estimate,
        needs_iban: !(order as { stripe_payment_intent_id?: string } | null)?.stripe_payment_intent_id,
      },
      history: ((txs ?? []) as { delta: number; kind: string; balance_after: number; created_at: string }[]).map((t) => ({ delta: t.delta, kind: t.kind, balance_after: t.balance_after, at: t.created_at })),
    });
  } catch (err) {
    console.error("[TOKEN-WALLET]", err instanceof Error ? err.message : err);
    return json({ success: false, error: "unexpected error" }, 500);
  }
});

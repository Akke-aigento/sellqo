// FEST-2 — "SellQo Bar": munten afschrijven aan de bar of de foodtruck.
// Werkt uitsluitend met een barlink (token_scanner_access.access_token, 64 hex), geen account.
// De winkel komt UITSLUITEND uit de barlink-rij, nooit uit de body.
// Acties:
//   - info:   winkelnaam, muntnaam, naam van de bar;
//   - lookup: saldo van een muntenkaart (code uit de QR);
//   - spend:  munten afschrijven (1..100), idempotent via een sleutel van het toestel;
//   - undo:   de laatste afschrijving terugdraaien (zelfde bar, binnen 10 minuten, één keer).
// Geeft nooit e-mailadressen terug; enkel de voornaam van de koper.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const VERSION = "FEST-2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bar-token",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const BAR_TOKEN_RE = /^[a-f0-9]{64}$/;
const WALLET_CODE_RE = /^[a-f0-9]{40}$/;
const UUID_RE = /^[0-9a-f-]{36}$/;

/** De QR kan de kale code bevatten of een link naar /munten/<code>. */
function walletCode(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  const m = s.match(/([a-f0-9]{40})(?:[/?#].*)?$/);
  const code = m ? m[1] : s;
  return WALLET_CODE_RE.test(code) ? code : null;
}

const firstName = (name: unknown) => {
  const s = String(name ?? "").trim();
  return s ? s.split(/\s+/)[0] : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (!["info", "lookup", "spend", "undo"].includes(action)) return json({ success: false, error: "invalid action" }, 400);

    const token = String(req.headers.get("x-bar-token") ?? body.bar_token ?? "").trim();
    if (!BAR_TOKEN_RE.test(token)) return json({ success: false, error: "invalid bar token" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: bar } = await admin.from("token_scanner_access")
      .select("id, tenant_id, name").eq("access_token", token).eq("is_active", true).maybeSingle();
    if (!bar) return json({ success: false, error: "invalid bar token" }, 401);
    const tenantId = bar.tenant_id as string;
    const barId = bar.id as string;

    if (action === "info") {
      const [{ data: tenant }, { data: settings }] = await Promise.all([
        admin.from("tenants").select("name, logo_url").eq("id", tenantId).maybeSingle(),
        admin.from("token_settings").select("token_name, token_name_plural").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      return json({
        success: true,
        bar: { name: bar.name },
        shop: { name: tenant?.name ?? null, logo_url: tenant?.logo_url ?? null },
        token_name: settings?.token_name ?? "munt",
        token_name_plural: settings?.token_name_plural ?? "munten",
      });
    }

    if (action === "undo") {
      const tx = String(body.transaction_id ?? "");
      if (!UUID_RE.test(tx)) return json({ success: false, error: "invalid transaction" }, 400);
      const { data, error } = await admin.rpc("undo_token_spend", { p_tenant_id: tenantId, p_transaction_id: tx, p_scanner_id: barId });
      if (error) {
        console.error("[TOKEN-BAR] undo failed", error.message);
        return json({ success: false, error: "undo failed" }, 500);
      }
      const r = data as { ok: boolean; reason?: string; balance?: number };
      return json({ success: r.ok, reason: r.reason ?? null, balance: r.balance ?? null });
    }

    const code = walletCode(body.code);
    if (!code) return json({ success: true, found: false, reason: "unknown_wallet" });

    if (action === "lookup") {
      const { data: w } = await admin.from("token_wallets")
        .select("balance, purchased, status, customer_name").eq("tenant_id", tenantId).eq("code", code).maybeSingle();
      if (!w) return json({ success: true, found: false, reason: "unknown_wallet" });
      return json({ success: true, found: true, balance: w.balance, purchased: w.purchased, status: w.status, name: firstName(w.customer_name) });
    }

    // spend
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) return json({ success: false, error: "invalid amount" }, 400);
    const keyRaw = String(body.idempotency_key ?? "").trim();
    const key = /^[A-Za-z0-9_-]{8,80}$/.test(keyRaw) ? `bar:${barId}:${keyRaw}` : null;
    const { data, error } = await admin.rpc("spend_tokens", {
      p_tenant_id: tenantId, p_code: code, p_amount: amount, p_key: key, p_scanner_id: barId,
    });
    if (error) {
      console.error("[TOKEN-BAR] spend failed", error.message);
      return json({ success: false, error: "spend failed" }, 500);
    }
    const r = data as { ok: boolean; reason?: string; balance?: number; transaction_id?: string; repeat?: boolean };
    return json({
      success: true,
      found: r.reason !== "unknown_wallet",
      ok: r.ok,
      reason: r.reason ?? null,
      balance: r.balance ?? null,
      transaction_id: r.transaction_id ?? null,
      repeat: r.repeat ?? false,
    });
  } catch (err) {
    console.error("[TOKEN-BAR]", err instanceof Error ? err.message : err);
    return json({ success: false, error: "unexpected error" }, 500);
  }
});

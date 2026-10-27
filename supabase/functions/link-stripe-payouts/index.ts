// PAYOUT-LINK-1 — zet bij elke in Odoo geboekte SellQo-factuur bij welke Stripe-uitbetaling
// ze hoort (logboeknotitie + "Stripe po_…" in Referentie). Geen boekingen. Zie
// _shared/payoutLink.ts voor de regels.
//
// Aanroepen:
//   GET                      versie-vingerafdruk (geen auth, geen neveneffect)
//   POST (cron of service)   { tenantId?, sinceDays? = 45, maxPayouts? = 60, dryRun? = false }
//
// Per tenant met Odoo-sync aan: het Stripe-account van die tenant (platformaccount voor
// SellQo zelf, anders het Connect-account). Demo-tenants nooit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { decryptOdooKey } from "../_shared/odooCrypto.ts";
import { assertValidOdooUrl, odooAuthenticate, odooExecKw, type OdooEnv } from "../_shared/odooRpc.ts";
import { getStripeContext } from "../_shared/stripe.ts";
import {
  extractTxn,
  linkTenantPayouts,
  PAYOUT_LINK_VERSION,
  type OdooApi,
  type OdooMove,
  type PayoutLite,
  type StripeApi,
  type TxnLite,
} from "../_shared/payoutLink.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// Stripe-client zonder vaste versie-types (de functie gebruikt drie list-methodes).
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStripe = any;

function stripeApiFor(stripe: AnyStripe, requestOptions: Record<string, unknown> | undefined): StripeApi {
  // 20 s per Stripe-aanroep (standaard 80 s): het tijdsbudget moet ook hier gelden.
  const opts = { ...(requestOptions ?? {}), timeout: 20_000 };
  return {
    async listPaidPayouts(sinceUnix: number, max: number): Promise<PayoutLite[]> {
      const out: PayoutLite[] = [];
      let startingAfter: string | undefined;
      while (out.length < max) {
        const page = await stripe.payouts.list(
          { status: "paid", arrival_date: { gte: sinceUnix }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) },
          opts,
        );
        for (const p of page.data) {
          out.push({
            id: p.id, amount: p.amount, currency: p.currency, arrival_date: p.arrival_date, status: p.status,
            automatic: p.automatic !== false,
          });
        }
        if (!page.has_more || !page.data.length) break;
        startingAfter = page.data[page.data.length - 1].id;
      }
      return out.slice(0, max);
    },
    async listPayoutTxns(payoutId: string): Promise<TxnLite[]> {
      const out: TxnLite[] = [];
      let startingAfter: string | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const page = await stripe.balanceTransactions.list(
          { payout: payoutId, limit: 100, expand: ["data.source"], ...(startingAfter ? { starting_after: startingAfter } : {}) },
          opts,
        );
        for (const t of page.data) out.push(extractTxn(t));
        if (!page.has_more || !page.data.length) break;
        startingAfter = page.data[page.data.length - 1].id;
      }
      return out;
    },
    async checkoutSessionIdsForPi(pi: string): Promise<string[]> {
      try {
        const page = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 5 }, opts);
        return (page.data ?? []).map((s: { id: string }) => s.id);
      } catch (e) {
        console.warn(`checkout.sessions.list(${pi}) faalde: ${errMsg(e)}`);
        return [];
      }
    },
  };
}

/** Elke Odoo-aanroep hoogstens 30 s: één hangende aanroep mag de run niet stilleggen. */
function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error(`Odoo antwoordde niet binnen ${ms / 1000}s`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function odooApiFor(env: OdooEnv, uid: number): OdooApi {
  const kw = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    withTimeout(odooExecKw(env, uid, model, method, args, kwargs));
  return {
    async readMoves(ids: number[]): Promise<OdooMove[]> {
      // search_read i.p.v. read: een verwijderde boeking mag de rest niet tegenhouden.
      const r = await kw("account.move", "search_read", [[["id", "in", ids]]], { fields: ["name", "ref", "state"] }) as OdooMove[];
      return r ?? [];
    },
    async writeRef(id: number, ref: string): Promise<void> {
      await kw("account.move", "write", [[id], { ref }]);
    },
    async countNotes(id: number, marker: string): Promise<number> {
      return Number(await kw("mail.message", "search_count", [[
        ["model", "=", "account.move"], ["res_id", "=", id], ["body", "ilike", marker],
      ]]));
    },
    async postNote(id: number, body: string): Promise<void> {
      await kw("account.move", "message_post", [[id]], { body, message_type: "comment", subtype_xmlid: "mail.mt_note" });
    },
  };
}

async function odooFor(supabase: SupabaseClient, tenantId: string): Promise<{ api: OdooApi | null; note?: string }> {
  const { data: cred, error } = await supabase
    .from("tenant_odoo_credentials")
    .select("odoo_url, odoo_db, odoo_login, api_key_ciphertext")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { api: null, note: `credentials: ${error.message}` };
  if (!cred) return { api: null, note: "geen Odoo-credentials" };
  const env: OdooEnv = {
    url: assertValidOdooUrl(cred.odoo_url),
    db: cred.odoo_db,
    login: cred.odoo_login,
    apiKey: await decryptOdooKey(cred.api_key_ciphertext),
  };
  const uid = await withTimeout(odooAuthenticate(env));
  return { api: odooApiFor(env, uid) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: PAYOUT_LINK_VERSION });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const denied = await denyUnlessCron(req, supabase, corsHeaders);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      tenantId?: string; sinceDays?: number; maxPayouts?: number; dryRun?: boolean;
    };
    const sinceDays = Math.min(Math.max(Number(body.sinceDays) || 45, 1), 400);
    const maxPayouts = Math.min(Math.max(Number(body.maxPayouts) || 60, 1), 300);
    const dryRun = body.dryRun === true;
    const sinceUnix = Math.floor(Date.now() / 1000) - sinceDays * 86400;
    // Tijdsbudget: geen nieuwe uitbetaling meer beginnen na ±100 s (wandklok ±150 s).
    // Wat blijft liggen, komt de volgende run aan bod.
    const deadline = Date.now() + 100_000;

    let q = supabase.from("tenant_odoo_settings").select("tenant_id, peppol_send_enabled").eq("odoo_sync_enabled", true);
    if (body.tenantId) q = q.eq("tenant_id", body.tenantId);
    const { data: enabled, error: eErr } = await q;
    if (eErr) throw new Error(`tenant_odoo_settings: ${eErr.message}`);
    const ids = (enabled ?? []).map((r: { tenant_id: string }) => r.tenant_id);
    const peppolAuto = new Map((enabled ?? []).map((r: { tenant_id: string; peppol_send_enabled: boolean | null }) =>
      [r.tenant_id, r.peppol_send_enabled !== false]));
    if (!ids.length) return json({ success: true, version: PAYOUT_LINK_VERSION, dryRun, tenants: {} });

    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, slug, is_demo, is_internal_tenant, stripe_account_id")
      .in("id", ids);
    if (tErr) throw new Error(`tenants: ${tErr.message}`);

    const perTenant: Record<string, unknown> = {};
    for (const t of tenants ?? []) {
      const label = `${t.name} (${t.id})`;
      if (t.is_demo) { perTenant[label] = { skipped: "demo" }; continue; }
      if (!t.is_internal_tenant && !t.stripe_account_id) { perTenant[label] = { skipped: "geen Stripe-account" }; continue; }
      // Het platformaccount hoort bij SellQo zelf. Een tweede interne tenant zou dezelfde
      // uitbetalingen nog eens verwerken en de rijen van SellQo overschrijven.
      if (t.is_internal_tenant && t.slug !== "sellqo") { perTenant[label] = { skipped: "intern, niet SellQo: geen eigen Stripe-account" }; continue; }
      if (Date.now() > deadline) { perTenant[label] = { skipped: "tijdsbudget op, volgende run" }; continue; }
      try {
        const ctx = getStripeContext(t);
        const stripeApi = stripeApiFor(ctx.stripe, ctx.requestOptions as Record<string, unknown> | undefined);
        let odoo: OdooApi | null = null;
        let odooNote: string | undefined;
        try {
          const o = await odooFor(supabase, t.id);
          odoo = o.api;
          odooNote = o.note;
        } catch (e) {
          odooNote = `Odoo: ${errMsg(e)}`;
        }
        const result = await linkTenantPayouts({
          db: supabase, stripe: stripeApi, odoo, tenantId: t.id,
          stripeAccount: ctx.onPlatformAccount ? "platform" : String(t.stripe_account_id),
          sinceUnix, maxPayouts, dryRun, deadline, peppolAutoSend: peppolAuto.get(t.id) ?? true,
        });
        perTenant[label] = { ...result, ...(odooNote ? { odoo_note: odooNote } : {}) };
      } catch (e) {
        perTenant[label] = { error: errMsg(e) };
        console.error(`link-stripe-payouts ${label}: ${errMsg(e)}`);
      }
    }

    return json({ success: true, version: PAYOUT_LINK_VERSION, dryRun, sinceDays, tenants: perTenant });
  } catch (e) {
    console.error("link-stripe-payouts fatal:", errMsg(e));
    return json({ success: false, error: errMsg(e) }, 500);
  }
});

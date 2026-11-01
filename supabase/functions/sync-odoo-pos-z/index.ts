// KASSA-ODOO-1 — dagontvangsten van SellQo Kassa naar Odoo: per afgesloten Z-rapport één
// boeking (omzet per btw-tarief). Regels en rekenwerk: _shared/odooPosZ.ts.
//
// Aanroepen:
//   GET                      versie-vingerafdruk (geen auth, geen neveneffect)
//   POST (cron of service)   { tenantId?, dryRun? = false, fromDate?, reportIds?, maxPerRun? = 20 }
//
// Standaard doet deze functie niets: enkel tenants met tenant_odoo_settings.pos_z_sync_enabled
// (standaard false) én odoo_sync_enabled worden verwerkt, vanaf pos_z_sync_from. Een proefrun
// (dryRun) met een tenantId mag ook een tenant met de schakelaar uit bekijken; die schrijft niets
// (geen DB, geen Odoo-create) en leest Odoo enkel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { decryptOdooKey } from "../_shared/odooCrypto.ts";
import { assertValidOdooUrl, odooAuthenticate, odooExecKw, type OdooEnv } from "../_shared/odooRpc.ts";
import { createPartnerTypeResolver, partnerTypeFields } from "../_shared/odooPartnerType.ts";
import {
  INCL_TAX_NAME,
  POS_Z_VERSION,
  prepareTenantZ,
  runPreparedZ,
  ZERO_TAX_NAME,
  type OdooMoveHead,
  type OdooMoveRead,
  type PosZOdoo,
  type PosZSettings,
  type PreparedTenant,
} from "../_shared/odooPosZ.ts";

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

/** Elke Odoo-aanroep hoogstens 30 s. */
function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error(`Odoo antwoordde niet binnen ${ms / 1000}s`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

type M2o = [number, string] | false | null | undefined;
const m2oId = (v: M2o): number | null => (Array.isArray(v) ? Number(v[0]) : null);

const MOVE_HEAD_FIELDS = ["id", "name", "state", "move_type", "partner_id", "invoice_date"];
type MoveHeadRow = { id: number; name: string; state: string; move_type: string; partner_id: M2o; invoice_date: string | false };
const moveHead = (m: MoveHeadRow): OdooMoveHead =>
  ({ id: m.id, name: m.name, state: m.state, move_type: m.move_type, partner_id: m2oId(m.partner_id), invoice_date: m.invoice_date || null });

function odooApiFor(env: OdooEnv, uid: number): PosZOdoo {
  const kw = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    withTimeout(odooExecKw(env, uid, model, method, args, kwargs));
  const partnerTypeMode = createPartnerTypeResolver((fields) =>
    kw("res.partner", "fields_get", [fields], { attributes: ["type", "readonly"] }) as Promise<Record<string, { type?: string; readonly?: boolean }>>);
  return {
    async journal(id) {
      const r = await kw("account.journal", "search_read", [[["id", "=", id]]], { fields: ["id", "name", "type"], limit: 1 }) as Array<{ id: number; name: string; type: string }>;
      return r?.[0] ?? null;
    },
    async findTax(rate, included) {
      // Exacte naam (ODOO-GUARD-1): een hernoemde code geeft een duidelijke fout, geen stille.
      const name = included ? INCL_TAX_NAME[rate] : ZERO_TAX_NAME;
      if (!name) throw new Error(`Geen btw-code bekend voor ${rate}%${included ? " inclusief" : ""}.`);
      const inclDomain = included
        ? [["price_include_override", "=", "tax_included"]]
        : ["|", ["price_include_override", "=", false], ["price_include_override", "=", "tax_excluded"]];
      const ids = await kw("account.tax", "search",
        [[["name", "=", name], ["amount", "=", rate], ["type_tax_use", "=", "sale"], ...inclDomain]],
        { limit: 1, order: "sequence, id" }) as number[];
      if (!ids?.length) {
        throw new Error(included
          ? `Prijs-inclusieve btw-code "${name}" ontbreekt in Odoo (verkoop, "Inbegrepen in prijs").`
          : `Btw-code "${name}" (verkoop, exclusief) ontbreekt in Odoo.`);
      }
      return ids[0];
    },
    async findPartner(name) {
      const ids = await kw("res.partner", "search", [[["name", "=", name], ["customer_rank", ">", 0]]], { limit: 1 }) as number[];
      return ids?.[0] ?? null;
    },
    async createPartner(name) {
      return await kw("res.partner", "create", [{
        name,
        ...partnerTypeFields(await partnerTypeMode(), false),
        customer_rank: 1,
        comment: "SellQo Kassa: dagontvangsten per Z-rapport (geen individuele klanten)",
      }]) as number;
    },
    async partnerName(id) {
      const r = await kw("res.partner", "search_read", [[["id", "=", id]]], { fields: ["name"], limit: 1 }) as Array<{ name: string }>;
      return r?.[0]?.name ?? null;
    },
    async findMove(name, journalId, moveType) {
      const r = await kw("account.move", "search_read",
        [[["name", "=", name], ["journal_id", "=", journalId], ["move_type", "=", moveType], ["state", "!=", "cancel"]]],
        { fields: MOVE_HEAD_FIELDS, limit: 1 }) as MoveHeadRow[];
      return r?.[0] ? moveHead(r[0]) : null;
    },
    async getMove(id) {
      // search_read i.p.v. read: een verwijderde boeking geeft null, geen fout.
      const r = await kw("account.move", "search_read", [[["id", "=", id]]], { fields: MOVE_HEAD_FIELDS, limit: 1 }) as MoveHeadRow[];
      return r?.[0] ? moveHead(r[0]) : null;
    },
    async createMove(data) {
      return await kw("account.move", "create", [data]) as number;
    },
    async readMove(id): Promise<OdooMoveRead> {
      const [mv] = await kw("account.move", "read", [[id], ["state", "amount_untaxed", "amount_tax", "amount_total"]]) as Array<{ state: string; amount_untaxed: number; amount_tax: number; amount_total: number }>;
      const lines = await kw("account.move.line", "search_read", [[["move_id", "=", id]]],
        { fields: ["display_type", "tax_ids", "tax_line_id", "price_subtotal", "balance"] }) as Array<{
          display_type: string | false; tax_ids: number[]; tax_line_id: M2o; price_subtotal: number; balance: number;
        }>;
      const productLines: OdooMoveRead["productLines"] = [];
      const taxLines: OdooMoveRead["taxLines"] = [];
      const otherLines: OdooMoveRead["otherLines"] = [];
      for (const l of lines ?? []) {
        const dt = l.display_type || "";
        if (dt === "product") productLines.push({ tax_ids: l.tax_ids ?? [], price_subtotal: Number(l.price_subtotal) || 0 });
        else if (dt === "tax" || m2oId(l.tax_line_id)) taxLines.push({ tax_id: m2oId(l.tax_line_id) ?? 0, balance: Number(l.balance) || 0 });
        // Tegenboeking (klant) en tekstregels horen erbij; al de rest met een bedrag is verdacht.
        else if (!["payment_term", "line_section", "line_note"].includes(dt)) otherLines.push({ display_type: dt || "onbekend", balance: Number(l.balance) || 0 });
      }
      return { id, state: mv?.state ?? "unknown", amount_untaxed: mv?.amount_untaxed ?? 0, amount_tax: mv?.amount_tax ?? 0, amount_total: mv?.amount_total ?? 0, productLines, taxLines, otherLines };
    },
    async post(id) {
      await kw("account.move", "action_post", [[id]]);
    },
  };
}

async function odooFor(supabase: SupabaseClient, tenantId: string): Promise<{ api: PosZOdoo | null; note?: string }> {
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

const SETTINGS_COLS = "tenant_id, odoo_sync_enabled, odoo_journal_id, odoo_journal_name, odoo_auto_post, channel_aliases, channel_partner_ids, pos_z_sync_enabled, pos_z_sync_from, pos_z_journal_id, pos_z_journal_name, pos_z_enabled_at, pos_z_backfill_from";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: POS_Z_VERSION });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const denied = await denyUnlessCron(req, supabase, corsHeaders);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      tenantId?: string; dryRun?: boolean; fromDate?: string; reportIds?: string[]; maxPerRun?: number;
    };
    const dryRun = body.dryRun === true;
    const fromDate = typeof body.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fromDate) ? body.fromDate : null;
    const reportIds = Array.isArray(body.reportIds) ? body.reportIds.filter((x) => typeof x === "string").slice(0, 100) : undefined;
    // Tijdsbudget: geen nieuwe Z meer na ±100 s. Wat blijft liggen, komt de volgende run.
    const deadline = Date.now() + 100_000;

    let q = supabase.from("tenant_odoo_settings").select(SETTINGS_COLS);
    if (body.tenantId) q = q.eq("tenant_id", body.tenantId);
    // Echte run: enkel wie het aanzette. Proefrun zonder tenantId: idem.
    if (!dryRun || !body.tenantId) q = q.eq("pos_z_sync_enabled", true);
    if (!dryRun) q = q.eq("odoo_sync_enabled", true);
    const { data: rows, error: sErr } = await q;
    if (sErr) throw new Error(`tenant_odoo_settings: ${sErr.message}`);
    const settingsById = new Map<string, PosZSettings>(((rows ?? []) as Array<PosZSettings & { tenant_id: string }>).map((r) => [r.tenant_id, r]));
    if (!settingsById.size) return json({ success: true, version: POS_Z_VERSION, dryRun, tenants: {} });

    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, is_demo")
      .in("id", [...settingsById.keys()]);
    if (tErr) throw new Error(`tenants: ${tErr.message}`);

    const perTenant: Record<string, unknown> = {};
    // Stap 1 zonder Odoo: wat staat er open? Dan de winkel met de oudste open Z eerst (review 1,
    // punt 6), en enkel inloggen in Odoo waar er werk is.
    const queue: Array<{ t: { id: string; name: string }; label: string; prepared: PreparedTenant }> = [];
    for (const t of (tenants ?? []) as Array<{ id: string; name: string; is_demo: boolean | null }>) {
      const label = `${t.name} (${t.id})`;
      // R8: demo-tenants nooit (ook geen proefrun: daar staat nep-omzet).
      if (t.is_demo) { perTenant[label] = { skipped: "demo" }; continue; }
      try {
        const prepared = await prepareTenantZ({
          db: supabase, tenantId: t.id, tenantName: t.name || "SellQo", settings: settingsById.get(t.id)!,
          dryRun, maxPerRun: Number(body.maxPerRun) || 20, fromDate, reportIds,
        });
        if (!prepared.work) perTenant[label] = prepared.result;
        else queue.push({ t, label, prepared });
      } catch (e) {
        perTenant[label] = { error: errMsg(e) };
        console.error(`sync-odoo-pos-z ${label}: ${errMsg(e)}`);
      }
    }
    queue.sort((a, b) => String(a.prepared.result.oldest_open ?? "9999").localeCompare(String(b.prepared.result.oldest_open ?? "9999")));

    for (const { t, label, prepared } of queue) {
      if (Date.now() > deadline) { perTenant[label] = { ...prepared.result, skipped: "tijdsbudget op, volgende run" }; continue; }
      try {
        let odoo: PosZOdoo | null = null;
        let odooNote: string | undefined;
        try {
          const o = await odooFor(supabase, t.id);
          odoo = o.api;
          odooNote = o.note;
        } catch (e) {
          odooNote = `Odoo: ${errMsg(e)}`;
        }
        perTenant[label] = await runPreparedZ({
          db: supabase, tenantId: t.id, tenantName: t.name || "SellQo", settings: settingsById.get(t.id)!,
          dryRun, prepared, odoo, odooNote, deadline,
        });
      } catch (e) {
        perTenant[label] = { error: errMsg(e) };
        console.error(`sync-odoo-pos-z ${label}: ${errMsg(e)}`);
      }
    }
    return json({ success: true, version: POS_Z_VERSION, dryRun, tenants: perTenant });
  } catch (e) {
    console.error("sync-odoo-pos-z fatal:", errMsg(e));
    return json({ success: false, error: errMsg(e) }, 500);
  }
});

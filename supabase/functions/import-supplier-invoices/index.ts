// INKOOP-2 — leveranciersfacturen uit API's als concept in het Odoo-aankoopdagboek.
// Regels: zie _shared/supplierInvoices.ts.
//
//   GET                      versie-vingerafdruk (geen auth, geen neveneffect)
//   POST (cron of service)   { days? = 62, dryRun? = false }
//
// Bron vandaag: bol.com, via de bol-koppeling van de winkel die er een heeft (VanXcel),
// naar de Odoo van diezelfde winkel. Enkel concepten; boeken doet Pieter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { decryptOdooKey } from "../_shared/odooCrypto.ts";
import { assertValidOdooUrl, odooAuthenticate, odooExecKw, type OdooEnv } from "../_shared/odooRpc.ts";
import {
  importBolInvoices,
  INKOOP_VERSION,
  moveIdFromAction,
  parseBolInvoiceList,
  type BolApi,
  type OdooPurchaseApi,
} from "../_shared/supplierInvoices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** fetch + body lezen binnen één time-out (een hangende body mag de run niet stilleggen). */
async function timed<T>(input: string, init: RequestInit, read: (r: Response) => Promise<T>, ms = 20_000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await read(await fetch(input, { ...init, signal: ctl.signal })); } finally { clearTimeout(t); }
}

function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error(`Odoo antwoordde niet binnen ${ms / 1000}s`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function bolApi(credentials: { clientId?: string; clientSecret?: string }): Promise<BolApi> {
  if (!credentials?.clientId || !credentials?.clientSecret) throw new Error("bol-koppeling zonder clientId/clientSecret");
  const token = await timed("https://login.bol.com/token?grant_type=client_credentials", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}` },
  }, async (r) => {
    if (!r.ok) throw new Error(`bol-token: HTTP ${r.status}`);
    return (await r.json()).access_token as string;
  });
  return {
    async listInvoices(start, end) {
      return await timed(`https://api.bol.com/retailer/invoices?period-start-date=${start}&period-end-date=${end}`, {
        headers: { Accept: "application/vnd.retailer.v10+json", Authorization: `Bearer ${token}` },
      }, async (r) => {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error(`bol invoices ${start}..${end}: HTTP ${r.status}`);
        return parseBolInvoiceList(await r.json());
      });
    },
    async downloadPdf(invoiceId) {
      const buf = await timed(`https://api.bol.com/retailer/invoices/${invoiceId}`, {
        headers: { Accept: "application/vnd.retailer.v10+pdf", Authorization: `Bearer ${token}` },
      }, async (r) => {
        if (!r.ok) throw new Error(`bol PDF ${invoiceId}: HTTP ${r.status}`);
        return await r.arrayBuffer();
      }, 30_000);
      const head = new TextDecoder().decode(new Uint8Array(buf).subarray(0, 5));
      if (head !== "%PDF-") throw new Error(`bol PDF ${invoiceId}: geen PDF`);
      return toBase64(buf);
    },
  };
}

async function odooApi(env: OdooEnv): Promise<OdooPurchaseApi & { repairPdf(invoiceId: string, pdfBase64: string): Promise<number> }> {
  const uid = await withTimeout(odooAuthenticate(env));
  const kw = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    withTimeout(odooExecKw(env, uid, model, method, args, kwargs));
  const journals = await kw("account.journal", "search_read", [[["type", "=", "purchase"]]], { fields: ["id", "code"], order: "id" }) as Array<{ id: number; code: string }>;
  const journal = journals.find((j) => j.code === "AK1") ?? journals[0];
  if (!journal) throw new Error("geen aankoopdagboek in Odoo");
  const byAttachment = async (fileName: string): Promise<number | null> => {
    const att = await kw("ir.attachment", "search_read", [[["name", "=", fileName], ["res_model", "=", "account.move"]]], { fields: ["res_id"], order: "res_id", limit: 1 }) as Array<{ res_id: number }>;
    return att?.[0]?.res_id || null;
  };
  /** Concept = aankoopfactuur, en de OCR is gevraagd (best effort: Pieter kan ook zelf). */
  const ensureBillAndOcr = async (moveId: number) => {
    const [m] = await kw("account.move", "read", [[moveId]], { fields: ["move_type", "state", "extract_state"] }) as Array<{ move_type: string; state: string; extract_state: string }>;
    if (!m || m.state !== "draft") return;
    if (m.move_type === "entry") await kw("account.move", "write", [[moveId], { move_type: "in_invoice" }]);
    if (!m.extract_state || ["no_extract_requested", "error_status"].includes(m.extract_state)) {
      try { await kw("account.move", "action_manual_send_for_digitization", [[moveId]]); } catch (e) {
        console.warn(`OCR voor ${moveId} niet gestart: ${errMsg(e)}`);
      }
    }
  };
  return {
    async findByRef(ref) {
      const byRef = await kw("account.move", "search", [[["ref", "=", ref], ["move_type", "in", ["in_invoice", "in_refund"]]]], { limit: 1 }) as number[];
      if (byRef?.length) return byRef[0];
      // Vangnet: een eerder concept waarvan de Referentie (nog) niet gezet werd.
      return await byAttachment(`bol-${ref}.pdf`);
    },
    async uploadPdf(fileName, pdfBase64) {
      // saas~19.x: het binaire veld heet `raw` (base64 over JSON-RPC); `datas` bestaat niet
      // meer en werd stil genegeerd (lege bijlage, 27-10).
      const attId = await kw("ir.attachment", "create", [{ name: fileName, raw: pdfBase64, mimetype: "application/pdf" }]) as number;
      const [{ file_size: size } = { file_size: 0 }] = await kw("ir.attachment", "read", [[attId]], { fields: ["file_size"] }) as Array<{ file_size: number }>;
      if (!size) throw new Error(`Odoo bewaarde de PDF niet (${fileName}, 0 bytes)`);
      let moveId: number | null = null;
      try {
        // Dezelfde context als de knop Uploaden in het aankoopdagboek: anders wordt het een
        // gewone boeking (move_type entry) zonder OCR.
        moveId = moveIdFromAction(await kw("account.journal", "create_document_from_attachment", [[journal.id], [attId]], {
          context: { default_move_type: "in_invoice", default_journal_id: journal.id },
        }));
      } catch (e) {
        // Een time-out breekt de aanroep in Odoo niet af: kijk of het concept er toch is.
        moveId = await byAttachment(fileName).catch(() => null);
        if (!moveId) throw e;
      }
      if (!moveId) moveId = await byAttachment(fileName);
      if (!moveId) throw new Error(`Odoo gaf geen concept terug voor ${fileName}`);
      await ensureBillAndOcr(moveId);
      return moveId;
    },
    async repairPdf(invoiceId, pdfBase64) {
      const fileName = `bol-${invoiceId}.pdf`;
      const att = await kw("ir.attachment", "search_read", [[["name", "=", fileName], ["res_model", "=", "account.move"]]], { fields: ["id", "res_id", "file_size"], order: "id", limit: 1 }) as Array<{ id: number; res_id: number; file_size: number }>;
      if (!att.length) throw new Error(`geen bijlage ${fileName}`);
      const [{ state } = { state: "" }] = await kw("account.move", "read", [[att[0].res_id]], { fields: ["state"] }) as Array<{ state: string }>;
      if (state !== "draft") throw new Error(`${fileName}: boeking ${att[0].res_id} is geen concept meer`);
      if (!att[0].file_size) await kw("ir.attachment", "write", [[att[0].id], { raw: pdfBase64 }]);
      await ensureBillAndOcr(att[0].res_id);
      return att[0].res_id;
    },
    async setRef(moveId, ref) {
      await kw("account.move", "write", [[moveId], { ref }]);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: INKOOP_VERSION });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const denied = await denyUnlessCron(req, supabase, corsHeaders);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { days?: number; dryRun?: boolean; repairInvoiceIds?: string[] };
    // Herstel: de PDF van deze bol-facturen opnieuw ophalen en in hun (lege) concept zetten.
    const repairIds = (Array.isArray(body.repairInvoiceIds) ? body.repairInvoiceIds : [])
      .map(String).filter((x) => /^\d{6,20}$/.test(x)).slice(0, 20);
    const days = Math.min(Math.max(Number(body.days) || 62, 1), 366);
    const dryRun = body.dryRun === true;
    const deadline = Date.now() + 100_000;
    const today = new Date().toISOString().slice(0, 10);

    const { data: conns, error: cErr } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id, credentials")
      .eq("marketplace_type", "bol_com")
      .eq("is_active", true);
    if (cErr) throw new Error(`marketplace_connections: ${cErr.message}`);

    const results: Record<string, unknown> = {};
    for (const c of conns ?? []) {
      const label = `bol ${c.tenant_id}`;
      try {
        const { data: cred, error: oErr } = await supabase
          .from("tenant_odoo_credentials")
          .select("odoo_url, odoo_db, odoo_login, api_key_ciphertext")
          .eq("tenant_id", c.tenant_id)
          .maybeSingle();
        if (oErr) throw new Error(`odoo-credentials: ${oErr.message}`);
        if (!cred) { results[label] = { skipped: "geen Odoo-koppeling" }; continue; }
        const env: OdooEnv = {
          url: assertValidOdooUrl(cred.odoo_url), db: cred.odoo_db, login: cred.odoo_login,
          apiKey: await decryptOdooKey(cred.api_key_ciphertext),
        };
        const bol = await bolApi(c.credentials as { clientId?: string; clientSecret?: string });
        const odoo = await odooApi(env);
        if (repairIds.length) {
          const repaired: Record<string, unknown> = {};
          for (const id of repairIds) {
            try { repaired[id] = dryRun ? "dry" : await odoo.repairPdf(id, await bol.downloadPdf(id)); } catch (e) { repaired[id] = { error: errMsg(e) }; }
          }
          results[label] = { repaired };
          continue;
        }
        results[label] = await importBolInvoices({
          db: supabase, bol, odoo, tenantId: c.tenant_id, today, days, dryRun, deadline,
        });
      } catch (e) {
        results[label] = { error: errMsg(e) };
        console.error(`import-supplier-invoices ${label}: ${errMsg(e)}`);
      }
    }
    return json({ success: true, version: INKOOP_VERSION, dryRun, days, results });
  } catch (e) {
    console.error("import-supplier-invoices fatal:", errMsg(e));
    return json({ success: false, error: errMsg(e) }, 500);
  }
});

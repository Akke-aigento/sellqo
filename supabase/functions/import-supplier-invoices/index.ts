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

async function odooApi(env: OdooEnv): Promise<OdooPurchaseApi> {
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
  return {
    async findByRef(ref) {
      const byRef = await kw("account.move", "search", [[["ref", "=", ref], ["move_type", "in", ["in_invoice", "in_refund"]]]], { limit: 1 }) as number[];
      if (byRef?.length) return byRef[0];
      // Vangnet: een eerder concept waarvan de Referentie (nog) niet gezet werd.
      return await byAttachment(`bol-${ref}.pdf`);
    },
    async uploadPdf(fileName, pdfBase64) {
      const attId = await kw("ir.attachment", "create", [{ name: fileName, datas: pdfBase64, mimetype: "application/pdf" }]) as number;
      let moveId: number | null = null;
      try {
        moveId = moveIdFromAction(await kw("account.journal", "create_document_from_attachment", [[journal.id], [attId]]));
      } catch (e) {
        // Een time-out breekt de aanroep in Odoo niet af: kijk of het concept er toch is.
        moveId = await byAttachment(fileName).catch(() => null);
        if (!moveId) throw e;
      }
      if (!moveId) moveId = await byAttachment(fileName);
      if (!moveId) throw new Error(`Odoo gaf geen concept terug voor ${fileName}`);
      return moveId;
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
    const body = (await req.json().catch(() => ({}))) as { days?: number; dryRun?: boolean };
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
        results[label] = await importBolInvoices({
          db: supabase, bol: await bolApi(c.credentials as { clientId?: string; clientSecret?: string }),
          odoo: await odooApi(env), tenantId: c.tenant_id, today, days, dryRun, deadline,
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

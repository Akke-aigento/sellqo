// INKOOP-3 — inkoopfacturen: SellQo is de inbox, Odoo de bestemming.
// Regels en stroom: _shared/supplierInbox.ts. bol-API: _shared/supplierInvoices.ts.
//
//   GET                                     versie-vingerafdruk (geen auth, geen neveneffect)
//   POST (cron of service, x-cron-secret):
//     { mode: "daily" }  (standaard)        per winkel: bol ophalen → doorsturen → status terughalen
//     { mode: "push", tenantId, documentId } één document meteen doorsturen (trigger na insert)
//     { mode: "archive", tenantId, routes, fallbackTenantId, limit, dryRun }
//                                            eenmalig: Odoo-aankoopfacturen als document in SellQo
//   dryRun: true  →  niets schrijven, enkel melden wat er zou gebeuren.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { decryptOdooKey } from "../_shared/odooCrypto.ts";
import { assertValidOdooUrl, odooAuthenticate, odooExecKw, type OdooEnv } from "../_shared/odooRpc.ts";
import { dateWindows, moveIdFromAction, parseBolInvoiceList, type BolInvoiceItem } from "../_shared/supplierInvoices.ts";
import {
  CLAIM_STALE_MS,
  findOrCreateSupplier,
  INBOX_VERSION,
  isSettled,
  MAX_PUSH_ATTEMPTS,
  mimeFor,
  odooFileName,
  odooMoveUrl,
  patchFromOdoo,
  routeByPartner,
  type OdooBill,
} from "../_shared/supplierInbox.ts";

const BUCKET = "supplier-documents";
const BILL_FIELDS = [
  "move_type", "state", "ref", "invoice_date", "invoice_date_due", "amount_untaxed", "amount_tax",
  "amount_total", "payment_state", "partner_id", "currency_id",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** fetch + body lezen binnen één time-out. */
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

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- Odoo

interface Odoo {
  url: string;
  kw: (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;
  journalId: number;
}

async function odooFor(supabase: SupabaseClient, tenantId: string): Promise<Odoo | null> {
  const { data: cred, error } = await supabase
    .from("tenant_odoo_credentials")
    .select("odoo_url, odoo_db, odoo_login, api_key_ciphertext")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`odoo-credentials: ${error.message}`);
  if (!cred) return null;
  const env: OdooEnv = {
    url: assertValidOdooUrl(cred.odoo_url), db: cred.odoo_db, login: cred.odoo_login,
    apiKey: await decryptOdooKey(cred.api_key_ciphertext),
  };
  const uid = await withTimeout(odooAuthenticate(env));
  const kw = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    withTimeout(odooExecKw(env, uid, model, method, args, kwargs));
  const journals = await kw("account.journal", "search_read", [[["type", "=", "purchase"]]], { fields: ["id", "code"], order: "id" }) as Array<{ id: number; code: string }>;
  const journal = journals.find((j) => j.code === "AK1") ?? journals[0];
  if (!journal) throw new Error("geen aankoopdagboek in Odoo");
  return { url: env.url, kw, journalId: journal.id };
}

async function moveByAttachmentName(odoo: Odoo, name: string): Promise<number | null> {
  const att = await odoo.kw("ir.attachment", "search_read", [[["name", "=", name], ["res_model", "=", "account.move"]]], { fields: ["res_id"], order: "res_id", limit: 1 }) as Array<{ res_id: number }>;
  return att?.[0]?.res_id || null;
}

async function moveByRef(odoo: Odoo, ref: string): Promise<number | null> {
  const ids = await odoo.kw("account.move", "search", [[["ref", "=", ref], ["move_type", "in", ["in_invoice", "in_refund"]]]], { limit: 1 }) as number[];
  return ids?.[0] ?? null;
}

/** Concept = aankoopfactuur/-creditnota, OCR gevraagd (best effort). */
async function ensureBillAndOcr(odoo: Odoo, moveId: number, creditNote: boolean): Promise<void> {
  const [m] = await odoo.kw("account.move", "read", [[moveId]], { fields: ["move_type", "state", "extract_state"] }) as Array<{ move_type: string; state: string; extract_state: string }>;
  if (!m || m.state !== "draft") return;
  if (m.move_type === "entry") await odoo.kw("account.move", "write", [[moveId], { move_type: creditNote ? "in_refund" : "in_invoice" }]);
  if (!m.extract_state || ["no_extract_requested", "error_status"].includes(m.extract_state)) {
    try { await odoo.kw("account.move", "action_manual_send_for_digitization", [[moveId]]); } catch (e) {
      console.warn(`OCR voor ${moveId} niet gestart: ${errMsg(e)}`);
    }
  }
}

/** Bestand uploaden in het aankoopdagboek (zoals de knop Uploaden) → move-id. */
async function uploadToOdoo(odoo: Odoo, fileName: string, b64: string, mimetype: string, creditNote: boolean): Promise<number> {
  // saas~19.x: het binaire veld heet `raw`; `datas` wordt stil genegeerd (lege bijlage).
  const attId = await odoo.kw("ir.attachment", "create", [{ name: fileName, raw: b64, mimetype }]) as number;
  const [{ file_size: size } = { file_size: 0 }] = await odoo.kw("ir.attachment", "read", [[attId]], { fields: ["file_size"] }) as Array<{ file_size: number }>;
  if (!size) throw new Error(`Odoo bewaarde het bestand niet (${fileName}, 0 bytes)`);
  let moveId: number | null = null;
  try {
    moveId = moveIdFromAction(await odoo.kw("account.journal", "create_document_from_attachment", [[odoo.journalId], [attId]], {
      context: { default_move_type: creditNote ? "in_refund" : "in_invoice", default_journal_id: odoo.journalId },
    }));
  } catch (e) {
    // Een time-out breekt de aanroep in Odoo niet af: kijk of het concept er toch is.
    moveId = await moveByAttachmentName(odoo, fileName).catch(() => null);
    if (!moveId) throw e;
  }
  if (!moveId) moveId = await moveByAttachmentName(odoo, fileName);
  if (!moveId) throw new Error(`Odoo gaf geen concept terug voor ${fileName}`);
  await ensureBillAndOcr(odoo, moveId, creditNote);
  return moveId;
}

async function readBills(odoo: Odoo, ids: number[]): Promise<OdooBill[]> {
  if (!ids.length) return [];
  return await odoo.kw("account.move", "search_read", [[["id", "in", ids]]], { fields: BILL_FIELDS }) as OdooBill[];
}

// ---------------------------------------------------------------- documenten

interface DocRow {
  id: string;
  tenant_id: string;
  source: string;
  document_type: string;
  document_number: string | null;
  external_id: string | null;
  file_name: string;
  storage_path: string | null;
  mime_type: string | null;
  supplier_id: string | null;
  odoo_move_id: number | null;
  odoo_status: string | null;
  payment_status: string | null;
  paid_at: string | null;
  odoo_attempts: number;
  extracted_data: Record<string, unknown> | null;
  review_status: string | null;
}
const DOC_COLS = "id, tenant_id, source, document_type, document_number, external_id, file_name, storage_path, mime_type, supplier_id, odoo_move_id, odoo_status, payment_status, paid_at, odoo_attempts, extracted_data, review_status";

/** Claim: enkel wie de rij van "vrij" naar "pending" zet, mag uploaden. */
async function claim(supabase: SupabaseClient, doc: DocRow): Promise<boolean> {
  const stale = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("supplier_documents")
    .update({ odoo_status: "pending", odoo_synced_at: new Date().toISOString(), odoo_attempts: doc.odoo_attempts + 1 })
    .eq("id", doc.id)
    .is("odoo_move_id", null)
    .or(`odoo_status.is.null,odoo_status.eq.error,and(odoo_status.eq.pending,odoo_synced_at.lt.${stale})`)
    .select("id");
  if (error) throw new Error(`claim ${doc.id}: ${error.message}`);
  return (data ?? []).length === 1;
}

async function pushOne(supabase: SupabaseClient, odoo: Odoo, doc: DocRow, dryRun: boolean): Promise<string> {
  if (!["invoice", "credit_note"].includes(doc.document_type)) return "skip:type";
  if (doc.odoo_move_id) return "skip:linked";
  // INKOOP-6: mail van een afzender die nog niet goedgekeurd is (of geweigerd) nooit naar Odoo.
  if (doc.review_status) return `skip:review-${doc.review_status}`;
  if (doc.odoo_attempts >= MAX_PUSH_ATTEMPTS) return "skip:attempts";
  if (!doc.storage_path) return "skip:no-file";
  // Enkel bestanden van de eigen winkel (ook afgedwongen met een CHECK in de databank).
  if (!doc.storage_path.startsWith(`${doc.tenant_id}/`)) return "skip:foreign-path";
  const creditNote = doc.document_type === "credit_note";
  const name = odooFileName(doc.id, doc.file_name);

  // Bestaat het al in Odoo? (eerdere poging, of een manuele upload van dezelfde bol-factuur)
  const bolRef = doc.source === "bol" ? doc.document_number : null;
  const existing = (await moveByAttachmentName(odoo, name)) ?? (bolRef ? await moveByRef(odoo, bolRef) : null);
  if (dryRun) return existing ? `link:${existing}` : "upload";
  if (!existing && !(await claim(supabase, doc))) return "skip:claimed";

  try {
    let moveId = existing;
    if (!moveId) {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
      if (error || !blob) throw new Error(`bestand ophalen: ${error?.message ?? "leeg"}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      moveId = await uploadToOdoo(odoo, name, toBase64(bytes), doc.mime_type || mimeFor(doc.file_name), creditNote);
      if (bolRef) await odoo.kw("account.move", "write", [[moveId], { ref: bolRef }]);
    }
    const { error: uErr } = await supabase.from("supplier_documents").update({
      odoo_move_id: moveId, odoo_status: "draft", odoo_error: null, odoo_synced_at: new Date().toISOString(),
      extracted_data: { ...(doc.extracted_data ?? {}), odoo_url: odooMoveUrl(odoo.url, moveId) },
    }).eq("id", doc.id).eq("tenant_id", doc.tenant_id);
    if (uErr) {
      // 23505: een ander document is al aan deze boeking gekoppeld (dubbel binnengekomen).
      throw new Error(`koppelen ${doc.id} → ${moveId}: ${uErr.message}`);
    }
    return existing ? `linked:${moveId}` : `uploaded:${moveId}`;
  } catch (e) {
    // Gekoppeld aan een boeking die al bij een ander document hoort = dubbel binnengekomen:
    // niet eindeloos opnieuw proberen.
    const duplicate = /23505|duplicate key/i.test(errMsg(e));
    const attempts = duplicate ? MAX_PUSH_ATTEMPTS : doc.odoo_attempts + 1;
    await supabase.from("supplier_documents").update({
      odoo_status: "error",
      odoo_error: (duplicate ? "Dubbel: deze factuur staat al bij een ander document. " : "") + errMsg(e).slice(0, 450),
      odoo_synced_at: new Date().toISOString(),
      // De claim zette al attempts + 1; zelfde waarde, ook zonder claim (bestaande boeking).
      odoo_attempts: attempts,
    }).eq("id", doc.id);
    // Laatste poging mislukt: de winkel moet het weten (één keer per document).
    if (attempts >= MAX_PUSH_ATTEMPTS) await notifyPushFailed(supabase, doc, errMsg(e), duplicate);
    throw e;
  }
}

async function notifyPushFailed(supabase: SupabaseClient, doc: DocRow, message: string, duplicate: boolean): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    tenant_id: doc.tenant_id,
    category: "integrations",
    type: "supplier_invoice_odoo_error",
    priority: "high",
    title: duplicate ? `Inkoopfactuur staat al in Odoo (${doc.file_name})` : `Inkoopfactuur niet naar Odoo (${doc.file_name})`,
    message: duplicate
      ? "Deze factuur hoort bij een boeking die al aan een ander document gekoppeld is. Kijk na of het een dubbel is."
      : `Na ${MAX_PUSH_ATTEMPTS} pogingen lukte het doorsturen niet: ${message.slice(0, 200)}. Upload ze manueel in Odoo of probeer later opnieuw.`,
    // Eén keer per document per dag (na een reset of verplaatsing mag hij opnieuw melden).
    data: { document_id: doc.id, dedupe_key: `supplier_odoo_error:${doc.id}:${new Date().toISOString().slice(0, 10)}` },
    action_url: "/admin/supplier-documents",
  });
  if (error && (error as { code?: string }).code !== "23505") console.error("melding Odoo-fout:", error.message);
}

async function pullTenant(supabase: SupabaseClient, odoo: Odoo, tenantId: string, today: string, deadline: number, dryRun: boolean) {
  const { data: docs, error } = await supabase
    .from("supplier_documents")
    .select(DOC_COLS)
    .eq("tenant_id", tenantId)
    .not("odoo_move_id", "is", null)
    // Enkel wat nog kan wijzigen; afgewerkte (geboekt + betaald/geannuleerd) nooit meer.
    .or("odoo_status.in.(draft,pending,error),odoo_status.is.null,and(odoo_status.eq.posted,payment_status.not.in.(paid,cancelled))")
    .order("odoo_synced_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) throw new Error(`documenten: ${error.message}`);
  const open = ((docs ?? []) as DocRow[]).filter((d) => !isSettled(d));
  const res = { checked: 0, updated: 0, missing: 0, errors: [] as string[] };
  for (let i = 0; i < open.length && Date.now() < deadline; i += 80) {
    const batch = open.slice(i, i + 80);
    const bills = await readBills(odoo, batch.map((d) => d.odoo_move_id!));
    const byId = new Map(bills.map((b) => [b.id, b]));
    for (const d of batch) {
      res.checked++;
      const bill = byId.get(d.odoo_move_id!);
      if (!bill) {
        res.missing++;
        if (!dryRun) await supabase.from("supplier_documents").update({ odoo_status: "error", odoo_error: "boeking niet meer gevonden in Odoo", odoo_synced_at: new Date().toISOString() }).eq("id", d.id);
        continue;
      }
      if (dryRun) { res.updated++; continue; }
      try {
        const patch: Record<string, unknown> = { ...patchFromOdoo(bill, today, d), odoo_synced_at: new Date().toISOString() };
        if (bill.partner_id) {
          const supplierId = await findOrCreateSupplier(supabase, tenantId, bill.partner_id);
          if (supplierId && supplierId !== d.supplier_id) patch.supplier_id = supplierId;
        }
        const { error: uErr } = await supabase.from("supplier_documents").update(patch).eq("id", d.id);
        if (uErr) throw new Error(uErr.message);
        res.updated++;
      } catch (e) { res.errors.push(`${d.id}: ${errMsg(e)}`); }
    }
  }
  return res;
}

// ---------------------------------------------------------------- bol

async function bolToken(credentials: { clientId?: string; clientSecret?: string }): Promise<string> {
  if (!credentials?.clientId || !credentials?.clientSecret) throw new Error("bol-koppeling zonder clientId/clientSecret");
  return await timed("https://login.bol.com/token?grant_type=client_credentials", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}` },
  }, async (r) => {
    if (!r.ok) throw new Error(`bol-token: HTTP ${r.status}`);
    return (await r.json()).access_token as string;
  });
}

async function bolList(token: string, start: string, end: string): Promise<BolInvoiceItem[]> {
  return await timed(`https://api.bol.com/retailer/invoices?period-start-date=${start}&period-end-date=${end}`, {
    headers: { Accept: "application/vnd.retailer.v10+json", Authorization: `Bearer ${token}` },
  }, async (r) => {
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`bol invoices ${start}..${end}: HTTP ${r.status}`);
    return parseBolInvoiceList(await r.json());
  });
}

async function bolPdf(token: string, invoiceId: string): Promise<Uint8Array> {
  const buf = await timed(`https://api.bol.com/retailer/invoices/${invoiceId}`, {
    headers: { Accept: "application/vnd.retailer.v10+pdf", Authorization: `Bearer ${token}` },
  }, async (r) => {
    if (!r.ok) throw new Error(`bol PDF ${invoiceId}: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }, 30_000);
  if (new TextDecoder().decode(buf.subarray(0, 5)) !== "%PDF-") throw new Error(`bol PDF ${invoiceId}: geen PDF`);
  return buf;
}

async function findOrCreateSupplierByName(supabase: SupabaseClient, tenantId: string, name: string): Promise<string | null> {
  const { data } = await supabase.from("suppliers").select("id").eq("tenant_id", tenantId).ilike("name", name).limit(1);
  if (data?.[0]?.id) return data[0].id as string;
  const ins = await supabase.from("suppliers").insert({ tenant_id: tenantId, name, country: null }).select("id").single();
  return ins.error ? null : (ins.data.id as string);
}

/** bol-facturen → supplier_documents (bron bol). Wat er al is (ook via het archief), slaan we over. */
async function ingestBol(supabase: SupabaseClient, tenantId: string, credentials: unknown, today: string, days: number, deadline: number, dryRun: boolean) {
  const token = await bolToken(credentials as { clientId?: string; clientSecret?: string });
  const items: BolInvoiceItem[] = [];
  for (const w of dateWindows(today, days)) items.push(...await bolList(token, w.start, w.end));
  const unique = [...new Map(items.map((i) => [i.invoiceId, i])).values()];
  const res = { scanned: unique.length, added: [] as string[], known: 0, errors: [] as string[] };
  if (!unique.length) return res;

  const ids = unique.map((i) => i.invoiceId);
  const { data: have, error } = await supabase
    .from("supplier_documents")
    .select("external_id, document_number")
    .eq("tenant_id", tenantId)
    .or(`external_id.in.(${ids.map((i) => `bol:${i}`).join(",")}),document_number.in.(${ids.join(",")})`);
  if (error) throw new Error(`bestaande bol-documenten: ${error.message}`);
  const known = new Set<string>();
  for (const r of have ?? []) {
    if (r.external_id?.startsWith("bol:")) known.add(r.external_id.slice(4));
    if (r.document_number) known.add(String(r.document_number));
  }

  // INKOOP-2 (27-10) uploadde al bol-facturen naar Odoo: die worden een document dat meteen
  // aan hun Odoo-boeking hangt, zonder nieuwe upload.
  const { data: inkoop2, error: i2Err } = await supabase
    .from("supplier_invoice_imports")
    .select("external_id, odoo_move_id")
    .eq("source", "bol")
    .eq("tenant_id", tenantId)
    .in("external_id", ids);
  if (i2Err) throw new Error(`supplier_invoice_imports: ${i2Err.message}`);
  const linkedMove = new Map((inkoop2 ?? []).filter((r: { odoo_move_id: number | null }) => r.odoo_move_id)
    .map((r: { external_id: string; odoo_move_id: number }) => [r.external_id, Number(r.odoo_move_id)]));

  const fresh = unique.filter((i) => !known.has(i.invoiceId));
  res.known = unique.length - fresh.length;
  if (!fresh.length) return res;
  const supplierId = dryRun ? null : await findOrCreateSupplierByName(supabase, tenantId, "bol");
  for (const inv of fresh) {
    if (!inv.hasPdf) { res.errors.push(`${inv.invoiceId}: geen PDF bij bol`); continue; }
    if (deadline - Date.now() < 30_000) break;
    if (dryRun) { res.added.push(inv.invoiceId); continue; }
    try {
      const pdf = await bolPdf(token, inv.invoiceId);
      const path = `${tenantId}/bol/${inv.invoiceId}.pdf`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`opslaan: ${upErr.message}`);
      const { error: insErr } = await supabase.from("supplier_documents").insert({
        tenant_id: tenantId, supplier_id: supplierId, source: "bol", external_id: `bol:${inv.invoiceId}`,
        document_type: inv.payable < 0 ? "credit_note" : "invoice", document_number: inv.invoiceId,
        document_date: inv.issueDate || null, file_name: `bol-${inv.invoiceId}.pdf`, file_url: path,
        file_size: pdf.length, mime_type: "application/pdf", storage_path: path, currency: "EUR",
        extracted_data: { bol: { invoiceType: inv.invoiceType, payable: inv.payable } },
        ...(linkedMove.has(inv.invoiceId)
          ? { odoo_move_id: linkedMove.get(inv.invoiceId), odoo_status: "draft", odoo_synced_at: new Date().toISOString() }
          : {}),
      });
      if (insErr && (insErr as { code?: string }).code !== "23505") throw new Error(insErr.message);
      res.added.push(inv.invoiceId);
    } catch (e) { res.errors.push(`${inv.invoiceId}: ${errMsg(e)}`); }
  }
  return res;
}

// ---------------------------------------------------------------- archief

async function archive(supabase: SupabaseClient, odoo: Odoo, body: {
  routes?: Array<{ pattern: string; tenantId: string }>; fallbackTenantId?: string; limit?: number; dryRun?: boolean;
}, deadline: number) {
  const fallback = body.fallbackTenantId;
  if (!fallback) throw new Error("fallbackTenantId ontbreekt");
  const routes = Array.isArray(body.routes) ? body.routes : [];
  const tenantIds = [...new Set([fallback, ...routes.map((r) => r.tenantId)])];
  const { data: linked, error } = await supabase.from("supplier_documents").select("odoo_move_id").in("tenant_id", tenantIds).not("odoo_move_id", "is", null);
  if (error) throw new Error(`gekoppelde documenten: ${error.message}`);
  const done = new Set((linked ?? []).map((r: { odoo_move_id: number }) => Number(r.odoo_move_id)));
  // bol-documenten die nog op hun push wachten, dekken hun Odoo-boeking al (zelfde Referentie).
  const { data: bolDocs, error: bdErr } = await supabase.from("supplier_documents").select("document_number").in("tenant_id", tenantIds).eq("source", "bol");
  if (bdErr) throw new Error(`bol-documenten: ${bdErr.message}`);
  const bolNumbers = new Set((bolDocs ?? []).map((r: { document_number: string | null }) => String(r.document_number ?? "")).filter(Boolean));
  const all = await odoo.kw("account.move", "search_read", [[["move_type", "in", ["in_invoice", "in_refund"]], ["state", "!=", "cancel"]]], {
    fields: [...BILL_FIELDS, "message_main_attachment_id", "name"], order: "id", limit: 5000,
  }) as Array<OdooBill & { name: string | false; message_main_attachment_id: [number, string] | false }>;
  const todo = all.filter((m) => !done.has(m.id) && !(m.ref && bolNumbers.has(String(m.ref))));
  const limit = Math.min(Math.max(Number(body.limit) || 40, 1), 200);
  const today = new Date().toISOString().slice(0, 10);
  const res = { total: all.length, alreadyInSellqo: all.length - todo.length, imported: 0, perTenant: {} as Record<string, number>, noFile: 0, errors: [] as string[], remaining: 0 };

  let n = 0;
  for (const m of todo) {
    if (n >= limit || Date.now() > deadline) break;
    n++;
    const partnerName = m.partner_id ? m.partner_id[1] : "";
    const tenantId = routeByPartner(partnerName, routes, fallback);
    res.perTenant[tenantId] = (res.perTenant[tenantId] ?? 0) + 1;
    if (body.dryRun) { res.imported++; continue; }
    try {
      let path: string | null = null;
      let fileName = `${m.name || `odoo-${m.id}`}.pdf`.replace(/[\\/]/g, "-");
      let size = 0;
      let mime = "application/pdf";
      if (m.message_main_attachment_id) {
        const [att] = await odoo.kw("ir.attachment", "read", [[m.message_main_attachment_id[0]]], { fields: ["name", "raw", "mimetype", "file_size"] }) as Array<{ name: string; raw: string | false; mimetype: string; file_size: number }>;
        if (att?.raw) {
          const bytes = fromBase64(att.raw);
          mime = att.mimetype || mimeFor(att.name);
          fileName = att.name || fileName;
          const ext = (/\.([a-z0-9]{2,5})$/i.exec(fileName)?.[1] ?? "pdf").toLowerCase();
          path = `${tenantId}/odoo/${m.id}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
          if (upErr) throw new Error(`opslaan: ${upErr.message}`);
          size = bytes.length;
        }
      }
      if (!path) res.noFile++;
      const supplierId = m.partner_id ? await findOrCreateSupplier(supabase, tenantId, m.partner_id) : null;
      const patch = patchFromOdoo(m, today);
      const { error: insErr } = await supabase.from("supplier_documents").insert({
        tenant_id: tenantId, supplier_id: supplierId, source: "odoo_archive", external_id: `odoo:${m.id}`,
        file_name: fileName, file_url: path ?? "", file_size: size || null, mime_type: path ? mime : null, storage_path: path,
        odoo_move_id: m.id, odoo_synced_at: new Date().toISOString(),
        extracted_data: { odoo_url: odooMoveUrl(odoo.url, m.id), odoo_name: m.name || null },
        ...patch,
        document_type: patch.document_type ?? "invoice",
      });
      if (insErr && (insErr as { code?: string }).code !== "23505") throw new Error(insErr.message);
      res.imported++;
    } catch (e) { res.errors.push(`${m.id}: ${errMsg(e)}`); }
  }
  res.remaining = Math.max(todo.length - n, 0);
  return res;
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: INBOX_VERSION });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const denied = await denyUnlessCron(req, supabase, corsHeaders);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string; tenantId?: string; documentId?: string; days?: number; dryRun?: boolean;
    routes?: Array<{ pattern: string; tenantId: string }>; fallbackTenantId?: string; limit?: number;
  };
  const dryRun = body.dryRun === true;
  const deadline = Date.now() + 100_000;
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (body.mode === "push") {
      if (!body.tenantId || !body.documentId) return json({ success: false, error: "tenantId en documentId vereist" }, 400);
      const { data: doc, error } = await supabase.from("supplier_documents").select(DOC_COLS).eq("id", body.documentId).eq("tenant_id", body.tenantId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!doc) return json({ success: false, error: "document niet gevonden" }, 404);
      const odoo = await odooFor(supabase, body.tenantId);
      if (!odoo) return json({ success: true, version: INBOX_VERSION, result: "skip:no-odoo" });
      return json({ success: true, version: INBOX_VERSION, result: await pushOne(supabase, odoo, doc as DocRow, dryRun) });
    }

    if (body.mode === "archive") {
      if (!body.tenantId) return json({ success: false, error: "tenantId (Odoo-koppeling) vereist" }, 400);
      const odoo = await odooFor(supabase, body.tenantId);
      if (!odoo) return json({ success: false, error: "geen Odoo-koppeling" }, 400);
      return json({ success: true, version: INBOX_VERSION, dryRun, result: await archive(supabase, odoo, body, deadline) });
    }

    // daily
    const days = Math.min(Math.max(Number(body.days) || 62, 1), 366);
    const { data: settings, error: sErr } = await supabase.from("tenant_odoo_settings").select("tenant_id").eq("push_supplier_documents", true);
    if (sErr) throw new Error(`tenant_odoo_settings: ${sErr.message}`);
    const { data: bols, error: bErr } = await supabase.from("marketplace_connections").select("tenant_id, credentials").eq("marketplace_type", "bol_com").eq("is_active", true);
    if (bErr) throw new Error(`marketplace_connections: ${bErr.message}`);
    const pushTenants = new Set((settings ?? []).map((s: { tenant_id: string }) => s.tenant_id));
    const tenants = [...new Set([...pushTenants, ...(bols ?? []).map((b: { tenant_id: string }) => b.tenant_id)])]
      .filter((t) => !body.tenantId || t === body.tenantId);

    const results: Record<string, unknown> = {};
    for (const tenantId of tenants) {
      const r: Record<string, unknown> = {};
      try {
        const bol = (bols ?? []).find((b: { tenant_id: string }) => b.tenant_id === tenantId);
        if (bol) {
          try { r.bol = await ingestBol(supabase, tenantId, bol.credentials, today, days, deadline, dryRun); } catch (e) { r.bol = { error: errMsg(e) }; }
        }
        if (pushTenants.has(tenantId)) {
          const odoo = await odooFor(supabase, tenantId);
          if (!odoo) { r.odoo = "geen Odoo-koppeling"; results[tenantId] = r; continue; }
          const { data: pending, error } = await supabase.from("supplier_documents").select(DOC_COLS)
            .eq("tenant_id", tenantId).is("odoo_move_id", null).in("document_type", ["invoice", "credit_note"])
            .neq("source", "odoo_archive").lt("odoo_attempts", MAX_PUSH_ATTEMPTS).not("storage_path", "is", null)
            .is("review_status", null)
            .order("odoo_attempts").order("created_at").limit(50);
          if (error) throw new Error(`te versturen: ${error.message}`);
          const pushed: Record<string, string> = {};
          for (const d of (pending as DocRow[]) ?? []) {
            if (deadline - Date.now() < 45_000) break;
            try { pushed[d.id] = await pushOne(supabase, odoo, d, dryRun); } catch (e) { pushed[d.id] = `error: ${errMsg(e)}`; }
          }
          r.push = pushed;
          r.pull = await pullTenant(supabase, odoo, tenantId, today, deadline, dryRun);
        }
      } catch (e) { r.error = errMsg(e); console.error(`import-supplier-invoices ${tenantId}: ${errMsg(e)}`); }
      results[tenantId] = r;
    }
    return json({ success: true, version: INBOX_VERSION, dryRun, days, results });
  } catch (e) {
    console.error("import-supplier-invoices fatal:", errMsg(e));
    return json({ success: false, error: errMsg(e) }, 500);
  }
});

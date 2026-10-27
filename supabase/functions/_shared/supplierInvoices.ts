// INKOOP-2 — leveranciersfacturen die enkel via een API bestaan, als concept in het
// aankoopdagboek van Odoo (nomadix-bv). Eerste bron: bol.com (VanXcel-koppeling).
//
// Werkwijze = exact wat Akke tot nu manueel deed: de PDF uploaden in het aankoopdagboek
// (account.journal.create_document_from_attachment, de knop "Uploaden"). Odoo maakt een
// concept, de OCR vult leverancier, datum en regels, Pieter keurt goed.
// SellQo vult bewust GEEN bedragen in: bol's ALL_IN_ONE-factuur verrekent omzet met kosten,
// en Pieter boekt die anders dan het payableAmount (gemeten 27-10: bol −35,77 → Odoo 20,13).
//
// Nooit dubbel: een factuur wordt overgeslagen als (a) supplier_invoice_imports haar al kent,
// of (b) Odoo al een aankoopfactuur/-creditnota heeft met Referentie = het bol-factuurnummer
// (zo zitten de 46 manueel geüploade bol-facturen er al in). Enkel concepten, nooit boeken.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele clients */

export const INKOOP_VERSION = "INKOOP-2";

export interface BolInvoiceItem {
  invoiceId: string;
  issueDate: string;          // YYYY-MM-DD (Europe/Brussels)
  invoiceType: string;        // ALL_IN_ONE | ADVERTISING_VIA_BOL | …
  payable: number;            // payableAmount.amount (kan negatief zijn)
  hasPdf: boolean;
}

/** bol geeft epoch-milliseconden; de factuurdatum is de kalenderdag in Brussel. */
export function brusselsDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(ms));
}

export function parseBolInvoiceList(json: any): BolInvoiceItem[] {
  const items = Array.isArray(json?.invoiceListItems) ? json.invoiceListItems : [];
  return items
    .filter((i: any) => typeof i?.invoiceId === "string" && /^\d{6,20}$/.test(i.invoiceId))
    .map((i: any) => ({
      invoiceId: i.invoiceId,
      issueDate: typeof i.issueDate === "number" ? brusselsDate(i.issueDate) : String(i.issueDate ?? "").slice(0, 10),
      invoiceType: String(i.invoiceType ?? ""),
      payable: Number(i?.legalMonetaryTotal?.payableAmount?.amount ?? 0),
      hasPdf: (i?.invoiceMediaTypes?.availableMediaTypes ?? []).some((m: string) => /pdf/.test(m)),
    }));
}

/** Vensters van hoogstens 31 dagen (bol staat er max. 32 toe), van oud naar nieuw. */
export function dateWindows(today: string, days: number): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  const endAll = new Date(`${today}T00:00:00Z`);
  let start = new Date(endAll.getTime() - days * 86400000);
  while (start < endAll) {
    const end = new Date(Math.min(start.getTime() + 31 * 86400000, endAll.getTime()));
    out.push({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    start = end;
  }
  return out;
}

/** Het move-id uit het actie-antwoord van create_document_from_attachment. */
export function moveIdFromAction(action: any): number | null {
  if (typeof action?.res_id === "number" && action.res_id > 0) return action.res_id;
  const dom = action?.domain;
  if (Array.isArray(dom)) {
    for (const leaf of dom) {
      // Splitst Odoo de PDF in meerdere concepten, dan het eerste (het laagste id);
      // de andere hangen aan dezelfde bijlage en Pieter ziet ze in het dagboek.
      if (Array.isArray(leaf) && leaf[0] === "id" && leaf[1] === "in" && Array.isArray(leaf[2]) && leaf[2].length >= 1) {
        const ids = leaf[2].map(Number).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
        return ids[0] ?? null;
      }
    }
  }
  return null;
}

export interface OdooPurchaseApi {
  /** Bestaat er al een aankoopfactuur of -creditnota met deze Referentie? → move-id of null. */
  findByRef(ref: string): Promise<number | null>;
  /** PDF uploaden in het aankoopdagboek (zoals de knop Uploaden) → move-id. */
  uploadPdf(fileName: string, pdfBase64: string): Promise<number>;
  /** Referentie zetten op het nieuwe concept (zodat een volgende run het herkent). */
  setRef(moveId: number, ref: string): Promise<void>;
}

export interface BolApi {
  listInvoices(start: string, end: string): Promise<BolInvoiceItem[]>;
  downloadPdf(invoiceId: string): Promise<string>; // base64
}

export interface ImportDb {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

export interface ImportResult {
  scanned: number;
  created: Array<{ invoiceId: string; moveId: number }>;
  alreadyInOdoo: string[];
  known: number;
  skippedNoPdf: string[];
  errors: Array<{ invoiceId: string; error: string }>;
}

export async function importBolInvoices(opts: {
  db: ImportDb; bol: BolApi; odoo: OdooPurchaseApi; tenantId: string; today: string; days: number;
  dryRun: boolean; deadline: number;
}): Promise<ImportResult> {
  const { db, bol, odoo, tenantId, dryRun } = opts;
  const res: ImportResult = { scanned: 0, created: [], alreadyInOdoo: [], known: 0, skippedNoPdf: [], errors: [] };

  const items: BolInvoiceItem[] = [];
  for (const w of dateWindows(opts.today, opts.days)) items.push(...await bol.listInvoices(w.start, w.end));
  const unique = [...new Map(items.map((i) => [i.invoiceId, i])).values()];
  res.scanned = unique.length;
  if (!unique.length) return res;

  const { data: knownRows, error: kErr } = await db
    .from("supplier_invoice_imports")
    .select("external_id")
    .eq("source", "bol")
    .in("external_id", unique.map((i) => i.invoiceId));
  if (kErr) throw new Error(`supplier_invoice_imports: ${kErr.message}`);
  const known = new Set((knownRows ?? []).map((r: { external_id: string }) => r.external_id));

  for (const inv of unique) {
    if (known.has(inv.invoiceId)) { res.known++; continue; }
    // Eén factuur kan tot ±60 s duren (PDF + Odoo-aanroepen): enkel beginnen als dat nog past.
    if (opts.deadline - Date.now() < 60_000) break;
    try {
      const existing = await odoo.findByRef(inv.invoiceId);
      if (existing) {
        res.alreadyInOdoo.push(inv.invoiceId);
        if (!dryRun) await record(db, tenantId, inv, existing, "exists");
        continue;
      }
      if (!inv.hasPdf) { res.skippedNoPdf.push(inv.invoiceId); continue; }
      if (dryRun) { res.created.push({ invoiceId: inv.invoiceId, moveId: 0 }); continue; }
      const pdf = await bol.downloadPdf(inv.invoiceId);
      const moveId = await odoo.uploadPdf(`bol-${inv.invoiceId}.pdf`, pdf);
      // Eerst vastleggen, dan de Referentie: faalt setRef, dan maakt de volgende run geen tweede concept.
      await record(db, tenantId, inv, moveId, "created");
      await odoo.setRef(moveId, inv.invoiceId);
      res.created.push({ invoiceId: inv.invoiceId, moveId });
    } catch (e) {
      res.errors.push({ invoiceId: inv.invoiceId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return res;
}

async function record(db: ImportDb, tenantId: string, inv: BolInvoiceItem, moveId: number, status: "created" | "exists") {
  const { error } = await db.from("supplier_invoice_imports").insert({
    tenant_id: tenantId,
    source: "bol",
    external_id: inv.invoiceId,
    invoice_date: inv.issueDate || null,
    invoice_type: inv.invoiceType,
    payable_amount: inv.payable,
    odoo_move_id: moveId,
    status,
  });
  if (!error) return;
  // 23505 = al vastgelegd. Voor "exists" onschuldig; voor "created" betekent het dat een
  // gelijktijdige run dezelfde factuur ook uploadde: melden, met het tweede concept erbij.
  if ((error as { code?: string }).code === "23505" && status === "exists") return;
  throw new Error(`vastleggen ${inv.invoiceId} (Odoo-concept ${moveId}): ${error.message}`);
}

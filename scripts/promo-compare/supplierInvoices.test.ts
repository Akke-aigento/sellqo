/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas */
// INKOOP-2 — bol-facturen als concept in Odoo: nooit dubbel, enkel wat nog niet in Odoo zit.
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/supplierInvoices.test.ts
import {
  brusselsDate,
  dateWindows,
  importBolInvoices,
  moveIdFromAction,
  parseBolInvoiceList,
  type BolApi,
  type BolInvoiceItem,
  type OdooPurchaseApi,
} from "../../supabase/functions/_shared/supplierInvoices.ts";
import { StatefulDb } from "./statefulDb.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

const T = "54f6b480-280b-42e1-b843-d5beb2831acd";

Deno.test("bol-lijst lezen zoals de live API (27-10)", () => {
  const items = parseBolInvoiceList({
    invoiceListItems: [
      { invoiceId: "3916522562326", issueDate: 1792015200000, invoiceType: "ALL_IN_ONE",
        legalMonetaryTotal: { payableAmount: { amount: 28.02 } },
        invoiceMediaTypes: { availableMediaTypes: ["application/vnd.retailer.v10+json", "application/vnd.retailer.v10+pdf"] } },
      { invoiceId: "3916443730873", issueDate: 1790805600000, invoiceType: "ALL_IN_ONE",
        legalMonetaryTotal: { payableAmount: { amount: -35.77 } }, invoiceMediaTypes: { availableMediaTypes: [] } },
      { invoiceId: "../evil", issueDate: 1790805600000 },
    ],
  });
  eq(items.map((i) => [i.invoiceId, i.issueDate, i.payable, i.hasPdf]), [
    ["3916522562326", "2026-10-15", 28.02, true],
    ["3916443730873", "2026-10-01", -35.77, false],
  ], "items");
  eq(brusselsDate(1792015200000), "2026-10-15", "Brusselse dag");
});

Deno.test("vensters van max. 31 dagen", () => {
  eq(dateWindows("2026-10-27", 62), [
    { start: "2026-08-26", end: "2026-09-26" },
    { start: "2026-09-26", end: "2026-10-27" },
  ], "62 dagen");
});

Deno.test("move-id uit het Odoo-antwoord", () => {
  eq(moveIdFromAction({ res_id: 1500 }), 1500, "res_id");
  eq(moveIdFromAction({ domain: [["id", "in", [1501]]] }), 1501, "domain");
  eq(moveIdFromAction({ domain: [["id", "in", [7, 2]]] }), 2, "gesplitst: het eerste concept");
  eq(moveIdFromAction(null), null, "niets");
});

function fakes(items: BolInvoiceItem[], inOdoo: Record<string, number>, failSetRef = false) {
  const calls: string[] = [];
  let next = 2000;
  const bol: BolApi = {
    listInvoices: async () => items,
    downloadPdf: async (id) => { calls.push(`pdf:${id}`); return "JVBERi0="; },
  };
  const odoo: OdooPurchaseApi = {
    findByRef: async (ref) => inOdoo[ref] ?? null,
    uploadPdf: async (name) => { calls.push(`upload:${name}`); return next++; },
    setRef: async (id, ref) => { if (failSetRef) throw new Error("odoo weg"); calls.push(`ref:${id}=${ref}`); inOdoo[ref] = id; },
  };
  return { bol, odoo, calls };
}

const inv = (id: string, hasPdf = true): BolInvoiceItem => ({ invoiceId: id, issueDate: "2026-10-15", invoiceType: "ALL_IN_ONE", payable: 1, hasPdf });

Deno.test("enkel nieuwe facturen, bestaande in Odoo worden vastgelegd, een tweede run doet niets", async () => {
  const db = new StatefulDb({ supplier_invoice_imports: [] });
  const f = fakes([inv("111"), inv("222"), inv("222"), inv("333", false)], { "111": 1410 });
  const base = { db: db as any, bol: f.bol, odoo: f.odoo, tenantId: T, today: "2026-10-27", days: 31, dryRun: false, deadline: Date.now() + 120_000 };
  const r = await importBolInvoices(base);
  eq(r.scanned, 3, "dubbel in de lijst telt één keer");
  eq(r.created, [{ invoiceId: "222", moveId: 2000 }], "enkel 222 nieuw");
  eq(r.alreadyInOdoo, ["111"], "111 zat er al in");
  eq(r.skippedNoPdf, ["333"], "geen PDF");
  eq(f.calls, ["pdf:222", "upload:bol-222.pdf", "ref:2000=222"], "volgorde");
  eq(db.tables.supplier_invoice_imports.map((x) => [x.external_id, x.status, x.odoo_move_id]), [["111", "exists", 1410], ["222", "created", 2000]], "vastgelegd");
  const r2 = await importBolInvoices(base);
  eq([r2.created.length, r2.known], [0, 2], "tweede run: niets nieuw");
});

Deno.test("dry run schrijft niets", async () => {
  const db = new StatefulDb({ supplier_invoice_imports: [] });
  const f = fakes([inv("222"), inv("111")], { "111": 1 });
  const r = await importBolInvoices({ db: db as any, bol: f.bol, odoo: f.odoo, tenantId: T, today: "2026-10-27", days: 31, dryRun: true, deadline: Date.now() + 120_000 });
  eq(r.created.map((c) => c.invoiceId), ["222"], "zou maken");
  eq([f.calls.length, db.tables.supplier_invoice_imports.length], [0, 0], "niets gedaan");
});

Deno.test("faalt de Referentie, dan is het concept al vastgelegd: geen tweede upload", async () => {
  const db = new StatefulDb({ supplier_invoice_imports: [] });
  const f = fakes([inv("444")], {}, true);
  const base = { db: db as any, bol: f.bol, odoo: f.odoo, tenantId: T, today: "2026-10-27", days: 31, dryRun: false, deadline: Date.now() + 120_000 };
  const r = await importBolInvoices(base);
  eq(r.errors.map((e) => e.invoiceId), ["444"], "fout gemeld");
  const r2 = await importBolInvoices(base);
  eq([r2.created.length, r2.known, f.calls.filter((c) => c.startsWith("upload")).length], [0, 1, 1], "één upload");
});

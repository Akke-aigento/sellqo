/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas */
// INKOOP-2 — bol-facturen als concept in Odoo: nooit dubbel, enkel wat nog niet in Odoo zit.
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/supplierInvoices.test.ts
import {
  brusselsDate,
  dateWindows,
  moveIdFromAction,
  parseBolInvoiceList,
} from "../../supabase/functions/_shared/supplierInvoices.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

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

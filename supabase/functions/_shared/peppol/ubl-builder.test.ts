// INVOICE-INTEGRITY-1 — kortingen als AllowanceCharge in de Peppol-UBL (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/peppol/ubl-builder.test.ts
import { buildPeppolUbl, type UblInvoiceInput } from "./ubl-builder.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<cbc:${name}[^>]*>([^<]*)</cbc:${name}>`, "g"))].map((m) => m[1]);

const base: Omit<UblInvoiceInput, "lines" | "subtotal" | "taxAmount" | "total"> = {
  documentType: "invoice",
  documentNumber: "INV-T-1",
  issueDate: "2026-10-27",
  currency: "EUR",
  supplier: { name: "Shop", country: "BE", vatNumber: "BE0123456789", street: "Straat 1", city: "Leuven", postalCode: "3000" },
  customer: { name: "Klant BV", country: "BE", vatNumber: "BE0987654321", street: "Laan 2", city: "Gent", postalCode: "9000" },
  vatRegime: "domestic_standard",
};

Deno.test("korting op 1 tarief: geen negatieve prijs, totalen kloppen", () => {
  const xml = buildPeppolUbl({
    ...base,
    lines: [{ id: 1, description: "Ticket", quantity: 2, unitPrice: 20.66, lineTotal: 41.32, vatRate: 21 }],
    allowances: [{ vatRate: 21, amount: 20.66, reason: "Korting (HALF)" }],
    subtotal: 20.66,
    taxAmount: 4.34,
    total: 25,
  });
  eq(tag(xml, "PriceAmount").every((p) => Number(p) >= 0), true, "geen negatieve prijs");
  eq(tag(xml, "LineExtensionAmount"), ["41.32", "41.32"], "kop = som regels");
  eq(tag(xml, "TaxExclusiveAmount"), ["20.66"]);
  eq(tag(xml, "AllowanceTotalAmount"), ["20.66"]);
  eq(tag(xml, "TaxableAmount"), ["20.66"]);
  eq(tag(xml, "TaxAmount").slice(0, 2), ["4.34", "4.34"]);
});

Deno.test("volledige korting (€0): btw 0", () => {
  const xml = buildPeppolUbl({
    ...base,
    lines: [{ id: 1, description: "Ticket", quantity: 1, unitPrice: 15.7, lineTotal: 15.7, vatRate: 21 }],
    allowances: [{ vatRate: 21, amount: 15.7, reason: "Korting" }],
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  });
  eq(tag(xml, "TaxableAmount"), ["0.00"]);
  eq(tag(xml, "PayableAmount"), ["0.00"]);
});

Deno.test("zonder korting: ongewijzigd gedrag (geen AllowanceCharge)", () => {
  const xml = buildPeppolUbl({
    ...base,
    lines: [{ id: 1, description: "Starter", quantity: 1, unitPrice: 29, lineTotal: 29, vatRate: 21 }],
    subtotal: 29,
    taxAmount: 6.09,
    total: 35.09,
  });
  eq(xml.includes("AllowanceCharge"), false);
  eq(tag(xml, "LineExtensionAmount")[0], "29.00");
});

Deno.test("btw per tarief van de factuur: TaxSubtotal = factuur, ook als herberekenen een cent afwijkt", () => {
  // 7 × 19,95 inclusief 21%: netto 115,41, btw 24,24 (half-up op bruto 139,65). 115,41 × 21% = 24,2361 → 24,24.
  // 3 × 2,95: netto 7,31, btw 1,54 (8,85 × 21/121 = 1,5359). 7,31 × 21% = 1,5351 → 1,54. Neem een geval dat wél afwijkt:
  // bruto 10,00 → btw 1,74, netto 8,26; 8,26 × 21% = 1,7346 → 1,73.
  const xml = buildPeppolUbl({
    ...base,
    lines: [{ id: 1, description: "Iets", quantity: 1, unitPrice: 8.26, lineTotal: 8.26, vatRate: 21 }],
    taxByRate: [{ vatRate: 21, tax: 1.74 }],
    subtotal: 8.26,
    taxAmount: 1.74,
    total: 10,
  });
  eq(tag(xml, "TaxAmount"), ["1.74", "1.74"]);
});

Deno.test("prijs met 4 decimalen", () => {
  const xml = buildPeppolUbl({
    ...base,
    lines: [{ id: 1, description: "Fles", quantity: 7, unitPrice: 16.4871, lineTotal: 115.41, vatRate: 21 }],
    taxByRate: [{ vatRate: 21, tax: 24.24 }],
    subtotal: 115.41,
    taxAmount: 24.24,
    total: 139.65,
  });
  eq(tag(xml, "PriceAmount"), ["16.4871"]);
});

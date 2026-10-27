/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// INVOICE-INTEGRITY-1 — de ECHTE generate-invoice-handler tegen een nep-databank.
// Bewijst voor een kortingsorder: factuur = som van de regels = betaald bedrag, de korting
// staat als regel per tarief, en pdf/CII/UBL tonen dezelfde bedragen (geen negatieve prijs,
// Σ btw per tarief = btw-totaal, belastbare basis = som van de tarieven).
//
// Run: deno test --allow-env --allow-read --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/generateInvoice.test.ts
import { StatefulDb, type Row } from "./statefulDb.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}
const c = (x: unknown) => Math.round(Number(x) * 100);

Deno.env.set("SUPABASE_URL", "https://db.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");

/** Zelfde controles als public.create_invoice_with_lines (migratie 20261027140000). */
function createInvoiceWithLines(args: { p_invoice: Row; p_lines: Row[]; p_cancel_existing_for_order?: boolean }, db: StatefulDb) {
  const lines = args.p_lines;
  if (!lines?.length) return { data: null, error: { message: "INVOICE_INTEGRITY: een factuur zonder regels" } };
  let net = 0, vat = 0, gross = 0;
  for (const l of lines) {
    for (const k of ["net_amount", "vat_amount", "gross_amount"]) {
      if (l[k] === undefined || l[k] === null) return { data: null, error: { message: `regel mist ${k}` } };
      if (Math.abs(Number(l[k]) * 100 - c(l[k])) > 1e-6) return { data: null, error: { message: `regel niet op de cent: ${k}=${l[k]}` } };
    }
    if (c(l.net_amount) + c(l.vat_amount) !== c(l.gross_amount)) return { data: null, error: { message: "netto + btw ≠ bruto" } };
    net += c(l.net_amount); vat += c(l.vat_amount); gross += c(l.gross_amount);
  }
  const inv = args.p_invoice;
  if (c(inv.subtotal) !== net || c(inv.tax_amount) !== vat || c(inv.total) !== gross) {
    return { data: null, error: { message: `factuur ${inv.subtotal}/${inv.tax_amount}/${inv.total} ≠ regels ${net}/${vat}/${gross}` } };
  }
  if (args.p_cancel_existing_for_order && inv.order_id) {
    for (const i of db.tables.invoices ?? []) if (i.order_id === inv.order_id) i.status = "cancelled";
  }
  const active = (db.tables.invoices ?? []).find((i) => i.order_id && i.order_id === inv.order_id && i.status !== "cancelled");
  if (active) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
  const id = crypto.randomUUID();
  (db.tables.invoices ||= []).push({ id, created_at: new Date().toISOString(), metadata: {}, ...structuredClone(inv) });
  for (const l of lines) (db.tables.invoice_lines ||= []).push({ id: crypto.randomUUID(), invoice_id: id, ...structuredClone(l) });
  return { data: id, error: null };
}

const TENANT = "11111111-1111-1111-1111-111111111111";
function setup(order: Row, items: Row[]) {
  const db = new StatefulDb({
    orders: [{ id: "o1", tenant_id: TENANT, customer_id: null, order_number: "#0042", payment_status: "paid", created_at: "2026-10-27T10:00:00Z", customer_email: "klant@test.be", customer_name: "Jan Klant", shipping_address: { country: "BE" }, billing_address: { country: "BE" }, sales_channel: "webshop", ...order }],
    order_items: items.map((it, i) => ({ id: `oi${i}`, order_id: "o1", ...it })),
    tenants: [{ id: TENANT, name: "Testwinkel", country: "BE", currency: "EUR", default_vat_handling: "inclusive", tax_percentage: 21, invoice_format: "pdf", btw_number: "BE0123456789", iban: "BE68539007547034" }],
    invoices: [],
    invoice_lines: [],
    notifications: [],
    invoice_archive: [],
  });
  db.rpcs.create_invoice_with_lines = createInvoiceWithLines as any;
  (globalThis as any).__fakeDb = db;
  return db;
}

let handler: (req: Request) => Promise<Response>;
async function call(body: Row) {
  if (!handler) {
    await import("../../supabase/functions/generate-invoice/index.ts");
    handler = (globalThis as any).__serveHandler;
  }
  const res = await handler(new Request("https://fn.test/generate-invoice", {
    method: "POST",
    headers: { Authorization: "Bearer service-test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { status: res.status, json: await res.json() };
}

const tags = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<(?:cbc|ram):${name}[^>]*>([^<]*)</(?:cbc|ram):${name}>`, "g"))].map((m) => m[1]);
const sumC = (xs: string[]) => xs.reduce((a, x) => a + c(x), 0);

function checkDocuments(db: StatefulDb, inv: Row) {
  const ubl = Object.entries(db.uploads).find(([p]) => p.endsWith(".xml") && !p.includes("factur-x"))?.[1] as string;
  const cii = Object.entries(db.uploads).find(([p]) => p.endsWith("_factur-x.xml"))?.[1] as string;
  if (!ubl || !cii) throw new Error("UBL of CII niet geüpload");
  // UBL
  eq(tags(ubl, "PriceAmount").every((p) => Number(p) >= 0), true, "UBL: geen negatieve prijs");
  eq(c(tags(ubl, "PayableAmount")[0]), c(inv.total), "UBL: te betalen = factuurtotaal");
  eq(c(tags(ubl, "TaxExclusiveAmount")[0]), c(inv.subtotal), "UBL: excl. btw = factuursubtotaal");
  const ublTaxAmounts = tags(ubl, "TaxAmount");
  eq(c(ublTaxAmounts[0]), c(inv.tax_amount), "UBL: btw-totaal");
  eq(sumC(ublTaxAmounts.slice(1)), c(inv.tax_amount), "UBL: Σ btw per tarief = btw-totaal");
  eq(sumC(tags(ubl, "TaxableAmount")), c(inv.subtotal), "UBL: Σ belastbaar = excl. btw");
  // CII
  eq(c(tags(cii, "GrandTotalAmount")[0]), c(inv.total), "CII: totaal");
  eq(c(tags(cii, "TaxBasisTotalAmount")[0]), c(inv.subtotal), "CII: belastbare basis");
  eq(sumC(tags(cii, "CalculatedAmount")), c(inv.tax_amount), "CII: Σ btw per tarief");
  eq(sumC(tags(cii, "BasisAmount")), c(inv.subtotal), "CII: Σ basis per tarief");
  eq(tags(cii, "ChargeAmount").every((p) => Number(p) >= 0), true, "CII: geen negatieve prijs");
}

Deno.test("Fonske: 100%-kortingscode → factuur €0 met kortingsregel, documenten kloppen", async () => {
  const db = setup({ subtotal: 19, shipping_cost: 0, discount_amount: 19, discount_code: "FONSKE", total: 0 },
    [{ product_name: "Pubcrawl ticket", quantity: 1, unit_price: 19, total_price: 19, vat_rate: 21, product_id: null }]);
  const r = await call({ order_id: "o1" });
  eq(r.status, 200, `status (${JSON.stringify(r.json)})`);
  const inv = db.tables.invoices[0];
  eq([Number(inv.subtotal), Number(inv.tax_amount), Number(inv.total), inv.status], [0, 0, 0, "paid"], "factuurkop");
  eq(db.tables.invoice_lines.map((l) => [l.line_type, l.gross_amount]), [["product", 19], ["discount", -19]], "regels");
  checkDocuments(db, inv);
});

Deno.test("twee tarieven + verzending + gedeeltelijke korting: alles telt op tot het betaalde bedrag", async () => {
  const db = setup({ subtotal: 150, shipping_cost: 4.95, discount_amount: 15, discount_code: "X10", total: 139.95 }, [
    { product_name: "Fles wijn", quantity: 2, unit_price: 50, total_price: 100, vat_rate: 21, product_id: null },
    { product_name: "Boek", quantity: 1, unit_price: 50, total_price: 50, vat_rate: 6, product_id: null },
  ]);
  const r = await call({ order_id: "o1" });
  eq(r.status, 200, `status (${JSON.stringify(r.json)})`);
  const inv = db.tables.invoices[0];
  eq(c(inv.total), c(139.95), "totaal = betaald");
  const lines = db.tables.invoice_lines;
  eq(lines.filter((l) => l.line_type === "discount").length, 2, "korting per tarief");
  const book = lines.find((l) => l.description === "Boek")!;
  eq([book.vat_rate, book.vat_box_code, book.gl_account_code], [6, "01", "700100"], "boek blijft 6%, vak 01");
  const wine = lines.find((l) => l.description === "Fles wijn")!;
  eq([wine.vat_rate, wine.vat_box_code], [21, "03"], "wijn 21%, vak 03");
  eq(lines.reduce((a, l) => a + c(l.gross_amount), 0), c(139.95), "Σ bruto = betaald");
  checkDocuments(db, inv);
});

Deno.test("eerste item aan 6%, verzending 21%: verzendtoeslag in UBL/CII aan 21%", async () => {
  const db = setup({ subtotal: 30, shipping_cost: 5, discount_amount: 0, total: 35 }, [
    { product_name: "Ticket", quantity: 2, unit_price: 15, total_price: 30, vat_rate: 6, product_id: null },
  ]);
  const r = await call({ order_id: "o1" });
  eq(r.status, 200, `status (${JSON.stringify(r.json)})`);
  const ubl = Object.entries(db.uploads).find(([p]) => p.endsWith(".xml") && !p.includes("factur-x"))![1] as string;
  const charge = ubl.split("<cac:AllowanceCharge>")[1] ?? "";
  eq(/<cbc:Percent>21<\/cbc:Percent>/.test(charge), true, "verzending aan 21%");
  checkDocuments(db, db.tables.invoices[0]);
});

Deno.test("force_new: oude factuur pas geannuleerd als de nieuwe klopt", async () => {
  const db = setup({ subtotal: 25.9, shipping_cost: 0, discount_amount: 0, total: 25.9 },
    [{ product_name: "Iets", quantity: 1, unit_price: 8.95, total_price: 8.95, vat_rate: 21, product_id: null }]);
  db.tables.invoices.push({ id: "old", order_id: "o1", tenant_id: TENANT, status: "paid", invoice_number: "INV-OLD" });
  const r = await call({ order_id: "o1", force_new: true });
  eq(r.status, 422, "geweigerd");
  eq(db.tables.invoices.find((i) => i.id === "old")!.status, "paid", "oude factuur blijft staan");
  eq(Object.keys(db.uploads).length, 0, "niets geüpload");
});

Deno.test("tweede aanroep voor dezelfde order: geen tweede factuur", async () => {
  const db = setup({ subtotal: 25, shipping_cost: 0, discount_amount: 0, total: 25 },
    [{ product_name: "Ticket", quantity: 1, unit_price: 25, total_price: 25, vat_rate: 21, product_id: null }]);
  await call({ order_id: "o1" });
  const r2 = await call({ order_id: "o1" });
  eq(r2.json.message, "Invoice already exists", "tweede aanroep");
  eq(db.tables.invoices.length, 1, "één factuur");
});

Deno.test("betaald meer dan de orderregels: 422, geen factuur, melding aan de winkel", async () => {
  const db = setup({ subtotal: 25.9, shipping_cost: 0, discount_amount: 0, total: 25.9 },
    [{ product_name: "Iets", quantity: 1, unit_price: 8.95, total_price: 8.95, vat_rate: 21, product_id: null }]);
  const r = await call({ order_id: "o1" });
  eq([r.status, r.json.code], [422, "INVOICE_INTEGRITY"], "geweigerd");
  eq(db.tables.invoices.length, 0, "geen factuur");
  eq(db.tables.notifications.map((n) => [n.type, n.priority]), [["invoice_blocked", "high"]], "melding");
});

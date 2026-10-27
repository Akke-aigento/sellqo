/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen en Odoo-RPC */
// ODOO-GUARD-1 — de ECHTE sync-odoo-invoices-handler tegen een nep-databank en een nagebootste
// Odoo (prijs-inclusieve btw, btw per regel half-up, productprijs op 2 decimalen, zoals
// nomadix-bv). Bewijst: een kortingsfactuur wordt exact geboekt; zonder prijs-inclusieve
// btw-code wordt niets geboekt; een verschil laat een concept + melding achter en wordt nooit
// definitief; een herpoging maakt geen tweede boeking; een creditnota verwijst naar haar factuur.
//
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/odooSync.test.ts
import { StatefulDb, type Row } from "./statefulDb.ts";
import { encryptOdooKey } from "../../supabase/functions/_shared/odooCrypto.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
const r2 = (x: number) => (x < 0 ? -1 : 1) * Math.round(Number((Math.abs(x) * 100).toFixed(6))) / 100;

Deno.env.set("SUPABASE_URL", "https://db.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
Deno.env.set("ODOO_CREDENTIALS_KEY", "test-key-for-odoo-credentials");

// ---------------------------------------------------------------- nep-Odoo
type Tax = { id: number; name: string; amount: number; included: boolean };
class FakeOdoo {
  taxes: Tax[] = [
    { id: 3, name: "21%", amount: 21, included: false },
    { id: 9, name: "0% EU S", amount: 0, included: false },
    { id: 10, name: "0%", amount: 0, included: false },
    { id: 13, name: "0% EU M", amount: 0, included: false },
    { id: 15, name: "0% EX", amount: 0, included: false },
    { id: 120, name: "21.0% NL BTW", amount: 21, included: false },
  ];
  moves: Row[] = [];
  partners: Row[] = [];
  calls: string[] = [];
  /** Extra verschil op de btw (om een afwijkende Odoo na te bootsen). */
  skewTax = 0;
  withIncluded() {
    this.taxes.push({ id: 503, name: "21% incl.", amount: 21, included: true }, { id: 504, name: "21.0% NL BTW incl.", amount: 21, included: true });
    return this;
  }
  private matchDomain(t: Tax, domain: any[]): boolean {
    let ok = true;
    let i = 0;
    while (i < domain.length) {
      const d = domain[i];
      if (d === "|") {
        const a = this.term(t, domain[i + 1]); const b = this.term(t, domain[i + 2]);
        ok = ok && (a || b); i += 3; continue;
      }
      ok = ok && this.term(t, d); i++;
    }
    return ok;
  }
  private term(t: Tax, [f, op, v]: [string, string, any]): boolean {
    const val = f === "amount" ? t.amount : f === "name" ? t.name : f === "type_tax_use" ? "sale" : f === "price_include_override" ? (t.included ? "tax_included" : false) : undefined;
    if (op === "=") return val === v;
    if (op === "ilike") return String(val).toLowerCase().includes(String(v).toLowerCase());
    if (op === "not ilike") return !String(val).toLowerCase().includes(String(v).toLowerCase());
    throw new Error(`op ${op}`);
  }
  exec(model: string, method: string, args: any[]): any {
    this.calls.push(`${model}.${method}`);
    if (model === "account.journal" && method === "read") return [{ id: args[0][0], name: "Verkoopdagboek Test", type: "sale" }];
    if (model === "account.tax" && method === "search") return this.taxes.filter((t) => this.matchDomain(t, args[0])).map((t) => t.id);
    if (model === "account.tax" && method === "search_read") return this.taxes.filter((t) => this.matchDomain(t, args[0])).map((t) => ({ id: t.id, name: t.name, tax_group_id: [1, t.name.includes("NL") ? "OSS 21%" : "VAT"] }));
    if (model === "res.partner" && method === "fields_get") return { is_company: { type: "boolean" } };
    if (model === "res.partner" && method === "search") return this.partners.map((p) => p.id);
    if (model === "res.partner" && method === "create") { const id = 900 + this.partners.length; this.partners.push({ id }); return id; }
    if (model === "account.move" && method === "search") {
      const dom = args[0] as any[];
      const idTerm = dom.find((d) => d[0] === "id");
      if (idTerm) return this.moves.filter((m) => m.id === idTerm[2]).map((m) => m.id);
      const name = dom.find((d) => d[0] === "name")?.[2];
      return this.moves.filter((m) => m.name === name && m.state !== "cancel").map((m) => m.id);
    }
    if (model === "account.move" && method === "create") {
      const data = args[0];
      let untaxed = 0, tax = 0;
      for (const [, , l] of data.invoice_line_ids) {
        const t = this.taxes.find((x) => x.id === l.tax_ids[0][2][0])!;
        const price = r2(l.price_unit) * l.quantity; // productprijs op 2 decimalen
        const lt = t.included ? r2((price * t.amount) / (100 + t.amount)) : r2((price * t.amount) / 100);
        tax += Math.round(lt * 100); untaxed += Math.round((t.included ? price - lt : price) * 100);
      }
      tax += Math.round(this.skewTax * 100);
      const id = 5000 + this.moves.length;
      this.moves.push({ id, ...data, state: "draft", amount_untaxed: untaxed / 100, amount_tax: tax / 100, amount_total: (untaxed + tax) / 100 });
      return id;
    }
    if (model === "account.move" && method === "read") return this.moves.filter((m) => args[0].includes(m.id)).map((m) => ({ ...m }));
    if (model === "account.move" && method === "action_post") { for (const m of this.moves) if (args[0].includes(m.id)) m.state = "posted"; return true; }
    throw new Error(`nep-Odoo kent ${model}.${method} niet`);
  }
}

let odoo: FakeOdoo;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://odoo.test/")) return realFetch(input, init);
  const body = JSON.parse(String(init?.body));
  const { service, method, args } = body.params;
  let result: unknown;
  try {
    if (service === "common" && method === "authenticate") result = 2;
    else if (service === "common" && method === "version") result = { server_version: "saas~19.3", server_version_info: [19, 3] };
    else if (service === "object" && method === "execute_kw") result = odoo.exec(args[3], args[4], args[5]);
    else throw new Error(`onbekend ${service}.${method}`);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
  } catch (e) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: (e as Error).message } }));
  }
}) as typeof fetch;

// ---------------------------------------------------------------- nep-SellQo
const TENANT = "11111111-1111-1111-1111-111111111111";
async function setup(): Promise<StatefulDb> {
  const db = new StatefulDb({
    tenant_odoo_settings: [{ tenant_id: TENANT, odoo_sync_enabled: true, odoo_journal_id: 45, odoo_journal_name: "Verkoopdagboek Test", aggregate_b2c_customers: true, odoo_auto_post: true, peppol_send_enabled: false, channel_aliases: {}, channel_partner_ids: {} }],
    tenant_odoo_credentials: [{ tenant_id: TENANT, odoo_url: "https://odoo.test", odoo_db: "test", odoo_login: "api", api_key_ciphertext: await encryptOdooKey("k") }],
    tenants: [{ id: TENANT, name: "Testwinkel" }],
    invoices: [{ id: "inv1", tenant_id: TENANT, invoice_number: "INV-2026-0042", status: "paid", issue_date: "2026-10-27", customer_id: null, is_b2b: false, order_id: null, subscription_id: null, vat_regime: "domestic_standard", reporting_country: "BE", subtotal: 0, tax_amount: 0, total: 0, created_at: "2026-10-27T10:00:00Z" }],
    invoice_lines: [
      { id: "l1", invoice_id: "inv1", description: "Pubcrawl ticket", quantity: 1, unit_price: 15.7, vat_rate: 21, vat_amount: 3.3, net_amount: 15.7, gross_amount: 19, line_total: 15.7, line_type: "product", sort_order: 0 },
      { id: "l2", invoice_id: "inv1", description: "Korting (FONSKE)", quantity: 1, unit_price: -15.7, vat_rate: 21, vat_amount: -3.3, net_amount: -15.7, gross_amount: -19, line_total: -15.7, line_type: "discount", sort_order: 1 },
    ],
    credit_notes: [],
    credit_note_lines: [],
    odoo_invoice_sync_log: [],
    orders: [],
    customers: [],
    notifications: [],
  });
  (globalThis as any).__fakeDb = db;
  return db;
}

let handler: (req: Request) => Promise<Response>;
async function run(body: Row = { tenantId: TENANT }) {
  if (!handler) {
    const orig = Deno.serve;
    (Deno as any).serve = (h: any) => { handler = h; return {} as any; };
    await import("../../supabase/functions/sync-odoo-invoices/index.ts");
    (Deno as any).serve = orig;
  }
  const res = await handler(new Request("https://fn.test/sync-odoo-invoices", {
    method: "POST",
    headers: { Authorization: "Bearer service-test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return await res.json();
}

const logs = (db: StatefulDb) => db.tables.odoo_invoice_sync_log.map((l) => [l.sync_status, l.odoo_move_id ?? null]);

Deno.test("kortingsfactuur €0: één boeking, exact €0, definitief", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  await run();
  eq(odoo.moves.map((m) => [m.name, m.state, m.amount_total]), [["INV-2026-0042", "posted", 0]], "Odoo-boeking");
  eq(odoo.moves[0].invoice_line_ids.map((l: any) => [l[2].quantity, l[2].price_unit, l[2].tax_ids[0][2][0]]), [[1, 19, 503], [1, -19, 503]], "regels bruto, inclusieve code");
  eq(logs(db), [["synced", "5000"]], "sync-log");
});

Deno.test("prijs-inclusieve btw-code ontbreekt: niets aangemaakt, duidelijke fout", async () => {
  const db = await setup();
  odoo = new FakeOdoo();
  await run();
  eq(odoo.moves.length, 0, "geen boeking");
  eq(db.tables.odoo_invoice_sync_log[0].sync_status, "failed", "gefaald");
  if (!String(db.tables.odoo_invoice_sync_log[0].error_message).includes("Prijs-inclusieve btw-code 21%")) throw new Error(db.tables.odoo_invoice_sync_log[0].error_message);
});

Deno.test("Odoo wijkt af: concept blijft staan, nooit geboekt, melding; herpoging maakt geen tweede", async () => {
  const db = await setup();
  db.tables.invoices[0] = { ...db.tables.invoices[0], subtotal: 16.53, tax_amount: 3.47, total: 20 };
  db.tables.invoice_lines = [
    { id: "l1", invoice_id: "inv1", description: "Ticket", quantity: 1, unit_price: 20.66, vat_rate: 21, vat_amount: 4.34, net_amount: 20.66, gross_amount: 25, line_total: 20.66, line_type: "product", sort_order: 0 },
    { id: "l2", invoice_id: "inv1", description: "Korting", quantity: 1, unit_price: -4.13, vat_rate: 21, vat_amount: -0.87, net_amount: -4.13, gross_amount: -5, line_total: -4.13, line_type: "discount", sort_order: 1 },
  ];
  odoo = new FakeOdoo().withIncluded();
  odoo.skewTax = 0.01;
  await run();
  await run(); // herpoging (cron een uur later)
  eq(odoo.moves.map((m) => [m.state]), [["draft"]], "één concept, niet geboekt");
  eq(odoo.calls.filter((c) => c === "account.move.create").length, 1, "één create");
  eq(odoo.calls.filter((c) => c === "account.move.action_post").length, 0, "nooit geboekt");
  eq(logs(db).map((l) => l[0]), ["failed", "failed"], "twee mislukte pogingen");
  eq(db.tables.notifications.map((n) => [n.category, n.type]), [["integrations", "integration_error"], ["integrations", "integration_error"]].slice(0, db.tables.notifications.length), "melding");
});

Deno.test("vorige poging liep vast na de create: hergebruik, geen dubbele boeking", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  // Een concept met hetzelfde nummer bestaat al (vorige run gekilled vóór de log).
  odoo.exec("account.move", "create", [{ name: "INV-2026-0042", journal_id: 45, move_type: "out_invoice", invoice_line_ids: [[0, 0, { quantity: 1, price_unit: 19, tax_ids: [[6, 0, [503]]] }], [0, 0, { quantity: 1, price_unit: -19, tax_ids: [[6, 0, [503]]] }]] }]);
  odoo.calls = [];
  await run();
  eq(odoo.calls.filter((c) => c === "account.move.create").length, 0, "geen nieuwe create");
  eq(odoo.moves.map((m) => m.state), ["posted"], "bestaande geboekt");
  eq(logs(db), [["synced", "5000"]], "gesynct");
});

Deno.test("creditnota verwijst naar de boeking van haar factuur", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  await run(); // factuur
  db.tables.credit_notes.push({ id: "cn1", tenant_id: TENANT, credit_note_number: "CN-2026-0001", status: "sent", issue_date: "2026-10-27", customer_id: null, reason: "test", original_invoice_id: "inv1", subtotal: 15.7, tax_amount: 3.3, total: 19, created_at: "2026-10-27T11:00:00Z" });
  db.tables.credit_note_lines.push({ id: "c1", credit_note_id: "cn1", description: "Pubcrawl ticket", quantity: 1, unit_price: 15.7, vat_rate: 21, vat_amount: 3.3, line_total: 15.7, line_type: "product" });
  await run();
  const cn = odoo.moves.find((m) => m.name === "CN-2026-0001")!;
  eq([cn.move_type, cn.reversed_entry_id, cn.state, cn.amount_total], ["out_refund", 5000, "posted", 19], "creditnota");
  if (!String(cn.ref).includes("creditnota voor INV-2026-0042")) throw new Error(`ref: ${cn.ref}`);
});

Deno.test("meer dan 200 gesyncte facturen: nieuwe worden nog altijd opgepikt", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  db.tables.invoices = [];
  for (let i = 0; i < 250; i++) {
    db.tables.invoices.push({ id: `old${i}`, tenant_id: TENANT, invoice_number: `OLD-${i}`, status: "paid", created_at: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00Z` });
    db.tables.odoo_invoice_sync_log.push({ tenant_id: TENANT, invoice_id: `old${i}`, document_type: "invoice", sync_status: "synced", odoo_move_id: "1", created_at: "2026-01-02T00:00:00Z" });
  }
  db.tables.invoices.push({ id: "inv1", tenant_id: TENANT, invoice_number: "INV-2026-0042", status: "paid", issue_date: "2026-10-27", customer_id: null, is_b2b: false, order_id: null, subscription_id: null, vat_regime: "domestic_standard", reporting_country: "BE", subtotal: 0, tax_amount: 0, total: 0, created_at: "2026-10-27T10:00:00Z" });
  await run();
  eq(odoo.moves.map((m) => m.name), ["INV-2026-0042"], "nieuwe factuur geboekt");
});

Deno.test("IC-levering goederen aan 0%: Odoo-code 0% EU M (rooster 46), niet de eerste 0%", async () => {
  const db = await setup();
  db.tables.invoices[0] = { ...db.tables.invoices[0], vat_regime: "ic_supply_goods", subtotal: 100, tax_amount: 0, total: 100 };
  db.tables.invoice_lines = [{ id: "l1", invoice_id: "inv1", description: "Omvormer", quantity: 1, unit_price: 100, vat_rate: 0, vat_amount: 0, net_amount: 100, gross_amount: 100, line_total: 100, line_type: "product", sort_order: 0 }];
  odoo = new FakeOdoo().withIncluded();
  await run();
  eq(odoo.moves[0].invoice_line_ids.map((l: any) => l[2].tax_ids[0][2][0]), [13], "0% EU M");
});

Deno.test("binnenlands 0%: de gewone 0%, niet EU/EX", async () => {
  const db = await setup();
  db.tables.invoices[0] = { ...db.tables.invoices[0], subtotal: 10, tax_amount: 0, total: 10 };
  db.tables.invoice_lines = [{ id: "l1", invoice_id: "inv1", description: "Vrijgesteld", quantity: 1, unit_price: 10, vat_rate: 0, vat_amount: 0, net_amount: 10, gross_amount: 10, line_total: 10, line_type: "product", sort_order: 0 }];
  odoo = new FakeOdoo().withIncluded();
  await run();
  eq(odoo.moves[0].invoice_line_ids.map((l: any) => l[2].tax_ids[0][2][0]), [10], "0%");
});

Deno.test("creditnota: originele boeking verdwenen → geen verwijzing, wel geboekt", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  db.tables.odoo_invoice_sync_log.push({ tenant_id: TENANT, invoice_id: "inv1", document_type: "invoice", sync_status: "synced", odoo_move_id: "4242", created_at: "2026-10-27T10:00:00Z", synced_at: "2026-10-27T10:00:00Z" });
  db.tables.credit_notes.push({ id: "cn1", tenant_id: TENANT, credit_note_number: "CN-2026-0001", status: "sent", issue_date: "2026-10-27", customer_id: null, reason: "test", original_invoice_id: "inv1", subtotal: 15.7, tax_amount: 3.3, total: 19, created_at: "2026-10-27T11:00:00Z" });
  db.tables.credit_note_lines.push({ id: "c1", credit_note_id: "cn1", description: "Pubcrawl ticket", quantity: 1, unit_price: 15.7, vat_rate: 21, vat_amount: 3.3, line_total: 15.7, line_type: "product" });
  await run();
  const cn = odoo.moves.find((m) => m.name === "CN-2026-0001")!;
  eq([cn.reversed_entry_id ?? null, cn.state], [null, "posted"], "zonder verwijzing geboekt");
});

Deno.test("nooit geprobeerde factuur gaat vóór eerder mislukte", async () => {
  const db = await setup();
  odoo = new FakeOdoo().withIncluded();
  db.tables.invoices = [];
  for (let i = 0; i < 120; i++) {
    db.tables.invoices.push({ id: `bad${i}`, tenant_id: TENANT, invoice_number: `BAD-${i}`, status: "paid", created_at: "2026-01-01T00:00:00Z" });
    db.tables.odoo_invoice_sync_log.push({ tenant_id: TENANT, invoice_id: `bad${i}`, document_type: "invoice", sync_status: "failed", created_at: new Date().toISOString() });
  }
  db.tables.invoices.push({ id: "inv1", tenant_id: TENANT, invoice_number: "INV-2026-0042", status: "paid", issue_date: "2026-10-27", customer_id: null, is_b2b: false, order_id: null, subscription_id: null, vat_regime: "domestic_standard", reporting_country: "BE", subtotal: 0, tax_amount: 0, total: 0, created_at: "2026-10-27T10:00:00Z" });
  await run();
  eq(odoo.moves.map((m) => m.name).includes("INV-2026-0042"), true, "nieuwe factuur toch geboekt");
});

Deno.test("CORRECTIE-1: historische import (elders uitgereikt) wordt nooit doorgestuurd", async () => {
  const db = await setup();
  db.tables.invoices[0].metadata = { historical_import: { source: "shopify_csv" } };
  odoo = new FakeOdoo().withIncluded();
  await run();
  eq([odoo.moves.length, db.tables.odoo_invoice_sync_log.length], [0, 0], "niets geboekt, niets gelogd");
});

Deno.test("CORRECTIE-1: ook met expliciete invoiceIds geen historische import", async () => {
  const db = await setup();
  db.tables.invoices[0].metadata = { historical_import: { source: "shopify_csv" } };
  odoo = new FakeOdoo().withIncluded();
  await run({ tenantId: TENANT, invoiceIds: ["inv1"] });
  eq(odoo.moves.length, 0, "niets geboekt");
  eq(db.tables.odoo_invoice_sync_log[0]?.sync_status, "failed", "gelogd als geweigerd");
});

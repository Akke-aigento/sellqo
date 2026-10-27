// INVOICE-INTEGRITY-1 — de factuurregels van een order (puur, zonder netwerk).
// Run: deno test --no-lock supabase/functions/_shared/invoiceBuild.test.ts
import { allocateCents, buildInvoiceLines, r2, type BuildInput, type BuildResult } from "./invoiceBuild.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}
const c = (x: number) => Math.round(x * 100);
function ok(r: ReturnType<typeof buildInvoiceLines>): BuildResult {
  if (!r.ok) throw new Error(`geweigerd: ${r.reason}`);
  return r;
}
/** De invarianten die voor elke factuur moeten gelden. */
function invariants(r: BuildResult, paid?: number) {
  const s = (f: (l: BuildResult["lines"][number]) => number) => r.lines.reduce((a, l) => a + c(f(l)), 0);
  eq(s((l) => l.net_amount), c(r.subtotal), "Σ netto = subtotaal");
  eq(s((l) => l.vat_amount), c(r.tax), "Σ btw = btw");
  eq(s((l) => l.gross_amount), c(r.total), "Σ bruto = totaal");
  eq(c(r.subtotal) + c(r.tax), c(r.total), "subtotaal + btw = totaal");
  for (const l of r.lines) {
    eq(c(l.net_amount) + c(l.vat_amount), c(l.gross_amount), `regel ${l.description}`);
    eq(l.line_total, l.net_amount, "line_total is netto");
    for (const v of [l.net_amount, l.vat_amount, l.gross_amount]) eq(Math.abs(c(v) - v * 100) < 1e-6, true, "op de cent");
  }
  // Btw per regel (zoals Odoo met prijs-inclusieve btw, round_per_line); per tarief = som.
  for (const l of r.lines) {
    eq(c(l.vat_amount), c(r2((l.gross_amount * l.vat_rate) / (100 + l.vat_rate))), `btw per regel ${l.description}`);
  }
  for (const b of r.breakdown) {
    eq(c(b.vatAmount), r.lines.filter((l) => l.vat_rate === b.vatRate).reduce((a, l) => a + c(l.vat_amount), 0), `btw ${b.vatRate}% = som regels`);
  }
  if (paid !== undefined) eq(c(r.total), c(paid), "totaal = betaald");
  for (const l of r.lines.filter((x) => x.line_type === "discount")) {
    eq(l.net_amount <= 0 && l.vat_amount <= 0 && l.gross_amount <= 0, true, `kortingsregel nooit positief (${JSON.stringify(l)})`);
  }
}

const ticket = (lineTotal: number, qty = 1, rate = 21): BuildInput["items"][number] => ({
  description: "Pubcrawl ticket",
  quantity: qty,
  lineTotal,
  origRate: rate,
  fiscalRate: rate,
});

Deno.test("r2: half weg van nul, op de cent", () => {
  eq([r2(1.005), r2(-1.005), r2(2.675), r2(0.125), r2(-0)], [1.01, -1.01, 2.68, 0.13, 0]);
});

Deno.test("allocateCents: som exact, naar rato", () => {
  eq(allocateCents(100, [1, 1, 1]), [34, 33, 33]);
  eq(allocateCents(0, [5, 5]), [0, 0]);
  eq(allocateCents(7, [0, 10]), [0, 7]);
});

Deno.test("Fonske: 100%-code → €0 factuur met kortingsregel, btw 0", () => {
  const r = ok(buildInvoiceLines({ vatHandling: "inclusive", items: [ticket(19)], paidTotal: 0, declaredDiscount: 19, discountCode: "FONSKE", vatCategory: "S" }));
  invariants(r, 0);
  eq([r.subtotal, r.tax, r.total, r.discount], [0, 0, 0, 19]);
  eq(r.lines.map((l) => [l.line_type, l.description, l.net_amount, l.vat_amount, l.gross_amount]), [
    ["product", "Pubcrawl ticket", 15.7, 3.3, 19],
    ["discount", "Korting (FONSKE)", -15.7, -3.3, -19],
  ]);
  eq(r.warnings, []);
});

Deno.test("gedeeltelijke korting: totaal = betaald, btw op het betaalde bedrag", () => {
  const r = ok(buildInvoiceLines({ vatHandling: "inclusive", items: [ticket(25, 1)], paidTotal: 20, declaredDiscount: 5, vatCategory: "S" }));
  invariants(r, 20);
  eq([r.subtotal, r.tax, r.total], [16.53, 3.47, 20]);
});

Deno.test("geen korting, meerdere regels: geen kortingsregel, btw per tarief exact", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [ticket(19.95, 7), ticket(23.95, 1), { ...ticket(4.95), description: "Verzendkosten", lineType: "shipping" }],
    paidTotal: 19.95 + 23.95 + 4.95,
    vatCategory: "S",
  }));
  invariants(r, 48.85);
  eq(r.lines.some((l) => l.line_type === "discount"), false);
  eq(r.lines[2].line_type, "shipping");
});

Deno.test("twee tarieven + korting: korting naar rato per tarief, elk tarief klopt", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [ticket(100, 1, 21), { ...ticket(50, 1, 6), description: "Boek" }],
    paidTotal: 135,
    declaredDiscount: 15,
    discountCode: "X10",
    vatCategory: "S",
  }));
  invariants(r, 135);
  const disc = r.lines.filter((l) => l.line_type === "discount");
  eq(disc.map((l) => [l.description, l.gross_amount]), [["Korting (X10) — 21%", -10], ["Korting (X10) — 6%", -5]]);
  eq(r.breakdown.map((b) => b.vatRate), [21, 6]);
});

Deno.test("subtotaal al na korting (oude Shopify-import): korting afgeleid uit betaald, waarschuwing", () => {
  const r = ok(buildInvoiceLines({ vatHandling: "inclusive", items: [ticket(597)], paidTotal: 537.3, declaredDiscount: 0, vatCategory: "S" }));
  invariants(r, 537.3);
  eq(r.discount, 59.7);
  eq(r.warnings.length, 1);
});

Deno.test("betaald meer dan de orderregels: geen factuur", () => {
  const r = buildInvoiceLines({ vatHandling: "inclusive", items: [ticket(8.95)], paidTotal: 25.9, vatCategory: "S" });
  eq(r.ok, false);
});

Deno.test("btw verlegd (0%) op een inclusieve prijs: netto uit 21%, totaal bewust ≠ betaald", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [{ ...ticket(121), fiscalRate: 0 }],
    paidTotal: 121,
    vatCategory: "AE",
  }));
  invariants(r);
  eq([r.subtotal, r.tax, r.total], [100, 0, 100]);
  eq(r.notes.length, 1);
});

Deno.test("btw verlegd met korting: kortingsregel in netto", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [{ ...ticket(121), fiscalRate: 0 }],
    paidTotal: 108.9,
    declaredDiscount: 12.1,
    vatCategory: "AE",
  }));
  invariants(r);
  eq([r.subtotal, r.tax, r.total], [90, 0, 90]);
});

Deno.test("OSS: bruto blijft het betaalde bedrag, btw aan het bestemmingstarief erin", () => {
  const r = ok(buildInvoiceLines({ vatHandling: "inclusive", items: [{ ...ticket(121), fiscalRate: 20 }], paidTotal: 121, vatCategory: "S" }));
  invariants(r, 121);
  eq([r.subtotal, r.tax, r.total], [100.83, 20.17, 121]);
});

Deno.test("korting gaat naar de producten, niet naar de verzending", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [ticket(100, 1, 6), { ...ticket(10, 1, 21), description: "Verzendkosten", lineType: "shipping" }],
    paidTotal: 90,
    declaredDiscount: 20,
    vatCategory: "S",
  }));
  invariants(r, 90);
  eq(r.lines.filter((l) => l.line_type === "discount").map((l) => [l.vat_rate, l.gross_amount]), [[6, -20]]);
  eq(r.tax, 6.27);
});

Deno.test("korting groter dan de producten: de rest gaat naar de verzending", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "inclusive",
    items: [ticket(10, 1, 6), { ...ticket(5, 1, 21), description: "Verzendkosten", lineType: "shipping" }],
    paidTotal: 0,
    declaredDiscount: 15,
    vatCategory: "S",
  }));
  invariants(r, 0);
  eq([r.subtotal, r.tax, r.total], [0, 0, 0]);
});

Deno.test("item zonder btw (checkout verlegde) maar factuur met btw: geweigerd", () => {
  const r = buildInvoiceLines({ vatHandling: "inclusive", items: [{ ...ticket(100), origRate: 0, fiscalRate: 21 }], paidTotal: 100, vatCategory: "S" });
  eq(r.ok, false);
});

Deno.test("exclusieve prijzen: btw bovenop, korting in netto", () => {
  const r = ok(buildInvoiceLines({
    vatHandling: "exclusive",
    items: [{ ...ticket(100), description: "Dienst" }],
    paidTotal: 108.9,
    declaredDiscount: 10,
    vatCategory: "S",
  }));
  eq([r.subtotal, r.tax, r.total], [90, 18.9, 108.9]);
  eq(r.warnings, []);
});

Deno.test("brute kracht: 20.000 willekeurige orders voldoen aan alle invarianten", () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let n = 0; n < 20000; n++) {
    const rates = [21, 6, 12, 0];
    const k = 1 + Math.floor(rnd() * 4);
    const tiny = rnd() < 0.3;
    const items: BuildInput["items"] = Array.from({ length: k + (tiny ? 6 : 0) }, () => {
      const rate = rates[Math.floor(rnd() * rates.length)];
      const qty = 1 + Math.floor(rnd() * 5);
      const unit = tiny ? Math.round(rnd() * 99) / 100 : Math.round(rnd() * 20000) / 100;
      return { ...ticket(Math.round(unit * qty * 100) / 100, qty, rate) };
    });
    if (rnd() < 0.5) items.push({ ...ticket(Math.round(rnd() * 900) / 100, 1, 21), description: "Verzendkosten", lineType: "shipping" });
    const base = items.reduce((a, i) => a + c(i.lineTotal), 0);
    const paid = Math.floor(rnd() * (base + 1)) / 100;
    const r = buildInvoiceLines({ vatHandling: "inclusive", items, paidTotal: paid, declaredDiscount: base / 100 - paid, vatCategory: "S" });
    if (!r.ok) throw new Error(`order ${n} geweigerd: ${r.reason}`);
    invariants(r, paid);
    eq(r.warnings, [], `order ${n}`);
  }
});

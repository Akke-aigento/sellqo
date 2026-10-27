// ODOO-GUARD-1 — boekingsregels voor Odoo (puur, zonder netwerk).
// Run: deno test --no-lock supabase/functions/_shared/odooBooking.test.ts
import { amountsMatch, planOdooLines } from "./odooBooking.ts";
import { buildInvoiceLines } from "./invoiceBuild.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
const c = (x: number) => Math.round(x * 100);
const r2 = (x: number) => (x < 0 ? -1 : 1) * Math.round(Number((Math.abs(x) * 100).toFixed(6))) / 100;

/** Odoo met prijs-inclusieve btw en round_per_line: per regel btw = half-up(bruto × t / (100+t)). */
function odooBooks(plan: ReturnType<typeof planOdooLines>) {
  let untaxed = 0, tax = 0;
  for (const p of plan) {
    const price = r2(p.price_unit); // productprijs op 2 decimalen
    if (p.included) {
      const t = r2((price * p.rate) / (100 + p.rate));
      tax += c(t); untaxed += c(price) - c(t);
    } else {
      const t = r2((price * p.rate) / 100);
      tax += c(t); untaxed += c(price);
    }
  }
  return { untaxed: untaxed / 100, tax: tax / 100, total: (untaxed + tax) / 100 };
}

Deno.test("Fonske 100%-code: twee regels, Odoo €0", () => {
  const b = buildInvoiceLines({ vatHandling: "inclusive", items: [{ description: "Ticket", quantity: 1, lineTotal: 19, origRate: 21, fiscalRate: 21 }], paidTotal: 0, declaredDiscount: 19, vatCategory: "S" });
  if (!b.ok) throw new Error(b.reason);
  const plan = planOdooLines(b.lines, { lineTotalIsNet: false });
  eq(plan.map((p) => [p.name, p.price_unit, p.included]), [["Ticket", 19, true], ["Korting", -19, true]]);
  eq(odooBooks(plan), { untaxed: 0, tax: 0, total: 0 });
});

Deno.test("7 × 19,95: één regel van 139,65 bruto, hoeveelheid in de naam", () => {
  const b = buildInvoiceLines({ vatHandling: "inclusive", items: [{ description: "Fles", quantity: 7, lineTotal: 139.65, origRate: 21, fiscalRate: 21 }], paidTotal: 139.65, vatCategory: "S" });
  if (!b.ok) throw new Error(b.reason);
  const plan = planOdooLines(b.lines, { lineTotalIsNet: false });
  eq(plan[0].name, "7 × Fles");
  eq(amountsMatch(odooBooks(plan), { untaxed: b.subtotal, tax: b.tax, total: b.total }), true);
});

Deno.test("brute kracht: Odoo boekt voor 20.000 orders exact de SellQo-factuur", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const rates = [21, 12, 6, 0];
  for (let n = 0; n < 20000; n++) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
      const rate = rates[Math.floor(rnd() * rates.length)];
      const qty = 1 + Math.floor(rnd() * 8);
      return { description: "x", quantity: qty, lineTotal: Math.round(rnd() * 5000) * qty / 100, origRate: rate, fiscalRate: rate };
    });
    if (rnd() < 0.4) items.push({ description: "Verzendkosten", quantity: 1, lineTotal: Math.round(rnd() * 900) / 100, origRate: 21, fiscalRate: 21, lineType: "shipping" } as never);
    const base = items.reduce((a, i) => a + c(i.lineTotal), 0);
    const paid = Math.floor(rnd() * (base + 1)) / 100;
    const b = buildInvoiceLines({ vatHandling: "inclusive", items, paidTotal: paid, declaredDiscount: base / 100 - paid, vatCategory: "S" });
    if (!b.ok) throw new Error(b.reason);
    const odoo = odooBooks(planOdooLines(b.lines, { lineTotalIsNet: false }));
    if (!amountsMatch(odoo, { untaxed: b.subtotal, tax: b.tax, total: b.total })) {
      throw new Error(`order ${n}: odoo ${JSON.stringify(odoo)} ≠ ${b.subtotal}/${b.tax}/${b.total}`);
    }
  }
});

Deno.test("creditnotaregel (line_total netto, geen bruto): prijs = netto + btw", () => {
  const plan = planOdooLines([{ description: "Ticket", quantity: 2, unit_price: 15.7, vat_rate: 21, vat_amount: 6.6, line_total: 31.4, line_type: "product" }], { lineTotalIsNet: true });
  eq(plan, [{ name: "2 × Ticket", price_unit: 38, rate: 21, included: true }]);
});

Deno.test("0%-regel: netto met exclusieve code", () => {
  const plan = planOdooLines([{ description: "Export", quantity: 1, unit_price: 100, vat_rate: 0, vat_amount: 0, net_amount: 100, gross_amount: 100 }], { lineTotalIsNet: false });
  eq(plan, [{ name: "Export", price_unit: 100, rate: 0, included: false }]);
});

Deno.test("amountsMatch: cent verschil = geen match, teken telt niet", () => {
  eq(amountsMatch({ untaxed: 115.41, tax: 24.24, total: 139.65 }, { untaxed: 115.41, tax: 24.24, total: 139.65 }), true);
  eq(amountsMatch({ untaxed: 115.43, tax: 24.24, total: 139.67 }, { untaxed: 115.41, tax: 24.24, total: 139.65 }), false);
  eq(amountsMatch({ untaxed: 10, tax: 2.1, total: 12.1 }, { untaxed: -10, tax: -2.1, total: -12.1 }), true);
});

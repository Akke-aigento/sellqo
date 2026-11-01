// KASSA-ODOO-1 — rekenwerk van de Z-boeking (puur, zonder netwerk).
// Run: deno test --no-lock supabase/functions/_shared/odooPosZ.test.ts
import {
  compareMove, divHalfUp, isTie, parseZRates, planZBooking, splitGrossForOdoo, vatInGross,
  type OdooMoveRead, type ZPlan, type ZReportRow,
} from "./odooPosZ.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
function ok(v: unknown, msg: string) { if (!v) throw new Error(msg); }

/** Zoals kassa_report_data: per ticket en tarief half-up, dan opgeteld. */
function zFromTickets(tickets: Array<Array<{ rate: number; cents: number }>>) {
  const by = new Map<number, { gross: number; vat: number }>();
  for (const t of tickets) {
    const perRate = new Map<number, number>();
    for (const l of t) perRate.set(l.rate, (perRate.get(l.rate) ?? 0) + l.cents);
    for (const [rate, g] of perRate) {
      const cur = by.get(rate) ?? { gross: 0, vat: 0 };
      cur.gross += g; cur.vat += vatInGross(g, rate);
      by.set(rate, cur);
    }
  }
  return [...by].map(([rate, v]) => ({ rate, gross_cents: v.gross, vat_cents: v.vat, net_cents: v.gross - v.vat }));
}

/** Odoo met prijs-inclusieve btw en round_per_line, hoeveelheid 1. */
function odooBooks(plan: ZPlan, taxIdOf: (rate: number) => number): OdooMoveRead {
  const productLines: OdooMoveRead["productLines"] = [];
  const taxByid = new Map<number, number>();
  let untaxed = 0, tax = 0;
  for (const l of plan.lines) {
    const cents = Math.round(l.price_unit * 100);
    const t = l.included ? vatInGross(cents, l.rate) : divHalfUp(cents * l.rate, 100);
    const sub = l.included ? cents - t : cents;
    productLines.push({ tax_ids: [taxIdOf(l.rate)], price_subtotal: sub / 100 });
    if (t !== 0) taxByid.set(taxIdOf(l.rate), (taxByid.get(taxIdOf(l.rate)) ?? 0) + t);
    untaxed += sub; tax += t;
  }
  const sign = plan.moveType === "out_invoice" ? -1 : 1;
  return {
    id: 1, state: "draft", amount_untaxed: untaxed / 100, amount_tax: tax / 100, amount_total: (untaxed + tax) / 100,
    productLines, taxLines: [...taxByid].map(([tax_id, v]) => ({ tax_id, balance: sign * v / 100 })), otherLines: [],
  };
}
const TAX_ID: Record<number, number> = { 21: 141, 12: 142, 6: 143, 0: 50 };
const rateOfTax = new Map(Object.entries(TAX_ID).map(([r, id]) => [id, Number(r)]));

const zRow = (vats: unknown[], extra: Record<string, unknown> = {}): ZReportRow => ({
  id: "z-1", tenant_id: "t", kind: "Z", report_no: 42, booking_date: "2026-10-30",
  period_start: "2026-10-30T05:00:00Z", period_end: "2026-10-31T05:00:00Z",
  data: { vats, payments: [{ method: "cash", cents: 1000 }], tips: [], rounding_cents: 0, ...extra },
});

Deno.test("half-up weg van nul, zoals de FDM", () => {
  eq([divHalfUp(5, 2), divHalfUp(-5, 2), divHalfUp(4, 3), divHalfUp(-4, 3)], [3, -3, 1, -1]);
  eq(vatInGross(1500, 21), 260, "15,00 aan 21%"); // live Z 1 van Café De Wissel
  eq(vatInGross(1600, 12), 171, "16,00 aan 12%");
  eq(vatInGross(-1500, 21), -260, "retour");
  eq(isTie(14, 12), true, "0,14 aan 12% = 1,5 cent");
  eq(isTie(100, 21), false, "21% heeft nooit een halve cent");
});

Deno.test("live Z van 30-10: één regel per tarief, Odoo = Z", () => {
  const p = planZBooking(zRow([{ rate: 21, gross_cents: 1500, vat_cents: 260, net_cents: 1240 }, { rate: 12, gross_cents: 1600, vat_cents: 171, net_cents: 1429 }]), { partnerLabel: "Kassaverkopen" });
  if (!p.ok) throw new Error(p.reason);
  eq(p.plan.name, "Z-2026-00042");
  eq(p.plan.moveType, "out_invoice");
  eq(p.plan.lines.map((l) => [l.price_unit, l.rate, l.included]), [[15, 21, true], [16, 12, true]]);
  eq(p.plan.expected, { untaxed: 26.69, tax: 4.31, total: 31 });
  eq(compareMove(p.plan, odooBooks(p.plan, (r) => TAX_ID[r]), rateOfTax), [], "Odoo gelijk");
});

Deno.test("btw per ticket ≠ btw op het dagtotaal: 300 koffies van 2,60 worden exact verdeeld", () => {
  const tickets = Array.from({ length: 300 }, () => [{ rate: 21, cents: 260 }]);
  const [v] = zFromTickets(tickets);
  eq(v.vat_cents, 300 * 45, "Z-btw = 300 × 0,45");
  ok(vatInGross(v.gross_cents, 21) !== v.vat_cents, "één regel zou afwijken");
  const parts = splitGrossForOdoo(v.gross_cents, v.vat_cents, 21)!;
  ok(parts, "verdeling gevonden");
  eq(parts.reduce((a, b) => a + b, 0), v.gross_cents, "som = bruto");
  eq(parts.reduce((a, g) => a + vatInGross(g, 21), 0), v.vat_cents, "som btw = Z");
  ok(parts.length <= 400, `binnen de limiet (${parts.length})`);
  const p = planZBooking(zRow([v]), { partnerLabel: "Kassaverkopen" });
  if (!p.ok) throw new Error(p.reason);
  eq(p.plan.exact, true);
  eq(compareMove(p.plan, odooBooks(p.plan, (r) => TAX_ID[r]), rateOfTax), [], "Odoo gelijk");
  ok(p.plan.narration.includes("btw-afronding per ticket"), "uitleg in de notitie");
  // Drukke dag met één prijs: 1.000 koffies, 1,24 euro verschil → nog altijd exact.
  const big = splitGrossForOdoo(260_000, 45_000, 21)!;
  ok(big && big.length <= 400, `1.000 koffies (${big?.length})`);
  eq(big.reduce((a, g) => a + vatInGross(g, 21), 0), 45_000, "1.000 koffies: btw = Z");
});

Deno.test("brute kracht: 1.500 willekeurige kassadagen, Odoo boekt exact de Z (incl. retours)", () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const rates = [21, 12, 6, 0];
  let maxLines = 0;
  for (let n = 0; n < 1500; n++) {
    const tickets = Array.from({ length: 1 + Math.floor(rnd() * 120) }, () =>
      Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => {
        const rate = rates[Math.floor(rnd() * rates.length)];
        const price = (50 + Math.floor(rnd() * 3000)) * (1 + Math.floor(rnd() * 3));
        return { rate, cents: rnd() < 0.05 ? -price : price }; // 5 % correcties/retours
      }));
    const vats = zFromTickets(tickets);
    const p = planZBooking(zRow(vats), { partnerLabel: "Kassaverkopen" });
    if (!p.ok) throw new Error(`dag ${n}: ${p.reason}`);
    if (p.plan.empty) continue;
    if (!p.plan.exact) throw new Error(`dag ${n}: geen verdeling gevonden ${JSON.stringify(vats)}`);
    const diffs = compareMove(p.plan, odooBooks(p.plan, (r) => TAX_ID[r]), rateOfTax);
    if (diffs.length) throw new Error(`dag ${n}: ${diffs.join("; ")}`);
    for (const l of p.plan.lines) if (isTie(Math.round(l.price_unit * 100), l.rate)) throw new Error(`dag ${n}: halve cent in een regel`);
    for (const r of [21, 12, 6, 0]) maxLines = Math.max(maxLines, p.plan.lines.filter((l) => l.rate === r).length);
  }
  ok(maxLines <= 400, `max regels per tarief ${maxLines}`);
});

Deno.test("fooien, betaalwijzen en afronding zijn geen omzet (enkel info)", () => {
  const p = planZBooking(zRow([{ rate: 21, gross_cents: 1210, vat_cents: 210, net_cents: 1000 }], {
    payments: [{ method: "cash", cents: 900 }, { method: "card", cents: 820 }],
    tips: [{ method: "card", cents: 500 }], rounding_cents: -2,
  }), { partnerLabel: "Kassaverkopen" });
  if (!p.ok) throw new Error(p.reason);
  eq(p.plan.expected.total, 12.1, "enkel de omzet");
  eq(p.plan.lines.reduce((a, l) => a + l.cents, 0), 1210);
  ok(p.plan.narration.includes("Fooien (geen omzet, niet geboekt): kaart € 5,00"), p.plan.narration);
  ok(p.plan.narration.includes("Betaalwijzen (info, geen betaling geboekt): contant € 9,00, kaart € 8,20"), p.plan.narration);
  ok(p.plan.narration.includes("Afronding contant (niet geboekt): −€ 0,02"), p.plan.narration);
});

Deno.test("retour in één tarief: negatieve regel; hele Z negatief: creditnota met omgekeerd teken", () => {
  const mixed = planZBooking(zRow([{ rate: 21, gross_cents: 5000, vat_cents: 868, net_cents: 4132 }, { rate: 6, gross_cents: -1060, vat_cents: -60, net_cents: -1000 }]), { partnerLabel: "K" });
  if (!mixed.ok) throw new Error(mixed.reason);
  eq(mixed.plan.moveType, "out_invoice");
  eq(mixed.plan.lines.map((l) => l.price_unit), [50, -10.6]);
  eq(compareMove(mixed.plan, odooBooks(mixed.plan, (r) => TAX_ID[r]), rateOfTax), []);

  const neg = planZBooking(zRow([{ rate: 21, gross_cents: -1210, vat_cents: -210, net_cents: -1000 }]), { partnerLabel: "K" });
  if (!neg.ok) throw new Error(neg.reason);
  eq(neg.plan.moveType, "out_refund");
  eq(neg.plan.lines.map((l) => l.price_unit), [12.1], "in de creditnota positief");
  eq(neg.plan.perRate, [{ rate: 21, gross: 1210, vat: 210, net: 1000 }]);
  eq(compareMove(neg.plan, odooBooks(neg.plan, (r) => TAX_ID[r]), rateOfTax), []);
});

Deno.test("lege Z (geen of enkel nul-tarieven) = niets boeken", () => {
  for (const vats of [[], [{ rate: 21, gross_cents: 0, vat_cents: 0, net_cents: 0 }]]) {
    const p = planZBooking(zRow(vats), { partnerLabel: "K" });
    if (!p.ok) throw new Error(p.reason);
    eq([p.plan.empty, p.plan.lines.length, p.plan.expected.total], [true, 0, 0]);
  }
});

Deno.test("0%: netto met de exclusieve code, nooit btw", () => {
  const p = planZBooking(zRow([{ rate: 0, gross_cents: 700, vat_cents: 0, net_cents: 700 }]), { partnerLabel: "K" });
  if (!p.ok) throw new Error(p.reason);
  eq(p.plan.lines.map((l) => [l.price_unit, l.included]), [[7, false]]);
  eq(splitGrossForOdoo(700, 1, 0), null, "0% met btw kan niet");
});

Deno.test("ongeldige Z wordt geweigerd, nooit gegokt", () => {
  const bad = [
    [{ rate: 9, gross_cents: 109, vat_cents: 9, net_cents: 100 }], // Nederlands tarief
    [{ rate: 21, gross_cents: 121, vat_cents: 21, net_cents: 99 }], // bruto − btw ≠ netto
    [{ rate: 21, gross_cents: 12.5, vat_cents: 2, net_cents: 10.5 }], // geen centen
    [{ rate: 21, gross_cents: 121, vat_cents: 21, net_cents: 100 }, { rate: 21, gross_cents: 1, vat_cents: 0, net_cents: 1 }],
    [{ rate: 0, gross_cents: 100, vat_cents: 1, net_cents: 99 }],
  ];
  for (const v of bad) eq(parseZRates({ vats: v }).ok, false, JSON.stringify(v));
  eq(parseZRates({}).ok, false, "zonder vats");
  eq(planZBooking({ ...zRow([]), kind: "X" }, { partnerLabel: "K" }).ok, false, "X-rapport");
});

Deno.test("verdeling past niet binnen de limiet: één regel per tarief, exact = false", () => {
  const tickets = Array.from({ length: 300 }, () => [{ rate: 21, cents: 260 }]);
  const [v] = zFromTickets(tickets);
  const p = planZBooking(zRow([v]), { partnerLabel: "K", maxLinesPerRate: 3 });
  if (!p.ok) throw new Error(p.reason);
  eq([p.plan.exact, p.plan.lines.length], [false, 1]);
  ok(compareMove(p.plan, odooBooks(p.plan, (r) => TAX_ID[r]), rateOfTax).length > 0, "Odoo wijkt af → concept + melding");
  ok(p.plan.narration.includes("LET OP"), "boekhouder krijgt uitleg");
});

Deno.test("compareMove ziet een verwisseling tussen tarieven ook als de totalen kloppen", () => {
  const p = planZBooking(zRow([{ rate: 21, gross_cents: 1500, vat_cents: 260, net_cents: 1240 }, { rate: 12, gross_cents: 1600, vat_cents: 171, net_cents: 1429 }]), { partnerLabel: "K" });
  if (!p.ok) throw new Error(p.reason);
  const mv = odooBooks(p.plan, (r) => TAX_ID[r]);
  mv.taxLines = mv.taxLines.map((t) => ({ ...t, balance: t.tax_id === 141 ? t.balance - 0.01 : t.balance + 0.01 }));
  ok(compareMove(p.plan, mv, rateOfTax).length === 2, "21% en 12% elk 1 cent fout");
  const extra = odooBooks(p.plan, (r) => TAX_ID[r]);
  extra.otherLines.push({ display_type: "rounding", balance: 0.01 });
  ok(compareMove(p.plan, extra, rateOfTax).some((d) => d.includes("rounding")), "afrondingsregel gezien");
  const foreignTax = odooBooks(p.plan, (r) => (r === 12 ? 999 : TAX_ID[r]));
  ok(compareMove(p.plan, foreignTax, rateOfTax).some((d) => d.includes("onverwachte")), "fiscale positie die de code omzet");
});

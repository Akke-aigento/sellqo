// ODOO-GUARD-1 — hoe een SellQo-factuur of -creditnota in Odoo geboekt wordt (puur, getest).
//
// Odoo (nomadix-bv) rondt btw per regel af (round_per_line) en bewaart productprijzen op 2
// decimalen. Een netto-eenheidsprijs uit een inclusieve prijs (19,95 / 1,21 = 16,4876) komt dus
// nooit exact door; tot 27-10 boekte Odoo per regel prijs × aantal met btw bovenop en week het
// af van de factuur (en een korting zat zelfs niet in de regels: Fonske €309).
//
// Regels:
//   - Elke SellQo-regel wordt ÉÉN Odoo-regel met hoeveelheid 1; het aantal staat in de naam
//     ("7 × Fles wijn"). Zo hoeft Odoo niet te vermenigvuldigen of af te ronden.
//   - Regel met btw > 0: prijs = het BRUTO van de regel, met een prijs-inclusieve btw-code. Odoo
//     rekent dan per regel half-up(bruto × t / (100 + t)): exact de btw van de SellQo-regel
//     (INVOICE-INTEGRITY-1 rekent sinds 27-10 ook per regel).
//   - Regel aan 0%: prijs = het NETTO, met de gewone (exclusieve) 0%-code.
//   - Na het aanmaken leest de sync Odoo's totalen terug; enkel bij gelijkheid tot op de cent
//     wordt geboekt (amountsMatch). Anders blijft het een concept en volgt een alarm.

export interface SourceLine {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  gross_amount?: number | null;
  line_total?: number | null;
  line_type?: string | null;
}

export interface OdooLinePlan {
  name: string;
  price_unit: number;
  rate: number;
  /** true = prijs-inclusieve btw-code, false = exclusieve. */
  included: boolean;
}

const cents = (x: number) => Math.round(Number((Math.abs(x) * 100).toFixed(6))) * (x < 0 ? -1 : 1);

/**
 * Netto van een regel in centen. `lineTotalIsNet`: credit_note_lines.line_total is netto; bij
 * invoice_lines komt netto uit net_amount (line_total is daar soms bruto).
 */
export function lineNetCents(l: SourceLine, lineTotalIsNet: boolean): number {
  if (l.net_amount !== null && l.net_amount !== undefined) return cents(Number(l.net_amount));
  // Ook bij invoice_lines is line_total netto zodra net_amount leeg is (abonnementsregels, waar
  // line_total bruto is, hebben altijd net_amount — live nagekeken 27-10).
  void lineTotalIsNet;
  if (l.line_total !== null && l.line_total !== undefined) return cents(Number(l.line_total));
  return cents(Number(l.unit_price || 0) * Number(l.quantity || 0));
}

export function planOdooLines(lines: SourceLine[], opts: { lineTotalIsNet: boolean }): OdooLinePlan[] {
  return lines.map((l) => {
    const rate = Number(l.vat_rate || 0);
    const net = lineNetCents(l, opts.lineTotalIsNet);
    const vat = cents(Number(l.vat_amount || 0));
    const gross = l.gross_amount !== null && l.gross_amount !== undefined ? cents(Number(l.gross_amount)) : net + vat;
    const qty = Number(l.quantity || 1);
    const desc = String(l.description || "Item");
    const name = qty !== 1 && l.line_type !== "discount" ? `${formatQty(qty)} × ${desc}` : desc;
    return rate > 0
      ? { name, price_unit: gross / 100, rate, included: true }
      : { name, price_unit: net / 100, rate, included: false };
  });
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 1000) / 1000).replace(".", ",");
}

export interface Amounts { untaxed: number; tax: number; total: number }

/** Odoo-totalen = SellQo-totalen tot op de cent (absolute waarden: een creditnota kan negatief staan). */
export function amountsMatch(odoo: Amounts, sellqo: Amounts): boolean {
  const a = (x: number) => Math.abs(cents(Number(x) || 0));
  return a(odoo.untaxed) === a(sellqo.untaxed) && a(odoo.tax) === a(sellqo.tax) && a(odoo.total) === a(sellqo.total);
}

export function describeAmounts(x: Amounts): string {
  const f = (n: number) => (Math.round(Math.abs(n) * 100) / 100).toFixed(2);
  return `${f(x.untaxed)} + ${f(x.tax)} btw = ${f(x.total)}`;
}

// INVOICE-INTEGRITY-1 — creditnotaregels uit factuurregels, met de korting naar rato.
//
// Sinds 27-10-2026 staat een kortingscode als negatieve regel (line_type 'discount') per
// btw-tarief op de factuur. Een volledige creditnota neemt alle regels over, dus ook de
// korting: het gecrediteerde bedrag is dan precies wat de klant betaalde. Een gedeeltelijke
// creditnota neemt de gekozen regels over plus het aandeel van de korting van hun tarief
// (naar rato van het bruto), zodat nooit meer gecrediteerd wordt dan er betaald is.
// Bedragen op de cent; netto + btw = bruto per regel.

export interface SourceInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  line_type: 'product' | 'shipping' | 'discount' | string;
  net_amount?: number | null;
  gross_amount?: number | null;
}

export interface CreditLineDraft {
  original_invoice_line_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  /** Netto (credit_note_lines.line_total is netto: subtotaal + btw = totaal). */
  line_total: number;
  line_type: 'product' | 'shipping' | 'discount';
}

const cents = (x: number) => Math.round(Number((Math.abs(x) * 100).toFixed(6))) * (x < 0 ? -1 : 1);
const eur = (c: number) => c / 100 || 0;

/**
 * Netto van een factuurregel in centen: net_amount; anders line_total (bij elke regel zonder
 * net_amount is line_total netto — live nagekeken 27-10); pas daarna prijs × aantal (de
 * eenheidsprijs van oude facturen stond los op 2 decimalen afgerond).
 */
export function lineNetCents(l: SourceInvoiceLine): number {
  if (l.net_amount !== null && l.net_amount !== undefined) return cents(Number(l.net_amount));
  if (l.line_total !== null && l.line_total !== undefined) return cents(Number(l.line_total));
  return cents(Number(l.unit_price || 0) * Number(l.quantity || 0));
}

/** Btw van een factuurregel in centen. */
export function lineVatCents(l: SourceInvoiceLine): number {
  return cents(Number(l.vat_amount || 0));
}

/** Bruto van een factuurregel in centen (netto + btw). */
export function lineGrossCents(l: SourceInvoiceLine): number {
  return lineNetCents(l) + lineVatCents(l);
}

export const isDiscountLine = (l: SourceInvoiceLine) => l.line_type === 'discount';

function copyLine(l: SourceInvoiceLine): CreditLineDraft {
  const net = lineNetCents(l);
  const qty = Number(l.quantity || 1);
  return {
    original_invoice_line_id: l.id,
    description: l.description,
    quantity: qty,
    unit_price: Number((eur(net) / qty).toFixed(4)),
    vat_rate: Number(l.vat_rate || 0),
    vat_amount: eur(lineVatCents(l)),
    line_total: eur(net),
    line_type: (['product', 'shipping', 'discount'].includes(l.line_type) ? l.line_type : 'product') as CreditLineDraft['line_type'],
  };
}

/**
 * De creditnotaregels.
 * - 'full': alle factuurregels, korting inbegrepen.
 * - anders: de gekozen regels (kortingsregels zelf zijn niet kiesbaar) plus per tarief
 *   een kortingsregel = korting van dat tarief × (gekozen bruto / bruto van dat tarief).
 */
export function buildCreditLines(
  lines: SourceInvoiceLine[],
  selectedIds: Set<string>,
  type: 'full' | 'partial' | 'correction',
): CreditLineDraft[] {
  if (type === 'full') return lines.map(copyLine);

  const chosen = lines.filter((l) => !isDiscountLine(l) && selectedIds.has(l.id));
  const out = chosen.map(copyLine);

  const rates = Array.from(new Set(lines.filter(isDiscountLine).map((l) => Number(l.vat_rate || 0))));
  for (const rate of rates) {
    const ofRate = (l: SourceInvoiceLine) => Number(l.vat_rate || 0) === rate;
    const baseGross = lines.filter((l) => !isDiscountLine(l) && ofRate(l)).reduce((a, l) => a + lineGrossCents(l), 0);
    const chosenGross = chosen.filter(ofRate).reduce((a, l) => a + lineGrossCents(l), 0);
    if (baseGross <= 0 || chosenGross <= 0) continue;
    const discs = lines.filter((l) => isDiscountLine(l) && ofRate(l));
    const discGross = discs.reduce((a, l) => a + lineGrossCents(l), 0);
    const share = Math.min(1, chosenGross / baseGross);
    const gross = Math.round(discGross * share);
    // Btw per regel zoals op de factuur (half weg van nul op bruto × t / (100 + t)).
    const vat = cents((gross / 100) * rate / (100 + rate));
    const net = gross - vat;
    if (gross === 0) continue;
    out.push({
      original_invoice_line_id: discs.length === 1 ? discs[0].id : null,
      description: `${discs[0].description} (aandeel)`,
      quantity: 1,
      unit_price: eur(net),
      vat_rate: rate,
      vat_amount: eur(vat),
      line_total: eur(net),
      line_type: 'discount',
    });
  }
  return out;
}

/** Totalen van creditnotaregels, op de cent. */
export function creditTotals(lines: CreditLineDraft[]): { subtotal: number; tax: number; total: number } {
  const net = lines.reduce((a, l) => a + cents(l.line_total), 0);
  const vat = lines.reduce((a, l) => a + cents(l.vat_amount || 0), 0);
  return { subtotal: eur(net), tax: eur(vat), total: eur(net + vat) };
}

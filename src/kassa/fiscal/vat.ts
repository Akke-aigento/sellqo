// KASSA-0 — btw zoals de FDM ze berekent (TX-01, TX-02).
//
// Per btw-label op het totaal van het event (niet per lijn):
//   totaal  = Σ (vat.price + Σ priceChange.amount) over alle (sub)producten met dat label
//   btw     = half_up(totaal × t / (100 + t))
//   maatstaf = totaal − btw
// Bewezen tegen 145/145 officiële antwoorden (projectdoc gks-prototypes.md). De FDM-waarde
// is de waarheid op het ticket; deze functie bestaat om ze te voorspellen en te testen.
import { cents, divRoundHalfUp, fromCents, type Cents } from './money';
import type { ProductInput, TransactionInput, TransferInput, VatCalcItem, VatLabel } from './types';

export interface VatRateRow { label: VatLabel; rate: number; outOfScope: boolean }

/** Tarieven per label met ingangsdatum (bookingDate, YYYY-MM-DD). Nieuwste eerst per label. */
const RATE_TABLE: Array<{ validFrom: string; rates: Record<VatLabel, VatRateRow> }> = [
  {
    validFrom: '2000-01-01',
    rates: {
      A: { label: 'A', rate: 21, outOfScope: false },
      B: { label: 'B', rate: 12, outOfScope: false },
      C: { label: 'C', rate: 6, outOfScope: false },
      D: { label: 'D', rate: 0, outOfScope: false },
      X: { label: 'X', rate: 0, outOfScope: true },
    },
  },
];

export const VAT_LABELS: VatLabel[] = ['A', 'B', 'C', 'D', 'X'];

export function vatRatesOn(bookingDate: string): Record<VatLabel, VatRateRow> {
  const row = RATE_TABLE.filter((r) => r.validFrom <= bookingDate).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (!row) throw new Error(`geen btw-tarieven voor ${bookingDate}`);
  return row.rates;
}

/** De producten die btw dragen: bij een samengesteld product enkel de subproducten. */
export function vatBearingProducts(line: TransactionInput['transactionLines'][number]): ProductInput[] {
  if (line.lineType === 'COMPOSITE_PRODUCT') return line.subProducts ?? [];
  return [line.mainProduct];
}

/** Totaal per label (centen) van één transactie, incl. prijswijzigingen. */
export function totalsPerLabel(tx: TransactionInput, into: Map<VatLabel, Cents> = new Map()): Map<VatLabel, Cents> {
  for (const line of tx.transactionLines) {
    for (const p of vatBearingProducts(line)) {
      for (const v of p.vats ?? []) {
        let amt = cents(v.price);
        for (const pc of v.priceChanges ?? []) amt += cents(pc.amount);
        into.set(v.label, (into.get(v.label) ?? 0) + amt);
      }
    }
  }
  return into;
}

export interface VatCalcCents { label: VatLabel; rate: number; taxable: Cents; vat: Cents; total: Cents; outOfScope: boolean }

export function vatForTotal(label: VatLabel, total: Cents, bookingDate: string): VatCalcCents {
  const r = vatRatesOn(bookingDate)[label];
  const vat = r.outOfScope || r.rate === 0 ? 0 : divRoundHalfUp(total * r.rate, 100 + r.rate);
  return { label, rate: r.rate, taxable: total - vat, vat, total, outOfScope: r.outOfScope };
}

/**
 * vatCalc zoals in het FDM-antwoord: labels in volgorde van eerste voorkomen in de transactie
 * (zo staan ze in de officiële antwoorden, bv. UC200: B vóór A). `totals` is een Map en
 * behoudt die invoegvolgorde.
 */
export function calcVat(totals: Map<VatLabel, Cents>, bookingDate: string): VatCalcItem[] {
  return [...totals.keys()].map((l) => {
    const c = vatForTotal(l, totals.get(l) as Cents, bookingDate);
    return {
      label: c.label,
      rate: c.rate,
      taxableAmount: fromCents(c.taxable),
      vatAmount: fromCents(c.vat),
      totalAmount: fromCents(c.total),
      outOfScope: c.outOfScope,
    };
  });
}

/** Alle transacties in een bericht (sale/order/prebill: 1, transfer: from + to). */
export function transactionsOf(data: { transaction?: TransactionInput | null; transfer?: TransferInput | null }): TransactionInput[] {
  const out: TransactionInput[] = [];
  if (data.transaction) out.push(data.transaction);
  if (data.transfer) {
    for (const it of data.transfer.from) out.push(it.transaction);
    for (const it of data.transfer.to) out.push(it.transaction);
  }
  return out;
}

// BILLING-1: gedeelde geldrekenkunde voor de billing-keten.
//
// Bug 3: btw werd PER REGEL afgerond en daarna gesomd. Op 3 x EUR 9,99 @ 21%
// geeft dat 3 x 2,10 = 6,30, terwijl fiscaal 21% over 29,97 = 6,29 verschuldigd
// is. Die cent per factuur loopt op en maakt de btw-aangifte onverklaarbaar.
//
// Fiscaal correct is: groepeer per tarief, sommeer het netto van de groep, en
// rond DAN pas af. Dat is precies het model dat _shared/peppol/ubl-builder.ts
// (aggregateTaxSubtotals, regels 127-145) al hanteert voor de UBL TaxSubtotals.
// Deze helper trekt de factuurkop met dat huisstandaard-model gelijk.

/** Afronden op 2 decimalen, met EPSILON tegen de klassieke 1.005-artefacten. */
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export interface VatLine {
  /** Netto regelbedrag (quantity x unit_price), ONAFGEROND. */
  net: number;
  /** Btw-percentage, bijv. 21 voor 21%. */
  vatRate: number;
}

export interface VatRateGroup {
  rate: number;
  net: number;
  vat: number;
}

export interface VatTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
  /** Per tarief-groep, aflopend op tarief (gelijk aan ubl-builder.ts:144). */
  perRate: VatRateGroup[];
}

/**
 * Tel netto, btw en totaal op over een set factuurregels.
 * Sommeert per tarief-groep VOOR het afronden, zodat de per-regel-drift verdwijnt.
 */
export function computeVatTotals(lines: VatLine[]): VatTotals {
  const byRate = new Map<number, number>();
  let rawSubtotal = 0;

  for (const line of lines ?? []) {
    const net = Number(line?.net);
    const safeNet = Number.isFinite(net) ? net : 0;
    const rawRate = Number(line?.vatRate);
    const rate = Number.isFinite(rawRate) ? rawRate : 0;
    rawSubtotal += safeNet;
    byRate.set(rate, (byRate.get(rate) ?? 0) + safeNet);
  }

  const perRate: VatRateGroup[] = [];
  let vatAmount = 0;
  for (const [rate, groupNet] of byRate.entries()) {
    // Eerst het groepsnetto afronden, dan de btw daarover: hetzelfde als
    // ubl-builder.ts:138-141, zodat kop en UBL-TaxSubtotal niet uiteenlopen.
    const net = round2(groupNet);
    const vat = round2(net * rate / 100);
    perRate.push({ rate, net, vat });
    vatAmount += vat;
  }
  perRate.sort((a, b) => b.rate - a.rate);

  const subtotal = round2(rawSubtotal);
  vatAmount = round2(vatAmount);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount), perRate };
}

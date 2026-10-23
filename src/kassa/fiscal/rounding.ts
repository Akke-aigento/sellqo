// KASSA-0 — contant afronden op 5 cent (PAY-02, PAY-03, PAY-04).
//
// Laatste cijfer 1,2 → omlaag naar 0; 3,4 → omhoog naar 5; 6,7 → omlaag naar 5; 8,9 → omhoog
// naar 0. Nooit afronden onder 5 cent (een totaal van €0,01..€0,04 blijft staan).
// Afronding = aparte betaallijn amountType ROUNDING met (afgerond − exact); de PAYMENT-lijn
// draagt het onafgeronde bedrag. Zie UC201 (6,08 → +0,02) en M112A_2 (1,04 → +0,01).
import type { Cents } from './money';

export function roundCash5(amount: Cents): Cents {
  if (!Number.isSafeInteger(amount)) throw new Error('roundCash5: centen verwacht');
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  if (abs < 5) return amount; // "< 5 cent nooit"
  const last = abs % 5;
  const down = abs - last;
  const r = last <= 2 ? down : down + 5;
  const out = sign * r;
  return out === 0 ? 0 : out;
}

/** Verschil dat als ROUNDING-lijn geboekt wordt (afgerond − exact). Max ±2 cent. */
export function cashRoundingDelta(amount: Cents): Cents {
  const d = roundCash5(amount) - amount;
  if (Math.abs(d) > 2) throw new Error(`afronding buiten ±0,02 (${d})`);
  return d === 0 ? 0 : d;
}

/**
 * Verwerkingsvolgorde bij een gemengde betaling (PAY-03): eerst cheques en bonnen (nooit
 * afronden, geen wisselgeld), dan cash (afgerond), dan elektronisch. Geeft per stap het
 * bedrag dat nog open staat.
 */
export type TenderKind = 'voucher' | 'cash' | 'electronic';
export function tenderOrder(kind: TenderKind): number {
  return kind === 'voucher' ? 0 : kind === 'cash' ? 1 : 2;
}

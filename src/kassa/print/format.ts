// PRINT-1 — notatie op het ticket. Bedragen altijd via fiscal/money.ts (centen, geen floats).
import { cents, milli4, type Cents } from '../fiscal/money';
import type { QuantityType } from '../fiscal/types';

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Centen → Belgische notatie: 1234,56 → "1.234,56", -304 → "-3,04". */
export function fmtCents(c: Cents): string {
  if (!Number.isSafeInteger(c)) throw new Error(`fmtCents: geen geheel aantal centen (${c})`);
  const neg = c < 0;
  const a = Math.abs(c);
  const s = `${groupThousands(Math.floor(a / 100))},${String(a % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/** JSON-bedrag uit een FDM-bericht/antwoord → Belgische notatie (via centen, gooit bij > 2 decimalen). */
export function fmtAmount(v: number): string {
  return fmtCents(cents(v));
}

/** Totaal met euroteken, zoals op de FOD-voorbeelden: "€3,04", "-€3,04". */
export function fmtEuro(v: number): string {
  const s = fmtAmount(v);
  return s.startsWith('-') ? `-€${s.slice(1)}` : `€${s}`;
}

/** Btw-tarief: 21 → "21,00%". */
export function fmtRate(rate: number): string {
  return `${fmtCents(Math.round(rate * 100))}%`;
}

const UNIT: Record<QuantityType, string> = { PIECE: '', KILOGRAM: 'kg', METER: 'm', LITRE: 'l', HOUR: 'h' };

/** Hoeveelheid (JSON, max 4 decimalen) → "2", "-1", "0,525 kg". */
export function fmtQty(q: number, type: QuantityType = 'PIECE'): string {
  const m = milli4(q);
  const neg = m < 0;
  const a = Math.abs(m);
  const int = Math.floor(a / 10_000);
  let frac = String(a % 10_000).padStart(4, '0').replace(/0+$/, '');
  frac = frac ? `,${frac}` : '';
  const s = `${neg ? '-' : ''}${int}${frac}`;
  return UNIT[type] ? `${s} ${UNIT[type]}` : s;
}

/**
 * posDateTime (Brusselse lokale tijd met offset, ID-08) → "23.06.2026" en "11:35".
 * Geen tijdzone-omrekening: de kassa schreef de lokale tijd al in de string.
 */
export function splitPosDateTime(posDateTime: string): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(posDateTime);
  if (!m) throw new Error(`posDateTime onleesbaar: ${posDateTime}`);
  return { date: `${m[3]}.${m[2]}.${m[1]}`, time: `${m[4]}:${m[5]}` };
}

export function fmtPosDateTime(posDateTime: string): string {
  const d = splitPosDateTime(posDateTime);
  return `${d.date} ${d.time}`;
}

/** Doorlopend ticketnummer, minstens 6 cijfers zoals op de voorbeelden ("000433"). */
export function fmtTicketNo(n: number): string {
  return String(n).padStart(6, '0');
}

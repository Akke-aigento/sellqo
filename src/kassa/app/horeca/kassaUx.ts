// KASSA-UX-6 — kleine rekenhulpen voor de kassa (pure functies, getest in __tests__/kassaUx6.test.ts).
// Niets hiervan raakt een fiscaal bericht: herhalen = gewone nieuwe ontwerp-lijnen (add_line),
// fooi en telling vullen enkel een invoerveld in dat de medewerker nog kan aanpassen.
import type { Check, CheckLine } from './types';

/**
 * "Herhaal vorige ronde": de positieve productlijnen van de laatst verstuurde ronde met nieuwe bestellingen
 * (de ronde van zo'n lijn met het hoogste volgnummer). Correcties, tegenboekingen, herboekingen met korting, verplaatste
 * kopieën (geen ronde) en lijnen zonder product tellen niet mee.
 */
export function lastRoundLines(check: Pick<Check, 'lines'>): CheckLine[] {
  const fresh = check.lines.filter((l) => l.state === 'sent' && !!l.round_id && l.qty > 0 && !!l.product_id && !l.neg_reason && !l.corrects_line_id);
  if (!fresh.length) return [];
  const last = fresh.reduce((a, b) => (b.seq > a.seq ? b : a));
  return fresh.filter((l) => l.round_id === last.round_id).sort((a, b) => a.seq - b.seq);
}

/** Fooi-snelknoppen: 5 %, 10 % en "rond af" naar de volgende hele euro (0 = al rond). */
export function tipSuggestions(totalCents: number): { pct5: number; pct10: number; roundUp: number } {
  const t = Math.max(0, Math.round(totalCents));
  return { pct5: Math.round(t * 0.05), pct10: Math.round(t * 0.1), roundUp: (100 - (t % 100)) % 100 };
}

/** Snelknoppen "gegeven" bij contant: het exacte (afgeronde) bedrag en de biljetten die genoeg zijn. */
export function cashGivenOptions(cashDue: number): number[] {
  return [cashDue, 500, 1000, 2000, 5000, 10000].filter((v, i, a) => a.indexOf(v) === i && v >= cashDue);
}

/** Euro-biljetten en -munten in centen, groot naar klein (de 1- en 2-centmunt bestaan, ook al rondt de kassa af). */
export const DENOMINATIONS = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

/** Totaal van een telling per biljet/munt; ongeldige of negatieve aantallen tellen niet. */
export function countTotal(counts: Partial<Record<number, number>>): number {
  return DENOMINATIONS.reduce((s, d) => {
    const n = counts[d];
    return s + (Number.isSafeInteger(n) && (n as number) > 0 ? (n as number) * d : 0);
  }, 0);
}

/** Vergrendeltijden die de zaak kan kiezen (minuten; 0 = nooit). Zelfde lijst als de check in de database. */
export const LOCK_MINUTES = [1, 2, 5, 10, 0] as const;
export const DEFAULT_LOCK_MINUTES = 2;
export const normalizeLockMinutes = (v: unknown): number =>
  v !== null && v !== undefined && v !== '' && (LOCK_MINUTES as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_LOCK_MINUTES;

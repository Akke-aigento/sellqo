// TAFEL-2 — afrekenen: betaalmiddelen, contant afronden, fooi en de fiscale betaallijnen.
//
// Eén betaling per rekening = één btw-kasticket (N). Meerdere betaalmiddelen op één ticket
// heet "gesplitste betaling" (UC4119); apart afrekenen per persoon loopt via een
// deelrekening (UC4119bis), niet via deze module.
//
// Regels (eisenmatrix PAY-01..06), dezelfde als de server (horeca_pay) controleert:
// - De betaalmiddelen sluiten exact op het totaal (vóór afronding).
// - Contant wordt afgerond op 5 cent over de som van het contante deel; de afronding is een
//   aparte lijn ROUNDING van max. ±0,02 (UC201, UC4119, UC4103bis).
// - Volgorde op het ticket: eerst cheques en bonnen, dan contant (+ afronding), dan
//   elektronisch (PAY-03).
// - Fooi staat buiten het totaal en de btw: lijn TIP (UC292, UC4103bis).
import { cashRoundingDelta, roundCash5 } from '../../fiscal/rounding';
import type { PaymentSpec } from '../../fiscal/builders';
import type { PaymentType } from '../../fiscal/types';

export type TenderMethod = 'cash' | 'card' | 'cheque_meal' | 'voucher' | 'other';
export const TENDER_METHODS: TenderMethod[] = ['cash', 'card', 'cheque_meal', 'voucher', 'other'];

export interface Tender { method: TenderMethod; amount_cents: number }
export type TipMethod = 'cash' | 'card';

export interface PaymentPlan {
  total: number;
  tenders: Tender[];
  /** Som contant vóór afronding. */
  cash: number;
  /** Afgerond contant min exact contant (−2..+2). */
  rounding: number;
  /** Wat de klant contant moet geven (afgerond). */
  cashDue: number;
  tip: number;
  tipMethod: TipMethod | null;
}

export class PaymentPlanError extends Error {
  constructor(readonly code: 'not_matching' | 'non_positive' | 'empty' | 'tip', message: string) {
    super(message);
    this.name = 'PaymentPlanError';
  }
}

/** Controleer en reken af zoals de server. Gooit PaymentPlanError als het niet klopt. */
export function planPayment(total: number, tenders: Tender[], tip = 0, tipMethod: TipMethod | null = null): PaymentPlan {
  if (!Number.isSafeInteger(total) || total < 0) throw new PaymentPlanError('not_matching', 'totaal ongeldig');
  const clean = tenders.filter((t) => t.amount_cents !== 0);
  if (clean.some((t) => !Number.isSafeInteger(t.amount_cents) || t.amount_cents < 0)) throw new PaymentPlanError('non_positive', 'bedrag per betaalmiddel moet positief zijn');
  if (total > 0 && clean.length === 0) throw new PaymentPlanError('empty', 'geen betaalmiddel');
  const sum = clean.reduce((s, t) => s + t.amount_cents, 0);
  if (sum !== total) throw new PaymentPlanError('not_matching', `betaalmiddelen ${sum} ≠ totaal ${total}`);
  if (!Number.isSafeInteger(tip) || tip < 0 || tip > 100000 || (tip > 0) !== (tipMethod !== null)) throw new PaymentPlanError('tip', 'fooi ongeldig');
  const cash = clean.filter((t) => t.method === 'cash').reduce((s, t) => s + t.amount_cents, 0);
  const rounding = cashRoundingDelta(cash);
  return { total, tenders: clean, cash, rounding, cashDue: cash + rounding, tip, tipMethod: tip > 0 ? tipMethod : null };
}

/** Gelijk delen in n delen; de resterende centen gaan naar de eerste delen. */
export function equalSplit(total: number, n: number): number[] {
  if (!Number.isSafeInteger(n) || n < 1 || n > 50) throw new Error('aantal delen 1..50');
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Wisselgeld bij contant: wat de klant gaf min het afgeronde contante deel (+ contante fooi). */
export function changeDue(plan: PaymentPlan, given: number): number {
  const due = plan.cashDue + (plan.tipMethod === 'cash' ? plan.tip : 0);
  return Math.max(0, given - due);
}

/** Wat de klant contant afgerond moet betalen voor een bedrag (voor de knoppen). */
export const cashAmountFor = (cents: number) => roundCash5(cents);

const FISCAL: Record<TenderMethod, { type: PaymentType; name: string }> = {
  cash: { type: 'CASH', name: 'CONTANT' },
  // De betaalterminal staat los van de kassa: debet of krediet kennen we niet.
  card: { type: 'CARD_UNKNOWN', name: 'KAART' },
  cheque_meal: { type: 'CHEQUE_MEAL', name: 'MAALTIJDCHEQUE' },
  voucher: { type: 'VOUCHER_OTHER', name: 'BON' },
  other: { type: 'OTHER', name: 'ANDERE' },
};
const ORDER: Record<TenderMethod, number> = { cheque_meal: 0, voucher: 0, cash: 1, card: 2, other: 2 };
export const DRAWER = { id: '1', name: 'Lade 1' } as const;

/** Fiscale betaallijnen (financials) voor signSale. */
export function paymentSpecs(plan: PaymentPlan): PaymentSpec[] {
  const out: PaymentSpec[] = [];
  let n = 0;
  const id = () => String(++n);
  const sorted = [...plan.tenders].sort((a, b) => ORDER[a.method] - ORDER[b.method]);
  // Contant samen als één lijn (de afronding geldt over de som contant).
  const nonCash = sorted.filter((t) => t.method !== 'cash');
  for (const t of nonCash.filter((x) => ORDER[x.method] === 0)) {
    out.push({ id: id(), name: FISCAL[t.method].name, type: FISCAL[t.method].type, inputMethod: 'MANUAL', amount: t.amount_cents, amountType: 'PAYMENT' });
  }
  if (plan.cash > 0) {
    out.push({ id: id(), name: FISCAL.cash.name, type: 'CASH', inputMethod: 'MANUAL', amount: plan.cash, amountType: 'PAYMENT', drawer: { ...DRAWER } });
    if (plan.rounding !== 0) out.push({ id: id(), name: FISCAL.cash.name, type: 'CASH', inputMethod: 'MANUAL', amount: plan.rounding, amountType: 'ROUNDING', drawer: { ...DRAWER } });
  }
  for (const t of nonCash.filter((x) => ORDER[x.method] === 2)) {
    out.push({ id: id(), name: FISCAL[t.method].name, type: FISCAL[t.method].type, inputMethod: 'MANUAL', amount: t.amount_cents, amountType: 'PAYMENT' });
  }
  if (plan.tip > 0 && plan.tipMethod) {
    const m = plan.tipMethod === 'cash' ? FISCAL.cash : FISCAL.card;
    out.push({ id: id(), name: m.name, type: m.type, inputMethod: 'MANUAL', amount: plan.tip, amountType: 'TIP', ...(plan.tipMethod === 'cash' ? { drawer: { ...DRAWER } } : {}) });
  }
  return out;
}

/** Contante betaalmiddelen samenvoegen tot één lijn (zoals op het ticket en voor de server). */
export function normalizedTenders(plan: PaymentPlan): Tender[] {
  const out: Tender[] = [];
  for (const t of plan.tenders) {
    const same = out.find((x) => x.method === t.method);
    if (same) same.amount_cents += t.amount_cents;
    else out.push({ ...t });
  }
  return out;
}

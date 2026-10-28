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

// BETAAL-1: 'transfer' = overschrijving via EPC-QR (de klant betaalt in zijn bankapp, het personeel
// bevestigt). Welke betaalwijzen een kassa toont, volgt uit horeca_pay_settings (paySettings.ts).
export type TenderMethod = 'cash' | 'card' | 'transfer' | 'cheque_meal' | 'voucher' | 'other';
export const TENDER_METHODS: TenderMethod[] = ['cash', 'card', 'transfer', 'cheque_meal', 'voucher', 'other'];

/** reference: enkel bij een overschrijving, de gestructureerde mededeling uit de QR. */
export interface Tender { method: TenderMethod; amount_cents: number; reference?: string }
export type TipMethod = 'cash' | 'card' | 'transfer';
export const TIP_METHODS: TipMethod[] = ['cash', 'card', 'transfer'];

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

/** BETAAL-1: wat de klant overschrijft — het overschrijvingsdeel plus een fooi via overschrijving. */
export function transferDue(plan: PaymentPlan): number {
  const part = plan.tenders.filter((t) => t.method === 'transfer').reduce((s, t) => s + t.amount_cents, 0);
  return part + (plan.tipMethod === 'transfer' ? plan.tip : 0);
}

/** Wat de klant contant afgerond moet betalen voor een bedrag (voor de knoppen). */
export const cashAmountFor = (cents: number) => roundCash5(cents);

const FISCAL: Record<TenderMethod, { type: PaymentType; name: string }> = {
  cash: { type: 'CASH', name: 'CONTANT' },
  // De betaalterminal staat los van de kassa: debet of krediet kennen we niet.
  card: { type: 'CARD_UNKNOWN', name: 'KAART' },
  // BETAAL-1: de FDM kent geen apart type voor een overschrijving; OTHER met een duidelijke naam
  // (vraag opgenomen voor de Q&A met de FOD, eisenmatrix §14).
  transfer: { type: 'OTHER', name: 'OVERSCHRIJVING' },
  cheque_meal: { type: 'CHEQUE_MEAL', name: 'MAALTIJDCHEQUE' },
  voucher: { type: 'VOUCHER_OTHER', name: 'BON' },
  other: { type: 'OTHER', name: 'ANDERE' },
};
const ORDER: Record<TenderMethod, number> = { cheque_meal: 0, voucher: 0, cash: 1, card: 2, transfer: 2, other: 2 };
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
    const m = FISCAL[plan.tipMethod];
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

/** "12,50" / "12.5" / "12" → centen; ongeldig = null. */
export function parseEuroInput(s: string): number | null {
  const v = s.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

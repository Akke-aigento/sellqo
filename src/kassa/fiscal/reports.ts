// KASSA-0 — rapporten X/Z berekend uit het fiscale logboek (RPT-01..RPT-09).
//
// Bron is ALTIJD de lijst ondertekende events (fiscal_events), nooit orders of
// pos_transactions (RPT-08: elk intern rapport moet met de Z overeenkomen).
// Regels, nagetrokken op de officiële rapportenset NL (12 tickets, 11-02-2025):
//  - training-events, rapporten (R) en kopieën (C) tellen nergens mee (Q502, Q504)
//  - transactions: N en P met een transaction-object; P = orders + voorrekeningen
//  - departments, vats, priceChanges: enkel N; vats = som van de FDM-vatCalc
//  - negQuantities: signSale en signOrder, nooit signPreBill (Q303)
//  - priceChanges: enkel PUBLIC, per label negatief/positief
//  - omzetrapport: S-events vallen buiten het bereik van posDevices/fdmDevices;
//    gebruikersrapport: wel (RPT-07)
//  - gebruikers: totalAmount = Σ transactionTotal van N (fooi en afronding zitten in de
//    betalingen, niet in transactionTotal), gesorteerd op employeeId
import { cents, fromCents, type Cents } from './money';
import type {
  AnyFiscalInput, DepartmentTotalInput, EventTotalInput, FdmDeviceInput, InOutItemInput, InvoiceInput,
  MutationName, NegQuantityReason, NegQuantityTotalInput, PaymentCorrectionInput, PaymentLineInput,
  PaymentLineType, PaymentTotalInput, PaymentType, PosDeviceInput, PriceChangeTotalInput, PriceChangeType,
  SaleInput, SignResult, TransactionInput, TurnoverInput, UserItemInput, VatLabel, VatTotalInput,
} from './types';

export interface SignedEvent {
  name: MutationName;
  isTraining: boolean;
  data: AnyFiscalInput;
  result: SignResult;
}

const AMOUNT_TYPES: PaymentLineType[] = ['PAYMENT', 'TIP', 'ROUNDING'];
const byNum = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
const instant = (s: string) => Date.parse(s);

function counted(events: SignedEvent[]): SignedEvent[] {
  return events.filter((e) => !e.isTraining && e.result.fdmRef.eventLabel !== 'R' && e.result.fdmRef.eventLabel !== 'C');
}
const isS = (e: SignedEvent) => e.name === 'signWorkIn' || e.name === 'signWorkOut';

export function posDevicesOf(events: SignedEvent[]): PosDeviceInput[] {
  const m = new Map<string, PosDeviceInput>();
  for (const e of events) {
    const k = `${e.data.posId}|${e.data.terminalId}`;
    const cur = m.get(k);
    const t = e.data.posDateTime;
    if (!cur) m.set(k, { posId: e.data.posId, terminalId: e.data.terminalId, firstPosDateTime: t, lastPosDateTime: t });
    else {
      if (instant(t) < instant(cur.firstPosDateTime)) cur.firstPosDateTime = t;
      if (instant(t) > instant(cur.lastPosDateTime)) cur.lastPosDateTime = t;
    }
  }
  return [...m.values()].sort((a, b) => byNum(a.posId, b.posId) || byNum(a.terminalId, b.terminalId));
}

export function fdmDevicesOf(events: SignedEvent[]): FdmDeviceInput[] {
  const m = new Map<string, FdmDeviceInput>();
  for (const e of events) {
    const r = e.result.fdmRef;
    const cur = m.get(r.fdmId);
    if (!cur) m.set(r.fdmId, { fdmId: r.fdmId, firstFdmDateTime: r.fdmDateTime, firstTotalCounter: r.totalCounter, lastFdmDateTime: r.fdmDateTime, lastTotalCounter: r.totalCounter });
    else {
      if (r.totalCounter < cur.firstTotalCounter) { cur.firstTotalCounter = r.totalCounter; cur.firstFdmDateTime = r.fdmDateTime; }
      if (r.totalCounter > cur.lastTotalCounter) { cur.lastTotalCounter = r.totalCounter; cur.lastFdmDateTime = r.fdmDateTime; }
    }
  }
  return [...m.values()].sort((a, b) => byNum(a.fdmId, b.fdmId));
}

// ---------------------------------------------------------------- betalingen

interface PayAcc {
  id: string; name: string; type: PaymentType;
  amounts: Map<PaymentLineType, { normal: Cents; neg: Cents; pos: Cents; count: number }>;
}

class PaymentTotals {
  private m = new Map<string, PayAcc>();
  private acc(p: PaymentLineInput): PayAcc {
    const k = `${p.id}|${p.type}`;
    let a = this.m.get(k);
    if (!a) { a = { id: p.id, name: p.name, type: p.type, amounts: new Map() }; this.m.set(k, a); }
    return a;
  }
  private slot(a: PayAcc, t: PaymentLineType) {
    let s = a.amounts.get(t);
    if (!s) { s = { normal: 0, neg: 0, pos: 0, count: 0 }; a.amounts.set(t, s); }
    return s;
  }
  addNormal(p: PaymentLineInput) { this.slot(this.acc(p), p.amountType).normal += cents(p.amount); }
  addCorrection(p: PaymentLineInput) {
    const s = this.slot(this.acc(p), p.amountType);
    const c = cents(p.amount);
    if (c < 0) s.neg += c; else s.pos += c;
    s.count += 1;
  }
  toInput(): PaymentTotalInput[] {
    return [...this.m.values()].sort((a, b) => byNum(a.id, b.id) || byNum(a.type, b.type)).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      amount: AMOUNT_TYPES.filter((t) => a.amounts.has(t)).map((t) => {
        const s = a.amounts.get(t)!;
        return {
          type: t,
          normalAmount: fromCents(s.normal),
          negativeCorrections: fromCents(s.neg),
          positiveCorrections: fromCents(s.pos),
          correctionsCount: s.count,
          totalAmount: fromCents(s.normal + s.neg + s.pos),
        };
      }),
    }));
  }
}

function addPayments(totals: PaymentTotals, e: SignedEvent) {
  if (e.name === 'signSale') for (const p of (e.data as SaleInput).financials) totals.addNormal(p);
  if (e.name === 'signPaymentCorrection') for (const p of (e.data as PaymentCorrectionInput).financials) totals.addCorrection(p);
}

// ---------------------------------------------------------------- omzet

function transactionOf(e: SignedEvent): TransactionInput | null {
  return (e.data as { transaction?: TransactionInput }).transaction ?? null;
}

export function buildTurnover(all: SignedEvent[]): TurnoverInput {
  const events = counted(all);
  const tx = new Map<'N' | 'P', { count: number; amount: Cents }>();
  const dept = new Map<string, { name: string; amount: Cents }>();
  const vats = new Map<VatLabel, { rate: number; taxable: Cents; vat: Cents; total: Cents }>();
  const neg = new Map<NegQuantityReason, { count: number; tickets: Set<number>; amount: Cents }>();
  const pcs = new Map<string, { id: string; name: string; type: PriceChangeType; perLabel: Map<VatLabel, { neg: Cents; pos: Cents }> }>();
  const pays = new PaymentTotals();
  const invoices: { invoiceNo: string; amount: Cents }[] = [];
  let drawersOpen = 0;
  const saleTotals = new Map<string, Cents>(); // fdm-sleutel → totaal, voor facturen

  events.forEach((e, idx) => {
    const label = e.result.fdmRef.eventLabel;
    const t = transactionOf(e);
    if (t && (label === 'N' || label === 'P')) {
      const cur = tx.get(label) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += cents(t.transactionTotal);
      tx.set(label, cur);
    }
    if (e.name === 'signSale' && t) {
      const r = e.result.fdmRef;
      saleTotals.set(`${r.fdmId}|${r.eventCounter}|${r.totalCounter}`, cents(t.transactionTotal));
      for (const line of t.transactionLines) {
        const p = line.mainProduct;
        const d = dept.get(p.departmentId) ?? { name: p.departmentName, amount: 0 };
        d.amount += cents(line.lineTotal);
        dept.set(p.departmentId, d);
        const prods = line.lineType === 'COMPOSITE_PRODUCT' ? line.subProducts ?? [] : [line.mainProduct];
        for (const sp of prods) for (const v of sp.vats ?? []) for (const pc of v.priceChanges ?? []) {
          if (pc.type !== 'PUBLIC') continue;
          const k = `${pc.id}|${pc.name}`;
          const acc = pcs.get(k) ?? { id: pc.id, name: pc.name, type: pc.type, perLabel: new Map() };
          const pl = acc.perLabel.get(v.label) ?? { neg: 0, pos: 0 };
          const a = cents(pc.amount);
          if (a < 0) pl.neg += a; else pl.pos += a;
          acc.perLabel.set(v.label, pl);
          pcs.set(k, acc);
        }
      }
      for (const vc of e.result.vatCalc ?? []) {
        const cur = vats.get(vc.label) ?? { rate: vc.rate, taxable: 0, vat: 0, total: 0 };
        cur.taxable += cents(vc.taxableAmount);
        cur.vat += cents(vc.vatAmount);
        cur.total += cents(vc.totalAmount);
        vats.set(vc.label, cur);
      }
    }
    if ((e.name === 'signSale' || e.name === 'signOrder') && t) {
      for (const line of t.transactionLines) {
        const p = line.mainProduct;
        if (p.quantity < 0 && p.negQuantityReason) {
          const n = neg.get(p.negQuantityReason) ?? { count: 0, tickets: new Set<number>(), amount: 0 };
          n.count += 1;
          n.tickets.add(idx);
          n.amount += cents(line.lineTotal);
          neg.set(p.negQuantityReason, n);
        }
      }
    }
    if (e.name === 'signDrawerOpen') drawersOpen += 1;
    if (e.name === 'signInvoice') {
      const inv = e.data as InvoiceInput;
      let amount = 0;
      for (const r of inv.fdmRefs) amount += saleTotals.get(`${r.fdmId}|${r.eventCounter}|${r.totalCounter}`) ?? 0;
      invoices.push({ invoiceNo: inv.invoiceNo, amount });
    }
    addPayments(pays, e);
  });

  const transactions: EventTotalInput[] = (['N', 'P'] as const).filter((l) => tx.has(l)).map((l) => ({
    eventLabel: l, ticketCount: tx.get(l)!.count, amount: fromCents(tx.get(l)!.amount),
  }));
  const departments: DepartmentTotalInput[] = [...dept.entries()].sort((a, b) => byNum(a[0], b[0])).map(([id, d]) => ({
    departmentId: id, departmentName: d.name, amount: fromCents(d.amount),
  }));
  const vatTotals: VatTotalInput[] = [...vats.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({
    label, rate: v.rate, taxableAmount: fromCents(v.taxable), vatAmount: fromCents(v.vat), totalAmount: fromCents(v.total),
  }));
  const negQuantities: NegQuantityTotalInput[] = [...neg.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, n]) => ({
    negQuantityReason: r, negQuantityCount: n.count, ticketCount: n.tickets.size, amount: fromCents(n.amount),
  }));
  const priceChanges: PriceChangeTotalInput[] = [...pcs.values()].sort((a, b) => byNum(a.id, b.id) || a.name.localeCompare(b.name)).map((p) => ({
    id: p.id, name: p.name, type: p.type,
    amount: [...p.perLabel.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, x]) => ({ label, negative: fromCents(x.neg), positive: fromCents(x.pos) })),
  }));
  return {
    transactions,
    departments,
    vats: vatTotals,
    payments: pays.toInput(),
    drawersOpenCount: drawersOpen,
    negQuantities,
    priceChanges,
    invoices: invoices.map((i) => ({ invoiceNo: i.invoiceNo, amount: fromCents(i.amount) })),
  };
}

export function turnoverReportParts(all: SignedEvent[]) {
  const events = counted(all);
  const inRange = events.filter((e) => !isS(e));
  return { posDevices: posDevicesOf(inRange), fdmDevices: fdmDevicesOf(inRange), turnover: buildTurnover(events) };
}

// ---------------------------------------------------------------- gebruikers

export function buildUsers(all: SignedEvent[]): UserItemInput[] {
  const events = counted(all);
  const users = new Map<string, { total: Cents; first: string; last: string; social: InOutItemInput[]; pays: PaymentTotals }>();
  for (const e of events) {
    const id = e.data.employeeId;
    let u = users.get(id);
    if (!u) { u = { total: 0, first: e.data.posDateTime, last: e.data.posDateTime, social: [], pays: new PaymentTotals() }; users.set(id, u); }
    if (instant(e.data.posDateTime) < instant(u.first)) u.first = e.data.posDateTime;
    if (instant(e.data.posDateTime) > instant(u.last)) u.last = e.data.posDateTime;
    if (e.name === 'signSale') u.total += cents((e.data as SaleInput).transaction.transactionTotal);
    if (e.name === 'signWorkIn') u.social.push({ posDateTime: e.data.posDateTime, inOut: 'IN' });
    if (e.name === 'signWorkOut') u.social.push({ posDateTime: e.data.posDateTime, inOut: 'OUT' });
    addPayments(u.pays, e);
  }
  return [...users.entries()].sort((a, b) => byNum(a[0], b[0])).map(([employeeId, u]) => ({
    employeeId,
    totalAmount: fromCents(u.total),
    firstPosDateTime: u.first,
    lastPosDateTime: u.last,
    socialEvents: u.social.sort((a, b) => instant(a.posDateTime) - instant(b.posDateTime)),
    payments: u.pays.toInput(),
  }));
}

export function userReportParts(all: SignedEvent[]) {
  const events = counted(all);
  return { posDevices: posDevicesOf(events), fdmDevices: fdmDevicesOf(events), users: buildUsers(events) };
}

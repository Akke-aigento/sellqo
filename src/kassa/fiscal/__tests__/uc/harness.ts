// KASSA-0 — testharnas voor de officiële GKS-use-cases.
//
// Per stap van een use case:
//  A. schema: het officiële bericht valideert tegen ons schema (FDM-01)
//  B. herbouw: de bedoeling van het bericht (producten, aantallen, prijswijzigingen, betalingen,
//     costCenters) gaat door ONZE builders; afgeleide velden (prijzen, lineTotal,
//     transactionTotal, spiegeling van from-lijnen bij een transfer) rekenen wij zelf uit.
//     Het resultaat moet structureel gelijk zijn aan het officiële bericht.
//  C. simulator: ons bericht gaat naar de FDM-simulator; eventOperation, eventLabel en de
//     btw-berekening moeten gelijk zijn aan het officiële FDM-antwoord. Handtekeningen,
//     QR en fdmId worden NOOIT vergeleken (de voorbeeldantwoorden zijn geanonimiseerd).
//  D. rapporten: X/Z-rapporten berekend uit het simulatorlogboek vs. het officiële rapport.
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCopy, buildCostCenterChange, buildDrawerOpen, buildInvoice, buildMoneyInOut, buildOrder,
  buildPaymentCorrection, buildPreBill, buildSale, buildWorkInOut, mirrorForTransfer,
  type LineSpec, type MoneyInOutSpec, type PaymentSpec, type ProductSpec,
} from '../../builders';
import { cents, lineAmountCents, milli4 } from '../../money';
import type { EventMeta, PosContext } from '../../identity';
import type {
  AnyFiscalInput, CostCenterChangeInput, CopyInput, DrawerOpenInput, IdentificationInput, InvoiceInput,
  MoneyInOutInput, MutationName, OrderInput, PaymentCorrectionInput, PaymentLineInput, PreBillInput,
  ProductInput, SaleInput, TransactionInput, TransactionLineInput,
} from '../../types';

export interface UcStep { step: string; query: string; variables: Record<string, unknown> | null; response: unknown; scenario: string | null }
export interface UcFixture { set: string; uc: string; scenario: string | null; steps: UcStep[] }

export const FIXTURE_DIR = path.join(__dirname, 'fixtures');

export function loadFixtures(): UcFixture[] {
  const out: UcFixture[] = [];
  for (const set of fs.readdirSync(FIXTURE_DIR).sort()) {
    for (const f of fs.readdirSync(path.join(FIXTURE_DIR, set)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      out.push(JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, set, f), 'utf8')));
    }
  }
  return out;
}

export interface ParsedCall { name: MutationName; data: AnyFiscalInput; isTraining: boolean; alias: string }

/** Haalt de sign-mutaties uit een officiële query + variabelen. */
export function parseCalls(step: UcStep): ParsedCall[] {
  const vars = step.variables ?? {};
  const re = /(?:(\w+)\s*:\s*)?(sign\w+)\s*\(\s*data\s*:\s*\$(\w+)(?:\s*,\s*isTraining\s*:\s*(\$\w+|true|false))?\s*\)/g;
  const calls: ParsedCall[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(step.query))) {
    const t = m[4];
    const isTraining = t === undefined ? false : t === 'true' ? true : t === 'false' ? false : Boolean(vars[t.slice(1)] ?? false);
    calls.push({ alias: m[1] ?? m[2], name: m[2] as MutationName, data: vars[m[3]] as AnyFiscalInput, isTraining });
  }
  return calls;
}

export function officialResult(step: UcStep, alias: string): Record<string, unknown> | null {
  const r = step.response as { data?: Record<string, unknown> } | null;
  return (r?.data?.[alias] as Record<string, unknown>) ?? null;
}

// ---------------------------------------------------------------- officieel bericht → bedoeling

function ctxOf(d: IdentificationInput): PosContext {
  return { language: d.language, vatNo: d.vatNo, estNo: d.estNo, posId: d.posId, posSwVersion: d.posSwVersion, terminalId: d.terminalId, deviceId: d.deviceId };
}
function metaOf(d: IdentificationInput): EventMeta {
  return { posFiscalTicketNo: d.posFiscalTicketNo, posDateTime: d.posDateTime, bookingPeriodId: d.bookingPeriodId, bookingDate: d.bookingDate, ticketMedium: d.ticketMedium, employeeId: d.employeeId };
}

function productSpec(p: ProductInput): ProductSpec {
  const quantity = milli4(p.quantity);
  const unitPrice = milli4(p.unitPrice);
  const single = p.vats.length === 1;
  return {
    product: { productId: p.productId, productName: p.productName, departmentId: p.departmentId, departmentName: p.departmentName, quantityType: p.quantityType, gtin: p.gtin ?? null },
    quantity,
    unitPrice,
    negQuantityReason: p.negQuantityReason ?? null,
    vats: p.vats.map((v) => {
      const price = cents(v.price);
      // Enkel de prijs meegeven als ze NIET gewoon aantal × eenheidsprijs is (bv. een
      // gedeelde fles bij gesplitste rekening, of meerdere btw-labels): anders rekent de builder.
      const computed = single ? lineAmountCents(quantity, unitPrice) : null;
      return {
        label: v.label,
        ...(computed === price ? {} : { price }),
        priceChanges: v.priceChanges?.map((pc) => ({ groupingId: pc.groupingId, id: pc.id, name: pc.name, scope: pc.scope, type: pc.type, amount: cents(pc.amount) })),
      };
    }),
  };
}

export function lineSpec(l: TransactionLineInput): LineSpec {
  if (l.lineType === 'COMPOSITE_PRODUCT') {
    const main = productSpec(l.mainProduct);
    return { kind: 'composite', main: { product: main.product, quantity: main.quantity, unitPrice: main.unitPrice, negQuantityReason: main.negQuantityReason }, subs: (l.subProducts ?? []).map(productSpec), costCenter: l.costCenter ?? null };
  }
  return { kind: 'single', main: productSpec(l.mainProduct), costCenter: l.costCenter ?? null };
}

/** Een from-lijn van een transfer terugrekenen naar de originele (positieve) lijn op de tafel. */
function unmirror(l: TransactionLineInput): LineSpec | null {
  const flipP = (p: ProductInput): ProductInput => ({
    ...p,
    quantity: -p.quantity,
    negQuantityReason: undefined,
    vats: p.vats.map((v) => ({ ...v, price: -v.price, priceChanges: v.priceChanges?.map((pc) => ({ ...pc, amount: -pc.amount })) })),
  });
  if (l.mainProduct.quantity >= 0 || l.mainProduct.negQuantityReason !== 'COST_CENTER_CHANGE') return null;
  const orig: TransactionLineInput = { ...l, mainProduct: flipP(l.mainProduct), subProducts: l.subProducts?.map(flipP) };
  return mirrorForTransfer(lineSpec(orig));
}

function paymentSpec(p: PaymentLineInput): PaymentSpec {
  return {
    id: p.id, name: p.name, type: p.type, inputMethod: p.inputMethod, amount: cents(p.amount), amountType: p.amountType,
    provider: p.provider ?? null, reference: p.reference ?? null, drawer: p.drawer ?? null,
    foreignCurrency: p.foreignCurrency ? { amount: cents(p.foreignCurrency.amount), iso: p.foreignCurrency.iso } : null,
  };
}

const lines = (t: TransactionInput) => t.transactionLines.map(lineSpec);

/** Bouwt het bericht opnieuw met onze builders. Gooit als een regel geschonden wordt. */
export function rebuild(name: MutationName, d: AnyFiscalInput): AnyFiscalInput | null {
  const ctx = ctxOf(d);
  const meta = metaOf(d);
  switch (name) {
    case 'signSale': {
      const s = d as SaleInput;
      return buildSale(ctx, meta, { lines: lines(s.transaction), payments: s.financials.map(paymentSpec), costCenter: s.costCenter ?? null, fdmRef: s.fdmRef ?? null });
    }
    case 'signOrder': {
      const s = d as OrderInput;
      return buildOrder(ctx, meta, { costCenter: s.costCenter, lines: lines(s.transaction) });
    }
    case 'signPreBill': {
      const s = d as PreBillInput;
      return buildPreBill(ctx, meta, { lines: lines(s.transaction), costCenter: s.costCenter ?? null, payments: s.financials?.map(paymentSpec) ?? null });
    }
    case 'signCostCenterChange': {
      const s = d as CostCenterChangeInput;
      const from = s.transfer.from.map((it) => ({
        costCenter: it.costCenter,
        lines: it.transaction.transactionLines.map((l) => unmirror(l) ?? lineSpec(l)),
      }));
      const to = s.transfer.to.map((it) => ({ costCenter: it.costCenter, lines: lines(it.transaction) }));
      return buildCostCenterChange(ctx, meta, from, to);
    }
    case 'signMoneyInOut': {
      const s = d as MoneyInOutInput;
      return buildMoneyInOut(ctx, meta, s.financials.map((f) => ({ ...paymentSpec(f as unknown as PaymentLineInput), amountType: f.amountType }) as MoneyInOutSpec));
    }
    case 'signDrawerOpen': return buildDrawerOpen(ctx, meta, (d as DrawerOpenInput).drawer ?? null);
    case 'signPaymentCorrection': {
      const s = d as PaymentCorrectionInput;
      return buildPaymentCorrection(ctx, meta, s.fdmRef, s.financials.map(paymentSpec));
    }
    case 'signWorkIn':
    case 'signWorkOut': return buildWorkInOut(ctx, meta);
    case 'signCopy': return buildCopy(ctx, meta, (d as CopyInput).fdmRef);
    case 'signInvoice': {
      const s = d as InvoiceInput;
      return buildInvoice(ctx, meta, { invoiceNo: s.invoiceNo, customerVatNo: s.customerVatNo, fdmRefs: s.fdmRefs, costCenter: s.costCenter ?? null });
    }
    default:
      return null; // rapporten: zie test D
  }
}

/**
 * Vergelijkbare vorm: sleutels gesorteerd, `null`/afwezig gelijkgesteld en lege optionele
 * lijsten weggelaten (GraphQL: afwezig = null = geen waarde). Getallen blijven getallen.
 */
export function normalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const x = o[k];
      if (x === null || x === undefined) continue;
      if (Array.isArray(x) && x.length === 0 && OPTIONAL_LISTS.has(k)) continue;
      out[k] = normalize(x);
    }
    return out;
  }
  return v;
}
const OPTIONAL_LISTS = new Set(['priceChanges', 'subProducts', 'financials', 'invoices', 'normalForeign', 'correctionsForeign']);

/** Alle verschilpaden tussen twee genormaliseerde waarden. */
export function allDiffs(a: unknown, b: unknown, p = '', out: string[] = []): string[] {
  if (typeof a !== typeof b || (a === null) !== (b === null)) { out.push(`${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); return out; }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${p}: lengte ${a.length} ≠ ${b.length}`); return out; }
    a.forEach((x, i) => allDiffs(x, b[i], `${p}[${i}]`, out));
    return out;
  }
  if (a && b && typeof a === 'object') {
    for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
      allDiffs((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${p}.${k}`, out);
    }
    return out;
  }
  if (a !== b) out.push(`${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  return out;
}

/** Eerste verschilpad tussen twee genormaliseerde waarden (voor leesbare testfouten). */
export function firstDiff(a: unknown, b: unknown, p = ''): string | null {
  if (typeof a !== typeof b) return `${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${p}: lengte ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${p}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a as object); const kb = Object.keys(b as object);
    for (const k of new Set([...ka, ...kb])) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${p}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

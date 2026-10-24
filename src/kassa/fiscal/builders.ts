// KASSA-0 — event-builders: van SellQo-kassagegevens naar de exacte FDM-berichten.
//
// Pure functies. Bedragen komen binnen als centen en hoeveelheden/eenheidsprijzen als
// tienduizendsten (money.ts); afgeleide velden (prijs, lineTotal, transactionTotal) worden
// hier berekend en nooit van buitenaf overgenomen. Elke regel uit de eisenmatrix die hier
// afgedwongen wordt, staat erbij (TX-07, TX-10, TX-14, TBL-04, TBL-05, PAY-*, ...).
import { fromCents, fromMilli4, lineAmountCents, type Cents, type Milli4 } from './money';
import { identification, type EventMeta, type PosContext } from './identity';
import type {
  CopyInput, CostCenterChangeInput, CostCenterInput, CostCenterType, DrawerInput, DrawerOpenInput,
  FdmReferenceInput, ForeignCurrencyInput, InputMethod, InvoiceInput, MoneyInOutInput, MoneyInOutLineInput,
  MoneyInOutLineType, NegQuantityReason, OrderInput, PaymentCorrectionInput, PaymentLineInput,
  PaymentLineType, PaymentType, PreBillInput, PriceChangeInput, PriceChangeScope, PriceChangeType,
  ProductInput, QuantityType, ReportTurnoverXInput, ReportTurnoverZInput, ReportUserXInput, ReportUserZInput,
  SaleInput, TransactionInput, TransactionLineInput, TransferItemInput, VatInput, VatLabel, WorkInOutInput,
} from './types';
import { turnoverReportParts, userReportParts, type SignedEvent } from './reports';

export class FiscalBuildError extends Error {
  constructor(public readonly rule: string, message: string) {
    super(`${rule}: ${message}`);
    this.name = 'FiscalBuildError';
  }
}

// ---------------------------------------------------------------- producten en lijnen

export interface ProductSnapshot {
  productId: string;
  productName: string;
  departmentId: string;
  departmentName: string;
  quantityType?: QuantityType;
  gtin?: string | null;
}

export interface PriceChangeSpec {
  groupingId: number;
  id: string;
  name: string;
  scope: PriceChangeScope;
  type: PriceChangeType;
  amount: Cents;
}

export interface VatPartSpec {
  label: VatLabel;
  /** Prijs voor dit label. Weglaten bij één label = hoeveelheid × eenheidsprijs (moet exact uitkomen). */
  price?: Cents;
  priceChanges?: PriceChangeSpec[];
}

export interface ProductSpec {
  product: ProductSnapshot;
  quantity: Milli4;
  unitPrice: Milli4;
  negQuantityReason?: NegQuantityReason | null;
  vats: VatPartSpec[];
}

export type LineSpec =
  | { kind: 'single'; main: ProductSpec; costCenter?: CostCenterInput | null }
  | { kind: 'composite'; main: Omit<ProductSpec, 'vats'>; subs: ProductSpec[]; costCenter?: CostCenterInput | null };

const NEG_REASONS: NegQuantityReason[] = ['REFUND', 'CORRECTION', 'PRICE_CHANGE', 'COST_CENTER_CHANGE', 'PRODUCT_SUBSTITUTION', 'VOUCHER', 'OTHER'];

function priceChange(pc: PriceChangeSpec): PriceChangeInput {
  if (!Number.isInteger(pc.groupingId) || pc.groupingId < 1) throw new FiscalBuildError('TX-11', `groupingId moet > 0 zijn (${pc.groupingId})`);
  if (!pc.id || !pc.name) throw new FiscalBuildError('TX-11', 'priceChange zonder id of naam');
  return { groupingId: pc.groupingId, id: pc.id, name: pc.name, scope: pc.scope, type: pc.type, amount: fromCents(pc.amount) };
}

function vatTotalCents(price: Cents, pcs: PriceChangeSpec[] | undefined): Cents {
  let t = price;
  for (const pc of pcs ?? []) t += pc.amount;
  return t;
}

export function buildProduct(spec: ProductSpec, opts: { composite?: boolean } = {}): ProductInput {
  const { product: p, quantity, unitPrice } = spec;
  if (!p.productId || !p.productName || !p.departmentId || !p.departmentName) {
    throw new FiscalBuildError('TX-06', `product onvolledig (${p.productId || '?'})`);
  }
  if (!Number.isSafeInteger(quantity) || quantity === 0) throw new FiscalBuildError('TX-06', `hoeveelheid ongeldig (${p.productName})`);
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new FiscalBuildError('TX-06', `eenheidsprijs moet ≥ 0 zijn (${p.productName})`);
  // TX-07: negatief aantal ⇒ reden verplicht. Positief aantal ⇒ geen reden.
  const reason = spec.negQuantityReason ?? null;
  if (quantity < 0 && !reason) throw new FiscalBuildError('TX-07', `negatief aantal zonder negQuantityReason (${p.productName})`);
  if (quantity > 0 && reason) throw new FiscalBuildError('TX-07', `negQuantityReason bij positief aantal (${p.productName})`);
  if (reason && !NEG_REASONS.includes(reason)) throw new FiscalBuildError('TX-07', `onbekende reden ${reason}`);

  const vats: VatInput[] = [];
  if (opts.composite) {
    if (spec.vats.length) throw new FiscalBuildError('TX-10', 'hoofdproduct van een samengesteld product draagt geen btw');
  } else {
    if (!spec.vats.length) throw new FiscalBuildError('TX-06', `product zonder btw-label (${p.productName})`);
    if (spec.vats.length > 5) throw new FiscalBuildError('TX-06', 'maximaal 5 btw-labels per product');
    const labels = new Set(spec.vats.map((v) => v.label));
    if (labels.size !== spec.vats.length) throw new FiscalBuildError('TX-06', `dubbel btw-label (${p.productName})`);
    for (const v of spec.vats) {
      let price = v.price;
      if (price === undefined) {
        if (spec.vats.length > 1) throw new FiscalBuildError('TX-04', `prijs per label verplicht bij meerdere labels (${p.productName})`);
        const computed = lineAmountCents(quantity, unitPrice);
        if (computed === null) throw new FiscalBuildError('TX-10', `${fromMilli4(quantity)} × ${fromMilli4(unitPrice)} is geen veelvoud van 0,01: geef de prijs mee (${p.productName})`);
        price = computed;
      }
      if (!Number.isSafeInteger(price)) throw new FiscalBuildError('TX-10', 'prijs in centen verwacht');
      if (price !== 0 && Math.sign(price) !== Math.sign(quantity)) throw new FiscalBuildError('TX-10', `prijs en aantal hebben een ander teken (${p.productName})`);
      if ((v.priceChanges?.length ?? 0) > 99) throw new FiscalBuildError('TX-11', 'maximaal 99 prijswijzigingen');
      // TX-14: nooit meer dan 100 % korting (het label mag niet van teken wisselen).
      const after = vatTotalCents(price, v.priceChanges);
      if (price > 0 && after < 0) throw new FiscalBuildError('TX-14', `meer dan 100 % korting op ${p.productName}`);
      if (price < 0 && after > 0) throw new FiscalBuildError('TX-14', `meer dan 100 % korting op ${p.productName}`);
      const vat: VatInput = { label: v.label, price: fromCents(price) };
      if (v.priceChanges?.length) vat.priceChanges = v.priceChanges.map(priceChange);
      vats.push(vat);
    }
  }

  const out: ProductInput = {
    productId: p.productId,
    productName: p.productName,
    departmentId: p.departmentId,
    departmentName: p.departmentName,
    quantity: fromMilli4(quantity),
    quantityType: p.quantityType ?? 'PIECE',
    unitPrice: fromMilli4(unitPrice),
    vats,
  };
  if (p.gtin) out.gtin = p.gtin;
  if (reason) out.negQuantityReason = reason;
  return out;
}

/** lineTotal in centen (TX-10): Σ over de btw-dragende producten van prijs + prijswijzigingen. */
export function lineTotalCents(spec: LineSpec): Cents {
  const products = spec.kind === 'composite' ? spec.subs : [spec.main];
  let t = 0;
  for (const p of products) {
    for (const v of p.vats) {
      const price = v.price ?? lineAmountCents(p.quantity, p.unitPrice);
      if (price === null) throw new FiscalBuildError('TX-10', `prijs niet exact berekenbaar (${p.product.productName})`);
      t += vatTotalCents(price, v.priceChanges);
    }
  }
  return t;
}

export function buildLine(spec: LineSpec): TransactionLineInput {
  const line: TransactionLineInput = spec.kind === 'composite'
    ? {
        lineType: 'COMPOSITE_PRODUCT',
        mainProduct: buildProduct({ ...spec.main, vats: [] }, { composite: true }),
        subProducts: (() => {
          if (!spec.subs.length) throw new FiscalBuildError('TX-09', 'samengesteld product zonder deelproducten');
          return spec.subs.map((s) => buildProduct(s));
        })(),
        lineTotal: 0,
      }
    : { lineType: 'SINGLE_PRODUCT', mainProduct: buildProduct(spec.main), lineTotal: 0 };
  if (spec.costCenter) line.costCenter = spec.costCenter;
  line.lineTotal = fromCents(lineTotalCents(spec));
  return line;
}

export function buildTransaction(lines: LineSpec[]): TransactionInput {
  let total = 0;
  const transactionLines = lines.map((l) => {
    total += lineTotalCents(l);
    return buildLine(l);
  });
  return { transactionLines, transactionTotal: fromCents(total) };
}

// ---------------------------------------------------------------- costCenter / transfer

export function costCenter(type: CostCenterType, id: string, reference: string, child?: CostCenterInput | null): CostCenterInput {
  if (!id || !reference) throw new FiscalBuildError('TBL-01', 'costCenter zonder id of reference');
  if (child) {
    if (child.costCenter) throw new FiscalBuildError('TBL-01', 'maximaal 2 niveaus costCenter');
    if (child.type === 'CHAIR' && type !== 'TABLE') throw new FiscalBuildError('TBL-01', 'CHAIR enkel onder TABLE');
  }
  if (type === 'CHAIR' && !child) {
    // Een stoel op het hoogste niveau mag niet: hij hangt altijd onder een tafel.
    throw new FiscalBuildError('TBL-01', 'CHAIR enkel onder TABLE');
  }
  const cc: CostCenterInput = { id, type, reference };
  if (child) cc.costCenter = child;
  return cc;
}

/** Spiegel van een lijn voor de "from"-kant van een transfer (TBL-04, TBL-05). */
export function mirrorForTransfer(spec: LineSpec): LineSpec {
  const flip = (p: ProductSpec): ProductSpec => ({
    ...p,
    quantity: -p.quantity,
    negQuantityReason: p.quantity > 0 ? 'COST_CENTER_CHANGE' : null,
    vats: p.vats.map((v) => {
      const price = v.price ?? lineAmountCents(p.quantity, p.unitPrice);
      if (price === null) throw new FiscalBuildError('TBL-04', `prijs niet exact berekenbaar (${p.product.productName})`);
      return { label: v.label, price: -price, priceChanges: v.priceChanges?.map((pc) => ({ ...pc, amount: -pc.amount })) };
    }),
  });
  if (spec.kind === 'composite') {
    return {
      kind: 'composite',
      main: { ...spec.main, quantity: -spec.main.quantity, negQuantityReason: spec.main.quantity > 0 ? 'COST_CENTER_CHANGE' : null },
      subs: spec.subs.map(flip),
      costCenter: spec.costCenter,
    };
  }
  return { kind: 'single', main: flip(spec.main), costCenter: spec.costCenter };
}

export interface TransferSideSpec { costCenter: CostCenterInput; lines: LineSpec[] }

export function buildTransfer(from: TransferSideSpec[], to: TransferSideSpec[]): { from: TransferItemInput[]; to: TransferItemInput[] } {
  if (!from.length || !to.length) throw new FiscalBuildError('TBL-04', 'transfer heeft minstens één from en één to');
  if (from.length > 1 && to.length > 1) throw new FiscalBuildError('TBL-04', 'veel-op-veel transfer is verboden (doe het in twee stappen)');
  const side = (s: TransferSideSpec, kind: 'from' | 'to'): TransferItemInput => {
    for (const l of s.lines) {
      const prods = l.kind === 'composite' ? [l.main, ...l.subs] : [l.main];
      for (const p of prods) {
        if (kind === 'from' && p.quantity > 0) throw new FiscalBuildError('TBL-04', 'from-lijnen zijn negatief');
        if (kind === 'from' && p.negQuantityReason !== 'COST_CENTER_CHANGE') throw new FiscalBuildError('TBL-04', 'from-lijnen dragen COST_CENTER_CHANGE');
        if (p.unitPrice < 0) throw new FiscalBuildError('TBL-04', 'unitPrice blijft positief');
      }
    }
    return { costCenter: s.costCenter, transaction: buildTransaction(s.lines) };
  };
  return { from: from.map((s) => side(s, 'from')), to: to.map((s) => side(s, 'to')) };
}

// ---------------------------------------------------------------- betalingen

export interface PaymentSpec {
  id: string;
  name: string;
  type: PaymentType;
  inputMethod: InputMethod;
  amount: Cents;
  amountType?: PaymentLineType;
  provider?: string | null;
  reference?: string | null;
  drawer?: DrawerInput | null;
  foreignCurrency?: { amount: Cents; iso: string } | null;
}

function foreign(fc: { amount: Cents; iso: string } | null | undefined): ForeignCurrencyInput | undefined {
  if (!fc) return undefined;
  if (!/^[A-Z]{3}$/.test(fc.iso)) throw new FiscalBuildError('PAY-14', `ongeldige munt ${fc.iso}`);
  return { amount: fromCents(fc.amount), iso: fc.iso };
}

export function buildPayment(p: PaymentSpec): PaymentLineInput {
  const amountType = p.amountType ?? 'PAYMENT';
  if (amountType === 'ROUNDING' && p.foreignCurrency) throw new FiscalBuildError('PAY-04', 'afronding nooit in vreemde munt');
  if (amountType === 'ROUNDING' && Math.abs(p.amount) > 2) throw new FiscalBuildError('PAY-03', 'afronding max ±0,02');
  const out: PaymentLineInput = {
    id: p.id,
    name: p.name,
    type: p.type,
    inputMethod: p.inputMethod,
    amount: fromCents(p.amount),
    amountType,
  };
  if (p.provider) out.provider = p.provider;
  if (p.reference) out.reference = p.reference;
  const fc = foreign(p.foreignCurrency);
  if (fc) out.foreignCurrency = fc;
  if (p.drawer) out.drawer = p.drawer;
  return out;
}

/** Totale afronding over alle ROUNDING-lijnen van één ticket mag niet meer dan ±0,02 zijn (PAY-03). */
export function checkFinancials(pays: PaymentSpec[]): void {
  const rounding = pays.filter((p) => p.amountType === 'ROUNDING').reduce((s, p) => s + p.amount, 0);
  if (Math.abs(rounding) > 2) throw new FiscalBuildError('PAY-03', `totale afronding ${rounding} cent > 2`);
}

export interface MoneyInOutSpec extends Omit<PaymentSpec, 'amountType'> { amountType: MoneyInOutLineType }

export function buildMoneyInOutLine(p: MoneyInOutSpec): MoneyInOutLineInput {
  const out: MoneyInOutLineInput = {
    id: p.id, name: p.name, type: p.type, inputMethod: p.inputMethod, amount: fromCents(p.amount), amountType: p.amountType,
  };
  if (p.provider) out.provider = p.provider;
  if (p.reference) out.reference = p.reference;
  const fc = foreign(p.foreignCurrency);
  if (fc) out.foreignCurrency = fc;
  if (p.drawer) out.drawer = p.drawer;
  return out;
}

// ---------------------------------------------------------------- volledige berichten

export function buildSale(ctx: PosContext, meta: EventMeta, s: {
  lines: LineSpec[];
  payments: PaymentSpec[];
  costCenter?: CostCenterInput | null;
  fdmRef?: FdmReferenceInput | null;
}): SaleInput {
  if (meta.ticketMedium === 'NONE') throw new FiscalBuildError('ID-02', 'een verkoop (N) mag nooit ticketMedium NONE hebben');
  checkFinancials(s.payments);
  const out: SaleInput = {
    ...identification(ctx, meta),
    transaction: buildTransaction(s.lines),
    financials: s.payments.map(buildPayment),
  };
  if (s.fdmRef) {
    // EVT-09: volledige terugname = enkel negatieve REFUND-lijnen met verwijzing naar één N.
    const allRefund = s.lines.every((l) => {
      const ps = l.kind === 'composite' ? [l.main] : [l.main];
      return ps.every((p) => p.quantity < 0 && p.negQuantityReason === 'REFUND');
    });
    if (!allRefund) throw new FiscalBuildError('EVT-09', 'een verkoop met fdmRef bevat enkel REFUND-lijnen');
    if (s.fdmRef.eventLabel !== 'N') throw new FiscalBuildError('EVT-09', 'fdmRef van een refund wijst naar een N-event');
    out.fdmRef = s.fdmRef;
  }
  if (s.costCenter) out.costCenter = s.costCenter;
  return out;
}

export function buildOrder(ctx: PosContext, meta: EventMeta, s: { costCenter: CostCenterInput; lines: LineSpec[] }): OrderInput {
  if (!s.lines.length) throw new FiscalBuildError('EVT-06', 'een bestelling zonder lijnen wordt niet verstuurd');
  return { ...identification(ctx, meta), costCenter: s.costCenter, transaction: buildTransaction(s.lines) };
}

export function buildPreBill(ctx: PosContext, meta: EventMeta, s: {
  lines: LineSpec[];
  costCenter?: CostCenterInput | null;
  payments?: PaymentSpec[] | null;
}): PreBillInput {
  const out: PreBillInput = { ...identification(ctx, meta), transaction: buildTransaction(s.lines) };
  if (s.costCenter) out.costCenter = s.costCenter;
  if (s.payments?.length) out.financials = s.payments.map(buildPayment);
  return out;
}

export function buildCostCenterChange(ctx: PosContext, meta: EventMeta, from: TransferSideSpec[], to: TransferSideSpec[]): CostCenterChangeInput {
  return { ...identification(ctx, meta), transfer: buildTransfer(from, to) };
}

export function buildMoneyInOut(ctx: PosContext, meta: EventMeta, lines: MoneyInOutSpec[]): MoneyInOutInput {
  if (!lines.length) throw new FiscalBuildError('PAY-09', 'kas in/uit zonder lijnen');
  return { ...identification(ctx, meta), financials: lines.map(buildMoneyInOutLine) };
}

export function buildDrawerOpen(ctx: PosContext, meta: EventMeta, drawer?: DrawerInput | null): DrawerOpenInput {
  const out: DrawerOpenInput = { ...identification(ctx, meta) };
  if (drawer) out.drawer = drawer;
  return out;
}

export function buildPaymentCorrection(ctx: PosContext, meta: EventMeta, fdmRef: FdmReferenceInput, payments: PaymentSpec[]): PaymentCorrectionInput {
  if (fdmRef.eventLabel !== 'N') throw new FiscalBuildError('PAY-08', 'betaalcorrectie verwijst naar een N-event');
  // Netto 0 over de PAYMENT-lijnen. Afronding en fooi mogen meebewegen: bij cash → kaart
  // wordt de cash-afronding teruggedraaid (UC4104_9: −59,66 cash, +0,01 afronding, +59,66 kaart).
  const net = payments.reduce((s, p) => s + ((p.amountType ?? 'PAYMENT') === 'PAYMENT' ? p.amount : 0), 0);
  if (net !== 0) throw new FiscalBuildError('PAY-08', `betaalcorrectie moet netto 0 zijn over de betalingen (${net})`);
  return { ...identification(ctx, meta), financials: payments.map(buildPayment), fdmRef };
}

export function buildWorkInOut(ctx: PosContext, meta: EventMeta): WorkInOutInput {
  return { ...identification(ctx, meta) };
}

export function buildCopy(ctx: PosContext, meta: EventMeta, original: FdmReferenceInput): CopyInput {
  if (original.eventLabel === 'C') throw new FiscalBuildError('EVT-12', 'een kopie van een kopie is verboden');
  return { ...identification(ctx, meta), fdmRef: original };
}

export function buildInvoice(ctx: PosContext, meta: EventMeta, s: {
  invoiceNo: string;
  customerVatNo: string;
  fdmRefs: FdmReferenceInput[];
  costCenter?: CostCenterInput | null;
}): InvoiceInput {
  if (!s.fdmRefs.length) throw new FiscalBuildError('INV-01', 'factuur zonder ticketverwijzing');
  const out: InvoiceInput = { ...identification(ctx, meta), invoiceNo: s.invoiceNo, customerVatNo: s.customerVatNo, fdmRefs: s.fdmRefs };
  if (s.costCenter) out.costCenter = s.costCenter;
  return out;
}

// ---------------------------------------------------------------- rapporten (TAFEL-3)

/** Gegevens die enkel een Z heeft (RPT-02): doorlopend nummer en de afgesloten bedrijfsdag. */
export interface ZSpec { reportNo: number; reportBookingDate: string }

function checkZ(z: ZSpec | null | undefined) {
  if (!z) return;
  if (!Number.isSafeInteger(z.reportNo) || z.reportNo < 1) throw new FiscalBuildError('RPT-02', 'reportNo moet een positief geheel getal zijn');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(z.reportBookingDate)) throw new FiscalBuildError('RPT-02', 'reportBookingDate moet JJJJ-MM-DD zijn');
}

/** Omzetrapport X of Z uit het fiscale logboek van de periode (RPT-04, RPT-07). */
export function buildReportTurnover(ctx: PosContext, meta: EventMeta, events: SignedEvent[], z?: ZSpec | null): ReportTurnoverXInput | ReportTurnoverZInput {
  checkZ(z);
  const parts = turnoverReportParts(events);
  const x: ReportTurnoverXInput = { ...identification(ctx, meta), posDevices: parts.posDevices, fdmDevices: parts.fdmDevices, turnover: parts.turnover };
  return z ? { ...x, reportNo: z.reportNo, reportBookingDate: z.reportBookingDate } : x;
}

/** Gebruikersrapport X of Z (RPT-06). Bevat werknemersnummers: nooit afdrukken of bewaren buiten fiscal_events. */
export function buildReportUser(ctx: PosContext, meta: EventMeta, events: SignedEvent[], z?: ZSpec | null): ReportUserXInput | ReportUserZInput {
  checkZ(z);
  const parts = userReportParts(events);
  const x: ReportUserXInput = { ...identification(ctx, meta), posDevices: parts.posDevices, fdmDevices: parts.fdmDevices, users: parts.users };
  return z ? { ...x, reportNo: z.reportNo, reportBookingDate: z.reportBookingDate } : x;
}

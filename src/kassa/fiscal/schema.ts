// KASSA-0 — het officiële GraphQL-inputschema als data, voor validatie (FDM-01).
// Bron: Detailbeschrijving POS v2.2 §2.3.4. Elk veld: type + verplicht + lijst.
// Een bericht dat hier niet door raakt, gaat nooit naar de FDM.
import type { MutationName } from './types';

type Scalar = 'String' | 'Int' | 'Float' | 'Boolean';
export type FieldType = { t: Scalar | string; req: boolean; list?: { itemReq: boolean } };

const S = (req = true): FieldType => ({ t: 'String', req });
const I = (req = true): FieldType => ({ t: 'Int', req });
const F = (req = true): FieldType => ({ t: 'Float', req });
const T = (t: string, req = true): FieldType => ({ t, req });
const L = (t: string, req = true, itemReq = true): FieldType => ({ t, req, list: { itemReq } });

export const ENUMS: Record<string, readonly string[]> = {
  Language: ['EN', 'NL', 'FR', 'DE'],
  TicketMedium: ['NONE', 'PAPER', 'DIGITAL', 'PAPER_DIGITAL'],
  InOut: ['IN', 'OUT'],
  PriceChangeType: ['PUBLIC', 'INTERNAL'],
  PriceChangeScope: ['LINE', 'EVENT'],
  VatLabel: ['A', 'B', 'C', 'D', 'X'],
  EventLabel: ['N', 'P', 'F', 'S', 'I', 'R', 'C', 'T'],
  QuantityType: ['PIECE', 'KILOGRAM', 'METER', 'LITRE', 'HOUR'],
  TransactionLineType: ['SINGLE_PRODUCT', 'COMPOSITE_PRODUCT'],
  NegQuantityReason: ['REFUND', 'CORRECTION', 'PRICE_CHANGE', 'COST_CENTER_CHANGE', 'PRODUCT_SUBSTITUTION', 'VOUCHER', 'OTHER'],
  PaymentType: ['UNKNOWN', 'CASH', 'CARD_UNKNOWN', 'CARD_DEBIT', 'CARD_CREDIT', 'CARD_OTHER', 'CHEQUE_MEAL', 'CHEQUE_OTHER', 'APP', 'ONLINE', 'CUSTOMER_CREDIT', 'ROOM_CREDIT', 'LOYALTY_REWARDS', 'VOUCHER_STORE', 'VOUCHER_SUPPLIER', 'VOUCHER_OTHER', 'OTHER'],
  InputMethod: ['MANUAL', 'AUTOMATIC'],
  PaymentLineType: ['PAYMENT', 'TIP', 'ROUNDING'],
  MoneyInOutLineType: ['MONEY_IN_OUT', 'TIP', 'DRAWER_DECLARATION'],
  CostCenterType: ['TABLE', 'CHAIR', 'ROOM', 'CUSTOMER', 'ON_HOLD', 'KIOSK', 'PLATFORM', 'WEBSHOP', 'OTHER'],
};

const IDENT: Record<string, FieldType> = {
  language: T('Language'), vatNo: S(), estNo: S(), posId: S(), posFiscalTicketNo: I(), posDateTime: S(),
  posSwVersion: S(), terminalId: S(), deviceId: S(), bookingPeriodId: S(), bookingDate: S(),
  ticketMedium: T('TicketMedium'), employeeId: S(),
};
const DEVICES = { posDevices: L('PosDeviceInput'), fdmDevices: L('FdmDeviceInput') };

export const INPUTS: Record<string, Record<string, FieldType>> = {
  FdmReferenceInput: { fdmId: S(), fdmDateTime: S(), eventLabel: T('EventLabel'), eventCounter: I(), totalCounter: I() },
  DrawerInput: { id: S(), name: S() },
  CostCenterInput: { id: S(), type: T('CostCenterType'), reference: S(), costCenter: T('CostCenterInput', false) },
  PriceChangeInput: { groupingId: I(), id: S(), name: S(), scope: T('PriceChangeScope'), type: T('PriceChangeType'), amount: F() },
  VatInput: { label: T('VatLabel'), price: F(), priceChanges: L('PriceChangeInput', false) },
  ProductInput: {
    gtin: S(false), productId: S(), productName: S(), departmentId: S(), departmentName: S(), quantity: F(),
    quantityType: T('QuantityType'), negQuantityReason: T('NegQuantityReason', false), unitPrice: F(), vats: L('VatInput'),
  },
  ForeignCurrencyInput: { amount: F(), iso: S() },
  TransactionLineInput: {
    lineType: T('TransactionLineType'), mainProduct: T('ProductInput'), subProducts: L('ProductInput', false),
    costCenter: T('CostCenterInput', false), lineTotal: F(),
  },
  TransactionInput: { transactionLines: L('TransactionLineInput'), transactionTotal: F() },
  PaymentLineInput: {
    id: S(), name: S(), type: T('PaymentType'), provider: S(false), inputMethod: T('InputMethod'), amount: F(),
    amountType: T('PaymentLineType'), foreignCurrency: T('ForeignCurrencyInput', false), reference: S(false), drawer: T('DrawerInput', false),
  },
  TransferInput: { from: L('TransferItemInput'), to: L('TransferItemInput') },
  TransferItemInput: { costCenter: T('CostCenterInput'), transaction: T('TransactionInput') },
  MoneyInOutLineInput: {
    id: S(), name: S(), type: T('PaymentType'), provider: S(false), inputMethod: T('InputMethod'), amount: F(),
    amountType: T('MoneyInOutLineType'), foreignCurrency: T('ForeignCurrencyInput', false), reference: S(false), drawer: T('DrawerInput', false),
  },
  MoneyInOutInput: { ...IDENT, financials: L('MoneyInOutLineInput') },
  WorkInOutInput: { ...IDENT },
  InvoiceInput: { ...IDENT, invoiceNo: S(), customerVatNo: S(), costCenter: T('CostCenterInput', false), fdmRefs: L('FdmReferenceInput') },
  SaleInput: {
    ...IDENT, fdmRef: T('FdmReferenceInput', false), costCenter: T('CostCenterInput', false),
    transaction: T('TransactionInput'), financials: L('PaymentLineInput'),
  },
  CostCenterChangeInput: { ...IDENT, transfer: T('TransferInput') },
  OrderInput: { ...IDENT, costCenter: T('CostCenterInput'), transaction: T('TransactionInput') },
  PreBillInput: { ...IDENT, costCenter: T('CostCenterInput', false), transaction: T('TransactionInput'), financials: L('PaymentLineInput', false) },
  DrawerOpenInput: { ...IDENT, drawer: T('DrawerInput', false) },
  PaymentCorrectionInput: { ...IDENT, financials: L('PaymentLineInput'), fdmRef: T('FdmReferenceInput') },
  CopyInput: { ...IDENT, fdmRef: T('FdmReferenceInput') },
  ReportTurnoverXInput: { ...IDENT, ...DEVICES, turnover: T('TurnoverInput') },
  PosDeviceInput: { posId: S(), terminalId: S(), firstPosDateTime: S(), lastPosDateTime: S() },
  FdmDeviceInput: { fdmId: S(), firstFdmDateTime: S(), firstTotalCounter: I(), lastFdmDateTime: S(), lastTotalCounter: I() },
  TurnoverInput: {
    transactions: L('EventTotalInput'), departments: L('DepartmentTotalInput'), vats: L('VatTotalInput'),
    payments: L('PaymentTotalInput'), drawersOpenCount: { t: 'Int', req: false }, negQuantities: L('NegQuantityTotalInput'),
    priceChanges: L('PriceChangeTotalInput'), invoices: L('InvoiceTotalInput', false),
  },
  EventTotalInput: { eventLabel: T('EventLabel'), ticketCount: I(), amount: F() },
  DepartmentTotalInput: { departmentId: S(), departmentName: S(), amount: F() },
  VatTotalInput: { label: T('VatLabel'), rate: F(), taxableAmount: F(), vatAmount: F(), totalAmount: F() },
  PaymentTotalInput: { id: S(), name: S(), type: T('PaymentType'), amount: L('PaymentTotalAmountInput') },
  PaymentTotalAmountInput: {
    type: T('PaymentLineType'), normalAmount: F(), negativeCorrections: F(), positiveCorrections: F(), correctionsCount: I(),
    totalAmount: F(), normalForeign: L('ForeignCurrencyInput', false), correctionsForeign: L('ForeignCurrencyInput', false),
  },
  NegQuantityTotalInput: { negQuantityReason: T('NegQuantityReason'), negQuantityCount: I(), ticketCount: I(), amount: F() },
  PriceChangeTotalInput: { id: S(), name: S(), type: T('PriceChangeType'), amount: L('PriceChangeVatTotalInput') },
  PriceChangeVatTotalInput: { label: T('VatLabel'), negative: F(), positive: F() },
  InvoiceTotalInput: { invoiceNo: S(), amount: F() },
  ReportTurnoverZInput: { ...IDENT, reportNo: I(), reportBookingDate: S(), ...DEVICES, turnover: T('TurnoverInput') },
  ReportUserXInput: { ...IDENT, ...DEVICES, users: L('UserItemInput') },
  UserItemInput: {
    employeeId: S(), totalAmount: F(), firstPosDateTime: S(), lastPosDateTime: S(),
    socialEvents: L('InOutItemInput'), payments: L('PaymentTotalInput'),
  },
  InOutItemInput: { posDateTime: S(), inOut: T('InOut') },
  ReportUserZInput: { ...IDENT, reportNo: I(), reportBookingDate: S(), ...DEVICES, users: L('UserItemInput') },
};

export const MUTATION_INPUT: Record<MutationName, string> = {
  signWorkIn: 'WorkInOutInput', signWorkOut: 'WorkInOutInput', signInvoice: 'InvoiceInput', signSale: 'SaleInput',
  signCostCenterChange: 'CostCenterChangeInput', signOrder: 'OrderInput', signPreBill: 'PreBillInput',
  signMoneyInOut: 'MoneyInOutInput', signDrawerOpen: 'DrawerOpenInput', signPaymentCorrection: 'PaymentCorrectionInput',
  signReportTurnoverX: 'ReportTurnoverXInput', signReportTurnoverZ: 'ReportTurnoverZInput',
  signReportUserX: 'ReportUserXInput', signReportUserZ: 'ReportUserZInput', signCopy: 'CopyInput',
};

/** Valideert een waarde tegen een inputtype; geeft paden met de fout terug (leeg = geldig). */
export function validateInput(typeName: string, value: unknown, path = 'data'): string[] {
  const errs: string[] = [];
  const fields = INPUTS[typeName];
  if (!fields) return [`${path}: onbekend type ${typeName}`];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path}: object verwacht (${typeName})`];
  const obj = value as Record<string, unknown>;
  for (const k of Object.keys(obj)) if (!(k in fields)) errs.push(`${path}.${k}: onbekend veld`);
  for (const [k, ft] of Object.entries(fields)) {
    const v = obj[k];
    const p = `${path}.${k}`;
    if (v === undefined || v === null) {
      if (ft.req) errs.push(`${p}: verplicht`);
      continue;
    }
    if (ft.list) {
      if (!Array.isArray(v)) { errs.push(`${p}: lijst verwacht`); continue; }
      v.forEach((item, i) => {
        if (item === null || item === undefined) { if (ft.list?.itemReq) errs.push(`${p}[${i}]: verplicht`); return; }
        errs.push(...checkValue(ft.t, item, `${p}[${i}]`));
      });
    } else {
      errs.push(...checkValue(ft.t, v, p));
    }
  }
  return errs;
}

function checkValue(t: string, v: unknown, p: string): string[] {
  switch (t) {
    case 'String':
      if (typeof v !== 'string') return [`${p}: tekst verwacht`];
      // FDM-01: geen voor- of achterliggende spaties in strings.
      if (v !== v.trim()) return [`${p}: spaties vooraan of achteraan`];
      return [];
    case 'Int':
      return typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 2147483647 ? [] : [`${p}: geheel getal verwacht`];
    case 'Float':
      return typeof v === 'number' && Number.isFinite(v) ? [] : [`${p}: getal verwacht`];
    case 'Boolean':
      return typeof v === 'boolean' ? [] : [`${p}: boolean verwacht`];
    default:
      if (ENUMS[t]) return typeof v === 'string' && ENUMS[t].includes(v) ? [] : [`${p}: ongeldige waarde ${String(v)} voor ${t}`];
      return validateInput(t, v, p);
  }
}

export function validateMutation(name: MutationName, data: unknown): string[] {
  return validateInput(MUTATION_INPUT[name], data);
}

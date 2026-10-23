// KASSA-0 — fiscale kern. Types 1-op-1 uit het officiële GraphQL-schema POS↔FDM
// (Detailbeschrijving POS v2.2, 17-04-2026, §2.3). Niets toevoegen of hernoemen: deze
// namen gaan letterlijk over de lijn naar de zwarte doos.
//
// WIJZIGEN IN src/kassa/ = FISCALE RELEASE. Zie src/kassa/README.md.

export type Language = 'EN' | 'NL' | 'FR' | 'DE';
export type TicketMedium = 'NONE' | 'PAPER' | 'DIGITAL' | 'PAPER_DIGITAL';
export type InOut = 'IN' | 'OUT';
export type PriceChangeType = 'PUBLIC' | 'INTERNAL';
export type PriceChangeScope = 'LINE' | 'EVENT';
export type VatLabel = 'A' | 'B' | 'C' | 'D' | 'X';
export type EventLabel = 'N' | 'P' | 'F' | 'S' | 'I' | 'R' | 'C' | 'T';
export type QuantityType = 'PIECE' | 'KILOGRAM' | 'METER' | 'LITRE' | 'HOUR';
export type TransactionLineType = 'SINGLE_PRODUCT' | 'COMPOSITE_PRODUCT';
export type NegQuantityReason =
  | 'REFUND' | 'CORRECTION' | 'PRICE_CHANGE' | 'COST_CENTER_CHANGE'
  | 'PRODUCT_SUBSTITUTION' | 'VOUCHER' | 'OTHER';
export type PaymentType =
  | 'UNKNOWN' | 'CASH' | 'CARD_UNKNOWN' | 'CARD_DEBIT' | 'CARD_CREDIT' | 'CARD_OTHER'
  | 'CHEQUE_MEAL' | 'CHEQUE_OTHER' | 'APP' | 'ONLINE' | 'CUSTOMER_CREDIT' | 'ROOM_CREDIT'
  | 'LOYALTY_REWARDS' | 'VOUCHER_STORE' | 'VOUCHER_SUPPLIER' | 'VOUCHER_OTHER' | 'OTHER';
export type InputMethod = 'MANUAL' | 'AUTOMATIC';
export type PaymentLineType = 'PAYMENT' | 'TIP' | 'ROUNDING';
export type MoneyInOutLineType = 'MONEY_IN_OUT' | 'TIP' | 'DRAWER_DECLARATION';
export type CostCenterType =
  | 'TABLE' | 'CHAIR' | 'ROOM' | 'CUSTOMER' | 'ON_HOLD' | 'KIOSK' | 'PLATFORM' | 'WEBSHOP' | 'OTHER';
export type EventOperation =
  | 'WORK_IN' | 'WORK_OUT' | 'SALE' | 'INVOICE' | 'COST_CENTER_CHANGE' | 'ORDER' | 'PRE_BILL'
  | 'MONEY_IN_OUT' | 'DRAWER_OPEN' | 'PAYMENT_CORRECTION' | 'COPY'
  | 'REPORT_TURNOVER_X' | 'REPORT_TURNOVER_Z' | 'REPORT_USER_X' | 'REPORT_USER_Z';
export type MessageCategory = 'SPF_FOD' | 'FDM' | 'OTHER';
export type Display = 'MANDATORY' | 'OPTIONAL' | 'NEVER';
export type MessageCode =
  | 'CLIENT_CERT_NEAR_EXPIRATION' | 'CLIENT_CERT_EXPIRED' | 'RTC_SYNC_FAILED' | 'UPDATE_URLS_FAILED'
  | 'UPDATE_TRUST_CERT_FAILED' | 'UPDATE_TASK_LIST_FAILED' | 'TASK_FEEDBACK_FAILED' | 'NOP_FAILED'
  | 'BUFFER_NEAR_FULL' | 'SERVER_CERT_RESOLVE_FAILED' | 'TRANSACTION_UPLOAD_FAILED'
  | 'INITIALIZATION_FAILED' | 'RTC_NOT_INITIALIZED' | 'CORRUPT_RECORD_ENCOUNTERED'
  | 'UPDATE_PARAMS_FAILED' | 'UPDATE_CLIENT_CERT_FAILED' | 'UPDATE_VAT_RATES_FAILED'
  | 'UPDATE_POS_ALLOWLIST_FAILED' | 'DUPLICATE_REQUEST' | 'BUFFER_FULL' | 'FDM_LOCKED'
  | 'UNAUTHORIZED' | 'INVALID_REQUEST' | 'INTERNAL_ERROR' | 'UNDEFINED_ERROR' | 'UNDEFINED_OTHER'
  | 'FDM_NOT_OPERATIONAL' | 'UNKNOWN_POS' | 'UPDATE_POS_VATNO' | 'UPDATE_POS_ESTNO';

// ---------- Output ----------
export interface FdmReference {
  fdmId: string;
  fdmDateTime: string;
  eventLabel: EventLabel;
  eventCounter: number;
  totalCounter: number;
}
export interface VatCalcItem {
  label: VatLabel;
  rate: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  outOfScope: boolean;
}
export interface DataItem { name: string; value: string }
export interface ExtensionItem { category: MessageCategory; code: MessageCode; data?: DataItem[] | null; showPos: Display }
export interface LocationItem { line: number; column: number }
export interface MessageItem { message: string; locations?: LocationItem[] | null; extensions: ExtensionItem }
export interface SignResult {
  posId: string;
  posFiscalTicketNo: number;
  posDateTime: string;
  terminalId: string;
  deviceId: string;
  eventOperation: EventOperation;
  fdmRef: FdmReference;
  fdmSwVersion: string;
  digitalSignature: string;
  shortSignature?: string | null;
  verificationUrl?: string | null;
  vatCalc?: VatCalcItem[] | null;
  bufferCapacityUsed: number;
  warnings?: MessageItem[] | null;
  informations?: MessageItem[] | null;
  footer: string[];
}
export interface FdmDevice { fdmId: string; fdmSwVersion: string; fdmDateTime: string; bufferCapacityUsed: number }
export interface FdmStatus {
  device: FdmDevice;
  initialized: boolean;
  informations?: MessageItem[] | null;
  warnings?: MessageItem[] | null;
  errors?: MessageItem[] | null;
}

// ---------- Input ----------
export type FdmReferenceInput = FdmReference;
export interface DrawerInput { id: string; name: string }
export interface CostCenterInput { id: string; type: CostCenterType; reference: string; costCenter?: CostCenterInput | null }
export interface PriceChangeInput {
  groupingId: number;
  id: string;
  name: string;
  scope: PriceChangeScope;
  type: PriceChangeType;
  amount: number;
}
export interface VatInput { label: VatLabel; price: number; priceChanges?: PriceChangeInput[] | null }
export interface ProductInput {
  gtin?: string | null;
  productId: string;
  productName: string;
  departmentId: string;
  departmentName: string;
  quantity: number;
  quantityType: QuantityType;
  negQuantityReason?: NegQuantityReason | null;
  unitPrice: number;
  vats: VatInput[];
}
export interface ForeignCurrencyInput { amount: number; iso: string }
export interface TransactionLineInput {
  lineType: TransactionLineType;
  mainProduct: ProductInput;
  subProducts?: ProductInput[] | null;
  costCenter?: CostCenterInput | null;
  lineTotal: number;
}
export interface TransactionInput { transactionLines: TransactionLineInput[]; transactionTotal: number }
export interface PaymentLineInput {
  id: string;
  name: string;
  type: PaymentType;
  provider?: string | null;
  inputMethod: InputMethod;
  amount: number;
  amountType: PaymentLineType;
  foreignCurrency?: ForeignCurrencyInput | null;
  reference?: string | null;
  drawer?: DrawerInput | null;
}
export interface TransferItemInput { costCenter: CostCenterInput; transaction: TransactionInput }
export interface TransferInput { from: TransferItemInput[]; to: TransferItemInput[] }
export interface MoneyInOutLineInput {
  id: string;
  name: string;
  type: PaymentType;
  provider?: string | null;
  inputMethod: InputMethod;
  amount: number;
  amountType: MoneyInOutLineType;
  foreignCurrency?: ForeignCurrencyInput | null;
  reference?: string | null;
  drawer?: DrawerInput | null;
}

/** Velden die in élk bericht zitten (ID-01..ID-10). */
export interface IdentificationInput {
  language: Language;
  vatNo: string;
  estNo: string;
  posId: string;
  posFiscalTicketNo: number;
  posDateTime: string;
  posSwVersion: string;
  terminalId: string;
  deviceId: string;
  bookingPeriodId: string;
  bookingDate: string;
  ticketMedium: TicketMedium;
  employeeId: string;
}

export type WorkInOutInput = IdentificationInput;
export interface InvoiceInput extends IdentificationInput {
  invoiceNo: string;
  customerVatNo: string;
  costCenter?: CostCenterInput | null;
  fdmRefs: FdmReferenceInput[];
}
export interface SaleInput extends IdentificationInput {
  fdmRef?: FdmReferenceInput | null;
  costCenter?: CostCenterInput | null;
  transaction: TransactionInput;
  financials: PaymentLineInput[];
}
export interface CostCenterChangeInput extends IdentificationInput { transfer: TransferInput }
export interface OrderInput extends IdentificationInput { costCenter: CostCenterInput; transaction: TransactionInput }
export interface PreBillInput extends IdentificationInput {
  costCenter?: CostCenterInput | null;
  transaction: TransactionInput;
  financials?: PaymentLineInput[] | null;
}
export interface MoneyInOutInput extends IdentificationInput { financials: MoneyInOutLineInput[] }
export interface DrawerOpenInput extends IdentificationInput { drawer?: DrawerInput | null }
export interface PaymentCorrectionInput extends IdentificationInput {
  financials: PaymentLineInput[];
  fdmRef: FdmReferenceInput;
}
export interface CopyInput extends IdentificationInput { fdmRef: FdmReferenceInput }

export interface PosDeviceInput { posId: string; terminalId: string; firstPosDateTime: string; lastPosDateTime: string }
export interface FdmDeviceInput {
  fdmId: string;
  firstFdmDateTime: string;
  firstTotalCounter: number;
  lastFdmDateTime: string;
  lastTotalCounter: number;
}
export interface EventTotalInput { eventLabel: EventLabel; ticketCount: number; amount: number }
export interface DepartmentTotalInput { departmentId: string; departmentName: string; amount: number }
export interface VatTotalInput { label: VatLabel; rate: number; taxableAmount: number; vatAmount: number; totalAmount: number }
export interface PaymentTotalAmountInput {
  type: PaymentLineType;
  normalAmount: number;
  negativeCorrections: number;
  positiveCorrections: number;
  correctionsCount: number;
  totalAmount: number;
  normalForeign?: ForeignCurrencyInput[] | null;
  correctionsForeign?: ForeignCurrencyInput[] | null;
}
export interface PaymentTotalInput { id: string; name: string; type: PaymentType; amount: PaymentTotalAmountInput[] }
export interface NegQuantityTotalInput {
  negQuantityReason: NegQuantityReason;
  negQuantityCount: number;
  ticketCount: number;
  amount: number;
}
export interface PriceChangeVatTotalInput { label: VatLabel; negative: number; positive: number }
export interface PriceChangeTotalInput { id: string; name: string; type: PriceChangeType; amount: PriceChangeVatTotalInput[] }
export interface InvoiceTotalInput { invoiceNo: string; amount: number }
export interface TurnoverInput {
  transactions: EventTotalInput[];
  departments: DepartmentTotalInput[];
  vats: VatTotalInput[];
  payments: PaymentTotalInput[];
  drawersOpenCount: number;
  negQuantities: NegQuantityTotalInput[];
  priceChanges: PriceChangeTotalInput[];
  invoices?: InvoiceTotalInput[] | null;
}
export interface ReportTurnoverXInput extends IdentificationInput {
  posDevices: PosDeviceInput[];
  fdmDevices: FdmDeviceInput[];
  turnover: TurnoverInput;
}
export interface ReportTurnoverZInput extends ReportTurnoverXInput { reportNo: number; reportBookingDate: string }
export interface InOutItemInput { posDateTime: string; inOut: InOut }
export interface UserItemInput {
  employeeId: string;
  totalAmount: number;
  firstPosDateTime: string;
  lastPosDateTime: string;
  socialEvents: InOutItemInput[];
  payments: PaymentTotalInput[];
}
export interface ReportUserXInput extends IdentificationInput {
  posDevices: PosDeviceInput[];
  fdmDevices: FdmDeviceInput[];
  users: UserItemInput[];
}
export interface ReportUserZInput extends ReportUserXInput { reportNo: number; reportBookingDate: string }

/** Alle mutaties met hun inputtype, eventOperation en het eventlabel dat de FDM geeft (niet-training). */
export interface MutationMap {
  signWorkIn: WorkInOutInput;
  signWorkOut: WorkInOutInput;
  signInvoice: InvoiceInput;
  signSale: SaleInput;
  signCostCenterChange: CostCenterChangeInput;
  signOrder: OrderInput;
  signPreBill: PreBillInput;
  signMoneyInOut: MoneyInOutInput;
  signDrawerOpen: DrawerOpenInput;
  signPaymentCorrection: PaymentCorrectionInput;
  signReportTurnoverX: ReportTurnoverXInput;
  signReportTurnoverZ: ReportTurnoverZInput;
  signReportUserX: ReportUserXInput;
  signReportUserZ: ReportUserZInput;
  signCopy: CopyInput;
}
export type MutationName = keyof MutationMap;
export type AnyFiscalInput = MutationMap[MutationName];

export const MUTATIONS: Record<MutationName, { operation: EventOperation; label: EventLabel }> = {
  signWorkIn: { operation: 'WORK_IN', label: 'S' },
  signWorkOut: { operation: 'WORK_OUT', label: 'S' },
  signInvoice: { operation: 'INVOICE', label: 'I' },
  signSale: { operation: 'SALE', label: 'N' },
  signCostCenterChange: { operation: 'COST_CENTER_CHANGE', label: 'P' },
  signOrder: { operation: 'ORDER', label: 'P' },
  signPreBill: { operation: 'PRE_BILL', label: 'P' },
  signMoneyInOut: { operation: 'MONEY_IN_OUT', label: 'F' },
  signDrawerOpen: { operation: 'DRAWER_OPEN', label: 'F' },
  signPaymentCorrection: { operation: 'PAYMENT_CORRECTION', label: 'F' },
  signReportTurnoverX: { operation: 'REPORT_TURNOVER_X', label: 'R' },
  signReportTurnoverZ: { operation: 'REPORT_TURNOVER_Z', label: 'R' },
  signReportUserX: { operation: 'REPORT_USER_X', label: 'R' },
  signReportUserZ: { operation: 'REPORT_USER_Z', label: 'R' },
  signCopy: { operation: 'COPY', label: 'C' },
};
export const MUTATION_NAMES = Object.keys(MUTATIONS) as MutationName[];

// PRINT-1 — van ondertekend event naar TicketDoc. Eén functie per soort afdruk.
//
// WIJZIGEN IN src/kassa/ = FISCALE RELEASE. Elke regel hier verwijst naar een eis-ID uit de
// eisenmatrix (projectdoc claude/gks-eisenmatrix.md). Bronnen: MB 29-04-2024 art. 20 en 29,
// POS-detailbeschrijving v2.2 hfst. 1, 6 en 8, certificatiehandleiding II "Ontvangsten inhoud",
// FAQ Q503/Q507 en de FOD-voorbeeldtickets van 24-09-2026.
//
// Harde regels die deze module afdwingt (en die de tests in __tests__/ bewijzen):
// - PRT-09  zonder FDM-antwoord (SignResult) geen afdruk: elke functie weigert.
// - PRT-02  btw-bedragen en maatstaf komen UITSLUITEND uit result.vatCalc; nooit herberekend.
// - PRT-04  shortSignature enkel op het echte kasticket (en ongewijzigd op de kopie ervan);
//           nooit op PRO FORMA of TRAINING.
// - PRT-05  keuken-/barbon: nooit een bedrag.
// - PRT-06  "btw-KASTICKET" enkel op het kasticket (en de kopie ervan, die identiek is).
// - USR     nooit het INSZ (employeeId) afdrukken.
// - EVT-12  kopie = inhoud van het origineel + KOPIE + posDateTime/fdmRef van de kopie,
//           QR van het origineel; een kopie van een kopie wordt geweigerd.
import { cents, type Cents } from '../fiscal/money';
import type {
  CostCenterInput, FdmReference, IdentificationInput, OrderInput, PaymentLineInput, PaymentTotalInput,
  PreBillInput, ProductInput, ReportTurnoverXInput, ReportTurnoverZInput, ReportUserXInput, ReportUserZInput,
  SaleInput, SignResult, TransactionInput, TransactionLineInput, VatInput,
} from '../fiscal/types';
import { SIMULATOR_FOOTER } from '../fiscal/simulator/fdmSimulator';
import { fmtAmount, fmtCents, fmtEuro, fmtPosDateTime, fmtQty, fmtRate, fmtTicketNo, splitPosDateTime } from './format';
import { strings, type TicketStrings } from './i18n';
import {
  PrintRefusedError, type Block, type SignedEvent, type StaffLabel, type TicketContext, type TicketDoc,
  type TicketKind, type TicketLanguage,
} from './types';

// ---------------------------------------------------------------- controles

type Signed = SignedEvent & { result: SignResult };

/** PRT-09: zonder volledig FDM-antwoord dat bij dit bericht hoort, geen ticket. */
export function requireSigned(ev: SignedEvent | null | undefined): asserts ev is Signed {
  if (!ev || !ev.data) throw new PrintRefusedError('PRT-09', 'geen event');
  const r = ev.result;
  if (!r) throw new PrintRefusedError('PRT-09', 'geen FDM-handtekening (SignResult ontbreekt)');
  const f = r.fdmRef;
  if (!f || !f.fdmId || !f.fdmDateTime || !f.eventLabel || !Number.isInteger(f.eventCounter) || !Number.isInteger(f.totalCounter)) {
    throw new PrintRefusedError('PRT-09', 'FDM-antwoord zonder volledige fdmRef');
  }
  if (!r.digitalSignature) throw new PrintRefusedError('PRT-09', 'FDM-antwoord zonder handtekening');
  if (!Array.isArray(r.footer)) throw new PrintRefusedError('FDM-07', 'FDM-antwoord zonder footer');
  const d = ev.data;
  if (r.posId !== d.posId || r.posFiscalTicketNo !== d.posFiscalTicketNo || r.posDateTime !== d.posDateTime || r.terminalId !== d.terminalId) {
    throw new PrintRefusedError('PRT-09', 'FDM-antwoord hoort niet bij dit bericht (posId/ticketnr/posDateTime/terminal verschillen)');
  }
  const expectT = ev.isTraining;
  if ((f.eventLabel === 'T') !== expectT) throw new PrintRefusedError('PRT-09', `eventLabel ${f.eventLabel} past niet bij isTraining=${expectT}`);
}

function checkContext(ctx: TicketContext, d: IdentificationInput) {
  const b = ctx.business;
  if (!b?.legalName || !b.tradeName || !b.address?.length) throw new PrintRefusedError('PRT-02', 'zaakgegevens onvolledig (naam, handelsnaam, adres)');
  if (b.vatNo !== d.vatNo) throw new PrintRefusedError('PRT-02', 'btw-nummer van de zaak verschilt van het bericht');
  if (b.estNo !== d.estNo) throw new PrintRefusedError('PRT-02', 'vestigingsnummer van de zaak verschilt van het bericht');
  checkStaffLabel(ctx.staff, d.employeeId);
}

/** pos_detail 6.4: nooit het INSZ op een afdruk, ook niet "per ongeluk" als naam of nummer. */
function checkStaffLabel(staff: StaffLabel | undefined, employeeId: string) {
  if (!staff?.name) throw new PrintRefusedError('PRT-02', 'gebruiker (naam) ontbreekt');
  for (const v of [staff.name, staff.number ?? '']) {
    if (v && employeeId && v.replace(/\D/g, '').includes(employeeId)) {
      throw new PrintRefusedError('PRT-02', 'het INSZ mag nooit als gebruikersidentificatie op een ticket');
    }
  }
}

function staffText(s: StaffLabel): string {
  return s.number ? `${s.name} (${s.number})` : s.name;
}

export function isSimulated(r: SignResult): boolean {
  return r.footer.some((l) => l.includes('SELLQO FDM-SIMULATOR')) || r.footer.includes(SIMULATOR_FOOTER);
}

function sameRef(a: FdmReference, b: FdmReference): boolean {
  return a.fdmId === b.fdmId && a.fdmDateTime === b.fdmDateTime && a.eventLabel === b.eventLabel
    && a.eventCounter === b.eventCounter && a.totalCounter === b.totalCounter;
}

function langOf(ctx: TicketContext, d: IdentificationInput): TicketLanguage {
  return ctx.language ?? d.language;
}

// ---------------------------------------------------------------- lijnen

interface Change { name: string; amount: Cents }
interface Row {
  key: string;
  productId: string;
  departmentId: string;
  departmentName: string;
  name: string;
  qty: number; // JSON-hoeveelheid
  qtyType: ProductInput['quantityType'];
  unitPrice: number;
  gross: Cents; // Σ vat.price (vóór prijswijzigingen)
  labels: string;
  composite: boolean;
  subs: { qty: number; qtyType: ProductInput['quantityType']; name: string; labels: string }[];
  lineChanges: Change[];
}

function labelsOf(vats: VatInput[]): string {
  return [...new Set(vats.map((v) => v.label))].sort().join('');
}

function rowsOf(tx: TransactionInput, eventChanges: Map<string, Change>): Row[] {
  const rows: Row[] = [];
  tx.transactionLines.forEach((line: TransactionLineInput, i) => {
    const m = line.mainProduct;
    const bearing = line.lineType === 'COMPOSITE_PRODUCT' ? (line.subProducts ?? []) : [m];
    let gross = 0;
    const lineChanges = new Map<string, Change>();
    const allVats: VatInput[] = [];
    for (const p of bearing) {
      for (const v of p.vats ?? []) {
        allVats.push(v);
        gross += cents(v.price);
        for (const pc of v.priceChanges ?? []) {
          const target = pc.scope === 'EVENT' ? eventChanges : lineChanges;
          const k = `${pc.id}|${pc.name}|${pc.type}`;
          const cur = target.get(k) ?? { name: pc.name, amount: 0 };
          cur.amount += cents(pc.amount);
          target.set(k, cur);
        }
      }
    }
    rows.push({
      key: String(i),
      productId: m.productId,
      departmentId: m.departmentId,
      departmentName: m.departmentName,
      name: m.productName,
      qty: m.quantity,
      qtyType: m.quantityType,
      unitPrice: m.unitPrice,
      gross,
      labels: labelsOf(allVats),
      composite: line.lineType === 'COMPOSITE_PRODUCT',
      subs: line.lineType === 'COMPOSITE_PRODUCT'
        ? (line.subProducts ?? []).map((p) => ({ qty: p.quantity, qtyType: p.quantityType, name: p.productName, labels: labelsOf(p.vats ?? []) }))
        : [],
      lineChanges: [...lineChanges.values()],
    });
  });
  return rows;
}

/**
 * PRT-07 / pos_detail 8.2: consolidatie mag op de afdruk (nooit in het bericht). Enkel
 * enkelvoudige lijnen zonder prijswijziging met hetzelfde product, dezelfde eenheidsprijs en
 * dezelfde btw-code worden samengevoegd; correcties vallen zo weg tegen de oorspronkelijke lijn.
 */
function consolidate(rows: Row[]): Row[] {
  const out: Row[] = [];
  const byKey = new Map<string, Row>();
  for (const r of rows) {
    if (r.composite || r.lineChanges.length) { out.push(r); continue; }
    const k = [r.productId, r.name, r.unitPrice, r.labels, r.qtyType].join('|');
    const cur = byKey.get(k);
    if (!cur) { const c = { ...r, subs: [], lineChanges: [] }; byKey.set(k, c); out.push(c); continue; }
    cur.qty = fromQty4(toQty4(cur.qty) + toQty4(r.qty));
    cur.gross += r.gross;
  }
  return out.filter((r) => !(toQty4(r.qty) === 0 && r.gross === 0 && !r.lineChanges.length));
}
function toQty4(q: number): number { return Math.round(q * 10_000); }
function fromQty4(m: number): number { const v = m / 10_000; return v === 0 ? 0 : v; }

function groupByDepartment(rows: Row[]): Row[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.departmentId.localeCompare(b.r.departmentId, 'en', { numeric: true }) || a.i - b.i)
    .map((x) => x.r);
}

function itemBlocks(rows: Row[], withAmounts: boolean, grouped: boolean): Block[] {
  const out: Block[] = [];
  let dep: string | null = null;
  for (const r of rows) {
    if (grouped && r.departmentId !== dep) {
      dep = r.departmentId;
      out.push({ t: 'text', text: r.departmentName, bold: true });
    }
    out.push({ t: 'item', qty: fmtQty(r.qty, r.qtyType), name: r.name, amount: withAmounts ? fmtCents(r.gross) : null, vat: withAmounts ? r.labels : null });
    for (const s of r.subs) out.push({ t: 'item', qty: fmtQty(s.qty, s.qtyType), name: s.name, amount: null, vat: withAmounts ? s.labels : null, indent: true });
    if (withAmounts) for (const c of r.lineChanges) out.push({ t: 'item', qty: '', name: c.name, amount: fmtCents(c.amount), vat: null, indent: true });
  }
  return out;
}

function transactionBlocks(tx: TransactionInput, ctx: TicketContext, s: TicketStrings): Block[] {
  const eventChanges = new Map<string, Change>();
  let rows = rowsOf(tx, eventChanges);
  if (ctx.options?.consolidate) rows = consolidate(rows);
  const grouped = !!ctx.options?.groupByDepartment;
  if (grouped) rows = groupByDepartment(rows);
  const out: Block[] = [{ t: 'rule' }, ...itemBlocks(rows, true, grouped)];
  // Art. 20 o: prijswijzigingen op het hele ticket (scope EVENT), samengeteld per soort.
  for (const c of eventChanges.values()) out.push({ t: 'kv', left: c.name, right: fmtCents(c.amount) });
  out.push({ t: 'rule' }, { t: 'kv', left: `${s.total}:`, right: fmtEuro(tx.transactionTotal), bold: true });
  return out;
}

function paymentBlocks(financials: PaymentLineInput[] | null | undefined, s: TicketStrings): Block[] {
  if (!financials?.length) return [];
  const out: Block[] = [{ t: 'text', text: `${s.paymentMethod}:` }];
  for (const p of financials) {
    const fx = p.foreignCurrency ? ` (${p.foreignCurrency.iso} ${fmtAmount(p.foreignCurrency.amount)})` : '';
    const left = p.amountType === 'ROUNDING' ? s.rounding : p.amountType === 'TIP' ? `${s.tip} ${p.name}` : `${p.name}${fx}`;
    out.push({ t: 'kv', left, right: fmtAmount(p.amount) });
  }
  return out;
}

/** PRT-02 m/n: maatstaf en btw zoals de FDM ze gaf. Nooit zelf herberekend. */
function vatBlocks(r: SignResult, s: TicketStrings): Block[] {
  if (!Array.isArray(r.vatCalc)) throw new PrintRefusedError('PRT-02', 'vatCalc van de FDM ontbreekt');
  return [{
    t: 'table',
    head: [...s.vatHead],
    rows: r.vatCalc.map((v) => [fmtRate(v.rate), v.label, fmtAmount(v.taxableAmount), fmtAmount(v.vatAmount), fmtAmount(v.totalAmount)]),
  }];
}

function refLines(ref: FdmReference): Block[] {
  return [
    { t: 'text', text: `fdmId: ${ref.fdmId};` },
    { t: 'text', text: `fdmDateTime: ${ref.fdmDateTime};` },
    { t: 'text', text: `Event: ${ref.eventLabel}; eventCounter: ${ref.eventCounter};` },
    { t: 'text', text: `totalCounter: ${ref.totalCounter};` },
  ];
}

/** Art. 20 o / pos_detail 6.6: controlegegevens leesbaar, incl. footer (FDM-07). */
function controlBlocks(r: SignResult, s: TicketStrings, withShortSignature: boolean): Block[] {
  const out: Block[] = [{ t: 'blank' }, { t: 'text', text: s.fdmInfo, align: 'center', bold: true }, ...refLines(r.fdmRef)];
  if (withShortSignature) {
    if (!r.shortSignature) throw new PrintRefusedError('PRT-02', 'shortSignature ontbreekt op het kasticket');
    out.push({ t: 'text', text: `shortSignature: ${r.shortSignature};` });
  }
  for (const l of r.footer) out.push({ t: 'text', text: l, align: 'center' });
  return out;
}

function headerBlocks(d: IdentificationInput, ctx: TicketContext, s: TicketStrings, costCenter?: CostCenterInput | null): Block[] {
  const { date, time } = splitPosDateTime(d.posDateTime);
  const out: Block[] = [
    { t: 'text', text: ctx.business.tradeName, bold: true },
    { t: 'text', text: `${s.estUnit} ${d.estNo}` },
    { t: 'kv', left: date, right: time },
    { t: 'text', text: `${s.user}: ${staffText(ctx.staff)}` },
    { t: 'text', text: `${s.terminal}: ${d.terminalId}` },
    { t: 'text', text: `${s.ticketNo}: ${fmtTicketNo(d.posFiscalTicketNo)}` },
    { t: 'text', text: `${s.posSerial}: ${d.posId}` },
    { t: 'text', text: `${s.inputDevice}: ${d.deviceId}` },
    { t: 'text', text: `${s.swVersion}: ${d.posSwVersion}` },
  ];
  if (costCenter) out.push({ t: 'text', text: costCenterText(costCenter, s) });
  return out;
}

function costCenterText(cc: CostCenterInput, s: TicketStrings): string {
  const own = `${s.costCenter[cc.type] ?? s.costCenter.OTHER} ${cc.id}`;
  return cc.costCenter ? `${own} / ${costCenterText(cc.costCenter, s)}` : own;
}

function businessBlocks(ctx: TicketContext, s: TicketStrings): Block[] {
  return [
    { t: 'blank' },
    { t: 'text', text: `${s.legalName}: ${ctx.business.legalName}` },
    ...ctx.business.address.map((a): Block => ({ t: 'text', text: a })),
    { t: 'text', text: `${s.vatNo}: ${ctx.business.vatNo}` },
  ];
}

function notValid(s: TicketStrings): Block[] {
  return [{ t: 'blank' }, { t: 'text', text: s.notValid, align: 'center', bold: true }];
}

// ---------------------------------------------------------------- samenstellen

interface Parts {
  kind: TicketKind;
  lang: TicketLanguage;
  ref: FdmReference | null;
  simulated: boolean;
  titles: Block[];
  body: Block[];
  /** PRT-04: "DIT IS GEEN GELDIG BTW-KASTICKET" onderaan. */
  notValid: boolean;
}

function compose(p: Parts): TicketDoc {
  const s = strings(p.lang);
  const blocks: Block[] = [];
  if (p.simulated) blocks.push({ t: 'title', text: s.simulator }); // nep-handtekening blijft zichtbaar
  blocks.push(...p.titles, ...p.body);
  if (p.notValid) blocks.push(...notValid(s));
  if (p.simulated) blocks.push({ t: 'text', text: s.simulator, align: 'center', bold: true });
  return { kind: p.kind, language: p.lang, fdmRef: p.ref, simulated: p.simulated, blocks };
}

function refusesShortSignatureLeak(doc: TicketDoc, r: SignResult) {
  // Defensief: P/T/keuken/rapport mogen nooit een shortSignature dragen (PRT-04), ook niet als
  // een FDM er (ten onrechte) een zou meesturen.
  if (r.shortSignature && doc.blocks.some((b) => 'text' in b && typeof b.text === 'string' && b.text.includes(r.shortSignature as string))) {
    throw new PrintRefusedError('PRT-04', 'shortSignature op een afdruk die geen kasticket is');
  }
}

// ---------------------------------------------------------------- N: kasticket en refund

/** pos_detail 1.2: enkel een volledige terugname (alle lijnen negatief met reden REFUND) = REFUND. */
export function isRefund(sale: SaleInput): boolean {
  if (!sale.fdmRef) return false;
  const lines = sale.transaction?.transactionLines ?? [];
  if (!lines.length) return false;
  return lines.every((l) => {
    const prods = l.lineType === 'COMPOSITE_PRODUCT' ? [l.mainProduct, ...(l.subProducts ?? [])] : [l.mainProduct];
    return prods.every((p) => p.quantity < 0 && p.negQuantityReason === 'REFUND');
  });
}

function saleParts(ev: SignedEvent, ctx: TicketContext): Parts {
  requireSigned(ev);
  if (ev.name !== 'signSale') throw new PrintRefusedError('PRT-02', `een btw-kasticket hoort bij signSale, niet bij ${ev.name}`);
  if (ev.isTraining || ev.result.fdmRef.eventLabel !== 'N') throw new PrintRefusedError('PRT-04', 'training is geen btw-kasticket (gebruik buildTrainingTicket)');
  const d = ev.data as SaleInput;
  checkContext(ctx, d);
  const r = ev.result;
  if (!r.verificationUrl) throw new PrintRefusedError('PRT-03', 'verificationUrl van de FDM ontbreekt (QR)');
  const lang = langOf(ctx, d);
  const s = strings(lang);
  const refund = isRefund(d);
  const titles: Block[] = [{ t: 'title', text: s.kasticket, big: true }];
  if (refund) titles.push({ t: 'title', text: s.refund, big: true });
  const body: Block[] = [
    ...headerBlocks(d, ctx, s, d.costCenter),
    ...transactionBlocks(d.transaction, ctx, s),
    ...paymentBlocks(d.financials, s),
    ...vatBlocks(r, s),
    ...controlBlocks(r, s, true),
    { t: 'qr', data: r.verificationUrl },
  ];
  // Refund / terugname: referentie van het oorspronkelijke kasticket (pos_detail 1.2).
  if (d.fdmRef) body.push({ t: 'blank' }, { t: 'text', text: s.originalFdm, bold: true }, ...refLines(d.fdmRef));
  body.push(...businessBlocks(ctx, s));
  return { kind: refund ? 'refund' : 'kasticket', lang, ref: r.fdmRef, simulated: isSimulated(r), titles, body, notValid: false };
}

/** PRT-01/02/03/06: het btw-kasticket (event N). Geeft automatisch de REFUND-variant bij een volledige terugname. */
export function buildKasticket(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  return compose(saleParts(ev, ctx));
}

/** Refund-ticket: een N met enkel negatieve REFUND-lijnen en de referentie naar het origineel. */
export function buildRefundTicket(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  requireSigned(ev);
  if (ev.name !== 'signSale' || !isRefund(ev.data as SaleInput)) {
    throw new PrintRefusedError('PRT-02', 'geen volledige terugname (enkel negatieve REFUND-lijnen met fdmRef van het origineel)');
  }
  return buildKasticket(ev, ctx);
}

// ---------------------------------------------------------------- P: bestelbon en voorrekening

function proFormaParts(ev: SignedEvent, ctx: TicketContext, which: 'signOrder' | 'signPreBill'): Parts {
  requireSigned(ev);
  if (ev.name !== which) throw new PrintRefusedError('PRT-04', `verwacht ${which}, kreeg ${ev.name}`);
  if (ev.isTraining || ev.result.fdmRef.eventLabel !== 'P') throw new PrintRefusedError('PRT-04', 'training: gebruik buildTrainingTicket');
  const d = ev.data as OrderInput | PreBillInput;
  checkContext(ctx, d);
  const lang = langOf(ctx, d);
  const s = strings(lang);
  const titles: Block[] = [{ t: 'title', text: s.proForma, big: true }];
  if (which === 'signPreBill') titles.push({ t: 'title', text: s.preliminaryBill, big: true });
  const body: Block[] = [
    ...headerBlocks(d, ctx, s, d.costCenter),
    ...transactionBlocks(d.transaction, ctx, s),
    // Voorrekening: géén btw-uitsplitsing (pos_detail 1.4, FOD-voorbeeld D). Wel voorschotten.
    ...(which === 'signPreBill' ? paymentBlocks((d as PreBillInput).financials, s) : []),
    ...controlBlocks(ev.result, s, false),
    ...businessBlocks(ctx, s),
  ];
  return { kind: which === 'signPreBill' ? 'voorrekening' : 'bestelbon', lang, ref: ev.result.fdmRef, simulated: isSimulated(ev.result), titles, body, notValid: true };
}

/** P / PRE_BILL: "PRO FORMA TICKET" + "VOORLOPIGE REKENING", zonder btw-uitsplitsing en zonder shortSignature. */
export function buildVoorrekening(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  const doc = compose(proFormaParts(ev, ctx, 'signPreBill'));
  refusesShortSignatureLeak(doc, ev.result as SignResult);
  return doc;
}

/** P / ORDER: bestelbon "PRO FORMA TICKET", zonder btw-uitsplitsing en zonder shortSignature. */
export function buildBestelbon(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  const doc = compose(proFormaParts(ev, ctx, 'signOrder'));
  refusesShortSignatureLeak(doc, ev.result as SignResult);
  return doc;
}

// ---------------------------------------------------------------- T: training

/** T: elk event in trainingsmodus. "TRAINING TICKET", geen btw-tabel, geen shortSignature, geen QR. */
export function buildTrainingTicket(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  requireSigned(ev);
  if (!ev.isTraining || ev.result.fdmRef.eventLabel !== 'T') throw new PrintRefusedError('PRT-04', 'geen trainingsevent');
  const d = ev.data;
  checkContext(ctx, d);
  const lang = langOf(ctx, d);
  const s = strings(lang);
  const withTx = d as Partial<SaleInput & PreBillInput>;
  const body: Block[] = [...headerBlocks(d, ctx, s, withTx.costCenter)];
  if (withTx.transaction) body.push(...transactionBlocks(withTx.transaction, ctx, s));
  if (ev.name === 'signSale' || ev.name === 'signPreBill') body.push(...paymentBlocks(withTx.financials, s));
  body.push(...controlBlocks(ev.result, s, false), ...businessBlocks(ctx, s));
  const doc = compose({ kind: 'training', lang, ref: ev.result.fdmRef, simulated: isSimulated(ev.result), titles: [{ t: 'title', text: s.training, big: true }], body, notValid: true });
  refusesShortSignatureLeak(doc, ev.result);
  return doc;
}

// ---------------------------------------------------------------- R: rapporten

type AnyReport = ReportTurnoverXInput | ReportTurnoverZInput | ReportUserXInput | ReportUserZInput;

function paymentTotalsBlocks(payments: PaymentTotalInput[], s: TicketStrings): Block[] {
  const out: Block[] = [];
  let total = 0;
  let rounding = 0;
  let tips = 0;
  for (const p of payments) {
    for (const a of p.amount) {
      if (a.type === 'PAYMENT') { out.push({ t: 'kv', left: p.name, right: fmtAmount(a.totalAmount) }); total += cents(a.totalAmount); }
      else if (a.type === 'TIP') tips += cents(a.totalAmount);
      else rounding += cents(a.totalAmount);
    }
  }
  out.push({ t: 'kv', left: s.totalPayments, right: fmtCents(total), bold: true });
  if (tips) out.push({ t: 'kv', left: s.tip, right: fmtCents(tips) });
  out.push({ t: 'kv', left: s.rounding, right: fmtCents(rounding) });
  return out;
}

/** R: X/Z-rapport omzet of gebruikers (MB art. 29/30). Bedragen 1-op-1 uit het rapportbericht. */
export function buildReport(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  const doc = compose(reportParts(ev, ctx));
  refusesShortSignatureLeak(doc, ev.result as SignResult);
  return doc;
}

function reportParts(ev: SignedEvent, ctx: TicketContext): Parts {
  requireSigned(ev);
  const kinds = ['signReportTurnoverX', 'signReportTurnoverZ', 'signReportUserX', 'signReportUserZ'];
  if (!kinds.includes(ev.name)) throw new PrintRefusedError('PRT-04', `${ev.name} is geen rapport`);
  const d = ev.data as AnyReport;
  checkContext(ctx, d);
  const lang = langOf(ctx, d);
  const s = strings(lang);
  const z = ev.name.endsWith('Z');
  const users = ev.name.startsWith('signReportUser');
  const titles: Block[] = [{ t: 'title', text: `${z ? 'Z' : 'X'} ${users ? s.reportUsers : s.reportTurnover}`, big: true }];
  if (ev.isTraining) titles.push({ t: 'title', text: s.training, big: true });

  const body: Block[] = [
    { t: 'text', text: ctx.business.tradeName, align: 'center', bold: true },
    { t: 'text', text: ctx.business.legalName, align: 'center' },
    ...ctx.business.address.map((a): Block => ({ t: 'text', text: a, align: 'center' })),
    { t: 'text', text: `${s.vatNo}: ${d.vatNo}`, align: 'center' },
    { t: 'text', text: `${s.estUnit} ${d.estNo}`, align: 'center' },
    { t: 'rule' },
    { t: 'kv', left: s.reportDate, right: fmtPosDateTime(d.posDateTime) },
  ];
  const zd = d as ReportTurnoverZInput;
  if (z) body.push({ t: 'kv', left: s.reportNo, right: String(zd.reportNo) }, { t: 'kv', left: s.bookingDate, right: zd.reportBookingDate });
  else body.push({ t: 'kv', left: s.bookingDate, right: d.bookingDate });
  body.push({ t: 'text', text: `${s.bookingPeriod}: ${d.bookingPeriodId}` }, { t: 'text', text: `${s.user}: ${staffText(ctx.staff)}` });
  for (const p of d.posDevices) {
    body.push({ t: 'rule' }, { t: 'kv', left: 'POSID', right: p.posId }, { t: 'kv', left: 'TerminalId', right: p.terminalId },
      { t: 'kv', left: s.first, right: p.firstPosDateTime }, { t: 'kv', left: s.last, right: p.lastPosDateTime });
  }
  for (const f of d.fdmDevices) {
    body.push({ t: 'rule' }, { t: 'kv', left: 'FDMID', right: f.fdmId },
      { t: 'kv', left: `${s.first} ${f.firstTotalCounter}`, right: f.firstFdmDateTime },
      { t: 'kv', left: `${s.last} ${f.lastTotalCounter}`, right: f.lastFdmDateTime });
  }

  if (!users) {
    const t = (d as ReportTurnoverXInput).turnover;
    body.push({ t: 'rule' }, { t: 'text', text: s.events, align: 'center', bold: true });
    for (const e of t.transactions) body.push({ t: 'kv', left: `${e.eventLabel} ${s.eventLabel[e.eventLabel]} ${e.ticketCount}`, right: fmtAmount(e.amount) });
    // MB art. 29 k-m: maatstaf en btw per tarief zoals de FDM ze berekende (som van vatCalc).
    let tx = 0, tv = 0, tt = 0;
    const rows = t.vats.map((v) => {
      tx += cents(v.taxableAmount); tv += cents(v.vatAmount); tt += cents(v.totalAmount);
      return [fmtRate(v.rate), v.label, fmtAmount(v.taxableAmount), fmtAmount(v.vatAmount), fmtAmount(v.totalAmount)];
    });
    rows.push(['', 'Tot', fmtCents(tx), fmtCents(tv), fmtCents(tt)]);
    body.push({ t: 'text', text: s.vatOverview, align: 'center', bold: true }, { t: 'table', head: [...s.vatHead], rows });
    if (t.departments.length) {
      body.push({ t: 'text', text: s.departments, align: 'center', bold: true });
      for (const dep of t.departments) body.push({ t: 'kv', left: dep.departmentName, right: fmtAmount(dep.amount) });
    }
    if (t.negQuantities.length) {
      body.push({ t: 'text', text: s.negQuantities, align: 'center', bold: true });
      for (const n of t.negQuantities) body.push({ t: 'kv', left: `${s.negReason[n.negQuantityReason]} ${n.negQuantityCount}/${n.ticketCount}`, right: fmtAmount(n.amount) });
    }
    if (t.priceChanges.length) {
      body.push({ t: 'text', text: s.priceChanges, align: 'center', bold: true });
      for (const pc of t.priceChanges) {
        for (const a of pc.amount) {
          if (a.negative) body.push({ t: 'kv', left: `${pc.name} ${a.label}`, right: fmtAmount(a.negative) });
          if (a.positive) body.push({ t: 'kv', left: `${pc.name} ${a.label}`, right: fmtAmount(a.positive) });
        }
      }
    }
    if (t.invoices?.length) {
      body.push({ t: 'text', text: s.invoices, align: 'center', bold: true });
      for (const inv of t.invoices) body.push({ t: 'kv', left: inv.invoiceNo, right: fmtAmount(inv.amount) });
    }
    body.push({ t: 'kv', left: s.drawerOpen, right: String(t.drawersOpenCount) });
    body.push({ t: 'text', text: s.payments, align: 'center', bold: true }, ...paymentTotalsBlocks(t.payments, s));
  } else {
    const list = (d as ReportUserXInput).users;
    list.forEach((u, i) => {
      // Nooit het INSZ: label uit de personeelslijst, anders "Gebruiker n".
      const label = ctx.staffDirectory?.[u.employeeId];
      if (label) checkStaffLabel(label, u.employeeId);
      body.push({ t: 'rule' }, { t: 'text', text: label ? staffText(label) : `${s.unknownUser} ${i + 1}`, bold: true },
        { t: 'kv', left: s.turnoverInclVat, right: fmtAmount(u.totalAmount) },
        { t: 'kv', left: s.first, right: u.firstPosDateTime }, { t: 'kv', left: s.last, right: u.lastPosDateTime });
      for (const se of u.socialEvents) body.push({ t: 'kv', left: se.inOut === 'IN' ? s.workIn : s.workOut, right: se.posDateTime });
      body.push(...paymentTotalsBlocks(u.payments, s));
    });
  }
  body.push(...controlBlocks(ev.result, s, false));
  return { kind: 'rapport', lang, ref: ev.result.fdmRef, simulated: isSimulated(ev.result), titles, body, notValid: true };
}

// ---------------------------------------------------------------- C: kopie

/**
 * EVT-12 / pos_detail 8.1 / FAQ Q503: kopie van een ondertekend event. Inhoud identiek aan het
 * origineel (alle velden, controledata en QR van het origineel), plus "KOPIE TICKET" en de
 * posDateTime + fdmRef van het copy-event zelf. "DIT IS GEEN GELDIG BTW-KASTICKET" komt er bij,
 * behalve bij de kopie van een btw-kasticket (N).
 *
 * @param ctx  context van het ORIGINEEL (gebruiker van het oorspronkelijke ticket)
 * @param copyStaff wie de kopie maakte (optioneel, komt in het kopieblok)
 */
export function buildCopyTicket(copyEv: SignedEvent, original: SignedEvent, ctx: TicketContext, copyStaff?: StaffLabel): TicketDoc {
  requireSigned(copyEv);
  requireSigned(original);
  if (copyEv.name !== 'signCopy' || copyEv.isTraining || copyEv.result.fdmRef.eventLabel !== 'C') {
    throw new PrintRefusedError('EVT-12', 'geen copy-event (signCopy met label C)');
  }
  if (original.name === 'signCopy' || original.result.fdmRef.eventLabel === 'C') {
    throw new PrintRefusedError('EVT-12', 'een kopie van een kopie is verboden');
  }
  const cd = copyEv.data as { fdmRef: FdmReference } & IdentificationInput;
  if (!cd.fdmRef || !sameRef(cd.fdmRef, original.result.fdmRef)) {
    throw new PrintRefusedError('EVT-12', 'copy-event verwijst naar een ander event dan dit origineel');
  }
  if (copyStaff) checkStaffLabel(copyStaff, cd.employeeId);
  const label = original.result.fdmRef.eventLabel;
  let parts: Parts;
  if (label === 'N') parts = saleParts(original, ctx);
  else if (label === 'P' && (original.name === 'signOrder' || original.name === 'signPreBill')) parts = proFormaParts(original, ctx, original.name);
  else if (label === 'R') parts = reportParts(original, ctx);
  else {
    throw new PrintRefusedError('EVT-12', `kopie van een ${label}-event (${original.name}) wordt (nog) niet afgedrukt`);
  }
  const s = strings(parts.lang);
  parts.titles.push({ t: 'title', text: s.copy, big: true });
  // Het blok van het copy-event zelf (certificatiehandleiding II: "kopie uitgegeven op dd.mm.jjjj uu:mm").
  const copyBlock: Block[] = [
    { t: 'rule' },
    { t: 'text', text: `${s.copyIssued} ${fmtPosDateTime(cd.posDateTime)}`, bold: true },
    { t: 'text', text: `${s.ticketNo}: ${fmtTicketNo(cd.posFiscalTicketNo)}` },
  ];
  if (copyStaff) copyBlock.push({ t: 'text', text: `${s.user}: ${staffText(copyStaff)}` });
  copyBlock.push({ t: 'text', text: s.copyFdm, bold: true }, ...refLines(copyEv.result.fdmRef));
  for (const l of copyEv.result.footer) copyBlock.push({ t: 'text', text: l, align: 'center' });
  parts.body.push(...copyBlock);
  parts.kind = 'kopie';
  parts.ref = copyEv.result.fdmRef;
  parts.simulated = parts.simulated || isSimulated(copyEv.result);
  // PRT-04 / pos_detail 8.1: enkel de kopie van een btw-kasticket draagt de vermelding niet.
  parts.notValid = label !== 'N';
  const doc = compose(parts);
  // De shortSignature van het origineel mag enkel op de kopie van een kasticket staan.
  if (label !== 'N') refusesShortSignatureLeak(doc, original.result);
  return doc;
}

// ---------------------------------------------------------------- keuken / bar

export interface KitchenOptions {
  station: 'keuken' | 'bar';
  /** Welke lijnen van de ronde naar dit station gaan (bv. per departement). Standaard alle. */
  filter?: (line: TransactionLineInput) => boolean;
  guests?: number | null;
}

/**
 * PRT-05: keuken-/barbon op basis van de lijnen van een ondertekende ronde (P/ORDER, of T in
 * training). NOOIT bedragen of btw-codes. Omdat de bon het gevolg is van een P-event, staat
 * "DIT IS GEEN GELDIG BTW-KASTICKET" er altijd op. Zonder ondertekende ronde geen bon (PRT-09).
 */
export function buildKitchenTicket(ev: SignedEvent, ctx: TicketContext, opts: KitchenOptions): TicketDoc {
  requireSigned(ev);
  if (ev.name !== 'signOrder') throw new PrintRefusedError('PRT-05', 'een keuken-/barbon volgt op een ondertekende bestelling (signOrder)');
  const d = ev.data as OrderInput;
  checkContext(ctx, d);
  const lang = langOf(ctx, d);
  const s = strings(lang);
  const lines = d.transaction.transactionLines.filter(opts.filter ?? (() => true));
  let rows = rowsOf({ transactionLines: lines, transactionTotal: 0 }, new Map());
  if (ctx.options?.consolidate) rows = consolidate(rows);
  const { date, time } = splitPosDateTime(d.posDateTime);
  const titles: Block[] = [{ t: 'title', text: opts.station === 'bar' ? s.bar : s.kitchen, big: true }];
  if (ev.isTraining) titles.push({ t: 'title', text: s.training, big: true });
  const body: Block[] = [
    { t: 'kv', left: s.date, right: `${date} ${time}` },
    { t: 'kv', left: s.operator, right: staffText(ctx.staff) },
  ];
  if (opts.guests) body.push({ t: 'kv', left: s.guests, right: String(opts.guests) });
  body.push({ t: 'kv', left: s.costCenter[d.costCenter.type] ?? s.costCenter.OTHER, right: d.costCenter.id });
  body.push({ t: 'rule' }, { t: 'text', text: `${s.quantity}   ${s.item}`, bold: true }, ...itemBlocks(rows, false, false).map((b): Block => (b.t === 'item' ? { ...b, qty: b.qty ? `${b.qty} x` : '' } : b)));
  const doc = compose({ kind: opts.station === 'bar' ? 'bar' : 'keuken', lang, ref: ev.result.fdmRef, simulated: isSimulated(ev.result), titles, body, notValid: true });
  refusesShortSignatureLeak(doc, ev.result);
  for (const b of doc.blocks) if (b.t === 'item' && (b.amount !== null || b.vat !== null)) throw new PrintRefusedError('PRT-05', 'bedrag op een keukenbon');
  return doc;
}

// ---------------------------------------------------------------- dispatcher

/** Kiest de juiste afdruk voor een ondertekend event (niet voor kopie- en keukenbonnen). */
export function buildTicketFor(ev: SignedEvent, ctx: TicketContext): TicketDoc {
  requireSigned(ev);
  if (ev.isTraining) return buildTrainingTicket(ev, ctx);
  switch (ev.name) {
    case 'signSale': return buildKasticket(ev, ctx);
    case 'signOrder': return buildBestelbon(ev, ctx);
    case 'signPreBill': return buildVoorrekening(ev, ctx);
    case 'signReportTurnoverX': case 'signReportTurnoverZ': case 'signReportUserX': case 'signReportUserZ': return buildReport(ev, ctx);
    default: throw new PrintRefusedError('PRT-04', `${ev.name}: geen afdruk voorzien in PRINT-1`);
  }
}

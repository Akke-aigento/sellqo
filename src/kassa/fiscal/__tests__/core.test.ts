// KASSA-0 — eigen tests (bewijs "E" in de eisenmatrix) voor de pure kern.
import { describe, expect, it } from 'vitest';
import { cents, divRoundHalfUp, fromCents, lineAmountCents, milli4 } from '../money';
import { cashRoundingDelta, roundCash5 } from '../rounding';
import {
  bookingDateFor, checkIdentification, isValidEstNo, isValidInsz, isValidVatNo, nextTicketNo, posDateTime,
  ROBOT_EMPLOYEE_ID, TECHNICIAN_EMPLOYEE_ID,
} from '../identity';
import { calcVat, totalsPerLabel } from '../vat';
import {
  buildCopy, buildCostCenterChange, buildPaymentCorrection, buildProduct, buildSale, buildTransaction, costCenter,
  FiscalBuildError, mirrorForTransfer, type LineSpec,
} from '../builders';
import { decodeVerification, encodeVerification } from '../simulator/qr';
import { mutationDocument } from '../documents';
import { parseDocument, fieldsOf } from '../simulator/graphql';
import { MUTATION_NAMES } from '../types';
import { TEST_POS, testMeta } from '../testSetup';

const martini = { product: { productId: '10006', productName: 'Dry Martini', departmentId: '10', departmentName: 'Aperitifs' }, quantity: milli4(2), unitPrice: milli4(12), vats: [{ label: 'A' as const }] };
const burger = { product: { productId: '22001', productName: 'Burger of the Chef', departmentId: '22', departmentName: 'Main Dishes' }, quantity: milli4(1), unitPrice: milli4(28), vats: [{ label: 'B' as const }] };

describe('money', () => {
  it('centen en tienduizendsten zijn exact, meer decimalen = fout', () => {
    expect(cents(19.83)).toBe(1983);
    expect(cents(-0.01)).toBe(-1);
    expect(cents(0.1 + 0.2)).toBe(30);
    expect(() => cents(1.005)).toThrow();
    expect(milli4(0.3335)).toBe(3335);
    expect(() => milli4(0.33333)).toThrow();
    expect(fromCents(-0)).toBe(0);
    expect(Object.is(fromCents(0), -0)).toBe(false);
  });
  it('half up weg van nul (zoals de FDM)', () => {
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(-5, 2)).toBe(-3);
    expect(divRoundHalfUp(2400 * 21, 121)).toBe(417); // M110: 24,00 A → btw 4,17
    expect(divRoundHalfUp(-2400 * 21, 121)).toBe(-417);
  });
  it('lijnbedrag enkel als het exact uitkomt', () => {
    expect(lineAmountCents(milli4(2), milli4(12))).toBe(2400);
    expect(lineAmountCents(milli4(0.333), milli4(35))).toBeNull(); // 11,655 → prijs moet meegegeven worden (UC4104)
  });
});

describe('contant afronden (PAY-02..04)', () => {
  it.each([[608, 610], [604, 605], [601, 600], [602, 600], [603, 605], [606, 605], [607, 605], [609, 610], [104, 105], [3, 3], [4, 4], [-608, -610], [-1, -1]])('%i → %i', (a, b) => {
    expect(roundCash5(a)).toBe(b);
  });
  it('afrondingslijn = afgerond − exact, nooit meer dan 2 cent', () => {
    expect(cashRoundingDelta(608)).toBe(2); // UC201
    expect(cashRoundingDelta(104)).toBe(1); // M112A_2
    for (let i = -1000; i <= 1000; i++) expect(Math.abs(cashRoundingDelta(i))).toBeLessThanOrEqual(2);
  });
});

describe('identificatie (ID-*, USR-*)', () => {
  it('btw- en vestigingsnummer mod 97', () => {
    expect(isValidVatNo('BE0000000097')).toBe(true);
    expect(isValidVatNo('BE0000000096')).toBe(false);
    expect(isValidVatNo('NL0000000097')).toBe(false);
    expect(isValidEstNo('2000000042')).toBe(true);
    expect(isValidEstNo('1000000042')).toBe(false);
  });
  it('INSZ: testpersoneel, robot en technicus', () => {
    for (const id of ['84022899837', '75061189702', '80113078968', ROBOT_EMPLOYEE_ID, TECHNICIAN_EMPLOYEE_ID]) expect(isValidInsz(id), id).toBe(true);
    expect(isValidInsz('84022899838')).toBe(false);
    expect(isValidInsz('8402289983')).toBe(false);
  });
  it('posDateTime in Brusselse tijd met offset en ms, zomer en winter', () => {
    expect(posDateTime(new Date('2024-07-29T11:00:00.000Z'))).toBe('2024-07-29T13:00:00.000+02:00');
    expect(posDateTime(new Date('2025-02-11T11:46:00.123Z'))).toBe('2025-02-11T12:46:00.123+01:00');
    expect(posDateTime(new Date('2026-10-25T00:59:59.999Z'))).toBe('2026-10-25T02:59:59.999+02:00');
    expect(posDateTime(new Date('2026-10-25T01:00:00.000Z'))).toBe('2026-10-25T02:00:00.000+01:00');
  });
  it('bedrijfsdag met afkappunt 05:00 (ID-09)', () => {
    expect(bookingDateFor(new Date('2026-10-24T00:30:00Z'))).toBe('2026-10-23'); // 02:30 Brussel
    expect(bookingDateFor(new Date('2026-10-24T03:30:00Z'))).toBe('2026-10-24'); // 05:30
    expect(bookingDateFor(new Date('2026-10-24T03:30:00Z'), 6)).toBe('2026-10-23');
  });
  it('ticketnummer herstart na 999 999 999 (ID-04)', () => {
    expect(nextTicketNo(null)).toBe(1);
    expect(nextTicketNo(41)).toBe(42);
    expect(nextTicketNo(999_999_999)).toBe(1);
  });
  it('testopstelling is geldig', () => {
    expect(checkIdentification({ ...TEST_POS, ...testMeta({ posFiscalTicketNo: 1 }) })).toEqual([]);
  });
});

describe('btw zoals de FDM (TX-01)', () => {
  it('M110: 24 A + 28 B', () => {
    const tx = buildTransaction([{ kind: 'single', main: martini }, { kind: 'single', main: burger }]);
    expect(tx.transactionTotal).toBe(52);
    expect(calcVat(totalsPerLabel(tx), '2024-07-29')).toEqual([
      { label: 'A', rate: 21, taxableAmount: 19.83, vatAmount: 4.17, totalAmount: 24, outOfScope: false },
      { label: 'B', rate: 12, taxableAmount: 25, vatAmount: 3, totalAmount: 28, outOfScope: false },
    ]);
  });
});

describe('builders: regels die afgedwongen worden', () => {
  const ctx = TEST_POS;
  it('TX-07: negatief aantal zonder reden', () => {
    expect(() => buildProduct({ ...martini, quantity: -martini.quantity, vats: [{ label: 'A' }] })).toThrow(FiscalBuildError);
  });
  it('TX-07: reden bij positief aantal', () => {
    expect(() => buildProduct({ ...martini, negQuantityReason: 'REFUND' })).toThrow(/TX-07/);
  });
  it('TX-14: meer dan 100 % korting', () => {
    expect(() => buildProduct({ ...burger, vats: [{ label: 'B', priceChanges: [{ groupingId: 1, id: '1', name: 'X', scope: 'LINE', type: 'PUBLIC', amount: -2801 }] }] })).toThrow(/TX-14/);
    expect(() => buildProduct({ ...burger, vats: [{ label: 'B', priceChanges: [{ groupingId: 1, id: '1', name: 'On the house', scope: 'LINE', type: 'PUBLIC', amount: -2800 }] }] })).not.toThrow();
  });
  it('TX-10: prijs die niet exact uitkomt moet meegegeven worden', () => {
    const share = { ...martini, quantity: milli4(0.333), unitPrice: milli4(35), vats: [{ label: 'A' as const }] };
    expect(() => buildProduct(share)).toThrow(/TX-10/);
    expect(buildProduct({ ...share, vats: [{ label: 'A', price: 1166 }] }).vats[0].price).toBe(11.66);
  });
  it('ID-02: een verkoop nooit met ticketMedium NONE', () => {
    expect(() => buildSale(ctx, testMeta({ ticketMedium: 'NONE' }), { lines: [{ kind: 'single', main: martini }], payments: [] })).toThrow(/ID-02/);
  });
  it('PAY-03: totale afronding max ±0,02', () => {
    const cash = { id: '1', name: 'CONTANT', type: 'CASH' as const, inputMethod: 'MANUAL' as const, amountType: 'ROUNDING' as const, amount: 2 };
    expect(() => buildSale(ctx, testMeta(), { lines: [{ kind: 'single', main: martini }], payments: [cash, cash] })).toThrow(/PAY-03/);
  });
  it('EVT-09: refund met fdmRef bevat enkel REFUND-lijnen', () => {
    const ref = { fdmId: 'FOD01000001', fdmDateTime: '2024-07-29T11:00:08.000Z', eventLabel: 'N' as const, eventCounter: 1, totalCounter: 1 };
    expect(() => buildSale(ctx, testMeta(), { lines: [{ kind: 'single', main: martini }], payments: [], fdmRef: ref })).toThrow(/EVT-09/);
  });
  it('EVT-12: kopie van een kopie is verboden', () => {
    const ref = { fdmId: 'FOD01000001', fdmDateTime: '2024-07-29T11:00:08.000Z', eventLabel: 'C' as const, eventCounter: 1, totalCounter: 1 };
    expect(() => buildCopy(ctx, testMeta(), ref)).toThrow(/EVT-12/);
  });
  it('PAY-08: betaalcorrectie netto 0 over de betalingen', () => {
    const ref = { fdmId: 'FOD01000001', fdmDateTime: '2024-07-29T11:00:08.000Z', eventLabel: 'N' as const, eventCounter: 1, totalCounter: 1 };
    const p = (type: 'CASH' | 'CARD_DEBIT', amount: number) => ({ id: type, name: type, type, inputMethod: 'MANUAL' as const, amount });
    expect(() => buildPaymentCorrection(ctx, testMeta(), ref, [p('CASH', -5966), p('CARD_DEBIT', 5966)])).not.toThrow();
    expect(() => buildPaymentCorrection(ctx, testMeta(), ref, [p('CASH', -5966), p('CARD_DEBIT', 5900)])).toThrow(/PAY-08/);
  });
  it('TBL-01: CHAIR enkel onder TABLE, max 2 niveaus', () => {
    expect(() => costCenter('CHAIR', '1', 'r')).toThrow(/TBL-01/);
    expect(() => costCenter('CUSTOMER', '1', 'r', { id: '2', type: 'CHAIR', reference: 'x' })).toThrow(/TBL-01/);
    expect(costCenter('TABLE', '5', 'sessie-1', { id: '2', type: 'CHAIR', reference: 'sessie-1-2' }).costCenter?.type).toBe('CHAIR');
  });
  it('TBL-04/05: veel-op-veel verboden; from-lijnen gespiegeld met omgekeerde korting', () => {
    const disc: LineSpec = { kind: 'single', main: { ...burger, vats: [{ label: 'B', priceChanges: [{ groupingId: 1, id: '1', name: '10%', scope: 'LINE', type: 'PUBLIC', amount: -280 }] }] } };
    const t1 = costCenter('TABLE', '1', 'a');
    const t2 = costCenter('TABLE', '2', 'b');
    const t3 = costCenter('TABLE', '3', 'c');
    const msg = buildCostCenterChange(ctx, testMeta(), [{ costCenter: t1, lines: [mirrorForTransfer(disc)] }], [{ costCenter: t2, lines: [disc] }]);
    const from = msg.transfer.from[0].transaction.transactionLines[0].mainProduct;
    expect(from.quantity).toBe(-1);
    expect(from.negQuantityReason).toBe('COST_CENTER_CHANGE');
    expect(from.unitPrice).toBe(28);
    expect(from.vats[0]).toEqual({ label: 'B', price: -28, priceChanges: [{ groupingId: 1, id: '1', name: '10%', scope: 'LINE', type: 'PUBLIC', amount: 2.8 }] });
    expect(msg.transfer.from[0].transaction.transactionTotal).toBe(-25.2);
    expect(() => buildCostCenterChange(ctx, testMeta(),
      [{ costCenter: t1, lines: [mirrorForTransfer(disc)] }, { costCenter: t3, lines: [mirrorForTransfer(disc)] }],
      [{ costCenter: t2, lines: [disc] }, { costCenter: t3, lines: [disc] }])).toThrow(/veel-op-veel/);
  });
});

describe('verificationUrl (QR) — officiële vectoren met echte handtekening', () => {
  const vectors = [
    { sig: 'tOKZG5v8RUeVPWu022lBIQf4gCVzAz9NlGr3JE3KyPj/e9K6fyHXRbZexqvgcSUfOlkrOScCpkmAesT9DQx4qA==', fdmId: 'FDM02024252', totalCounter: 83876, code: 'xJYcHkRNO5UJS3hnXbo', short: 'b6f7940dcc4694a14681471de6415defec44e02d' },
    { sig: '9UrNym6R2ky3eijjqBxtnuZpRlN6FJtGtJ+W9pcNVDkiS06blUMLS7yfGvQfBWSnrL+ZZSHkB0e7+sDWge5//A==', fdmId: 'FDM02024252', totalCounter: 83877, code: 'lLApSfduWYcqKx9QQ80', short: 'e0ed61dd6d3c46bf448c1991b49a3d39ca98ee15' },
    { sig: 'lRvExSh9UUeyZRaCZyK54Tz+WiFHb25PvXldpSsYEPOC9JN2cFEXSr9/vOP0LKCVqFekl4IPXkm+CYLKM2ONTg==', fdmId: 'FDM02024253', totalCounter: 1483, code: 'vKRnCKepX2Yy8WiDjvU', short: '84b433a643fc935474ee744678dcfe1042fbc3c2' },
    { sig: 'zoD9XCZIxU6t7Hg5tCNyyvTCu5OvspJAmv/2VWE0ADYHXg39QXRfSbdV+eka8xPBZ01pcLPONki1rx9WDqFOBQ==', fdmId: 'FDM02030868', totalCounter: 676, code: 'iw0VguJ5V1WbqPy0Czi', short: 'cf6a3f6f3f9493de23006047310937a7217e0562' },
  ];
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  it.each(vectors)('$code', async (v) => {
    expect(encodeVerification(v.fdmId, v.totalCounter, bytes(v.sig))).toBe(v.code);
    const d = decodeVerification(v.code);
    expect(d?.fdmId).toBe(v.fdmId);
    expect(d?.totalCounter).toBe(v.totalCounter);
    const sha1 = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes(v.sig)));
    expect(Array.from(sha1, (x) => x.toString(16).padStart(2, '0')).join('')).toBe(v.short);
  });
});

describe('GraphQL-documenten (FDM-01, FDM-07)', () => {
  it.each(MUTATION_NAMES)('%s: parseerbaar en selecteert footer', (name) => {
    const doc = parseDocument(mutationDocument(name));
    const root = fieldsOf(doc.operations[0].selection, doc.fragments);
    expect(root.map((f) => f.name)).toEqual([name]);
    const sel = fieldsOf(root[0].selection ?? [], doc.fragments).map((f) => f.name);
    expect(sel).toEqual(expect.arrayContaining(['footer', 'fdmRef', 'vatCalc', 'shortSignature', 'verificationUrl', 'digitalSignature', 'warnings']));
  });
});

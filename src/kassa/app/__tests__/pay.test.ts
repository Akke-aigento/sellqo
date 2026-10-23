// TAFEL-2 — afrekenen: betaalplan, afronding, fooi, fiscale betaallijnen, deelrekening.
// Getoetst aan de officiële use cases UC201 (afronding), UC292 (fooi), UC4103bis (contant
// afgerond + fooi), UC4119 (één ticket, drie betaalmiddelen) en UC4119bis (TABLE › CHAIR).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSale } from '../../fiscal/builders';
import { FdmSimulator } from '../../fiscal/simulator/fdmSimulator';
import { validateMutation } from '../../fiscal/schema';
import { TEST_POS, testMeta } from '../../fiscal/testSetup';
import { consolidatedSpecs, costCenterOf } from '../horeca/fiscalLines';
import { changeDue, equalSplit, normalizedTenders, paymentSpecs, planPayment, PaymentPlanError } from '../horeca/pay';
import { payableTotal } from '../horeca/payActions';
import { parseEuroInput } from '../screens/PayDialog';
import type { Check, CheckLine } from '../horeca/types';

const FIX = path.resolve(__dirname, '../../fiscal/__tests__/uc/fixtures/advanced');
const fixtureFinancials = (file: string, step: number) => {
  const d = JSON.parse(fs.readFileSync(path.join(FIX, file), 'utf8'));
  return d.steps[step].variables.data.financials as { type: string; amount: number; amountType: string }[];
};
const shape = (fs_: { type: string; amount: number; amountType: string }[]) => fs_.map((f) => `${f.amountType}:${f.type === 'CARD_CREDIT' ? 'CARD' : f.type}:${f.amount}`).sort();
const ours = (specs: ReturnType<typeof paymentSpecs>) => specs.map((s) => `${s.amountType}:${s.type === 'CARD_UNKNOWN' ? 'CARD' : s.type}:${s.amount / 100}`).sort();

describe('betaalplan', () => {
  it('UC201: 6,08 contant → +0,02 afronding, aparte lijn', () => {
    const p = planPayment(608, [{ method: 'cash', amount_cents: 608 }]);
    expect(p.rounding).toBe(2);
    expect(p.cashDue).toBe(610);
    expect(ours(paymentSpecs(p))).toEqual(shape(fixtureFinancials('UC201_signSale_Rounding.json', 0)));
  });

  it('UC292: fooi buiten het totaal (contant 30,50 + fooi 4,50)', () => {
    const p = planPayment(3050, [{ method: 'cash', amount_cents: 3050 }], 450, 'cash');
    expect(ours(paymentSpecs(p))).toEqual(shape(fixtureFinancials('UC292_Tip.json', 0)));
    expect(changeDue(p, 3500)).toBe(0);
  });

  it('UC4103bis rekening 1: 89,02 contant → −0,02, fooi 5,00', () => {
    const p = planPayment(8902, [{ method: 'cash', amount_cents: 8902 }], 500, 'cash');
    expect(p.rounding).toBe(-2);
    expect(ours(paymentSpecs(p))).toEqual(shape(fixtureFinancials('UC4103bis_SplitBill.json', 1)));
  });

  it('UC4119: één ticket, contant (+0,01) + kaart + maaltijdcheque', () => {
    const p = planPayment(9312, [{ method: 'cash', amount_cents: 3104 }, { method: 'card', amount_cents: 3104 }, { method: 'cheque_meal', amount_cents: 3104 }]);
    expect(p.rounding).toBe(1);
    expect(ours(paymentSpecs(p))).toEqual(shape(fixtureFinancials('UC4119_SplitPayment.json', 1)));
    // PAY-03: cheques eerst, dan contant + afronding, dan elektronisch.
    expect(paymentSpecs(p).map((s) => s.amountType + ':' + s.type)).toEqual(['PAYMENT:CHEQUE_MEAL', 'PAYMENT:CASH', 'ROUNDING:CASH', 'PAYMENT:CARD_UNKNOWN']);
  });

  it('weigert wat de server ook weigert', () => {
    expect(() => planPayment(1000, [{ method: 'card', amount_cents: 999 }])).toThrow(PaymentPlanError);
    expect(() => planPayment(1000, [])).toThrow(PaymentPlanError);
    expect(() => planPayment(1000, [{ method: 'card', amount_cents: 1100 }, { method: 'cash', amount_cents: -100 }])).toThrow(PaymentPlanError);
    expect(() => planPayment(1000, [{ method: 'card', amount_cents: 1000 }], 100, null)).toThrow(PaymentPlanError);
    expect(planPayment(0, []).total).toBe(0);
  });

  it('afronding over de som contant, nooit meer dan ±0,02 per ticket', () => {
    const p = planPayment(1004, [{ method: 'cash', amount_cents: 502 }, { method: 'cash', amount_cents: 502 }]);
    expect(p.rounding).toBe(1); // 10,04 → 10,05
    expect(normalizedTenders(p)).toEqual([{ method: 'cash', amount_cents: 1004 }]);
    expect(paymentSpecs(p).filter((s) => s.amountType === 'ROUNDING')).toHaveLength(1);
  });

  it('gelijk delen: restcenten naar de eerste delen', () => {
    expect(equalSplit(1000, 3)).toEqual([334, 333, 333]);
    expect(equalSplit(9312, 3).reduce((a, b) => a + b, 0)).toBe(9312);
  });

  it('wisselgeld = gegeven − afgerond contant (− contante fooi)', () => {
    const p = planPayment(608, [{ method: 'cash', amount_cents: 608 }]);
    expect(changeDue(p, 2000)).toBe(1390);
    expect(changeDue(p, 500)).toBe(0);
  });

  it('bedrag intikken', () => {
    expect(parseEuroInput('12,50')).toBe(1250);
    expect(parseEuroInput('€ 3.04')).toBe(304);
    expect(parseEuroInput('7')).toBe(700);
    expect(parseEuroInput('1,234')).toBeNull();
    expect(parseEuroInput('-2')).toBeNull();
  });
});

let n = 0;
const line = (over: Partial<CheckLine>): CheckLine => ({
  id: `l${++n}`, seq: n, product_id: 'p', variant_id: null, name: 'X', department_id: '20', department_name: 'Starters',
  vat_label: 'B', vat_rate: 12, unit_price_cents: 2000, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'sent',
  round_id: 'r1', neg_reason: null, corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...over,
});

describe('afrekenen van een (deel)rekening', () => {
  it('UC4119bis: deelrekening = TABLE (reference hoofdrekening) › CHAIR (eigen reference)', async () => {
    const sub: Check = {
      id: 'sub-1', table_id: 'tbl-1', name: null, status: 'open', guests: null, opened_at: '', bill_requested_at: null,
      reference: 'C1_1', version: 1, next_grouping_id: 1, split_of: 'main', split_no: 1, parent_reference: 'O158',
      lines: [
        line({ product_id: '20001', name: 'Carpaccio Beef', unit_price_cents: 2000 }),
        line({ product_id: '15003', name: 'Wine (glass)', department_id: '15', department_name: 'Wines', vat_label: 'A', vat_rate: 21, unit_price_cents: 800 }),
        line({ product_id: '12009', name: 'Coca Cola', department_id: '12', department_name: 'Soft Drinks', vat_label: 'A', vat_rate: 21, unit_price_cents: 304 }),
      ],
    };
    expect(costCenterOf(sub, 'T1')).toEqual({ id: 'T1', type: 'TABLE', reference: 'O158', costCenter: { id: '1', type: 'CHAIR', reference: 'C1_1' } });
    const total = payableTotal(sub);
    expect(total).toBe(3104);
    const plan = planPayment(total, [{ method: 'cash', amount_cents: total }]);
    const msg = buildSale(TEST_POS, testMeta({ ticketMedium: 'PAPER' }), { lines: consolidatedSpecs(sub), payments: paymentSpecs(plan), costCenter: costCenterOf(sub, 'T1') });
    expect(validateMutation('signSale', msg)).toEqual([]);
    expect(msg.transaction.transactionTotal).toBe(31.04);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'UC4119bis_SplitBill.json'), 'utf8')).steps[2].variables.data;
    expect(msg.costCenter?.type).toBe(fx.costCenter.type);
    expect(msg.costCenter?.costCenter?.type).toBe(fx.costCenter.costCenter.type);
    expect(ours(paymentSpecs(plan))).toEqual(shape(fx.financials));
    // De simulator tekent het: vatCalc per label, shortSignature, QR-url.
    const r = await new FdmSimulator({ fdmId: 'SIM01000001' }).sign('signSale', msg, false);
    expect(r.errors ?? []).toEqual([]);
    expect(r.result?.vatCalc?.map((v) => v.label).sort()).toEqual(['A', 'B']);
  });

  it('totaal = enkel verstuurde lijnen, met correcties en korting', () => {
    const a = line({ qty: 2, open_qty: 1 });
    const corr = line({ qty: -1, neg_reason: 'CORRECTION', corrects_line_id: a.id, open_qty: 0 });
    const disc = line({ price_changes: [{ grouping_id: 1, id: 'D', name: '10%', scope: 'LINE', type: 'PUBLIC', amount_cents: -200 }] });
    const draft = line({ state: 'draft', round_id: null });
    expect(payableTotal({ lines: [a, corr, disc, draft] })).toBe(2000 + 1800);
  });
});

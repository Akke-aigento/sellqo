// TAFEL-1 — rekeninglijnen → FDM-berichten, en de wachtrij/optimistische weergave.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildCostCenterChange, buildOrder, buildPreBill } from '../../fiscal/builders';
import { FdmSimulator } from '../../fiscal/simulator/fdmSimulator';
import { validateMutation } from '../../fiscal/schema';
import { TEST_POS, testMeta } from '../../fiscal/testSetup';
import { consolidatedLines, consolidatedSpecs, costCenterOf, lineSpecsOf, roundLines, roundSpecs, transferSpecs } from '../horeca/fiscalLines';
import { applyOptimistic, HorecaStore, type Command, type Transport } from '../horeca/store';
import { checkTotalCents, lineTotalCents, type Check, type CheckLine } from '../horeca/types';

let n = 0;
const line = (over: Partial<CheckLine>): CheckLine => ({
  id: `l${++n}`, seq: n, product_id: 'p-burger', variant_id: null, name: 'Burger', department_id: 'cat-main', department_name: 'Hoofdgerechten',
  vat_label: 'B', vat_rate: 12, unit_price_cents: 2800, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'sent',
  round_id: 'r1', neg_reason: null, corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...over,
});
const check = (lines: CheckLine[], over: Partial<Check> = {}): Check => ({
  id: 'chk-1', table_id: 'tbl-1', name: null, status: 'open', guests: 2, opened_at: '2026-10-23T18:00:00Z', bill_requested_at: null,
  reference: 'chk-1', version: 1, next_grouping_id: 1, lines, ...over,
});

beforeEach(() => { n = 0; });

describe('rekeninglijnen → fiscale lijnen', () => {
  it('supplement met prijs = eigen lijn (UC4120bis), zonder prijs enkel keuken', () => {
    const l = line({ addons: [{ option_id: 'mayo', name: 'Mayonaise', price_cents: 250 }, { option_id: 'ketchup', name: 'Ketchup', price_cents: 0 }] });
    const specs = lineSpecsOf(l);
    expect(specs).toHaveLength(2);
    const msg = buildOrder(TEST_POS, testMeta({ ticketMedium: 'NONE' }), { costCenter: costCenterOf(check([l]), 'B1'), lines: specs });
    expect(msg.transaction.transactionTotal).toBe(30.5);
    expect(msg.transaction.transactionLines[1].mainProduct).toMatchObject({ productId: 'mayo', productName: 'Mayonaise', departmentId: 'SUPP', unitPrice: 2.5 });
    expect(lineTotalCents(l)).toBe(3050);
  });

  it('ronde = enkel ontwerp-lijnen; annulering is een negatieve CORRECTION-lijn', () => {
    const cola = line({ product_id: 'p-cola', name: 'Cola', vat_label: 'A', unit_price_cents: 304, qty: 2, open_qty: 1 });
    const corr = line({ product_id: 'p-cola', name: 'Cola', vat_label: 'A', unit_price_cents: 304, qty: -1, state: 'draft', round_id: null, neg_reason: 'CORRECTION', corrects_line_id: cola.id, open_qty: 0 });
    const c = check([cola, corr]);
    expect(roundLines(c).map((x) => x.id)).toEqual([corr.id]);
    const msg = buildOrder(TEST_POS, testMeta(), { costCenter: costCenterOf(c, 'B1'), lines: roundSpecs(c) });
    expect(msg.transaction.transactionLines[0].mainProduct).toMatchObject({ quantity: -1, negQuantityReason: 'CORRECTION', vats: [{ label: 'A', price: -3.04 }] });
    expect(validateMutation('signOrder', msg)).toEqual([]);
  });

  it('korting op een verstuurde lijn: tegenboeking PRICE_CHANGE + nieuwe lijn met priceChange (TX-13)', () => {
    const orig = line({ open_qty: 0 });
    const neg = line({ qty: -1, state: 'draft', round_id: null, neg_reason: 'PRICE_CHANGE', corrects_line_id: orig.id, open_qty: 0 });
    const disc = line({ state: 'draft', round_id: null, corrects_line_id: orig.id, price_changes: [{ grouping_id: 1, id: 'D', name: '10%', scope: 'LINE', type: 'PUBLIC', amount_cents: -280 }] });
    const c = check([orig, neg, disc]);
    const msg = buildOrder(TEST_POS, testMeta(), { costCenter: costCenterOf(c, 'B1'), lines: roundSpecs(c) });
    expect(msg.transaction.transactionTotal).toBe(-2.8);
    expect(msg.transaction.transactionLines[1].mainProduct.vats[0].priceChanges?.[0]).toEqual({ groupingId: 1, id: 'D', name: '10%', scope: 'LINE', type: 'PUBLIC', amount: -2.8 });
    // Voorrekening: geconsolideerd = één burger met korting, de tegenboeking valt weg.
    const sent = check([orig, { ...neg, state: 'sent' }, { ...disc, state: 'sent' }]);
    expect(consolidatedLines(sent)).toHaveLength(1);
    expect(checkTotalCents(sent)).toBe(2520);
  });

  it('voorrekening en afrekenen tellen dezelfde producten samen (PRT-07)', () => {
    const a = line({ product_id: 'p-cola', name: 'Cola', vat_label: 'A', unit_price_cents: 304, qty: 2 });
    const b = line({ product_id: 'p-cola', name: 'Cola', vat_label: 'A', unit_price_cents: 304, qty: 1, round_id: 'r2' });
    const corr = line({ product_id: 'p-cola', name: 'Cola', vat_label: 'A', unit_price_cents: 304, qty: -1, neg_reason: 'CORRECTION', corrects_line_id: a.id });
    const msg = buildPreBill(TEST_POS, testMeta(), { costCenter: costCenterOf(check([a, b, corr]), 'B1'), lines: consolidatedSpecs(check([a, b, corr])) });
    expect(msg.transaction.transactionLines).toHaveLength(1);
    expect(msg.transaction.transactionLines[0].mainProduct.quantity).toBe(2);
    expect(msg.transaction.transactionTotal).toBe(6.08);
  });

  it('verplaatsen: from-lijnen gespiegeld met omgekeerde korting, simulator ondertekent (TBL-04/05)', async () => {
    const disc = line({ qty: 2, open_qty: 2, price_changes: [{ grouping_id: 1, id: 'D', name: '10%', scope: 'LINE', type: 'PUBLIC', amount_cents: -560 }] });
    const { from, to } = transferSpecs([{ line: disc, qty: 1 }]);
    const msg = buildCostCenterChange(TEST_POS, testMeta(), [{ costCenter: costCenterOf(check([disc]), 'B1'), lines: from }], [{ costCenter: costCenterOf(check([], { id: 'chk-2', reference: 'chk-2', table_id: 'tbl-2' }), 'B2'), lines: to }]);
    expect(msg.transfer.from[0].transaction.transactionTotal).toBe(-25.2);
    expect(msg.transfer.to[0].transaction.transactionTotal).toBe(25.2);
    expect(msg.transfer.from[0].transaction.transactionLines[0].mainProduct.vats[0].priceChanges?.[0].amount).toBe(2.8);
    const sim = new FdmSimulator();
    const r = await sim.sign('signCostCenterChange', msg);
    expect(r.ok && r.result.fdmRef.eventLabel).toBe('P');
  });

  it('costCenter: tafel = TABLE met de sessie-reference, op naam = CUSTOMER', () => {
    expect(costCenterOf(check([]), 'B1')).toEqual({ id: 'B1', type: 'TABLE', reference: 'chk-1' });
    expect(costCenterOf(check([], { table_id: null, name: 'Jan' }), null)).toEqual({ id: 'Jan', type: 'CUSTOMER', reference: 'chk-1' });
  });
});

describe('wachtrij en optimistische weergave', () => {
  const tenant = '11111111-1111-1111-1111-111111111111';
  beforeEach(() => { localStorage.clear(); });

  it('tik = meteen zichtbaar, één aanroep voor meerdere tikken, bevestiging vervangt de schatting', async () => {
    const calls: Command[][] = [];
    const server = check([], { lines: [] });
    const transport: Transport = {
      async apply(_t, _d, cmds) {
        calls.push(cmds);
        const lines = cmds.filter((c) => c.kind === 'add_line').map((c, i) => line({ id: c.line_id as string, seq: i + 1, state: 'draft', round_id: null, qty: c.qty as number, open_qty: c.qty as number }));
        server.lines.push(...lines);
        return { version: 2, results: cmds.map((c) => ({ id: c.id, ok: true, check: structuredClone(server) })) };
      },
      async snapshot() { return { version: 2, checks: [structuredClone(server)] }; },
      async version() { return 2; },
    };
    const s = new HorecaStore(tenant, 'dev', transport, 5);
    s.setSnapshot({ version: 1, checks: [check([])] });
    s.hint('p-burger', { name: 'Burger', unit_price_cents: 2800, vat_label: 'B' });
    s.enqueue({ id: 'c1', kind: 'add_line', check_id: 'chk-1', line_id: 'x1', product_id: 'p-burger', qty: 1 });
    s.enqueue({ id: 'c2', kind: 'add_line', check_id: 'chk-1', line_id: 'x2', product_id: 'p-burger', qty: 2 });
    expect(s.check('chk-1')?.lines.map((l) => [l.name, l.qty, l.pending])).toEqual([['Burger', 1, true], ['Burger', 2, true]]);
    await s.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(s.pendingCount).toBe(0);
    expect(s.check('chk-1')?.lines.every((l) => !l.pending)).toBe(true);
  });

  it('geen verbinding: wachtrij blijft (ook na herladen), daarna alsnog verstuurd', async () => {
    let up = false;
    const transport: Transport = {
      async apply(_t, _d, cmds) { if (!up) throw new Error('net'); return { version: 1, results: cmds.map((c) => ({ id: c.id, ok: true })) }; },
      async snapshot() { return { version: 1, checks: [] }; },
      async version() { return 1; },
    };
    const s = new HorecaStore(tenant, 'dev', transport, 5);
    s.enqueue({ id: 'c1', kind: 'open_check', check_id: 'chk-9', table_id: 'tbl-1' });
    await s.flush();
    expect(s.online).toBe(false);
    expect(s.pendingCount).toBe(1);
    const reloaded = new HorecaStore(tenant, 'dev', transport, 5);
    expect(reloaded.pendingCount).toBe(1);
    expect(reloaded.checks.map((c) => c.id)).toEqual(['chk-9']);
    up = true;
    await reloaded.flush();
    expect(reloaded.pendingCount).toBe(0);
  });

  it('weigering door de server: verdwijnt lokaal en wordt gemeld (nooit stil)', async () => {
    const transport: Transport = {
      async apply(_t, _d, cmds) { return { version: 1, results: cmds.map((c) => ({ id: c.id, ok: false, error: 'product is op' })) }; },
      async snapshot() { return { version: 1, checks: [check([])] }; },
      async version() { return 1; },
    };
    const s = new HorecaStore(tenant, 'dev', transport, 5);
    s.setSnapshot({ version: 1, checks: [check([])] });
    s.enqueue({ id: 'c1', kind: 'add_line', check_id: 'chk-1', line_id: 'x1', product_id: 'p-burger', qty: 1 });
    expect(s.check('chk-1')?.lines).toHaveLength(1);
    await s.flush();
    expect(s.check('chk-1')?.lines).toHaveLength(0);
    expect(s.takeRejections().map((r) => r.error)).toEqual(['product is op']);
  });

  it('annuleren: ontwerp weg, verstuurd = negatieve lijn met reden', () => {
    const sent = line({ qty: 2, open_qty: 2 });
    const draft = line({ state: 'draft', round_id: null });
    const m = new Map([['chk-1', check([sent, draft])]]);
    applyOptimistic(m, { id: 'a', kind: 'void_line', check_id: 'chk-1', line_id: draft.id, reason: 'mistake' }, new Map());
    applyOptimistic(m, { id: 'b', kind: 'void_line', check_id: 'chk-1', line_id: sent.id, new_line_id: 'neg', qty: 1, reason: 'customer' }, new Map());
    const c = m.get('chk-1') as Check;
    expect(c.lines.find((l) => l.id === draft.id)?.state).toBe('void');
    expect(c.lines.find((l) => l.id === 'neg')).toMatchObject({ qty: -1, neg_reason: 'CORRECTION', corrects_line_id: sent.id });
    expect(c.lines.find((l) => l.id === sent.id)?.open_qty).toBe(1);
  });
});

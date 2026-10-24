// TAFEL-3 — toogverkoop (directe verkoop, N zonder P), kas in/uit en telling, X/Z-rapporten.
// Echte runtime met de FDM-simulator; de server is nagebootst (rpc + inserts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserts: { table: string; row: Record<string, unknown> }[] = [];
const calls: { name: string; args: Record<string, unknown> }[] = [];
let rpcImpl: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown } = () => ({ data: { ok: true }, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({ insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; } }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const r = rpcImpl(name, args);
      // De server geeft bij begin de rapport-id terug (bij resume een andere).
      if (name === 'kassa_report_begin' && r.data && typeof r.data === 'object' && !('id' in (r.data as object))) (r.data as Record<string, unknown>).id = (args.p as { id: string }).id;
      return r;
    },
  },
}));

const { KassaRuntime } = await import('../runtime');
const { payCheck } = await import('../horeca/payActions');
const { cashMove, shift } = await import('../cashActions');
const { readPendingOps, retryFiscalOps } = await import('../fiscalOps');
const { makeReport, eventsFromSource, autoZ } = await import('../reportActions');
const { buildReportTurnover } = await import('../../fiscal/builders');
const { FiscalBuildError } = await import('../../fiscal/builders');
const { ROBOT_EMPLOYEE_ID } = await import('../../fiscal/identity');
import type { ActionCtx } from '../horeca/actions';
import type { Check, CheckLine } from '../horeca/types';
import type { SaleInput, MoneyInOutInput, ReportTurnoverZInput } from '../../fiscal/types';
import { TEST_POS } from '../../fiscal/testSetup';

const device = { tenantId: '11111111-1111-1111-1111-111111111111', terminalRowId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', deviceUuid: '1631678d-7a85-4ac3-b296-bb4565e873fe' };
const fiscalSim = { mode: 'simulator' as const, vatNo: 'BE0000000097', estNo: '2000000042', posId: 'CPOS0031234567', terminalId: 'TER-2-DIN' };
const INSZ = '84022899837';

const line = (id: string, state: CheckLine['state'], qty: number, price: number, label: CheckLine['vat_label'] = 'C'): CheckLine => ({
  id, seq: Number(id.slice(-1)) || 1, product_id: `p-${id}`, variant_id: null, name: `Friet ${id}`, department_id: '1', department_name: 'Frieten', vat_label: label, vat_rate: 6,
  unit_price_cents: price, qty, addons: [], note: null, course: null, station_id: null, state, round_id: null, neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: qty,
});

function counterCtx(fiscal: boolean, lines: CheckLine[]) {
  const check: Check = { id: 'k1', table_id: null, name: 'Toog', status: 'open', guests: null, opened_at: '', bill_requested_at: null, reference: 'k1', version: 1, next_grouping_id: 1, kind: 'counter', service: 'takeaway', lines };
  const runtime = new KassaRuntime(device, fiscal ? fiscalSim : { mode: 'off' });
  const store = { flush: async () => {}, pendingCount: 0, check: () => check, refresh: async () => {} };
  const ctx = { runtime, store, staffId: 'staff-1', staffName: 'Els', employeeId: fiscal ? INSZ : null, tableLabel: () => null } as unknown as ActionCtx;
  return { ctx, runtime, check };
}

beforeEach(() => { inserts.length = 0; calls.length = 0; localStorage.clear(); rpcImpl = () => ({ data: { ok: true }, error: null }); });

describe('toogverkoop (EVT-04: directe verkoop = N zonder P)', () => {
  it('niet-fiscaal: geen ronde, ontwerp-lijnen afgerekend, keukenbon standaard aan', async () => {
    const { ctx } = counterCtx(false, [line('l1', 'draft', 2, 420), line('l2', 'draft', 1, 280, 'A')]);
    const o = await payCheck(ctx, 'k1', [{ method: 'cash', amount_cents: 1120 }]);
    expect(o.ok).toBe(true);
    expect(calls.map((c) => c.name)).toEqual(['horeca_pay_begin', 'horeca_pay']);
    const begin = calls[0].args.p as { line_ids: string[]; expected_total_cents: number };
    expect(begin.line_ids).toEqual(['l1', 'l2']);
    expect(begin.expected_total_cents).toBe(1120);
    expect((calls[0].args.p as { line_vats: Record<string, string> }).line_vats).toEqual({ l1: 'C', l2: 'A' });
    const pay = calls[1].args.p_payment as { kitchen: boolean; fiscal_event_id: string | null; line_vats: Record<string, string> };
    expect(pay.line_vats).toEqual({ l1: 'C', l2: 'A' });
    expect(pay.kitchen).toBe(true);
    expect(pay.fiscal_event_id).toBeNull();
    expect(calls.some((c) => c.name === 'horeca_apply')).toBe(false); // geen send_round
  });

  it('keukenbon uit wordt meegegeven', async () => {
    const { ctx } = counterCtx(false, [line('l1', 'draft', 1, 420)]);
    await payCheck(ctx, 'k1', [{ method: 'card', amount_cents: 420 }], 0, null, { kitchen: false });
    expect((calls[1].args.p_payment as { kitchen: boolean }).kitchen).toBe(false);
  });

  it('fiscaal: één signSale zonder costCenter, event hangt aan de rekening', async () => {
    const { ctx } = counterCtx(true, [line('l1', 'draft', 2, 420)]);
    const o = await payCheck(ctx, 'k1', [{ method: 'cash', amount_cents: 840 }]);
    expect(o.ok).toBe(true);
    const ev = inserts.filter((x) => x.table === 'fiscal_events');
    expect(ev).toHaveLength(1);
    expect(ev[0].row.mutation).toBe('signSale');
    expect(ev[0].row.cost_center_reference).toBe('k1');
    const sale = JSON.parse(ev[0].row.request_body as string).variables.data as SaleInput;
    expect(sale.costCenter).toBeUndefined();
    expect(sale.transaction.transactionTotal).toBe(8.4);
    expect((calls.find((c) => c.name === 'horeca_pay')!.args.p_payment as { fiscal_event_id: string }).fiscal_event_id).toBe(ev[0].row.id);
  });

  it('niets aangetikt = niets af te rekenen', async () => {
    const { ctx } = counterCtx(false, []);
    expect((await payCheck(ctx, 'k1', [])).reason).toBe('nothing');
    expect(calls).toHaveLength(0);
  });
});

describe('kas in/uit en telling (PAY-09)', () => {
  it('niet-fiscaal: rechtstreeks naar de server, geen event', async () => {
    const { ctx } = counterCtx(false, []);
    const o = await cashMove(ctx, 'out', 2000, ' Brood ');
    expect(o.ok).toBe(true);
    expect(calls[0].name).toBe('kassa_cash_move');
    expect(calls[0].args.p).toMatchObject({ direction: 'out', amount_cents: 2000, reason: 'Brood', terminal_id: device.terminalRowId, staff_id: 'staff-1' });
    expect(inserts).toHaveLength(0);
    expect(readPendingOps(device.tenantId)).toEqual([]);
  });

  it('fiscaal: MONEY_IN_OUT negatief bij kas uit, event aan het verzoek-id', async () => {
    const { ctx } = counterCtx(true, []);
    await cashMove(ctx, 'out', 2000, 'Brood');
    const ev = inserts.find((x) => x.table === 'fiscal_events')!;
    const data = JSON.parse(ev.row.request_body as string).variables.data as MoneyInOutInput;
    expect(data.financials[0]).toMatchObject({ amount: -20, amountType: 'MONEY_IN_OUT', type: 'CASH' });
    expect(data.ticketMedium).toBe('NONE');
    const p = calls.find((c) => c.name === 'kassa_cash_move')!.args.p as { id: string; fiscal_event_id: string };
    expect(ev.row.cost_center_reference).toBe(p.id);
    expect(p.fiscal_event_id).toBe(ev.row.id);
  });

  it('telling = DRAWER_DECLARATION', async () => {
    const { ctx } = counterCtx(true, []);
    rpcImpl = () => ({ data: { ok: true, session_id: 's', expected_cents: 15000, counted_cents: 14900, difference_cents: -100 }, error: null });
    const o = await shift(ctx, 'close', 14900);
    expect(o.ok && o.data?.difference_cents).toBe(-100);
    const data = JSON.parse(inserts.find((x) => x.table === 'fiscal_events')!.row.request_body as string).variables.data as MoneyInOutInput;
    expect(data.financials[0]).toMatchObject({ amount: 149, amountType: 'DRAWER_DECLARATION' });
  });

  it('netwerkfout na tekenen: bewaard en later doorgestuurd, nooit opnieuw getekend', async () => {
    const { ctx, runtime } = counterCtx(true, []);
    rpcImpl = () => ({ data: null, error: { message: 'Failed to fetch' } });
    const o = await cashMove(ctx, 'in', 500, 'Wisselgeld');
    expect(o.ok && o.pending).toBe(true);
    expect(readPendingOps(device.tenantId)).toHaveLength(1);
    rpcImpl = () => ({ data: { ok: true }, error: null });
    expect((await retryFiscalOps(runtime)).done).toBe(1);
    expect(inserts.filter((x) => x.table === 'fiscal_events')).toHaveLength(1);
    expect(readPendingOps(device.tenantId)).toEqual([]);
  });

  it('getekend en definitief geweigerd: blijft staan als geweigerd', async () => {
    const { ctx } = counterCtx(true, []);
    rpcImpl = (n) => (n === 'kassa_cash_move' ? { data: null, error: { code: '22023', message: 'nee' } } : { data: null, error: null });
    const o = await cashMove(ctx, 'in', 500, 'Wisselgeld');
    expect(o.reason).toBe('signed_rejected');
    expect(JSON.parse(localStorage.getItem(`sq_kassa_fop|${device.tenantId}`)!)[0].status).toBe('rejected');
  });

  it('fiscaal zonder rijksregisternummer: niets', async () => {
    const { ctx } = counterCtx(true, []);
    (ctx as { employeeId: string | null }).employeeId = null;
    expect((await cashMove(ctx, 'in', 500, 'x')).reason).toBe('no_insz');
    expect(calls).toHaveLength(0);
  });
});

describe('rapporten (RPT-01..03)', () => {
  it('niet-fiscaal: begin dan finish, zonder events', async () => {
    const runtime = new KassaRuntime(device, { mode: 'off' });
    rpcImpl = (n) => (n === 'kassa_report_begin'
      ? { data: { report_no: 4, booking_date: '2026-10-24', period_start: 'a', period_end: 'b', fiscal: false }, error: null }
      : { data: { id: 'r', kind: 'Z', report_no: 4, data: {} }, error: null });
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: null }, 'Z');
    expect(o.ok).toBe(true);
    expect(calls.map((c) => c.name)).toEqual(['kassa_report_begin', 'kassa_report_finish']);
    expect(calls[1].args.p).not.toHaveProperty('fiscal_event_ids');
  });

  it('fiscaal: omzet- en gebruikersrapport uit de events van de periode, met het Z-nummer', async () => {
    // Eerst een verkoop tekenen, zodat er een journaal is.
    const { ctx, runtime } = counterCtx(true, [line('l1', 'draft', 1, 420)]);
    await payCheck(ctx, 'k1', [{ method: 'card', amount_cents: 420 }]);
    const journal = inserts.filter((x) => x.table === 'fiscal_events').map((x) => ({ mutation: x.row.mutation, is_training: false, request_body: x.row.request_body, response_body: x.row.response_body }));
    inserts.length = 0;
    calls.length = 0;
    rpcImpl = (n) => (n === 'kassa_report_begin' ? { data: { report_no: 7, booking_date: '2026-10-24', period_start: 'a', period_end: 'b', fiscal: false }, error: null }
      : n === 'kassa_report_source' ? { data: journal, error: null }
      : { data: { id: 'r', kind: 'Z', report_no: 7, data: {} }, error: null });
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: INSZ }, 'Z');
    expect(o.ok).toBe(true);
    const ev = inserts.filter((x) => x.table === 'fiscal_events');
    expect(ev.map((x) => x.row.mutation)).toEqual(['signReportTurnoverZ', 'signReportUserZ']);
    const t = JSON.parse(ev[0].row.request_body as string).variables.data as ReportTurnoverZInput;
    expect(t.reportNo).toBe(7);
    expect(t.reportBookingDate).toBe('2026-10-24');
    expect(t.turnover.transactions).toEqual([{ eventLabel: 'N', ticketCount: 1, amount: 4.2 }]);
    const finish = calls.find((c) => c.name === 'kassa_report_finish')!.args.p as { id: string; fiscal_event_ids: string[] };
    expect(finish.fiscal_event_ids).toEqual(ev.map((x) => x.row.id));
    expect(ev.every((x) => x.row.cost_center_reference === finish.id)).toBe(true);
  });

  it('resume: een afgebroken Z wordt afgewerkt met enkel het ontbrekende rapport, op dezelfde id', async () => {
    const runtime = new KassaRuntime(device, fiscalSim);
    rpcImpl = (n) => (n === 'kassa_report_begin' ? { data: { id: 'oud-z', report_no: 9, booking_date: '2026-10-23', period_start: 'a', period_end: 'b', fiscal: true, resume: true, signed: ['signReportTurnoverZ'] }, error: null }
      : n === 'kassa_report_source' ? { data: [], error: null }
      : { data: { id: 'oud-z', kind: 'Z', report_no: 9, data: {} }, error: null });
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: INSZ }, 'Z');
    expect(o.ok).toBe(true);
    const ev = inserts.filter((x) => x.table === 'fiscal_events');
    expect(ev.map((x) => x.row.mutation)).toEqual(['signReportUserZ']);
    expect(ev[0].row.cost_center_reference).toBe('oud-z');
    expect((calls.find((c) => c.name === 'kassa_report_finish')!.args.p as { id: string }).id).toBe('oud-z');
  });

  it('INSZ van het gebruikersrapport blijft niet op het toestel na het tekenen (review M6b)', async () => {
    const runtime = new KassaRuntime(device, fiscalSim);
    rpcImpl = (n) => (n === 'kassa_report_begin' ? { data: { report_no: 3, booking_date: '2026-10-24', period_start: 'a', period_end: 'b', fiscal: true }, error: null }
      : n === 'kassa_report_source' ? { data: [], error: null }
      : { data: null, error: { message: 'Failed to fetch' } });
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: INSZ }, 'Z');
    expect(o.ok && o.pending).toBe(true);
    const stored = localStorage.getItem(`sq_kassa_fop|${device.tenantId}`)!;
    expect(stored).not.toContain(INSZ);
    expect(JSON.parse(stored)[0].signs.every((s: { eventId: string | null }) => !!s.eventId)).toBe(true);
    rpcImpl = () => ({ data: { ok: true }, error: null });
    expect((await retryFiscalOps(runtime)).done).toBe(1);
  });

  it('een rapport dat nog op het toestel wacht, gaat eerst identiek door; geen nieuwe Z (review N3)', async () => {
    const runtime = new KassaRuntime(device, fiscalSim);
    rpcImpl = (n) => (n === 'kassa_report_begin' ? { data: { report_no: 5, booking_date: '2026-10-24', period_start: 'a', period_end: 'b', fiscal: true }, error: null }
      : n === 'kassa_report_source' ? { data: [], error: null }
      : { data: null, error: { message: 'Failed to fetch' } });
    expect((await makeReport(runtime, { staffId: 'staff-1', employeeId: INSZ }, 'Z')).pending).toBe(true);
    calls.length = 0;
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: INSZ }, 'Z');
    expect(o.reason).toBe('pending_elsewhere');
    expect(calls.some((c) => c.name === 'kassa_report_begin')).toBe(false);
  });

  it('zwarte doos niet beschikbaar: handeling niet in de wachtrij laten hangen (review N5)', async () => {
    const runtime = new KassaRuntime(device, { ...fiscalSim, mode: 'fdm' as const });
    const ctx = { runtime, staffId: 'staff-1', employeeId: INSZ } as unknown as ActionCtx;
    expect((await cashMove(ctx, 'in', 500, 'x')).reason).toBe('fdm_not_available');
    expect(readPendingOps(device.tenantId)).toEqual([]);
  });

  it('zaak met zwarte doos op een kassa zonder: nummer vrijgeven', async () => {
    const runtime = new KassaRuntime(device, { mode: 'off' });
    rpcImpl = (n) => (n === 'kassa_report_begin' ? { data: { report_no: 2, booking_date: '2026-10-24', period_start: 'a', period_end: 'b', fiscal: true }, error: null } : { data: null, error: null });
    const o = await makeReport(runtime, { staffId: 'staff-1', employeeId: null }, 'Z');
    expect(o.reason).toBe('fiscal_not_configured');
    expect(calls.map((c) => c.name)).toEqual(['kassa_report_begin', 'kassa_report_release']);
  });

  it('dag al afgesloten (55000) = closed', async () => {
    const runtime = new KassaRuntime(device, { mode: 'off' });
    rpcImpl = () => ({ data: null, error: { code: '55000', message: 'al afgesloten' } });
    expect((await makeReport(runtime, { staffId: 's', employeeId: null }, 'Z')).reason).toBe('closed');
  });

  it('automatische Z: robotgebruiker, per ontbrekende dag; een ander toestel was sneller = geen fout', async () => {
    const runtime = new KassaRuntime(device, fiscalSim);
    let begins = 0;
    rpcImpl = (n) => {
      if (n === 'kassa_report_due') return { data: ['2026-10-21', '2026-10-22'], error: null };
      if (n === 'kassa_report_begin') { begins += 1; return begins === 1 ? { data: { report_no: 1, booking_date: '2026-10-21', period_start: 'a', period_end: 'b', fiscal: true }, error: null } : { data: null, error: { code: '55000', message: 'al afgesloten' } }; }
      if (n === 'kassa_report_source') return { data: [], error: null };
      return { data: { id: 'r', kind: 'Z', report_no: 1, data: {} }, error: null };
    };
    const r = await autoZ(runtime);
    expect(r).toEqual({ made: 1, failed: 0 });
    const t = JSON.parse(inserts.find((x) => x.row.mutation === 'signReportTurnoverZ')!.row.request_body as string).variables.data;
    expect(t.employeeId).toBe(ROBOT_EMPLOYEE_ID);
    expect((calls.find((c) => c.name === 'kassa_report_begin')!.args.p as { auto: boolean; staff_id: null }).auto).toBe(true);
  });

  it('bron-events: onleesbare rijen tellen niet mee', () => {
    expect(eventsFromSource([{ mutation: 'signSale', is_training: false, request_body: 'x', response_body: '{}' }])).toEqual([]);
  });

  it('builder weigert een ongeldig Z-nummer (RPT-02)', () => {
    const meta = { posFiscalTicketNo: 1, posDateTime: '2026-10-24T06:00:00+02:00', bookingPeriodId: 'dffcd829-a0e5-41ca-a0ae-9eb887f95637', bookingDate: '2026-10-24', ticketMedium: 'PAPER' as const, employeeId: ROBOT_EMPLOYEE_ID };
    expect(() => buildReportTurnover(TEST_POS, meta, [], { reportNo: 0, reportBookingDate: '2026-10-23' })).toThrow(FiscalBuildError);
    expect(() => buildReportTurnover(TEST_POS, meta, [], { reportNo: 1, reportBookingDate: '23/10/2026' })).toThrow(FiscalBuildError);
    expect(buildReportTurnover(TEST_POS, meta, [], { reportNo: 1, reportBookingDate: '2026-10-23' })).toMatchObject({ reportNo: 1, reportBookingDate: '2026-10-23' });
  });
});

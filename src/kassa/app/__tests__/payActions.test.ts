// TAFEL-2 — afrekenflow op het toestel (review-rondes 1 en 2): claim vóór tekenen, geen
// antwoord van de FDM = claim houden en hetzelfde bericht opnieuw, write-ahead, en dezelfde
// betaling-id bij een nieuwe poging na een verloren antwoord.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionCtx } from '../horeca/actions';
import type { Check, CheckLine } from '../horeca/types';
import { TEST_POS, testMeta } from '../../fiscal/testSetup';

const calls: { name: string; args: Record<string, unknown> }[] = [];
let rpcImpl: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown } = () => ({ data: { ok: true }, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return rpcImpl(name, args); } },
}));

const { payCheck, readPendingPays, retryPendingPays, hasPendingPay } = await import('../horeca/payActions');

const line: CheckLine = {
  id: 'l1', seq: 1, product_id: 'p', variant_id: null, name: 'Cola', department_id: '1', department_name: 'Dranken', vat_label: 'A', vat_rate: 21,
  unit_price_cents: 304, qty: 2, addons: [], note: null, course: null, station_id: null, state: 'sent', round_id: 'r', neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 2,
};
const check: Check = { id: 'c1', table_id: 't1', name: null, status: 'open', guests: null, opened_at: '', bill_requested_at: null, reference: 'c1', version: 1, next_grouping_id: 1, lines: [line] };

function makeCtx(fiscal: boolean, signKinds: ('signed' | 'unreachable' | 'rejected')[]) {
  const signs: unknown[] = [];
  const runtime = {
    device: { tenantId: 'ten', terminalRowId: 'term', deviceUuid: 'dev' },
    fiscal: { mode: fiscal ? 'simulator' : 'off', vatNo: 'BE0000000097', estNo: '2000000042' },
    isFiscal: fiscal,
    posContext: () => TEST_POS,
    meta: async () => testMeta({ ticketMedium: 'PAPER' }),
    sign: vi.fn(async (_n: string, data: unknown) => {
      signs.push(data);
      const kind = signKinds.shift() ?? 'signed';
      return kind === 'signed' ? { kind, eventId: 'ev-1', result: { fdmRef: {} } } : { kind, errors: [] };
    }),
    flushOutbox: async () => true,
    audit: vi.fn(async () => {}),
  };
  const store = { flush: async () => {}, pendingCount: 0, check: () => check, refresh: async () => {} };
  const ctx = { runtime, store, staffId: 'staff', staffName: 'Jan', employeeId: '84022899837', tableLabel: () => 'T1' } as unknown as ActionCtx;
  return { ctx, runtime, signs };
}

beforeEach(() => { calls.length = 0; localStorage.clear(); rpcImpl = () => ({ data: { ok: true }, error: null }); });

describe('afrekenen op het toestel', () => {
  it('claim vóór tekenen, dan boeken met het event', async () => {
    const { ctx } = makeCtx(true, ['signed']);
    const o = await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }]);
    expect(o.ok).toBe(true);
    expect(calls.map((c) => c.name)).toEqual(['horeca_pay_begin', 'horeca_pay']);
    expect((calls[1].args.p_payment as { fiscal_event_id: string }).fiscal_event_id).toBe('ev-1');
    expect(readPendingPays('ten')).toEqual([]);
  });

  it('FDM antwoordt niet: claim blijft, rekening vergrendeld, later hetzelfde bericht opnieuw', async () => {
    const { ctx, runtime, signs } = makeCtx(true, ['unreachable', 'signed']);
    const o = await payCheck(ctx, 'c1', [{ method: 'cash', amount_cents: 608 }]);
    expect(o.ok).toBe(false);
    expect(calls.map((c) => c.name)).toEqual(['horeca_pay_begin']); // geen release
    expect(hasPendingPay('ten', 'c1')).toBe(true);
    // tweede poging via de knop: geweigerd (niet opnieuw tekenen)
    expect((await payCheck(ctx, 'c1', [{ method: 'cash', amount_cents: 608 }])).reason).toBe('pending_elsewhere');
    const r = await retryPendingPays({ runtime } as unknown as ActionCtx);
    expect(r.done).toBe(1);
    expect(signs).toHaveLength(2);
    expect(JSON.stringify(signs[1])).toBe(JSON.stringify(signs[0])); // identiek bericht
    const pay = calls.find((c) => c.name === 'horeca_pay')!;
    expect((pay.args.p_payment as { fiscal_event_id: string; rounding_cents: number }).fiscal_event_id).toBe('ev-1');
    expect(hasPendingPay('ten', 'c1')).toBe(false);
  });

  it('FDM weigert later het bericht: aantoonbaar niet getekend → claim vrij, betaling weg', async () => {
    const { ctx, runtime } = makeCtx(true, ['unreachable', 'rejected']);
    await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }]);
    await retryPendingPays({ runtime } as unknown as ActionCtx);
    expect(calls.some((c) => c.name === 'horeca_pay_release')).toBe(true);
    expect(calls.some((c) => c.name === 'horeca_pay')).toBe(false);
    expect(hasPendingPay('ten', 'c1')).toBe(false);
  });

  it('getekend en dan netwerkfout: write-ahead, later doorgestuurd', async () => {
    const { ctx, runtime } = makeCtx(true, ['signed']);
    rpcImpl = (name) => (name === 'horeca_pay' ? { data: null, error: { message: 'Failed to fetch' } } : { data: { ok: true }, error: null });
    const o = await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }]);
    expect(o.ok && o.pending).toBe(true);
    expect(readPendingPays('ten')).toHaveLength(1);
    rpcImpl = () => ({ data: { ok: true }, error: null });
    expect((await retryPendingPays({ runtime } as unknown as ActionCtx)).done).toBe(1);
  });

  it('getekend en definitief geweigerd: blijft als geweigerd, nooit opnieuw tekenen', async () => {
    const { ctx, runtime } = makeCtx(true, ['signed', 'signed']);
    rpcImpl = (name) => (name === 'horeca_pay' ? { data: null, error: { code: '22023', message: 'nee' } } : { data: { ok: true }, error: null });
    const o = await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }]);
    expect(o.reason).toBe('signed_rejected');
    expect((await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }])).reason).toBe('pending_elsewhere');
    expect(runtime.sign).toHaveBeenCalledTimes(1);
  });

  it('niet-fiscaal, antwoord verloren: nieuwe poging = dezelfde betaling-id (geen dubbele kaartbetaling)', async () => {
    const { ctx } = makeCtx(false, []);
    rpcImpl = (name) => (name === 'horeca_pay' ? { data: null, error: { message: 'Failed to fetch' } } : { data: { ok: true }, error: null });
    expect((await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }])).reason).toBe('offline');
    rpcImpl = () => ({ data: { ok: true, duplicate: true }, error: null });
    expect((await payCheck(ctx, 'c1', [{ method: 'card', amount_cents: 608 }])).ok).toBe(true);
    const ids = calls.filter((c) => c.name === 'horeca_pay').map((c) => (c.args.p_payment as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });
});

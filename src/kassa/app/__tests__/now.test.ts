// HORECA-NU-1 — "Nu" op de kassa: wie mag zelf (eigenaar/verantwoordelijke met token), anders goedkeurder + PIN;
// foutcodes van kassa_now_apply; de stand via kassa_now_state; de kassaversie.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: Record<string, unknown> }[] = [];
let rpcImpl: (name: string) => { data: unknown; error: unknown } = () => ({ data: null, error: null });
vi.mock('@/kassa/app/kassaSupabase', () => ({
  kassaSupabase: { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return rpcImpl(name); } },
}));

const { applyNow, fetchNowState, selfApproves } = await import('../horeca/nowActions');
const { KASSA_SW_VERSION } = await import('../../version');
import type { ActionCtx } from '../horeca/actions';

const ctx = (role?: string, token: string | null = null) => ({
  staffId: 'staff-1', staffRole: role, staffToken: token,
  runtime: { device: { tenantId: 't-1', deviceUuid: 'dev-1' } },
}) as unknown as ActionCtx;
const PIN = { approverId: 'boss', pin: '1234' };

beforeEach(() => { calls.length = 0; rpcImpl = () => ({ data: { ok: true, kind: 'pause' }, error: null }); });

describe('selfApproves', () => {
  it('enkel eigenaar/verantwoordelijke mét sessietoken', () => {
    expect(selfApproves(ctx('owner', 'tok'))).toBe(true);
    expect(selfApproves(ctx('manager', 'tok'))).toBe(true);
    expect(selfApproves(ctx('owner', null))).toBe(false);
    expect(selfApproves(ctx('waiter', 'tok'))).toBe(false);
  });
});

describe('applyNow', () => {
  it('eigenaar met token: token mee, geen PIN', async () => {
    const o = await applyNow(ctx('owner', 'tok'), { kind: 'pause', minutes: 15 }, null);
    expect(o.ok).toBe(true);
    expect(calls[0]).toEqual({ name: 'kassa_now_apply', args: { p_tenant_id: 't-1', p_device_id: 'dev-1', p: { kind: 'pause', minutes: 15, staff_id: 'staff-1', staff_token: 'tok' } } });
  });
  it('ober: goedkeurder en PIN mee, nooit zijn eigen token', async () => {
    await applyNow(ctx('waiter', 'tok'), { kind: 'area', area_id: 'a1', open: false }, PIN);
    expect(calls[0].args.p).toEqual({ kind: 'area', area_id: 'a1', open: false, staff_id: 'staff-1', approver_id: 'boss', pin: '1234' });
  });
  it('zonder akkoord: niets naar de server', async () => {
    expect(await applyNow(ctx('waiter', 'tok'), { kind: 'special_clear' }, null)).toEqual({ ok: false, reason: 'need_approval' });
    expect(calls).toHaveLength(0);
  });
  it('foute PIN, slot en foutcodes', async () => {
    rpcImpl = () => ({ data: { ok: false, reason: 'wrong_pin' }, error: null });
    expect(await applyNow(ctx('waiter'), { kind: 'special', product_id: 'p1', on: true }, PIN)).toEqual({ ok: false, reason: 'wrong_pin' });
    rpcImpl = () => ({ data: { ok: false, reason: 'locked' }, error: null });
    expect(await applyNow(ctx('waiter'), { kind: 'special', product_id: 'p1', on: true }, PIN)).toEqual({ ok: false, reason: 'locked' });
    rpcImpl = () => ({ data: null, error: { code: '42501', message: 'akkoord nodig' } });
    expect(await applyNow(ctx('waiter'), { kind: 'sold_out', product_id: 'p1', sold_out: true }, PIN)).toMatchObject({ ok: false, reason: 'not_allowed' });
    rpcImpl = () => ({ data: null, error: { code: '22023', message: 'onbekende zone' } });
    expect(await applyNow(ctx('waiter'), { kind: 'area', area_id: 'x', open: true }, PIN)).toMatchObject({ ok: false, reason: 'invalid' });
    rpcImpl = () => ({ data: null, error: { message: 'Failed to fetch' } });
    expect(await applyNow(ctx('waiter'), { kind: 'pause', minutes: 0 }, PIN)).toMatchObject({ ok: false, reason: 'offline' });
  });
});

describe('fetchNowState', () => {
  it('leest online en pauze via kassa_now_state', async () => {
    rpcImpl = () => ({ data: { online: true, paused_until: '2026-11-04T19:45:00Z' }, error: null });
    expect(await fetchNowState('t-1')).toEqual({ online: true, pausedUntil: '2026-11-04T19:45:00Z' });
    expect(calls[0]).toEqual({ name: 'kassa_now_state', args: { p_tenant_id: 't-1' } });
  });
});

it('kassaversie 0.23.0 (HORECA-NU-1)', () => {
  expect(KASSA_SW_VERSION).toBe('sellqo-kassa-0.23.0');
});

// KASSA-0.6 — product snel aanpassen op de kassa (rol, foutcodes) en btw-tarieven op de kaart.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: Record<string, unknown> }[] = [];
let rpcImpl: (name: string) => { data: unknown; error: unknown } = () => ({ data: null, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return rpcImpl(name); } },
}));

const { canApprove, quickEditProduct } = await import('../horeca/productActions');
import type { ActionCtx } from '../horeca/actions';

const ctx = (role?: string) => ({
  staffId: 'staff-1', staffRole: role,
  runtime: { device: { tenantId: 't-1', deviceUuid: 'dev-1' } },
}) as unknown as ActionCtx;

beforeEach(() => { calls.length = 0; });

describe('canApprove', () => {
  it('enkel eigenaar en verantwoordelijke staan voorgeselecteerd als goedkeurder', () => {
    expect(canApprove(ctx('owner'))).toBe(true);
    expect(canApprove(ctx('manager'))).toBe(true);
    expect(canApprove(ctx('waiter'))).toBe(false);
    expect(canApprove(ctx())).toBe(false);
  });
});

describe('quickEditProduct', () => {
  const ok = { approverId: 'boss', pin: '1234' };
  it('stuurt starter, goedkeurder met PIN, product en enkel wat wijzigt', async () => {
    rpcImpl = () => ({ data: { ok: true, id: 'p1', price: '3.10', sold_out_until: null }, error: null });
    const o = await quickEditProduct(ctx('waiter'), 'p1', ok, { price: '3.10' });
    expect(o).toEqual({ ok: true, price: 3.1, soldOutUntil: null });
    expect(calls[0]).toEqual({ name: 'kassa_product_quick_edit', args: { p_tenant_id: 't-1', p_device_id: 'dev-1', p: { staff_id: 'staff-1', approver_id: 'boss', pin: '1234', product_id: 'p1', price: '3.10' } } });
    await quickEditProduct(ctx('owner'), 'p1', ok, { soldOut: true });
    expect(calls[1].args.p).toEqual({ staff_id: 'staff-1', approver_id: 'boss', pin: '1234', product_id: 'p1', sold_out: true });
  });

  it('foute PIN en slot komen terug als reden (geen fout van de server)', async () => {
    rpcImpl = () => ({ data: { ok: false, reason: 'wrong_pin' }, error: null });
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: '1' })).toEqual({ ok: false, reason: 'wrong_pin' });
    rpcImpl = () => ({ data: { ok: false, reason: 'locked' }, error: null });
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: '1' })).toEqual({ ok: false, reason: 'locked' });
    rpcImpl = () => ({ data: null, error: { code: '28000', message: 'pin geblokkeerd' } });
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: '1' })).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('vertaalt de foutcodes van de server', async () => {
    rpcImpl = () => ({ data: null, error: { code: '42501', message: 'enkel een eigenaar' } });
    expect(await quickEditProduct(ctx('waiter'), 'p1', ok, { soldOut: true })).toMatchObject({ ok: false, reason: 'not_allowed' });
    rpcImpl = () => ({ data: null, error: { code: '22023', message: 'prijs' } });
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: 'x' })).toMatchObject({ ok: false, reason: 'invalid' });
    rpcImpl = () => ({ data: null, error: { message: 'Failed to fetch' } });
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: '1' })).toMatchObject({ ok: false, reason: 'offline' });
    rpcImpl = () => { throw new Error('netwerk'); };
    expect(await quickEditProduct(ctx('owner'), 'p1', ok, { price: '1' })).toMatchObject({ ok: false, reason: 'offline' });
  });
});

describe('sortCatalog (0.6.1)', () => {
  it('categorievolgorde, dan positie, dan naam; zonder positie achteraan', async () => {
    const { sortCatalog } = await import('../horeca/useCatalog');
    const cats = new Map([['bier', 0], ['fris', 1]]);
    const rows = [
      { name: 'Cola', category_id: 'fris', menu_position: 0 },
      { name: 'Westmalle', category_id: 'bier', menu_position: null },
      { name: 'Duvel', category_id: 'bier', menu_position: null },
      { name: 'Pils', category_id: 'bier', menu_position: 0 },
      { name: 'Losse', category_id: null, menu_position: 0 },
      { name: 'Tripel', category_id: 'bier', menu_position: 1 },
    ];
    expect(rows.slice().sort((a, b) => sortCatalog(a, b, cats)).map((r) => r.name)).toEqual(['Pils', 'Tripel', 'Duvel', 'Westmalle', 'Cola', 'Losse']);
  });
});

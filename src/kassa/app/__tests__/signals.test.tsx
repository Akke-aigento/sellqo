// MELDING-1 — meldingen op de open kassa: de eerste lading telt nooit als nieuw, enkel wat erbij
// komt geeft een melding (één keer), een fout slaat niets over, en een bon met een "oudere" tijd
// (keukentoestel met een achterlopende klok) wordt toch gemeld.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

type Row = Record<string, unknown>;
const state: { ready: Row[]; paid: Row[]; fail: boolean; filters: { table: string; gt: [string, string] | null }[] } = { ready: [], paid: [], fail: false, filters: [] };

function builder(table: string) {
  let gt: [string, string] | null = null;
  let asc = true;
  let limit = 100;
  const b = {
    select: () => b, eq: () => b,
    gt: (col: string, v: string) => { gt = [col, v]; return b; },
    order: (_c: string, o?: { ascending?: boolean }) => { asc = o?.ascending !== false; return b; },
    limit: (n: number) => { limit = n; return b; },
    then: (res: (v: unknown) => unknown) => {
      state.filters.push({ table, gt });
      if (state.fail) return Promise.resolve({ data: null, error: { message: 'x' } }).then(res);
      const col = table === 'kitchen_tickets' ? 'status_at' : 'paid_at';
      let rows = (table === 'kitchen_tickets' ? state.ready : state.paid).filter((r) => !gt || String(r[col]) > gt[1]);
      rows = [...rows].sort((a, c) => (String(a[col]) < String(c[col]) ? -1 : 1));
      if (!asc) rows.reverse();
      return Promise.resolve({ data: rows.slice(0, limit), error: null }).then(res);
    },
  };
  return b;
}

const toastSuccess = vi.fn();
const toastPlain = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('sonner', () => ({ toast: Object.assign((...a: unknown[]) => toastPlain(...a), { success: (...a: unknown[]) => toastSuccess(...a) }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => `${k}${o ? JSON.stringify(o) : ''}`, i18n: { language: 'nl' } }) }));
vi.mock('@/lib/ding', () => ({ ding: vi.fn() }));

import { useKassaSignals } from '../useKassaSignals';
import { ding } from '@/lib/ding';

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

describe('useKassaSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:10:00Z'));
    state.ready = [{ id: 'old', table_label: '1', customer_label: null, status_at: '2026-10-28T10:00:00Z' }];
    state.paid = [];
    state.fail = false;
    state.filters = [];
    toastSuccess.mockClear(); toastPlain.mockClear(); vi.mocked(ding).mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('eerste lading = nulmeting; daarna enkel wat nieuw is, één keer, met geluid', async () => {
    renderHook(() => useKassaSignals('t1', [], true, true));
    await flush();
    expect(toastSuccess).not.toHaveBeenCalled();
    state.ready.push({ id: 'new', table_label: '4', customer_label: null, status_at: '2026-10-28T10:05:00Z' });
    state.paid.push({ id: 'p1', table_label: '4', amount_cents: 1250, tip_cents: 100, paid_at: '2026-10-28T10:05:01Z' });
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(toastSuccess).toHaveBeenCalledTimes(2);
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/kassa\.signals\.ready.*4/);
    expect(String(toastSuccess.mock.calls[1][0])).toContain('13,50');
    expect(ding).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(toastSuccess).toHaveBeenCalledTimes(2); // niet opnieuw
  });

  it('achterlopende klok van een keukentoestel: een bon met een oudere tijd wordt toch gemeld', async () => {
    state.ready.push({ id: 'a', table_label: '2', customer_label: null, status_at: '2026-10-28T10:08:00Z' });
    renderHook(() => useKassaSignals('t1', [], true, false));
    await flush();
    state.ready.push({ id: 'b', table_label: '9', customer_label: null, status_at: '2026-10-28T10:03:00Z' });
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/kassa\.signals\.ready.*9/);
  });

  it('een fout slaat niets over', async () => {
    renderHook(() => useKassaSignals('t1', [], true, false));
    await flush();
    state.fail = true;
    state.ready.push({ id: 'new', table_label: '7', customer_label: null, status_at: '2026-10-28T10:06:00Z' });
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(toastSuccess).not.toHaveBeenCalled();
    state.fail = false;
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(ding).not.toHaveBeenCalled(); // geluid staat uit
  });

  it('nieuwe QR-bestelling: melding; wat bij het openen al openstond telt niet', async () => {
    const r = (id: string, label: string) => ({ id, table_label: label, dining_table_id: null, items: [], item_count: 1, total_cents: 100, guest_name: null, note: null, created_at: '' });
    const { rerender } = renderHook(({ reqs, loaded }) => useKassaSignals('t1', reqs, loaded, true), { initialProps: { reqs: [] as ReturnType<typeof r>[], loaded: false } });
    await flush();
    // Eerste echte lading (al openstaande aanvraag 'a') is de nulmeting, geen melding.
    rerender({ reqs: [r('a', '1')], loaded: true });
    expect(toastPlain).not.toHaveBeenCalled();
    rerender({ reqs: [r('a', '1'), r('b', '5')], loaded: true });
    expect(toastPlain).toHaveBeenCalledTimes(1);
    expect(String(toastPlain.mock.calls[0][0])).toContain('"tables":"5"');
  });
});

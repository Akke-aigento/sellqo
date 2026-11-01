// OBER-ROEPEN-1 — oproepen van tafels in de kassa: ophalen samen met de rekeningen (een fout of
// een ontbrekende tabel blokkeert niets), tonen in Binnenkomend, en "Afgehandeld" roept de
// serverfunctie aan; een fout blijft bij die ene oproep staan.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HorecaStore, type Transport } from '../horeca/store';
import type { TableCall } from '../horeca/requests';
import type { ActionCtx } from '../horeca/actions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'nl' } }),
}));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}) } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const { CallList } = await import('../screens/RequestInbox');

const call = (id: string, kind: TableCall['kind'], over: Partial<TableCall> = {}): TableCall => ({
  id, dining_table_id: 't-7', table_label: '7', kind, repeat_count: 1, last_called_at: new Date().toISOString(), created_at: new Date().toISOString(), ...over,
});
const transport = (calls?: () => Promise<TableCall[]>): Transport => ({
  apply: async () => ({ version: 1, results: [] }),
  snapshot: async () => ({ version: 1, checks: [] }),
  version: async () => 1,
  ...(calls ? { calls } : {}),
});

describe('HorecaStore + oproepen', () => {
  it('haalt oproepen samen met de rekeningen op en zet callsLoaded', async () => {
    const s = new HorecaStore('t', 'd', transport(async () => [call('c1', 'waiter')]));
    expect(s.callsLoaded).toBe(false);
    await s.refresh();
    expect(s.calls.map((c) => c.id)).toEqual(['c1']);
    expect(s.callsLoaded).toBe(true);
  });
  it('een fout (bv. tabel bestaat nog niet) blokkeert de rekeningen niet', async () => {
    const s = new HorecaStore('t', 'd', transport(async () => { throw new Error('relation "table_calls" does not exist'); }));
    await s.refresh();
    expect(s.online).toBe(true);
    expect(s.calls).toEqual([]);
    expect(s.callsLoaded).toBe(false);
  });
  it('zonder calls in het transport: gewoon geen oproepen', async () => {
    const s = new HorecaStore('t', 'd', transport());
    await s.refresh();
    expect(s.calls).toEqual([]);
  });
});

describe('CallList', () => {
  const ctx = (refresh = vi.fn(async () => {})) => ({ store: { tenantId: 't', deviceId: 'd', refresh }, staffId: 's1' }) as unknown as ActionCtx;
  it('toont ober en rekening, met het aantal keer geroepen', () => {
    render(<CallList ctx={ctx()} calls={[call('c1', 'waiter', { repeat_count: 3 }), call('c2', 'bill', { table_label: 'Ter 2' })]} />);
    expect(screen.getByText(/kassa\.calls\.waiter.*"7"/)).toBeTruthy();
    expect(screen.getByText(/kassa\.calls\.bill.*"Ter 2"/)).toBeTruthy();
    expect(screen.getByText(/kassa\.calls\.repeat.*3/)).toBeTruthy();
  });
  it('Afgehandeld → horeca_table_call_handle met tenant, oproep en medewerker; daarna verversen', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const refresh = vi.fn(async () => {});
    render(<CallList ctx={ctx(refresh)} calls={[call('c1', 'waiter')]} />);
    fireEvent.click(screen.getByRole('button', { name: /kassa\.calls\.handle/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('horeca_table_call_handle', { p_tenant_id: 't', p_call_id: 'c1', p_staff_id: 's1' });
  });
  it('een fout blijft bij die oproep staan, de lijst valt niet', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: { message: 'geen toegang' } });
    render(<CallList ctx={ctx()} calls={[call('c1', 'waiter'), call('c2', 'bill')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: /kassa\.calls\.handle/ })[0]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('geen toegang'));
    expect(screen.getAllByRole('button', { name: /kassa\.calls\.handle/ })).toHaveLength(2);
  });
  it('beforeAction false (PIN-bewaking) → niets', () => {
    rpc.mockReset();
    render(<CallList ctx={ctx()} calls={[call('c1', 'waiter')]} beforeAction={() => false} />);
    fireEvent.click(screen.getByRole('button', { name: /kassa\.calls\.handle/ }));
    expect(rpc).not.toHaveBeenCalled();
  });
});

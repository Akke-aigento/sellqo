// QR-REKENING-1 — tafelaanvragen in de kassa: groeperen per tafel, ophalen samen met de rekeningen,
// enkel de lijnen van de aanvraag versturen, en een inbox die bij drukte overzichtelijk blijft en
// bij een fout van één aanvraag niet crasht.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roundLines } from '../horeca/fiscalLines';
import { HorecaStore, type Transport } from '../horeca/store';
import type { Check, CheckLine } from '../horeca/types';
import type { TableRequest } from '../horeca/requests';
import type { ActionCtx } from '../horeca/actions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'nl' } }),
}));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}) } }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const { groupByTable } = await import('../horeca/requests');
const { RequestInbox } = await import('../screens/RequestInbox');
const { acceptRequest } = await import('../horeca/requests');
const { useAutoAcceptRunner } = await import('../horeca/autoAccept');
const { renderHook } = await import('@testing-library/react');

const req = (id: string, table: string, at: string, over: Partial<TableRequest> = {}): TableRequest => ({
  id, dining_table_id: `t-${table}`, table_label: table, items: [{ product_id: 'p', variant_id: null, qty: 2, name: 'Duvel', unit_price_cents: 450, addons: [] }],
  item_count: 2, total_cents: 900, guest_name: null, note: null, created_at: at, ...over,
});

describe('groupByTable', () => {
  it('per tafel, de tafel met de oudste aanvraag eerst, binnen een tafel oudste eerst', () => {
    const g = groupByTable([req('a', '4', '2026-10-28T10:00:00Z'), req('b', '7', '2026-10-28T09:59:00Z'), req('c', '4', '2026-10-28T10:02:00Z')]);
    expect(g.map((x) => [x.label, x.requests.map((r) => r.id)])).toEqual([['7', ['b']], ['4', ['a', 'c']]]);
  });
  it('tafel zonder zaalplan groepeert op label', () => {
    const g = groupByTable([req('a', '12', 'x', { dining_table_id: null }), req('b', '12', 'y', { dining_table_id: null })]);
    expect(g).toHaveLength(1);
    expect(g[0].tableId).toBeNull();
  });
});

describe('HorecaStore + aanvragen', () => {
  const baseTransport = (requests: () => Promise<TableRequest[]>): Transport => ({
    apply: async () => ({ version: 1, results: [] }),
    snapshot: async () => ({ version: 1, checks: [] }),
    version: async () => 1,
    requests,
  });
  it('haalt aanvragen samen met de rekeningen op', async () => {
    const s = new HorecaStore('t', 'd', baseTransport(async () => [req('a', '4', 'x')]));
    await s.refresh();
    expect(s.requests.map((r) => r.id)).toEqual(['a']);
    expect(s.online).toBe(true);
  });
  it('een fout bij het ophalen van aanvragen blokkeert de rekeningen niet en houdt de vorige lijst', async () => {
    let fail = false;
    const s = new HorecaStore('t', 'd', baseTransport(async () => { if (fail) throw new Error('x'); return [req('a', '4', 'x')]; }));
    await s.refresh();
    fail = true;
    await s.refresh();
    expect(s.requests.map((r) => r.id)).toEqual(['a']);
    expect(s.online).toBe(true);
  });
});

describe('roundLines met een selectie', () => {
  const line = (id: string, state: CheckLine['state']) => ({ id, state, seq: Number(id.slice(1)), pending: false }) as unknown as CheckLine;
  it('verstuurt enkel de lijnen van de aanvraag, niet wat een collega aantikt', () => {
    const c = { lines: [line('l1', 'draft'), line('l2', 'draft'), line('l3', 'sent')] } as unknown as Check;
    expect(roundLines(c, new Set(['l2'])).map((l) => l.id)).toEqual(['l2']);
    expect(roundLines(c).map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

describe('RequestInbox', () => {
  const store = { tenantId: 't', deviceId: 'd', refresh: vi.fn(async () => {}), check: () => undefined, flush: async () => {}, pendingCount: 0 };
  const ctx = { store, runtime: { isFiscal: false }, staffId: 's1', staffName: 'Jan', employeeId: null, tableLabel: () => null } as unknown as ActionCtx;

  it('toont per tafel en bevestigt alles van één tafel in één tik, in volgorde', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true, duplicate: true, check_id: 'c1', line_ids: [], version: 2 }, error: null });
    const reqs = [req('a', '4', '2026-10-28T10:00:00Z'), req('c', '4', '2026-10-28T10:02:00Z'), req('b', '7', '2026-10-28T10:01:00Z')];
    render(<RequestInbox ctx={ctx} requests={reqs} open onClose={() => {}} />);
    expect(screen.getByText(/kassa.requests.table .*"label":"4"/)).toBeTruthy();
    fireEvent.click(screen.getByText(/kassa.requests.acceptAll/));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(rpc.mock.calls.map((c) => (c[1] as { p_request_id: string }).p_request_id)).toEqual(['a', 'c']);
  });

  it('een fout bij één aanvraag blijft bij die aanvraag en laat de rest werken', async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'product is op', code: '22023' } });
    render(<RequestInbox ctx={ctx} requests={[req('a', '4', '2026-10-28T10:00:00Z'), req('b', '7', '2026-10-28T10:01:00Z')]} open onClose={() => {}} />);
    fireEvent.click(screen.getAllByText('kassa.requests.accept')[0]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('product is op'));
    expect(screen.getAllByText('kassa.requests.accept')).toHaveLength(2);
  });

  it('weigeren met een snelle reden', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    render(<RequestInbox ctx={ctx} requests={[req('a', '4', '2026-10-28T10:00:00Z')]} open onClose={() => {}} />);
    fireEvent.click(screen.getByText('kassa.requests.reject'));
    fireEvent.click(screen.getByText('kassa.requests.reason.soldOut'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('horeca_table_request_reject', expect.objectContaining({ p_request_id: 'a', p_reason: 'soldOut' })));
  });
});

describe('acceptRequest: niets blijft onverstuurd liggen', () => {
  // check() geeft geen rekening: sendRound stopt met check_missing, genoeg om te zien óf het verstuurt.
  const mk = () => ({ store: { tenantId: 't', deviceId: 'd', refresh: vi.fn(async () => {}), check: vi.fn(() => undefined), flush: async () => {}, pendingCount: 0 },
    runtime: { isFiscal: false }, staffId: 's1', employeeId: null, tableLabel: () => null } as unknown as ActionCtx);
  it('al bevestigd door een ander toestel, net nu: dat toestel verstuurt, wij niet', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true, duplicate: true, check_id: 'c1', line_ids: [], unsent: 1, age_s: 2, version: 3 }, error: null });
    const ctx = mk();
    expect(await acceptRequest(ctx, { id: 'a' })).toEqual({ ok: true, checkId: 'c1', sent: true });
    expect(ctx.store.check).not.toHaveBeenCalled();
  });
  it('ons eigen antwoord kwam nooit aan en de lijnen wachten nog: wij versturen ze', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true, duplicate: true, check_id: 'c1', line_ids: ['l1'], unsent: 1, age_s: 120, version: 3 }, error: null });
    const ctx = mk();
    const o = await acceptRequest(ctx, { id: 'a' });
    expect(ctx.store.check).toHaveBeenCalledWith('c1');
    expect(o).toMatchObject({ ok: true, sent: false, send: { ok: false, detail: 'check_missing' } });
  });
  it('een ander toestel bevestigde lang geleden en er wacht nog iets: melden, niet zelf versturen (GKS)', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true, duplicate: true, check_id: 'c1', line_ids: [], unsent: 2, age_s: 120, version: 3 }, error: null });
    const ctx = mk();
    expect(await acceptRequest(ctx, { id: 'a' })).toMatchObject({ ok: true, sent: false, send: { detail: 'other_device' } });
    expect(ctx.store.check).not.toHaveBeenCalled();
  });
  it('al bevestigd en alles verstuurd: klaar', async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { ok: true, duplicate: true, check_id: 'c1', line_ids: [], age_s: 120, version: 3 }, error: null });
    expect(await acceptRequest(mk(), { id: 'a' })).toEqual({ ok: true, checkId: 'c1', sent: true });
  });
});

describe('automatisch bevestigen', () => {
  const store = { tenantId: 't', deviceId: 'd', refresh: vi.fn(async () => {}), check: () => undefined, flush: async () => {}, pendingCount: 0 };
  const ctx = { store, runtime: { isFiscal: false }, staffId: 's1', employeeId: null, tableLabel: () => null } as unknown as ActionCtx;
  it('werkt een achterstand helemaal af, één tegelijk, en laat een vrij tafelnummer voor de bediening', async () => {
    rpc.mockReset();
    let inFlight = 0; let maxInFlight = 0;
    rpc.mockImplementation(async () => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { data: { ok: true, duplicate: true, check_id: 'c1', line_ids: [], version: 2 }, error: null };
    });
    const reqs = [req('a', '4', '1'), req('b', '5', '2'), req('c', '6', '3'), req('free', '9', '4', { dining_table_id: null })];
    renderHook(() => useAutoAcceptRunner(ctx, true, reqs));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 50));
    expect(rpc.mock.calls.map((c) => (c[1] as { p_request_id: string }).p_request_id)).toEqual(['a', 'b', 'c']);
    expect(maxInFlight).toBe(1);
  });
  it('staat het uit, dan gebeurt er niets', async () => {
    rpc.mockReset();
    renderHook(() => useAutoAcceptRunner(ctx, false, [req('a', '4', '1')]));
    await new Promise((r) => setTimeout(r, 30));
    expect(rpc).not.toHaveBeenCalled();
  });
});

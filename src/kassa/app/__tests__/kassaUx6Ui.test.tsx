// KASSA-UX-6 — UI: PIN-scherm met de laatste medewerker voorgekozen na inactiviteit (niet na Wissel),
// en het afrekenvenster met fooi-knoppen en "volgende persoon" bij gelijk delen.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionCtx } from '../horeca/actions';
import type { Check, CheckLine } from '../horeca/types';

vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { name: 'Café Test' } }) }));
const settings = { methods: ['cash', 'transfer', 'card'], terminal: 'standalone', kassa_tip: true };
vi.mock('../horeca/paySettings', async (orig) => ({ ...(await orig<object>()), useKassaPaySettings: () => settings }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'nl' } }),
}));
// Het kasticket (print/qr.ts → qr.js) speelt hier geen rol.
vi.mock('../../print', () => ({ buildKasticket: vi.fn(), renderHtml: vi.fn() }));
vi.mock('../horeca/payActions', async (orig) => ({ ...(await orig<object>()), payCheck: vi.fn() }));
const staffList = [
  { id: 's1', display_name: 'Jan', role: 'waiter', employee_no: 1, avatar_color: null },
  { id: 's2', display_name: 'An', role: 'owner', employee_no: 2, avatar_color: null },
];
vi.mock('@/integrations/supabase/client', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) q[m] = () => q;
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: staffList, error: null }).then(ok);
  return { supabase: { from: () => q, rpc: vi.fn() } };
});

const { PayDialog } = await import('../screens/PayDialog');
const { PinLock } = await import('../screens/PinLock');
const { KassaSessionProvider, useKassaSession } = await import('../session');

const line = (over: Partial<CheckLine>): CheckLine => ({
  id: 'l1', seq: 1, product_id: 'p', variant_id: null, name: 'Menu', department_id: '1', department_name: 'Eten', vat_label: 'B', vat_rate: 12,
  unit_price_cents: 2340, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'sent', round_id: 'r', neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...over,
});
const check: Check = { id: 'c1', table_id: 't1', name: null, status: 'open', guests: null, opened_at: '', bill_requested_at: null, reference: 'c1', version: 1, next_grouping_id: 1, lines: [line({})] };
const ctx = { runtime: { fiscal: { mode: 'off' } }, staffName: 'Jan' } as unknown as ActionCtx;

describe('PayDialog — KASSA-UX-6', () => {
  it('fooi 10 % en "rond af" vullen het fooiveld; €5 en €10 bij contant', () => {
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    fireEvent.click(screen.getByText('10 %'));
    expect((screen.getByLabelText('kassa.pay.tip') as HTMLInputElement).value).toBe('2,34');
    fireEvent.click(screen.getByText('kassa.ux6.roundUp'));
    expect((screen.getByLabelText('kassa.pay.tip') as HTMLInputElement).value).toBe('0,60');
    fireEvent.click(screen.getAllByText('kassa.pay.method.cash').find((e) => e.tagName === 'BUTTON' && e.closest('.grid'))!);
    // 23,40 contant: knoppen vanaf het exacte bedrag (geen €5/€10, die zijn te weinig).
    const given = screen.getByLabelText('kassa.pay.given').parentElement!;
    expect(given.textContent).toContain('23,40');
    expect(given.textContent).not.toContain('5,00');
  });

  it('review 1: "rond af" bij volledig contant vertrekt van het afgeronde contante bedrag', () => {
    const cola: Check = { ...check, lines: [line({ unit_price_cents: 304, qty: 2, open_qty: 2, vat_label: 'A', vat_rate: 21 })] };
    render(<PayDialog ctx={ctx} check={cola} onClose={() => {}} onPaid={() => {}} />);
    // Kaart (6,08): tot 7,00 = 0,92.
    fireEvent.click(screen.getAllByText('kassa.pay.method.card').find((e) => e.tagName === 'BUTTON' && e.closest('.grid'))!);
    fireEvent.click(screen.getByText('kassa.ux6.roundUp'));
    expect((screen.getByLabelText('kassa.pay.tip') as HTMLInputElement).value).toBe('0,92');
    // Contant: de klant geeft 6,10 → tot 7,00 = 0,90.
    fireEvent.click(screen.getAllByText('kassa.pay.method.cash').find((e) => e.tagName === 'BUTTON' && e.closest('.grid'))!);
    fireEvent.click(screen.getByText('kassa.ux6.roundUp'));
    expect((screen.getByLabelText('kassa.pay.tip') as HTMLInputElement).value).toBe('0,90');
  });

  it('gelijk delen door 3: per persoon de betaalwijze, dan "iedereen gekozen"', () => {
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    fireEvent.click(screen.getByText('3'));
    expect(screen.getByText(/kassa.ux6.person .*"n":1/)).toBeTruthy();
    const panel = screen.getByText(/kassa.ux6.person/).closest('div')!.parentElement!;
    fireEvent.click(Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === 'kassa.pay.method.card')!);
    fireEvent.click(screen.getByText('kassa.ux6.nextPerson'));
    expect(screen.getByText(/kassa.ux6.person .*"n":2/)).toBeTruthy();
    fireEvent.click(screen.getByText('kassa.ux6.nextPerson'));
    fireEvent.click(screen.getByText('kassa.ux6.allPersons'));
    expect(screen.getByText(/kassa.ux6.personsDone/)).toBeTruthy();
    // De drie regels blijven één afrekening; persoon 1 betaalt met kaart.
    const selects = screen.getAllByLabelText('kassa.pay.methodLabel').filter((e) => e.tagName === 'SELECT') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['card', 'cash', 'cash']);
    expect(screen.getByText('kassa.pay.balanced')).toBeTruthy();
  });
});

function Probe() {
  const { staff, signIn, lock } = useKassaSession();
  return (
    <div>
      <span data-testid="who">{staff?.display_name ?? 'niemand'}</span>
      <button onClick={() => signIn(staffList[0], null)}>in</button>
      <button onClick={lock}>wissel</button>
      {!staff && <PinLock tenantId="t" deviceUuid="d" />}
    </div>
  );
}

describe('Sessietoken — review 1', () => {
  it('signIn bewaart het token in het geheugen; Wissel en inactiviteit trekken het in', () => {
    vi.useFakeTimers();
    const ended: string[] = [];
    function TokenProbe() {
      const { staffToken, signIn, lock } = useKassaSession();
      return (
        <div>
          <span data-testid="tk">{staffToken ?? 'geen'}</span>
          <button onClick={() => signIn(staffList[1], null, 't1')}>in1</button>
          <button onClick={() => signIn(staffList[1], null, 't2')}>in2</button>
          <button onClick={lock}>wissel</button>
        </div>
      );
    }
    render(<KassaSessionProvider idleMs={1000} onEnd={(tk) => ended.push(tk)}><TokenProbe /></KassaSessionProvider>);
    act(() => { screen.getByText('in1').click(); });
    expect(screen.getByTestId('tk').textContent).toBe('t1');
    act(() => { screen.getByText('wissel').click(); });
    expect(ended).toEqual(['t1']);
    expect(screen.getByTestId('tk').textContent).toBe('geen');
    act(() => { screen.getByText('in2').click(); });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(ended).toEqual(['t1', 't2']);
    expect(localStorage.getItem('t2')).toBeNull();
    vi.useRealTimers();
  });
});

describe('PIN-scherm — KASSA-UX-6', () => {
  it('na inactiviteit staat de laatste medewerker voorgekozen; na Wissel kies je opnieuw', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = render(<KassaSessionProvider idleMs={1000}><Probe /></KassaSessionProvider>);
    act(() => { screen.getByText('in').click(); });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByTestId('who').textContent).toBe('niemand');
    expect(await screen.findByText(/kassa.pin.notMe .*Jan/)).toBeTruthy();
    unmount();
    render(<KassaSessionProvider idleMs={1000}><Probe /></KassaSessionProvider>);
    act(() => { screen.getByText('in').click(); });
    act(() => { screen.getByText('wissel').click(); });
    expect(await screen.findByText('kassa.pin.whoAreYou')).toBeTruthy();
    vi.useRealTimers();
  });
});

// KASSA-MOBIEL-1: de kassa praat via haar eigen client; in de test dezelfde nep-client.
vi.mock('@/kassa/app/kassaSupabase', async () => ({ kassaSupabase: (await import('@/integrations/supabase/client')).supabase, KASSA_AUTH_STORAGE_KEY: 'sb-sellqo-kassa-auth', defaultAuthStorageKey: () => 'sb-test-auth-token' }));

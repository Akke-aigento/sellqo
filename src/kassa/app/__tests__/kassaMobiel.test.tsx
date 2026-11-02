// KASSA-MOBIEL-1 — eigen kassa-aanmelding naast beheer: eenmalige verhuis van een bestaande toestelsessie,
// nooit een eigenaar-sessie, één-tik-koppelen met de beheer-sessie, terugknop naar beheer.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import i18n from '@/i18n';
import { isDeviceSessionJson, migrateLegacyDeviceSession, type MinimalStorage } from '../legacySession';

const beheerSignOut = vi.fn(async () => ({ error: null }));
const beheerRpc = vi.fn();
const kassaInvoke = vi.fn();
const kassaSignIn = vi.fn(async () => ({ data: {}, error: null }));
const kassaGetSession = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => beheerSignOut(...(a as [])) }, rpc: (...a: unknown[]) => beheerRpc(...a), from: () => ({}) },
}));
vi.mock('@/kassa/app/kassaSupabase', () => ({
  KASSA_AUTH_STORAGE_KEY: 'sb-sellqo-kassa-auth',
  defaultAuthStorageKey: () => 'sb-test-auth-token',
  kassaSupabase: {
    auth: {
      getSession: (...a: unknown[]) => kassaGetSession(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: (...a: unknown[]) => kassaSignIn(...(a as [])),
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: (...a: unknown[]) => kassaInvoke(...a) },
    rpc: async () => ({ data: null, error: null }),
  },
}));

const session = (kind?: string) => JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: kind ? 'dev-1' : 'owner-1', app_metadata: kind ? { kind } : { provider: 'email' } } });

function memStorage(init: Record<string, string> = {}): MinimalStorage & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}
const keys = { defaultKey: 'sb-test-auth-token', kassaKey: 'sb-sellqo-kassa-auth' };

describe('verhuis van een bestaande toestelsessie', () => {
  it('toestelsessie in de standaardsleutel → één keer naar de kassa-sleutel, standaardsleutel leeg', async () => {
    const st = memStorage({ [keys.defaultKey]: session('kassa') });
    const locks: string[] = [];
    const r = await migrateLegacyDeviceSession({ storage: st, ...keys, lock: async (name, fn) => { locks.push(name); return fn(); } });
    expect(r).toBe('moved');
    expect(st.data[keys.kassaKey]).toBe(session('kassa'));
    expect(st.data[keys.defaultKey]).toBeUndefined();
    // Onder het lock van de beheer-client (supabase-js gebruikt "lock:<storageKey>").
    expect(locks).toEqual(['lock:sb-test-auth-token']);
    // Tweede keer: niets meer te doen.
    expect(await migrateLegacyDeviceSession({ storage: st, ...keys })).toBe('kassa-present');
  });

  it('een eigenaar-sessie wordt nooit verhuisd', async () => {
    const st = memStorage({ [keys.defaultKey]: session() });
    expect(await migrateLegacyDeviceSession({ storage: st, ...keys })).toBe('not-device');
    expect(st.data[keys.defaultKey]).toBe(session());
    expect(st.data[keys.kassaKey]).toBeUndefined();
  });

  it('staat er al een kassa-sessie, dan blijft de standaardsleutel ongemoeid', async () => {
    const st = memStorage({ [keys.defaultKey]: session('kassa'), [keys.kassaKey]: 'bestaand' });
    expect(await migrateLegacyDeviceSession({ storage: st, ...keys })).toBe('kassa-present');
    expect(st.data[keys.defaultKey]).toBe(session('kassa'));
    expect(st.data[keys.kassaKey]).toBe('bestaand');
  });

  it('herleest onder het lock: intussen een eigenaar aangemeld = niet verhuizen', async () => {
    const st = memStorage({ [keys.defaultKey]: session('kassa') });
    const r = await migrateLegacyDeviceSession({ storage: st, ...keys, lock: async (_n, fn) => { st.data[keys.defaultKey] = session(); return fn(); } });
    expect(r).toBe('not-device');
    expect(st.data[keys.kassaKey]).toBeUndefined();
  });

  it('wissen lukt niet → ook de kopie weg (nooit dezelfde sessie op twee plekken)', async () => {
    const st = memStorage({ [keys.defaultKey]: session('kassa') });
    st.removeItem = (k) => { if (k === keys.defaultKey) throw new Error('quota'); delete st.data[k]; };
    expect(await migrateLegacyDeviceSession({ storage: st, ...keys })).toBe('none');
    expect(st.data[keys.kassaKey]).toBeUndefined();
  });

  it('isDeviceSessionJson: enkel app_metadata.kind = kassa', () => {
    expect(isDeviceSessionJson(session('kassa'))).toBe(true);
    expect(isDeviceSessionJson(session())).toBe(false);
    expect(isDeviceSessionJson('{kapot')).toBe(false);
    expect(isDeviceSessionJson(null)).toBe(false);
  });
});

describe('moveLegacySessionOnce (opstart van de kassa)', () => {
  beforeEach(() => { localStorage.clear(); beheerSignOut.mockClear(); });
  it('verhuist en ruimt de beheer-staat lokaal op (scope local, na het wissen: geen serveraanroep)', async () => {
    localStorage.setItem('sb-test-auth-token', session('kassa'));
    const { moveLegacySessionOnce } = await import('../legacySession');
    expect(await moveLegacySessionOnce()).toBe(true);
    expect(localStorage.getItem('sb-sellqo-kassa-auth')).toBe(session('kassa'));
    expect(localStorage.getItem('sb-test-auth-token')).toBeNull();
    expect(beheerSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('eigenaar in beheer: niets verhuisd, beheer niet afgemeld', async () => {
    localStorage.setItem('sb-test-auth-token', session());
    const { moveLegacySessionOnce } = await import('../legacySession');
    expect(await moveLegacySessionOnce()).toBe(false);
    expect(localStorage.getItem('sb-test-auth-token')).toBe(session());
    expect(beheerSignOut).not.toHaveBeenCalled();
  });
});

describe('één-tik-koppelen met de beheer-sessie', () => {
  beforeEach(() => { beheerRpc.mockReset(); kassaInvoke.mockReset(); kassaSignIn.mockClear(); });
  it('beheer-client maakt de code, kassa-client ruilt het token in en meldt het toestel aan', async () => {
    const token = 'ab'.repeat(32);
    beheerRpc.mockResolvedValue({ data: { code: '482913', token, expires_at: '2026-11-02T12:00:00Z' }, error: null });
    kassaInvoke.mockResolvedValue({ data: { email: 'kassa-x@toestel.sellqo.app', password: 'p' }, error: null });
    const { pairWithAdminSession } = await import('../deviceAccount');
    expect(await pairWithAdminSession('tn', 't1', '99999999-9999-4999-8999-999999999999')).toEqual({ ok: true });
    expect(beheerRpc).toHaveBeenCalledWith('kassa_pair_code_create', { p_tenant_id: 'tn', p_terminal_id: 't1' });
    expect(kassaInvoke).toHaveBeenCalledWith('kassa-device-pair', { body: { code: token, device_uuid: '99999999-9999-4999-8999-999999999999' } });
    expect(kassaSignIn).toHaveBeenCalledWith({ email: 'kassa-x@toestel.sellqo.app', password: 'p' });
  });
  it('geen zaakvoerder → not_allowed, niets ingeruild', async () => {
    beheerRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'geen toegang' } });
    const { pairWithAdminSession } = await import('../deviceAccount');
    expect(await pairWithAdminSession('tn', 't1', '99999999-9999-4999-8999-999999999999')).toEqual({ ok: false, error: 'not_allowed' });
    expect(kassaInvoke).not.toHaveBeenCalled();
  });
});

describe('schermen', () => {
  beforeAll(async () => { await i18n.changeLanguage('nl'); });
  it('NotADevice: terugknop naar beheer enkel als er beheer is; geen variant owner meer', async () => {
    const { NotADevice } = await import('../screens/NotADevice');
    const { unmount } = render(<NotADevice variant="revoked" hasAdmin onSignOut={() => {}} />);
    expect(screen.getByRole('link', { name: 'Terug naar beheer' })).toHaveAttribute('href', '/admin');
    unmount();
    render(<NotADevice variant="error" hasAdmin={false} onSignOut={() => {}} onRetry={() => {}} />);
    expect(screen.queryByRole('link', { name: 'Terug naar beheer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Opnieuw koppelen' })).toBeInTheDocument();
  });

  it('PairDevice zonder beheer-sessie: geen één-tik-knop; met hasAdmin wel de terugknop', async () => {
    const { PairDevice } = await import('../screens/PairDevice');
    render(<PairDevice hasAdmin />);
    expect(screen.getByRole('link', { name: 'Terug naar beheer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dit toestel nu koppelen' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Koppelcode'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Koppelen' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

// KASSA-MOBIEL-1 — pushtoken bewaren: via device_token_claim, terugval op de upsert zolang de RPC niet live is,
// en elke fout met een reden (nooit meer stil "Het lukte niet").
import { describe, it, expect, vi } from 'vitest';
import { errorDetail, saveDeviceToken } from './pushTokens';
import type { Db } from './supabaseScope';

function db(rpc: { data?: unknown; error?: unknown }, upsert: { error?: unknown } = {}) {
  const calls: { rpc: unknown[]; upsert: unknown[] } = { rpc: [], upsert: [] };
  const client = {
    rpc: vi.fn(async (...a: unknown[]) => { calls.rpc.push(a); if (rpc.error instanceof Error) throw rpc.error; return { data: rpc.data ?? null, error: rpc.error ?? null }; }),
    from: () => ({ upsert: async (...a: unknown[]) => { calls.upsert.push(a); return { error: upsert.error ?? null }; } }),
  } as unknown as Db;
  return { client, calls };
}
const row = { token: 'https://web.push.apple.com/abc', platform: 'web' as const, os: 'ios', p256dh: 'P', auth: 'A', install_id: 'i1', device_name: 'iPhone' };

describe('saveDeviceToken', () => {
  it('RPC met alle velden; overgezet = ok', async () => {
    const { client, calls } = db({ data: { status: 'transferred' } });
    expect(await saveDeviceToken(client, 'u1', row)).toEqual({ ok: true, status: 'transferred' });
    expect(calls.rpc[0]).toEqual(['device_token_claim', { p_token: row.token, p_platform: 'web', p_os: 'ios', p_device_name: 'iPhone', p_install_id: 'i1', p_p256dh: 'P', p_auth: 'A' }]);
    expect(calls.upsert).toHaveLength(0);
  });
  it('token van een andere account zonder bewijs → owned_elsewhere met de technische melding', async () => {
    const { client } = db({ error: { code: '42501', message: 'token_owned_elsewhere' } });
    expect(await saveDeviceToken(client, 'u1', row)).toEqual({ ok: false, reason: 'owned_elsewhere', detail: '42501 token_owned_elsewhere' });
  });
  it('RPC bestaat nog niet (PGRST202) → oude upsert; die botst op RLS (de oorspronkelijke fout) → owned_elsewhere', async () => {
    const { client, calls } = db({ error: { code: 'PGRST202', message: 'not found' } }, { error: { code: '42501', message: 'new row violates row-level security policy (USING expression) for table "device_tokens"' } });
    const r = await saveDeviceToken(client, 'u1', row);
    expect(calls.upsert).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, reason: 'owned_elsewhere' });
  });
  it('RPC bestaat nog niet en de upsert lukt → ok', async () => {
    const { client } = db({ error: { code: 'PGRST202' } });
    expect(await saveDeviceToken(client, 'u1', row)).toEqual({ ok: true, status: 'upsert' });
  });
  it('netwerk → offline; niet aangemeld → not_signed_in; andere fout → save', async () => {
    expect(await saveDeviceToken(db({ error: new Error('Failed to fetch') }).client, 'u1', row)).toMatchObject({ ok: false, reason: 'offline' });
    expect(await saveDeviceToken(db({ error: { code: '42501', message: 'niet aangemeld' } }).client, 'u1', row)).toMatchObject({ ok: false, reason: 'not_signed_in' });
    expect(await saveDeviceToken(db({ error: { code: '22023', message: 'web push zonder sleutels' } }).client, 'u1', row)).toEqual({ ok: false, reason: 'save', detail: '22023 web push zonder sleutels' });
  });
  it('errorDetail is kort', () => {
    expect(errorDetail({ code: 'X', message: 'y'.repeat(500) }).length).toBe(300);
    expect(errorDetail(null)).toBe('');
  });
});

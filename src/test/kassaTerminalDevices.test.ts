// KASSA-ACCOUNT-1 — één lijst per kassa: gekoppelde toestellen met hun hartslag, daarna recente oude aanmeldingen.
import { describe, expect, it } from 'vitest';
import { terminalDeviceRows, type KassaDevice, type KassaDeviceAccount } from '@/hooks/useKassaDevices';

const now = Date.parse('2026-11-02T10:00:00Z');
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
const acc = (id: string, uuid: string, terminal = 't1'): KassaDeviceAccount => ({ user_id: id, tenant_id: 'x', terminal_id: terminal, device_uuid: uuid, name: id, paired_at: ago(1) });
const beat = (uuid: string, h: number, terminal = 't1'): KassaDevice => ({ device_id: uuid, terminal_id: terminal, sw_version: null, fiscal_mode: null, queue_count: 0, outbox_count: 0, pending_pays: 0, online: true, last_seen_at: ago(h) });

describe('terminalDeviceRows', () => {
  it('koppelt hartslag aan het toestel op device_uuid; gekoppelde eerst', () => {
    const rows = terminalDeviceRows('t1', [acc('a', 'u1')], [beat('old', 2), beat('u1', 0.1)], now);
    expect(rows.map((r) => [r.account?.user_id ?? null, r.beat?.device_id ?? null])).toEqual([['a', 'u1'], [null, 'old']]);
  });
  it('oude aanmelding ouder dan 7 dagen, andere kassa of al gekoppeld elders: niet tonen', () => {
    const rows = terminalDeviceRows('t1', [acc('b', 'u2', 't2')], [beat('stale', 24 * 8), beat('other', 1, 't2'), beat('u2', 1)], now);
    expect(rows).toEqual([]);
  });
  it('gekoppeld zonder hartslag (nog nooit gestart) blijft zichtbaar', () => {
    expect(terminalDeviceRows('t1', [acc('c', 'u3')], [], now)).toHaveLength(1);
  });
});

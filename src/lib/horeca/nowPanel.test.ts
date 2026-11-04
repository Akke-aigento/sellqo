// HORECA-NU-1 — pure regels van het Nu-paneel.
import { describe, expect, it } from 'vitest';
import { activeUntil, closedToday, fetchActiveDailySpecials, localYmd, onMenuChannel, pauseEffectKey, pauseTileVisible, specialEligible, withMenuChannels, zoneTiles, type SpecialsClient } from './nowPanel';
import { CHANNELS } from '@/components/admin/storefront/food/ProductChannelsCard';

describe('localYmd', () => {
  it('rekent in de tijdzone van de zaak (23:30 UTC op 4 nov = 5 nov in Brussel)', () => {
    const ms = Date.UTC(2026, 10, 4, 23, 30);
    expect(localYmd(ms, 'Europe/Brussels')).toBe('2026-11-05');
    expect(localYmd(ms, 'Europe/London')).toBe('2026-11-04');
  });
  it('onbekende of lege zone = Brussel', () => {
    const ms = Date.UTC(2026, 10, 4, 23, 30);
    expect(localYmd(ms, 'Mars/Olympus')).toBe('2026-11-05');
    expect(localYmd(ms, null)).toBe('2026-11-05');
  });
});

describe('closedToday', () => {
  const today = '2026-11-04';
  it('één dag van vandaag: dicht en weg te halen', () => {
    expect(closedToday([{ from: today, to: today, reason: 'Personeel ziek' }], today)).toEqual({ closed: true, single: true, period: false, reason: 'Personeel ziek' });
  });
  it('een periode rond vandaag: dicht, maar niet via het paneel te openen', () => {
    expect(closedToday([{ from: '2026-11-01', to: '2026-11-08', reason: 'Verlof' }], today)).toMatchObject({ closed: true, single: false, period: true });
  });
  it('enkel voorbije of komende sluitingen, of rommel: open', () => {
    expect(closedToday([{ from: '2026-11-01', to: '2026-11-03' }, { from: '2026-11-05', to: '2026-11-05' }, null, 'x', { from: 1 }], today).closed).toBe(false);
    expect(closedToday(null, today).closed).toBe(false);
  });
});

describe('tegels', () => {
  it('zones pas vanaf twee actieve ruimtes', () => {
    expect(zoneTiles([{ id: 'a', is_active: true }])).toEqual([]);
    expect(zoneTiles([{ id: 'a', is_active: true }, { id: 'b', is_active: false }])).toEqual([]);
    expect(zoneTiles([{ id: 'a', is_active: true }, { id: 'b', is_active: true }]).map((x) => x.id)).toEqual(['a', 'b']);
    expect(zoneTiles(undefined)).toEqual([]);
  });
  it('pauzeren enkel met online bestellen, of als er al een pauze loopt', () => {
    expect(pauseTileVisible({ onlineOrdering: false, paused: false })).toBe(false);
    expect(pauseTileVisible({ onlineOrdering: true, paused: false })).toBe(true);
    expect(pauseTileVisible({ onlineOrdering: false, paused: true })).toBe(true);
    // HORECA-STAAT-1: ook als er enkel aan tafel besteld wordt (keukengerechten liggen dan stil).
    expect(pauseTileVisible({ onlineOrdering: false, tableOrdering: true, paused: false })).toBe(true);
    expect(pauseTileVisible({ onlineOrdering: false, tableOrdering: false, paused: false })).toBe(false);
  });
  it('pauseEffectKey: zegt wat er echt stilligt (zelfde regel als storefront-api)', () => {
    expect(pauseEffectKey({ online: true, table: true, kitchenSplit: true })).toBe('effect_online_kitchen');
    expect(pauseEffectKey({ online: true, table: true, kitchenSplit: false })).toBe('effect_online_table');
    expect(pauseEffectKey({ online: true, table: false, kitchenSplit: true })).toBe('effect_online');
    expect(pauseEffectKey({ online: false, table: true, kitchenSplit: true })).toBe('effect_kitchen');
    expect(pauseEffectKey({ online: false, table: true, kitchenSplit: false })).toBe('effect_table');
    expect(pauseEffectKey({ online: false, table: false, kitchenSplit: false })).toBe('effect_online');
  });
  it('activeUntil: enkel een moment in de toekomst', () => {
    const now = Date.UTC(2026, 10, 4, 12);
    expect(activeUntil('2026-11-05T04:00:00Z', now)).toBe(true);
    expect(activeUntil('2026-11-04T04:00:00Z', now)).toBe(false);
    expect(activeUntil(null, now)).toBe(false);
  });
});

describe('fetchActiveDailySpecials (HORECA-NU-1b)', () => {
  const NOW = Date.UTC(2026, 10, 4, 12, 0);
  // Nep-builder die de filters echt toepast, zoals PostgREST: 60 vervallen dagschotels + 1 actieve.
  function fakeClient(rows: { id: string; tenant_id: string; daily_special_until: string | null }[], error: { code?: string; message: string } | null = null) {
    const calls: [string, ...unknown[]][] = [];
    const client: SpecialsClient = {
      from(table) {
        calls.push(['from', table]);
        return {
          select(cols) {
            calls.push(['select', cols]);
            let out = [...rows];
            let lim = Infinity;
            const q = {
              eq(c: string, v: unknown) { calls.push(['eq', c, v]); out = out.filter((r) => (r as Record<string, unknown>)[c] === v); return q; },
              gt(c: string, v: unknown) { calls.push(['gt', c, v]); out = out.filter((r) => { const x = (r as Record<string, unknown>)[c]; return x != null && String(x) > String(v); }); return q; },
              order(c: string) { calls.push(['order', c]); out.sort((a, b) => String(a.daily_special_until).localeCompare(String(b.daily_special_until))); return q; },
              limit(n: number) { calls.push(['limit', n]); lim = n; return q; },
              then(res: (v: { data: unknown; error: typeof error }) => unknown) { return Promise.resolve(res(error ? { data: null, error } : { data: out.slice(0, lim), error: null })); },
            };
            return q as never;
          },
        };
      },
    };
    return { client, calls };
  }
  const old = Array.from({ length: 60 }, (_, i) => ({ id: `old-${i}`, tenant_id: 't1', daily_special_until: new Date(NOW - (i + 1) * 86_400_000).toISOString() }));

  it('filtert in de databank op daily_special_until > nu: vervallen dagschotels duwen de actieve niet uit de limiet', async () => {
    const { client, calls } = fakeClient([...old, { id: 'nu', tenant_id: 't1', daily_special_until: new Date(NOW + 3_600_000).toISOString() }, { id: 'ander', tenant_id: 't2', daily_special_until: new Date(NOW + 3_600_000).toISOString() }]);
    const r = await fetchActiveDailySpecials(client, 't1', NOW);
    expect(r).toEqual([{ id: 'nu', until: new Date(NOW + 3_600_000).toISOString() }]);
    expect(calls).toContainEqual(['gt', 'daily_special_until', new Date(NOW).toISOString()]);
    expect(calls).toContainEqual(['eq', 'tenant_id', 't1']);
  });

  it('kolom bestaat nog niet → null (geen tegel); andere fout → gooit', async () => {
    expect(await fetchActiveDailySpecials(fakeClient([], { code: '42703', message: 'x' }).client, 't1', NOW)).toBeNull();
    await expect(fetchActiveDailySpecials(fakeClient([], { code: '57014', message: 'timeout' }).client, 't1', NOW)).rejects.toBeTruthy();
  });
});

describe('dagschotel enkel op menu of aan tafel (HORECA-NU-1b)', () => {
  it('onMenuChannel volgt storefront-api channelAllows(p, menu): menu of table; geen lijst = alles', () => {
    expect(onMenuChannel(['menu'])).toBe(true);
    expect(onMenuChannel(['table'])).toBe(true);
    expect(onMenuChannel(['online', 'pos'])).toBe(false);
    expect(onMenuChannel([])).toBe(false);
    expect(onMenuChannel(null)).toBe(true);
  });
  it('specialEligible: actief, niet verborgen en op het menu', () => {
    expect(specialEligible({ is_active: true, hide_from_storefront: false, channels: ['online', 'table', 'menu', 'pos'] })).toBe(true);
    expect(specialEligible({ is_active: false, channels: ['menu'] })).toBe(false);
    expect(specialEligible({ is_active: true, hide_from_storefront: true, channels: ['menu'] })).toBe(false);
    expect(specialEligible({ is_active: true, channels: ['pos'] })).toBe(false);
    expect(specialEligible({ is_active: true, channels: ['online'] })).toBe(false);
  });
  it('withMenuChannels: menu en table erbij in de vaste volgorde; al goed of geen lijst = niets doen', () => {
    expect(withMenuChannels(['pos'], CHANNELS)).toEqual(['table', 'menu', 'pos']);
    expect(withMenuChannels(['online', 'menu'], CHANNELS)).toEqual(['online', 'table', 'menu']);
    expect(withMenuChannels(['online', 'table', 'menu', 'pos'], CHANNELS)).toBeNull();
    expect(withMenuChannels(null, CHANNELS)).toBeNull();
  });
});

// HORECA-NU-1 — pure regels van het Nu-paneel.
import { describe, expect, it } from 'vitest';
import { activeUntil, closedToday, localYmd, pauseTileVisible, zoneTiles } from './nowPanel';

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
  });
  it('activeUntil: enkel een moment in de toekomst', () => {
    const now = Date.UTC(2026, 10, 4, 12);
    expect(activeUntil('2026-11-05T04:00:00Z', now)).toBe(true);
    expect(activeUntil('2026-11-04T04:00:00Z', now)).toBe(false);
    expect(activeUntil(null, now)).toBe(false);
  });
});

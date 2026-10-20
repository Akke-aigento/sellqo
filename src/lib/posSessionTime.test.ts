import { describe, it, expect } from 'vitest';
import { enUS, nl } from 'date-fns/locale';
import { formatSessionOpenedAt, isStaleOpenSession } from './posSessionTime';

const now = new Date(2026, 9, 21, 18, 0);

describe('formatSessionOpenedAt', () => {
  it('vandaag: enkel de tijd', () => {
    const iso = new Date(2026, 9, 21, 16, 23).toISOString();
    expect(formatSessionOpenedAt(iso, enUS, now)).toBe('4:23 PM');
    expect(formatSessionOpenedAt(iso, nl, now)).toBe('16:23');
  });

  it('andere dag: datum + tijd', () => {
    const iso = new Date(2026, 2, 23, 16, 23).toISOString();
    expect(formatSessionOpenedAt(iso, enUS, now)).toBe('Mar 23, 2026 4:23 PM');
    expect(formatSessionOpenedAt(iso, nl, now)).toBe('23 mrt. 2026 16:23');
  });

  it('ongeldige datum geeft lege string', () => {
    expect(formatSessionOpenedAt('nope', nl, now)).toBe('');
  });
});

describe('isStaleOpenSession', () => {
  const at = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  it('open en ouder dan 24 u', () => {
    expect(isStaleOpenSession({ status: 'open', opened_at: at(25) }, now)).toBe(true);
  });

  it('open maar jonger dan 24 u (ook als het gisteren was)', () => {
    expect(isStaleOpenSession({ status: 'open', opened_at: at(20) }, now)).toBe(false);
  });

  it('gesloten sessies zijn nooit stale', () => {
    expect(isStaleOpenSession({ status: 'closed', opened_at: at(500) }, now)).toBe(false);
  });
});

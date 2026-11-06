// HORECA-INSTELLINGEN-1 — het zoekregister: elk pad leidt naar een bestaande route/sectie/tab, elk label en
// elk synoniem bestaat in elke taal, en de voorbeelden uit het plan vinden de juiste plek.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KAART_TABS_HORECA_ONLY, STAFF_TABS, ZAAK_GROUPS } from './mijnZaak';
import { SETTINGS_INDEX, searchSettings, settingsIndexFor, type ResolvedEntry } from './settingsIndex';
import type { Track } from './tracks';

const app = readFileSync('src/App.tsx', 'utf8');
const adminRoutes = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]));
const locales = readdirSync('src/i18n/locales').filter((f) => /^[a-z]{2}\.json$/.test(f));
const dict = (f: string) => JSON.parse(readFileSync(`src/i18n/locales/${f}`, 'utf8')) as Record<string, unknown>;
const lookup = (d: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), d);

describe('zoekregister', () => {
  it('elk pad leidt naar een bestaande route, groep en tab', () => {
    for (const e of SETTINGS_INDEX) {
      const url = new URL(e.path, 'https://x');
      const route = url.pathname.replace(/^\/admin\/?/, '');
      // '' = /admin zelf (Vandaag, met het Nu-paneel): de index-route van het dashboard.
      expect(adminRoutes.has(route) || route === 'settings' || route === '', `${e.id}: route ${url.pathname}`).toBe(true);
      const tab = url.searchParams.get('tab');
      if (url.pathname === '/admin/settings') {
        const g = ZAAK_GROUPS.find((x) => x.id === url.searchParams.get('section'));
        expect(g, `${e.id}: section`).toBeTruthy();
        expect(g!.tabs.some((x) => x.id === tab), `${e.id}: tab ${tab}`).toBe(true);
      } else if (url.pathname === '/admin/personeel') {
        expect(tab === null || STAFF_TABS.some((x) => x.id === tab), `${e.id}: tab`).toBe(true);
      } else if (url.pathname === '/admin/bestellen') {
        expect((KAART_TABS_HORECA_ONLY as readonly string[]).includes(tab ?? ''), `${e.id}: tab`).toBe(true);
      }
    }
  });

  it('dekt elke tab van Mijn zaak en Personeel, zonder dubbele id’s', () => {
    const ids = SETTINGS_INDEX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of ZAAK_GROUPS) for (const t of g.tabs) expect(ids).toContain(`${g.id}.${t.id}`);
    for (const t of STAFF_TABS) expect(ids).toContain(`personeel.${t.id}`);
  });

  it('label, groep en synoniemen bestaan in elke taal', () => {
    for (const f of locales) {
      const d = dict(f);
      for (const e of SETTINGS_INDEX) {
        for (const key of [e.labelKey, e.groupKey, e.synKey]) expect(typeof lookup(d, key), `${f}: ${key}`).toBe('string');
      }
    }
  });

  it('enkel voor horeca-only; webshop, events en combinaties krijgen niets', () => {
    const has = (tracks: Track[]) => (t: Track) => tracks.includes(t);
    expect(settingsIndexFor(has(['horeca']))).toBe(SETTINGS_INDEX);
    expect(settingsIndexFor(has(['webshop']))).toEqual([]);
    expect(settingsIndexFor(has(['events']))).toEqual([]);
    expect(settingsIndexFor(has(['horeca', 'webshop']))).toEqual([]);
  });
});

describe('zoeken (nl)', () => {
  const nl = dict('nl.json');
  const resolved: ResolvedEntry[] = SETTINGS_INDEX.map((e) => ({
    ...e, label: String(lookup(nl, e.labelKey)), group: String(lookup(nl, e.groupKey)),
    synonyms: String(lookup(nl, e.synKey)).split(',').map((x) => x.trim()),
  }));
  const first = (q: string) => searchSettings(resolved, q)[0]?.id;

  it.each([
    ['fooi', 'betalen.fooi'], ['tip', 'betalen.fooi'], ['drinkgeld', 'betalen.fooi'],
    ['printer', 'zaal-keuken.printers'], ['bon', 'zaal-keuken.printers'], ['ticket', 'zaal-keuken.printers'],
    ['pin', 'personeel.pin'], ['medewerker', 'personeel.pin'],
    ['vakantie', 'zaak.uren'], ['feestdag', 'zaak.uren'], ['gesloten', 'zaak.uren'],
    ['terras', 'zaal-keuken.zaalplan'], ['tafel', 'zaal-keuken.zaalplan'],
    ['qr', 'gasten.qr'], ['sticker', 'gasten.qr'],
    ['peppol', 'geld.facturen'], ['btw', 'geld.btw'],
    ['logo', 'zaak.merk'], ['kleur', 'zaak.merk'],
    ['dagschotel', 'nu.dagschotel'], ['uitverkocht', 'nu.uitverkocht'], ['keuken pauzeren', 'nu.keuken'],
    ['vandaag dicht', 'nu.dicht'], ['terras dicht', 'nu.zone'],
    // ZIJBALK-BESTELLINGEN-1: Bestellingen blijft vindbaar als hij niet in de zijbalk staat.
    ['bestellingen', 'bestellingen.lijst'], ['orders', 'bestellingen.lijst'],
  ])('"%s" → %s', (q, id) => {
    expect(first(q)).toBe(id);
  });

  it('1b: "domein" vindt horeca-only niets (eigen domein komt binnenkort); het label heet Website in elke taal', () => {
    expect(searchSettings(resolved, 'domein')).toEqual([]);
    for (const f of locales) {
      expect(String(lookup(dict(f), 'mijnZaak.tabs.website')), f).not.toMatch(/&|domain|domein|domaine|домен/i);
      expect(String(lookup(dict(f), 'settingsSearch.syn.zaak_website')), f).not.toMatch(/domain|domein|domaine|домен/i);
    }
  });

  it('accenten en hoofdletters maken niet uit; niets gevonden = lege lijst', () => {
    expect(first('FOOI')).toBe('betalen.fooi');
    expect(searchSettings(resolved, 'xyzzy')).toEqual([]);
    expect(searchSettings(resolved, '')).toHaveLength(resolved.length);
  });
});

import { describe, expect, it } from 'vitest';
import { groupTenants } from '@/lib/tenantGroups';

// TENANT-SWITCHER-1 / TENANT-INTERNAL-1: Mijn winkels / Klanten / Demo,
// afgeleid uit is_internal_tenant + is_demo.

const t = (id: string, name: string, is_internal_tenant = false, is_demo = false) =>
  ({ id, name, is_internal_tenant, is_demo });

describe('groupTenants', () => {
  it('gewone gebruiker → null (kiezer ongewijzigd)', () => {
    expect(groupTenants([t('a', 'A', true)], false)).toBeNull();
  });

  it('interne vlag → Mijn winkels; de rest → Klanten', () => {
    const groups = groupTenants([t('a', 'Eigen', true), t('b', 'Klant')], true);
    expect(groups).toEqual([
      { key: 'own', tenants: [t('a', 'Eigen', true)] },
      { key: 'clients', tenants: [t('b', 'Klant')] },
    ]);
  });

  it('demo wint, ook als de winkel intern is', () => {
    const groups = groupTenants([t('d', 'Demo', true, true)], true);
    expect(groups).toEqual([{ key: 'demo', tenants: [t('d', 'Demo', true, true)] }]);
  });

  it('ontbrekende vlag telt als klant, niet als eigen winkel', () => {
    const groups = groupTenants([{ id: 'x', name: 'Zonder vlaggen' }], true);
    expect(groups?.map((g) => g.key)).toEqual(['clients']);
  });

  it('alfabetisch binnen een groep, hoofdletterongevoelig; lege groepen weg', () => {
    const groups = groupTenants([t('1', 'zona'), t('2', 'Astra'), t('3', 'benny')], true);
    expect(groups?.map((g) => g.key)).toEqual(['clients']);
    expect(groups?.[0].tenants.map((x) => x.name)).toEqual(['Astra', 'benny', 'zona']);
  });

  it('live-voorbeeld 28-09: 13 winkels → 4 / 5 / 4 in de juiste volgorde', () => {
    // Stand van de database op 28-09: Studio Akke is intern (facturatietenant
    // uit MAIL-BILLING-1), The Fonske Crawl niet.
    const own = ['SellQo', 'VanXcel', 'Loveke', 'Studio Akke'].map((n, i) => t(`o${i}`, n, true));
    const clients = ['Mancini Milano', 'Benny Rich', 'Astra Sleep', 'Zona Dorata', 'The Fonske Crawl']
      .map((n, i) => t(`c${i}`, n));
    const demo = ['Demo Bakkerij', 'Demo Fashion Store', 'SellQo Sandbox', 'SellQo Speeltuin']
      .map((n, i) => t(`d${i}`, n, false, true));
    const groups = groupTenants([...demo, ...clients, ...own], true)!;
    expect(groups.map((g) => [g.key, g.tenants.map((x) => x.name)])).toEqual([
      ['own', ['Loveke', 'SellQo', 'Studio Akke', 'VanXcel']],
      ['clients', ['Astra Sleep', 'Benny Rich', 'Mancini Milano', 'The Fonske Crawl', 'Zona Dorata']],
      ['demo', ['Demo Bakkerij', 'Demo Fashion Store', 'SellQo Sandbox', 'SellQo Speeltuin']],
    ]);
  });
});

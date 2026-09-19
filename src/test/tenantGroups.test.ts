import { describe, expect, it } from 'vitest';
import { groupTenants } from '@/lib/tenantGroups';

// TENANT-SWITCHER-1: Mijn winkels / Klanten / Demo, afgeleid uit user_roles + is_demo.

const t = (id: string, name: string, is_demo = false) => ({ id, name, is_demo });
const platform = { tenant_id: null };

describe('groupTenants', () => {
  it('gewone gebruiker → null (kiezer ongewijzigd)', () => {
    expect(groupTenants([t('a', 'A')], [{ tenant_id: 'a' }], false)).toBeNull();
  });

  it('eigen rol → Mijn winkels; alleen platform → Klanten', () => {
    const groups = groupTenants([t('a', 'Eigen'), t('b', 'Klant')], [platform, { tenant_id: 'a' }], true);
    expect(groups).toEqual([
      { key: 'own', tenants: [t('a', 'Eigen')] },
      { key: 'clients', tenants: [t('b', 'Klant')] },
    ]);
  });

  it('demo wint, ook met een eigen rol', () => {
    const groups = groupTenants([t('d', 'Demo', true)], [platform, { tenant_id: 'd' }], true);
    expect(groups).toEqual([{ key: 'demo', tenants: [t('d', 'Demo', true)] }]);
  });

  it('alfabetisch binnen een groep, hoofdletterongevoelig; lege groepen weg', () => {
    const groups = groupTenants([t('1', 'zona'), t('2', 'Astra'), t('3', 'benny')], [platform], true);
    expect(groups?.map((g) => g.key)).toEqual(['clients']);
    expect(groups?.[0].tenants.map((x) => x.name)).toEqual(['Astra', 'benny', 'zona']);
  });

  it('live-voorbeeld 19-09: 12 winkels → 4 / 4 / 4 in de juiste volgorde', () => {
    const own = ['SellQo', 'VanXcel', 'Loveke', 'The Fonske Crawl'].map((n, i) => t(`o${i}`, n));
    const clients = ['Mancini Milano', 'Benny Rich', 'Astra Sleep', 'Zona Dorata'].map((n, i) => t(`c${i}`, n));
    const demo = ['Demo Bakkerij', 'Demo Fashion Store', 'SellQo Sandbox', 'SellQo Speeltuin'].map((n, i) => t(`d${i}`, n, true));
    const roles = [platform, ...own.map((x) => ({ tenant_id: x.id }))];
    const groups = groupTenants([...demo, ...clients, ...own], roles, true)!;
    expect(groups.map((g) => [g.key, g.tenants.map((x) => x.name)])).toEqual([
      ['own', ['Loveke', 'SellQo', 'The Fonske Crawl', 'VanXcel']],
      ['clients', ['Astra Sleep', 'Benny Rich', 'Mancini Milano', 'Zona Dorata']],
      ['demo', ['Demo Bakkerij', 'Demo Fashion Store', 'SellQo Sandbox', 'SellQo Speeltuin']],
    ]);
  });
});

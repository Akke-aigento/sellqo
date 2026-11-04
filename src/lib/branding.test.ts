// UREN-1c — syncTenantBrand: het logo enkel als het ingevuld is (of na "Logo verwijderen"), en een write die
// geen rij raakt is een fout (HONEST-SAVE-1). brandDiverges: geen logobelofte zonder websitelogo.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { patch: unknown; id: unknown }[] = [];
let result: { data: unknown; error: unknown } = { data: [{ id: 't1' }], error: null };
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      update: (patch: unknown) => ({
        eq: (_c: string, id: unknown) => ({
          select: async () => { calls.push({ patch: { table, ...(patch as object) }, id }); return result; },
        }),
      }),
    }),
  },
}));
vi.mock('i18next', () => ({ default: { t: (k: string) => k } }));

const { syncTenantBrand, brandDiverges } = await import('./branding');

describe('UREN-1c syncTenantBrand', () => {
  beforeEach(() => { calls.length = 0; result = { data: [{ id: 't1' }], error: null }; });
  it('logo en kleur ingevuld → beide naar tenants', async () => {
    await syncTenantBrand('t1', { logo_url: 'https://x/logo.png', brand_color: '#2f5d46' });
    expect(calls).toEqual([{ patch: { table: 'tenants', logo_url: 'https://x/logo.png', primary_color: '#2f5d46' }, id: 't1' }]);
  });
  it('leeg formulierlogo zonder "Logo verwijderen" → tenants.logo_url blijft onaangeroerd', async () => {
    await syncTenantBrand('t1', { logo_url: null, brand_color: '#2f5d46' });
    await syncTenantBrand('t1', { logo_url: '', brand_color: '#2f5d46' });
    expect(calls.map((c) => c.patch)).toEqual([{ table: 'tenants', primary_color: '#2f5d46' }, { table: 'tenants', primary_color: '#2f5d46' }]);
  });
  it('enkel een leeg logo en geen kleur → geen write', async () => {
    await syncTenantBrand('t1', { logo_url: null });
    expect(calls).toHaveLength(0);
  });
  it('"Logo verwijderen" → op beide plekken weg', async () => {
    await syncTenantBrand('t1', { logo_url: null, clear_logo: true });
    expect(calls.map((c) => c.patch)).toEqual([{ table: 'tenants', logo_url: null }]);
  });
  it('0 rijen (RLS) → fout, geen stil "opgeslagen"', async () => {
    result = { data: [], error: null };
    await expect(syncTenantBrand('t1', { brand_color: '#2f5d46' })).rejects.toThrow('common.saveNoPermission');
  });
  it('databankfout → fout', async () => {
    result = { data: null, error: { message: 'boem' } };
    await expect(syncTenantBrand('t1', { brand_color: '#2f5d46' })).rejects.toEqual({ message: 'boem' });
  });
});

describe('UREN-1c brandDiverges', () => {
  it('geen websitelogo maar wel een factuurlogo → geen logomelding (bewaren wist het niet)', () => {
    expect(brandDiverges({ logo_url: null, brand_color: '#2f5d46' }, { logo_url: 'b', primary_color: '#2f5d46' })).toEqual({ logo: false, color: false });
  });
});

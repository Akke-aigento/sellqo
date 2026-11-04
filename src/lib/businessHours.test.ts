// UREN-1 / WEBSITE-HORECA-1 — openingsuren (beheer), secties per spoor en de prijsregel voor horeca.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { cleanHours, crossesMidnight, groupWeek, parseClosures, parseWeek, resolveHoursMode, todayYmd, validateHours, validRange, type BusinessHours } from './businessHours';
import { canAddSection, isHorecaOnly } from './siteSections';
import { planLines } from './planLines';
import type { PricingPlan } from '@/types/billing';
import type { Track } from './tracks';

const H = (over: Partial<BusinessHours> = {}): BusinessHours => ({ week: {}, closures: [], timezone: 'Europe/Brussels', ...over });

describe('openingsuren: blokken', () => {
  it('geldig blok, over middernacht mag, gelijk niet', () => {
    expect(validRange(['11:30', '14:00'])).toBe(true);
    expect(validRange(['20:00', '02:00'])).toBe(true);
    expect(crossesMidnight(['20:00', '02:00'])).toBe(true);
    expect(crossesMidnight(['11:30', '14:00'])).toBe(false);
    expect(validRange(['10:00', '10:00'])).toBe(false);
    expect(validRange(['9:00', '10:00'])).toBe(false);
    expect(validRange(['24:00', '10:00'])).toBe(false);
  });

  it('validateHours volgt de databankregels', () => {
    expect(validateHours(H({ week: { 1: [['11:30', '14:00'], ['17:30', '22:00']] } }))).toBeNull();
    expect(validateHours(H({ week: { 1: [['10:00', '10:00']] } }))).toBe('range');
    expect(validateHours(H({ week: { 1: [['08:00', '09:00'], ['10:00', '11:00'], ['12:00', '13:00'], ['14:00', '15:00']] } }))).toBe('too_many');
    expect(validateHours(H({ closures: [{ from: '2026-12-26', to: '2026-12-24', reason: null }] }))).toBe('closure_order');
    expect(validateHours(H({ closures: [{ from: '2026-12-24', to: '2026-12-24', reason: 'x'.repeat(81) }] }))).toBe('closure_reason');
    expect(validateHours(H({ closures: [{ from: '24/12', to: '2026-12-24', reason: null }] }))).toBe('closure_dates');
  });

  it('cleanHours: lege dagen en voorbije sluitingen weg, reden getrimd, gesorteerd', () => {
    const c = cleanHours(H({
      week: { 1: [['11:30', '14:00']], 2: [], 0: [['10:00', '10:00']] },
      closures: [{ from: '2026-12-24', to: '2026-12-26', reason: '  Kerst ' }, { from: '2026-10-01', to: '2026-10-02', reason: null }, { from: '2026-11-11', to: '2026-11-11', reason: ' ' }],
    }), '2026-11-04');
    expect(c.week).toEqual({ 1: [['11:30', '14:00']] });
    expect(c.closures).toEqual([{ from: '2026-11-11', to: '2026-11-11', reason: null }, { from: '2026-12-24', to: '2026-12-26', reason: 'Kerst' }]);
  });

  it('parse: rommel uit de databank valt weg', () => {
    expect(parseWeek({ 1: [['11:00', '12:00'], 'x'], 8: [['1', '2']], 2: 'nee' })).toEqual({ 1: [['11:00', '12:00']] });
    expect(parseClosures([{ from: '2026-12-24', to: '2026-12-24' }, { from: 'x', to: 'y' }])).toEqual([{ from: '2026-12-24', to: '2026-12-24', reason: null }]);
  });

  it('groupWeek: maandag eerst, gelijke opeenvolgende dagen samen, gesloten apart', () => {
    const w = { 1: [['11:30', '22:00']], 2: [['11:30', '22:00']], 3: [['11:30', '22:00']], 4: [['11:30', '22:00']], 5: [['11:30', '23:00']], 6: [['11:30', '23:00']] } as BusinessHours['week'];
    expect(groupWeek(w)).toEqual([
      { days: ['1', '2', '3', '4'], ranges: [['11:30', '22:00']] },
      { days: ['5', '6'], ranges: [['11:30', '23:00']] },
      { days: ['0'], ranges: [] },
    ]);
  });

  it('todayYmd rekent in de tijdzone van de zaak', () => {
    // 3 nov 2026 23:30 UTC = 4 nov 00:30 in Brussel.
    expect(todayYmd('Europe/Brussels', new Date(Date.UTC(2026, 10, 3, 23, 30)))).toBe('2026-11-04');
  });
});

describe('zelfde als openingsuren of eigen uren', () => {
  it('een keuze wint; zonder keuze: eigen uren ingevuld → eigen, anders zelfde als', () => {
    expect(resolveHoursMode('own', {})).toBe('own');
    expect(resolveHoursMode('business', { 1: [['17:00', '22:00']] })).toBe('business');
    expect(resolveHoursMode(null, { 1: [['17:00', '22:00']] })).toBe('own');
    expect(resolveHoursMode(null, { 1: [] })).toBe('business');
    expect(resolveHoursMode(undefined, undefined)).toBe('business');
  });
});

describe('WEBSITE-HORECA-1: secties per spoor', () => {
  const has = (...t: Track[]) => (x: Track) => t.includes(x);
  it('horeca zonder webshop/events: geen agenda, nieuwsbrief of winkelreviews', () => {
    expect(isHorecaOnly(has('horeca'))).toBe(true);
    for (const s of ['event_agenda', 'newsletter', 'external_reviews']) expect(canAddSection(s, has('horeca'))).toBe(false);
    for (const s of ['hero', 'menu_card', 'contact_hours', 'featured_products', 'faq', 'text_image']) expect(canAddSection(s, has('horeca'))).toBe(true);
  });
  it('andere zaken: alles zoals voorheen', () => {
    for (const tr of [has('webshop'), has('events'), has('horeca', 'webshop'), has('horeca', 'events')]) {
      expect(isHorecaOnly(tr)).toBe(false);
      for (const s of ['event_agenda', 'newsletter', 'external_reviews']) expect(canAddSection(s, tr)).toBe(true);
    }
  });
});

describe('WEBSITE-HORECA-1: prijzenpagina', () => {
  const t = ((k: string) => k) as never;
  const plan = (track: 'webshop' | 'horeca' | 'events') => ({ limit_products: null, limit_users: null, limit_orders: null, track, features: { webshop_builder: true }, ai_credits_monthly: 0 } as unknown as PricingPlan);
  it('horecaplan: "eigen website" in plaats van "webshop"', () => {
    const l = planLines(plan('horeca'), t, 'nl').lines;
    expect(l).toContain('landing.pricing.feat_site');
    expect(l).not.toContain('landing.pricing.feat_webshop');
  });
  it('webshop- en eventsplannen: ongewijzigd', () => {
    for (const tr of ['webshop', 'events'] as const) {
      const l = planLines(plan(tr), t, 'nl').lines;
      expect(l).toContain('landing.pricing.feat_webshop');
      expect(l).not.toContain('landing.pricing.feat_site');
    }
  });
});

describe('UREN-1b: één bron voor logo en merkkleur', async () => {
  const { brandDiverges } = await import('./branding');
  it('gelijk = geen melding; ander logo of andere kleur = melding', () => {
    expect(brandDiverges({ logo_url: 'a', brand_color: '#B3261E' }, { logo_url: 'a', primary_color: '#b3261e' })).toEqual({ logo: false, color: false });
    expect(brandDiverges({ logo_url: 'a', brand_color: '#f97316' }, { logo_url: 'b', primary_color: '#3b82f6' })).toEqual({ logo: true, color: true });
    expect(brandDiverges({ logo_url: 'a', brand_color: null }, { logo_url: null, primary_color: '#3b82f6' })).toEqual({ logo: true, color: false });
  });
});

describe('UREN-1b: themagalerij en horecathema', async () => {
  const { isHorecaPreset } = await import('@/hooks/useThemeSchema');
  const schema = { presets: [{ id: 'bar', vocabulary: 'horeca' }, { id: 'standaard' }] } as never;
  it('horeca enkel als het thema het zegt; onbekend schema = nooit een valse tip', () => {
    expect(isHorecaPreset(schema, 'bar')).toBe(true);
    expect(isHorecaPreset(schema, 'standaard')).toBe(false);
    expect(isHorecaPreset(undefined, 'bar')).toBe(false);
  });
});

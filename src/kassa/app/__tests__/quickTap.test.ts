import { describe, expect, it } from 'vitest';
import { adminHref, draftCountWith, draftCounts, isQuickChoice, itemCount, lineEditKind, planMinus, planMinusWith, planTap, popularIds } from '../horeca/quickTap';
import type { CheckLine } from '../horeca/types';

const line = (p: Partial<CheckLine> & { id: string; seq: number }): CheckLine => ({
  product_id: 'pils', variant_id: null, name: 'Pils', department_id: 'd', department_name: 'D', vat_label: 'A', vat_rate: 21,
  unit_price_cents: 280, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'draft', round_id: null, neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...p,
});

describe('KASSA-UX-1 sneltikken', () => {
  it('telt een tweede tik op dezelfde ontwerp-lijn op', () => {
    expect(planTap({ lines: [line({ id: 'a', seq: 1, qty: 2 })] }, 'pils')).toEqual({ kind: 'qty', lineId: 'a', qty: 3 });
  });
  it('maakt een nieuwe lijn bij extra’s, een opmerking, een verstuurde lijn of een ander product', () => {
    expect(planTap({ lines: [line({ id: 'a', seq: 1 })] }, 'pils', ['25cl'])).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, note: 'zonder schuim' })] }, 'pils')).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, state: 'sent' })] }, 'pils')).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, product_id: 'cola' })] }, 'pils')).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, addons: [{ option_id: 'o', name: 'citroen', price_cents: 0 }] })] }, 'pils')).toEqual({ kind: 'add' });
    expect(planTap(undefined, 'pils')).toEqual({ kind: 'add' });
  });
  it('KASSA-UX-3: zelfde maat telt op dezelfde lijn op, een andere maat krijgt een eigen lijn', () => {
    const lines = [line({ id: 'a', seq: 1, qty: 2, addons: [{ option_id: '25cl', name: '25 cl', price_cents: 0 }] })];
    expect(planTap({ lines }, 'pils', ['25cl'])).toEqual({ kind: 'qty', lineId: 'a', qty: 3 });
    expect(planTap({ lines }, 'pils', ['50cl'])).toEqual({ kind: 'add' });
    expect(draftCountWith({ lines }, 'pils', ['25cl'])).toBe(2);
    expect(draftCountWith({ lines }, 'pils', ['50cl'])).toBe(0);
    expect(isQuickChoice([{ min: 1, max: 1, options: [1, 2, 3] }])).toBe(true);
    expect(isQuickChoice([{ min: 0, max: 2, options: [1] }])).toBe(false);
    expect(isQuickChoice([{ min: 1, max: 1, options: [1] }, { min: 0, max: 1, options: [1] }])).toBe(false);
  });
  it('"−" vermindert de laatste ontwerp-lijn en raakt nooit verstuurde lijnen', () => {
    const lines = [line({ id: 'a', seq: 1, state: 'sent', qty: 4 }), line({ id: 'b', seq: 2, qty: 2 })];
    expect(planMinus({ lines }, 'pils')).toEqual({ lineId: 'b', qty: 1 });
    expect(planMinus({ lines: [line({ id: 'a', seq: 1, state: 'sent' })] }, 'pils')).toBeNull();
  });
  it('badge telt enkel de lopende ronde; balk telt alles wat open staat', () => {
    const lines = [
      line({ id: 'a', seq: 1, state: 'sent', qty: 4, open_qty: 3 }),
      line({ id: 'b', seq: 2, qty: 2, open_qty: 2 }),
      line({ id: 'c', seq: 3, state: 'void', qty: 5 }),
      line({ id: 'd', seq: 4, qty: -1, corrects_line_id: 'a' }),
    ];
    expect(draftCounts({ lines }).get('pils')).toBe(2);
    expect(itemCount({ lines })).toBe(5);
  });
  it('Populair: meest verkocht, enkel wat op de kaart staat, pas vanaf 4 producten', () => {
    const avail = new Set(['a', 'b', 'c', 'd', 'e']);
    const rows = [{ product_id: 'a', qty: 1 }, { product_id: 'b', qty: 5 }, { product_id: 'c', qty: 2 }, { product_id: 'd', qty: 3 }, { product_id: 'x', qty: 99 }, { product_id: null, qty: 9 }];
    expect(popularIds(rows, avail)).toEqual(['b', 'd', 'c', 'a']);
    expect(popularIds(rows.slice(0, 3), avail)).toEqual([]);
  });
  it('naar beheer: in de SellQo-app intern, in de aparte Kassa-app naar de site', () => {
    expect(adminHref('/kassa', 'https://sellqo.app')).toEqual({ href: '/admin', external: false });
    expect(adminHref('/', 'https://sellqo.app')).toEqual({ href: 'https://sellqo.app/admin', external: true });
  });
});

describe('KASSA-UX-2 taal van de kassa', () => {
  it('volgt de zaak, tenzij het toestel iets anders koos', async () => {
    const { kassaLanguage } = await import('../language');
    expect(kassaLanguage('nl', null)).toBe('nl');
    expect(kassaLanguage('fr-BE', null)).toBe('fr');
    expect(kassaLanguage('es', null)).toBe('nl');
    expect(kassaLanguage(null, null)).toBe('nl');
    expect(kassaLanguage('nl', 'en')).toBe('en');
    expect(kassaLanguage('nl', 'xx')).toBe('nl');
  });
});

describe('KASSA-UX-4 formaatvenster en rekeninglijst', () => {
  const c25 = [{ option_id: '25cl', name: '25 cl', price_cents: 0 }];
  const c50 = [{ option_id: '50cl', name: '50 cl', price_cents: 150 }];
  it('"−" in het formaatvenster haalt er één af van precies die maat', () => {
    const lines = [line({ id: 'a', seq: 1, qty: 3, addons: c25 }), line({ id: 'b', seq: 2, qty: 1, addons: c50 })];
    expect(planMinusWith({ lines }, 'pils', ['25cl'])).toEqual({ lineId: 'a', qty: 2 });
    expect(planMinusWith({ lines }, 'pils', ['50cl'])).toEqual({ lineId: 'b', qty: 0 });
    expect(planMinusWith({ lines }, 'pils', ['33cl'])).toBeNull();
  });
  it('"−" raakt nooit een verstuurde lijn van die maat', () => {
    expect(planMinusWith({ lines: [line({ id: 'a', seq: 1, qty: 2, state: 'sent', addons: c25 })] }, 'pils', ['25cl'])).toBeNull();
  });
  it('lijst: ontwerp = meteen aanpassen, verstuurd = annuleren met reden, correcties = niets', () => {
    expect(lineEditKind(line({ id: 'a', seq: 1 }))).toBe('draft');
    expect(lineEditKind(line({ id: 'a', seq: 1, state: 'sent', open_qty: 2 }))).toBe('sent');
    expect(lineEditKind(line({ id: 'a', seq: 1, state: 'sent', open_qty: 0 }))).toBeNull();
    expect(lineEditKind(line({ id: 'a', seq: 1, qty: -1, corrects_line_id: 'x' }))).toBeNull();
    expect(lineEditKind(line({ id: 'a', seq: 1, state: 'void' }))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { adminHref, draftCounts, itemCount, planMinus, planTap, popularIds } from '../horeca/quickTap';
import type { CheckLine } from '../horeca/types';

const line = (p: Partial<CheckLine> & { id: string; seq: number }): CheckLine => ({
  product_id: 'pils', variant_id: null, name: 'Pils', department_id: 'd', department_name: 'D', vat_label: 'A', vat_rate: 21,
  unit_price_cents: 280, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'draft', round_id: null, neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...p,
});

describe('KASSA-UX-1 sneltikken', () => {
  it('telt een tweede tik op dezelfde ontwerp-lijn op', () => {
    expect(planTap({ lines: [line({ id: 'a', seq: 1, qty: 2 })] }, 'pils', false)).toEqual({ kind: 'qty', lineId: 'a', qty: 3 });
  });
  it('maakt een nieuwe lijn bij extra’s, een opmerking, een verstuurde lijn of een ander product', () => {
    expect(planTap({ lines: [line({ id: 'a', seq: 1 })] }, 'pils', true)).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, note: 'zonder schuim' })] }, 'pils', false)).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, state: 'sent' })] }, 'pils', false)).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, product_id: 'cola' })] }, 'pils', false)).toEqual({ kind: 'add' });
    expect(planTap({ lines: [line({ id: 'a', seq: 1, addons: [{ option_id: 'o', name: 'citroen', price_cents: 0 }] })] }, 'pils', false)).toEqual({ kind: 'add' });
    expect(planTap(undefined, 'pils', false)).toEqual({ kind: 'add' });
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

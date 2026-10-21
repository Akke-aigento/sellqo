import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCockpitBrief, lowStockProducts, type BriefFormat, type BriefStockProduct } from '@/lib/cockpitBrief';

const fmt: BriefFormat = {
  money: (n) => `€${n.toFixed(2)}`,
  channel: (c) => c.toUpperCase(),
  channelCount: (c, n) => `${n}x${c}`,
  age: (ms) => `${Math.floor(ms / 3_600_000)}h`,
  list: (items) => items.join(' + '),
};

const product = (over: Partial<BriefStockProduct>): BriefStockProduct => ({
  id: 'p',
  name: 'Product',
  stock: 10,
  low_stock_threshold: 5,
  track_inventory: true,
  ...over,
});

const keys = (input: Parameters<typeof buildCockpitBrief>[0]) => buildCockpitBrief(input, fmt).map((s) => s.key.split('.').pop());

describe('DASH-2a ochtendbrief', () => {
  it('gisteren via één kanaal', () => {
    const out = buildCockpitBrief(
      { yesterday: [{ channel: 'bol_com', revenue: 84.3, count: 2 }], shipping: null, products: null },
      fmt,
    );
    expect(out).toEqual([
      { key: 'admin.cockpit.brief.yesterday_single', values: { count: 2, amount: '€84.30', channel: 'BOL_COM' } },
    ]);
  });

  it('gisteren via meerdere kanalen, kassa meegeteld', () => {
    const out = buildCockpitBrief(
      {
        yesterday: [
          { channel: 'bol_com', revenue: 50, count: 2 },
          { channel: 'pos', revenue: 10, count: 1 },
        ],
        shipping: null,
        products: null,
      },
      fmt,
    );
    expect(out[0]).toEqual({
      key: 'admin.cockpit.brief.yesterday_channels',
      values: { count: 3, amount: '€60.00', channels: '2xbol_com + 1xpos' },
    });
  });

  it('geen bestellingen gisteren', () => {
    expect(keys({ yesterday: [], shipping: null, products: null })).toEqual(['yesterday_none']);
  });

  it('zonder omzetrecht (yesterday null) geen zin over gisteren', () => {
    expect(keys({ yesterday: null, shipping: { openCount: 0, oldestAgeMs: null }, products: null })).toEqual([
      'shipping_none',
    ]);
  });

  it('oudste openstaande verzending met leeftijd en aantal', () => {
    const out = buildCockpitBrief(
      { yesterday: null, shipping: { openCount: 3, oldestAgeMs: 26 * 3_600_000 }, products: null },
      fmt,
    );
    expect(out).toEqual([{ key: 'admin.cockpit.brief.shipping_waiting', values: { count: 3, age: '26h' } }]);
  });

  it('eerste product dat op raakt: laagste voorraad, alleen met voorraadbeheer en drempel', () => {
    const products = [
      product({ id: 'a', name: 'Omvormer 2000W', stock: 3, low_stock_threshold: 5 }),
      product({ id: 'b', name: 'Lader', stock: 1, low_stock_threshold: null }),
      product({ id: 'c', name: 'Zekering', stock: 0, low_stock_threshold: 2, track_inventory: false }),
      product({ id: 'd', name: 'Kabel', stock: 9, low_stock_threshold: 5 }),
      product({ id: 'e', name: 'Accu', stock: 5, low_stock_threshold: 5 }),
    ];
    expect(lowStockProducts(products).map((p) => p.id)).toEqual(['a', 'e']);
    const out = buildCockpitBrief({ yesterday: null, shipping: null, products }, fmt);
    expect(out).toEqual([
      { key: 'admin.cockpit.brief.stock_low', values: { name: 'Omvormer 2000W', count: 3 } },
      { key: 'admin.cockpit.brief.stock_more', values: { count: 1 } },
    ]);
  });

  it('uitverkocht product krijgt stock_out', () => {
    expect(keys({ yesterday: null, shipping: null, products: [product({ stock: 0 })] })).toEqual(['stock_out']);
  });

  it('niets te melden → lege lijst (de component toont dan "niets dringends")', () => {
    expect(keys({ yesterday: null, shipping: null, products: [product({ stock: 50 })] })).toEqual([]);
  });

  it('elke key die de brief kan geven bestaat in alle talen (incl. meervoud)', () => {
    const dir = resolve(__dirname, '../i18n/locales');
    for (const lang of ['nl', 'en', 'fr', 'de', 'uk']) {
      const brief = JSON.parse(readFileSync(resolve(dir, `${lang}.json`), 'utf8')).admin.cockpit.brief;
      for (const k of ['yesterday_none', 'shipping_none', 'stock_out', 'channel_count', 'and', 'title', 'all_quiet']) {
        expect(brief[k], `${lang}.${k}`).toBeTypeOf('string');
      }
      for (const k of ['yesterday_single', 'yesterday_channels', 'shipping_waiting', 'stock_low', 'stock_more']) {
        for (const suf of ['_one', '_few', '_many', '_other']) {
          expect(brief[k + suf], `${lang}.${k}${suf}`).toBeTypeOf('string');
        }
      }
    }
  });
});

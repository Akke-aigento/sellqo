import { describe, expect, it } from 'vitest';
import {
  aggregateCockpitRevenue,
  cockpitPeriods,
  pctChange,
  POS_CHANNEL,
  toSales,
  totalsByChannel,
  type CockpitOrderRow,
  type CockpitPosRow,
} from '@/lib/cockpitRevenue';

// Alle datums lokaal opgebouwd (new Date(y, m, d, ...)) zodat de tests in elke tijdzone kloppen.
const iso = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

const order = (over: Partial<CockpitOrderRow> & { created_at: string }): CockpitOrderRow => ({
  status: 'processing',
  payment_status: 'paid',
  marketplace_source: null,
  sales_channel: 'webshop',
  total: 10,
  ...over,
});

const pos = (over: Partial<CockpitPosRow> & { created_at: string }): CockpitPosRow => ({
  status: 'completed',
  order_id: null,
  total: 5,
  ...over,
});

describe('DASH-2a kanaal-aggregatie', () => {
  const now = new Date(2026, 9, 20, 15, 0);
  const at = iso(2026, 9, 10);

  it('bol_com is een eigen kanaal, ook als sales_channel webshop zegt', () => {
    const sales = toSales([order({ created_at: at, marketplace_source: 'bol_com', sales_channel: 'webshop', total: 40 })], []);
    expect(sales.map((s) => s.channel)).toEqual(['bol_com']);
  });

  it('shopify_draft_order, csv_import, web en null tellen als webshop', () => {
    const rows = ['shopify_draft_order', 'csv_import', 'web', null].map((src) =>
      order({ created_at: at, marketplace_source: src, total: 10 }),
    );
    const totals = totalsByChannel(toSales(rows, []), new Date(2026, 9, 1), now);
    expect(totals).toEqual([{ channel: 'webshop', revenue: 40, count: 4 }]);
  });

  it('alleen omzet-orders: niet betaald of geannuleerd telt niet', () => {
    const rows = [
      order({ created_at: at, payment_status: 'pending' }),
      order({ created_at: at, status: 'cancelled' }),
      order({ created_at: at, payment_status: 'refunded' }),
      order({ created_at: at, total: 7 }),
    ];
    expect(totalsByChannel(toSales(rows, []), new Date(2026, 9, 1), now)).toEqual([
      { channel: 'webshop', revenue: 7, count: 1 },
    ]);
  });

  it('kassa zonder order_id telt als kanaal kassa', () => {
    const totals = totalsByChannel(toSales([], [pos({ created_at: at, total: '12.50' })]), new Date(2026, 9, 1), now);
    expect(totals).toEqual([{ channel: POS_CHANNEL, revenue: 12.5, count: 1 }]);
  });

  it('kassa mét order_id wordt overgeslagen (zit al in de order, geen dubbeltelling)', () => {
    const totals = totalsByChannel(
      toSales(
        [order({ created_at: at, sales_channel: 'pos', total: 20 })],
        [pos({ created_at: at, order_id: 'o-1', total: 20 })],
      ),
      new Date(2026, 9, 1),
      now,
    );
    expect(totals).toEqual([{ channel: 'pos', revenue: 20, count: 1 }]);
  });

  it('kassatickets die niet completed zijn tellen niet', () => {
    const sales = toSales([], [pos({ created_at: at, status: 'voided' }), pos({ created_at: at, status: 'refunded' })]);
    expect(sales).toHaveLength(0);
  });

  it('sorteert kanalen op omzet, hoogste eerst', () => {
    const rows = [
      order({ created_at: at, marketplace_source: 'bol_com', total: 745 }),
      order({ created_at: at, total: 436 }),
    ];
    const totals = totalsByChannel(toSales(rows, [pos({ created_at: at, total: 103 })]), new Date(2026, 9, 1), now);
    expect(totals.map((t) => t.channel)).toEqual(['bol_com', 'webshop', POS_CHANNEL]);
  });
});

describe('DASH-2a maandvergelijking', () => {
  it('20 oktober 15:00 → 1 september tot 20 september 15:00', () => {
    const p = cockpitPeriods(new Date(2026, 9, 20, 15, 0));
    expect(p.monthStart).toEqual(new Date(2026, 9, 1));
    expect(p.prevMonthStart).toEqual(new Date(2026, 8, 1));
    expect(p.prevCompareEnd).toEqual(new Date(2026, 8, 20, 15, 0));
  });

  it('31 maart → de hele februari (29 februari bestaat in 2026 niet)', () => {
    const p = cockpitPeriods(new Date(2026, 2, 31, 9, 0));
    expect(p.prevMonthStart).toEqual(new Date(2026, 1, 1));
    expect(p.prevCompareEnd).toEqual(new Date(2026, 2, 1));
  });

  it('31 oktober → de hele september (30 dagen)', () => {
    const p = cockpitPeriods(new Date(2026, 9, 31, 8, 0));
    expect(p.prevCompareEnd).toEqual(new Date(2026, 9, 1));
  });

  it('31 augustus → tot 31 juli zelfde uur (juli heeft 31 dagen)', () => {
    const p = cockpitPeriods(new Date(2026, 7, 31, 8, 0));
    expect(p.prevCompareEnd).toEqual(new Date(2026, 6, 31, 8, 0));
  });

  it('jaargrens: 15 januari vergelijkt met 1–15 december van vorig jaar', () => {
    const p = cockpitPeriods(new Date(2027, 0, 15, 10, 0));
    expect(p.prevMonthStart).toEqual(new Date(2026, 11, 1));
    expect(p.prevCompareEnd).toEqual(new Date(2026, 11, 15, 10, 0));
  });

  it('gisteren op de 1e van de maand valt in de vorige maand', () => {
    const p = cockpitPeriods(new Date(2026, 10, 1, 7, 0));
    expect(p.yesterdayStart).toEqual(new Date(2026, 9, 31));
    expect(p.todayStart).toEqual(new Date(2026, 10, 1));
  });

  it('maandgrens: een order op 30 sept 23:59 lokaal telt niet in oktober, wel in de vergelijking', () => {
    const now = new Date(2026, 9, 1, 0, 30);
    const r = aggregateCockpitRevenue(
      [
        order({ created_at: iso(2026, 8, 30, 23, 59), total: 50 }),
        order({ created_at: iso(2026, 9, 1, 0, 10), total: 30 }),
        order({ created_at: iso(2026, 8, 1, 0, 20), total: 15 }),
        order({ created_at: iso(2026, 8, 1, 0, 40), total: 99 }),
      ],
      [],
      now,
    );
    expect(r.monthTotal).toBe(30);
    // Vergelijking: 1 sept 00:00 tot 1 sept 00:30 → enkel de order van 00:20.
    expect(r.prevTotal).toBe(15);
    expect(r.changePct).toBe(100);
    expect(r.yesterdayChannels).toEqual([{ channel: 'webshop', revenue: 50, count: 1 }]);
  });

  it('vandaag: omzet en bestellingen tellen hetzelfde (betaald, niet geannuleerd, plus kassa)', () => {
    const now = new Date(2026, 9, 20, 15, 0);
    const r = aggregateCockpitRevenue(
      [
        order({ created_at: iso(2026, 9, 20, 9), total: 40, marketplace_source: 'bol_com' }),
        order({ created_at: iso(2026, 9, 20, 10), total: 20, payment_status: 'pending' }),
        order({ created_at: iso(2026, 9, 20, 11), total: 60, status: 'cancelled' }),
        order({ created_at: iso(2026, 9, 19, 23, 59), total: 70 }),
      ],
      [
        pos({ created_at: iso(2026, 9, 20, 12), total: 4.3 }),
        pos({ created_at: iso(2026, 9, 20, 13), total: 9, order_id: 'o-1' }),
      ],
      now,
    );
    expect(r.todayRevenue).toBe(44.3);
    // bol-order (betaald) + kassaticket; onbetaald, geannuleerd en gisteren tellen niet.
    expect(r.todayOrders).toBe(2);
  });

  it('pctChange zonder vorige omzet geeft null, geen Infinity', () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(118, 100)).toBe(18);
    expect(pctChange(50, 100)).toBe(-50);
  });
});

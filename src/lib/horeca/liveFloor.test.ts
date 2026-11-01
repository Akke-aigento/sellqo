// HORECA-ZIJBALK-1 — live zaaloverzicht: zelfde getallen als de kassa.
import { describe, expect, it } from 'vitest';
import { checkTotalCents, type Check, type CheckLine } from '@/kassa/app/horeca/types';
import { buildLiveFloor, durationParts, liveState } from './liveFloor';

const NOW = Date.parse('2026-11-01T20:00:00Z');
const line = (p: Partial<CheckLine>): CheckLine => ({
  id: crypto.randomUUID(), seq: 1, product_id: null, variant_id: null, name: 'Duvel', department_id: 'd', department_name: 'Dranken',
  vat_label: 'A', vat_rate: 21, unit_price_cents: 450, qty: 1, addons: [], note: null, course: null, station_id: null,
  state: 'sent', round_id: null, neg_reason: null, corrects_line_id: null, price_changes: [], void_reason: null,
  created_by: null, created_at: '2026-11-01T19:30:00Z', open_qty: 1, ...p,
});
const check = (p: Partial<Check>): Check => ({
  id: crypto.randomUUID(), table_id: null, name: null, status: 'open', guests: null, opened_at: '2026-11-01T19:00:00Z',
  bill_requested_at: null, reference: 'r', version: 1, next_grouping_id: 1, lines: [], ...p,
});
const opts = { now: NOW, money: (c: number) => `€${(c / 100).toFixed(2)}`, counterLabel: 'Toog', unnamedLabel: 'Rekening' };
const labels: Record<string, string> = { t1: 'T1', t2: 'T2' };

describe('live zaaloverzicht', () => {
  it('bedrag = checkTotalCents (geschrapte lijnen tellen niet), minuten open, status per tafel', () => {
    const c1 = check({ table_id: 't1', lines: [line({ qty: 2 }), line({ state: 'void' }), line({ state: 'draft', unit_price_cents: 300 })] });
    const c2 = check({ table_id: 't2', opened_at: '2026-11-01T19:45:00Z', bill_requested_at: '2026-11-01T19:59:00Z', lines: [line({})] });
    const f = buildLiveFloor([c2, c1], (id) => labels[id] ?? null, opts);
    expect(f.rows.map((r) => r.label)).toEqual(['T1', 'T2']);
    expect(f.rows[0].totalCents).toBe(checkTotalCents(c1));
    expect(f.rows[0].totalCents).toBe(1200);
    expect(f.rows[0].minutesOpen).toBe(60);
    expect(f.status).toEqual({ t1: 'occupied', t2: 'bill' });
    expect(f.badges.t1).toBe('€12.00 · 60′');
    expect(f.openTables).toBe(2);
    expect(f.totalCents).toBe(1650);
  });

  it('rekeningen op naam en aan de toog staan in de lijst, niet op het plan; gesloten rekeningen niet', () => {
    const f = buildLiveFloor([
      check({ name: 'Jan', lines: [line({})] }),
      check({ kind: 'counter' }),
      check({ table_id: 't1', status: 'closed' }),
    ], (id) => labels[id] ?? null, opts);
    expect(f.rows.map((r) => r.label)).toEqual(['Jan', 'Toog']);
    expect(f.openTables).toBe(0);
    expect(f.status).toEqual({});
  });

  it('deelrekening: de hoofdrekening wint per tafel, het deel staat apart in de lijst', () => {
    const main = check({ table_id: 't1' });
    const part = check({ table_id: 't1', split_of: main.id, split_no: 1, lines: [line({})] });
    const f = buildLiveFloor([main, part], (id) => labels[id] ?? null, opts);
    expect(f.openTables).toBe(1);
    expect(f.rows.find((r) => r.part === 1)?.label).toBe('T1');
    // Hoofdrekening betaald, deel nog open: de tafel blijft bezet via het deel.
    const g = buildLiveFloor([part], (id) => labels[id] ?? null, opts);
    expect(g.status).toEqual({ t1: 'occupied' });
  });

  it('stand: afrekenen bezig > rekening gevraagd > open', () => {
    expect(liveState({ paying: true, bill_requested_at: 'x' })).toBe('paying');
    expect(liveState({ paying: false, bill_requested_at: 'x' })).toBe('bill');
    expect(liveState({ bill_requested_at: null })).toBe('open');
  });

  it('duur in uren en minuten', () => {
    expect(durationParts(65)).toEqual({ h: 1, m: 5, mm: '05' });
    expect(durationParts(7)).toEqual({ h: 0, m: 7, mm: '07' });
  });
});

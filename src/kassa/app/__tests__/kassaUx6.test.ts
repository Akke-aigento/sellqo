// KASSA-RECHTEN-1 + KASSA-UX-6 — pure regels: wie een akkoord nodig heeft, herhaal vorige ronde,
// fooi-knoppen, snelknoppen contant, telling per biljet/munt, vergrendeltijden.
import { describe, expect, it } from 'vitest';
import { approvalFor, needsApproval } from '../horeca/approvals';
import { planMinus, qtyLocked } from '../horeca/quickTap';
import { effectiveLockMinutes } from '../horeca/staffSession';
import { DENOMINATIONS, cashGivenOptions, countTotal, lastRoundLines, normalizeLockMinutes, tipSuggestions } from '../horeca/kassaUx';
import type { CheckLine } from '../horeca/types';

const line = (over: Partial<CheckLine>): CheckLine => ({
  id: 'l', seq: 1, product_id: 'p', variant_id: null, name: 'Pils', department_id: '1', department_name: 'Dranken', vat_label: 'A', vat_rate: 21,
  unit_price_cents: 280, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'sent', round_id: 'r1', neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...over,
});

describe('KASSA-RECHTEN-1: akkoord nodig', () => {
  it('eigenaar en verantwoordelijke meteen (met sessietoken); ober, barman en zonder rol via PIN', () => {
    expect(needsApproval({ staffRole: 'owner', staffToken: 'a'.repeat(64) }, 'discount')).toBe(false);
    expect(needsApproval({ staffRole: 'manager', staffToken: 'b'.repeat(64) }, 'void_sent')).toBe(false);
    expect(needsApproval({ staffRole: 'manager', staffToken: 'b'.repeat(64) }, 'cash_out')).toBe(false);
    // Review 1: zonder token keurt de eigenaar zelf goed met zijn PIN (de server aanvaardt de uitzondering niet).
    expect(needsApproval({ staffRole: 'owner', staffToken: null }, 'discount')).toBe(true);
    expect(needsApproval({ staffRole: 'waiter', staffToken: 'c'.repeat(64) }, 'cash_out')).toBe(true);
    expect(needsApproval({ staffRole: 'waiter' }, 'discount')).toBe(true);
    expect(needsApproval({ staffRole: 'bartender' }, 'void_sent')).toBe(true);
    expect(needsApproval({ staffRole: undefined }, 'discount')).toBe(true);
  });
  it('ontwerp-lijn weghalen blijft vrij; korting altijd; verstuurde lijn annuleren met akkoord', () => {
    expect(approvalFor('void', { state: 'draft' })).toBeNull();
    expect(needsApproval({ staffRole: 'waiter' }, approvalFor('void', { state: 'draft' }))).toBe(false);
    expect(approvalFor('void', { state: 'sent' })).toBe('void_sent');
    expect(approvalFor('discount', { state: 'draft' })).toBe('discount');
    expect(approvalFor('discount', { state: 'sent' })).toBe('discount');
  });
});

describe('KASSA-UX-6: herhaal vorige ronde', () => {
  it('neemt de nieuwe bestellingen van de laatste ronde, niet de correcties of herboekingen', () => {
    const lines = [
      line({ id: 'a', seq: 1, round_id: 'r1', name: 'Cola' }),
      line({ id: 'b', seq: 2, round_id: 'r2', name: 'Pils', qty: 3, open_qty: 2 }),
      line({ id: 'c', seq: 3, round_id: 'r2', name: 'Kriek' }),
      line({ id: 'd', seq: 4, round_id: 'r3', qty: -1, neg_reason: 'CORRECTION', corrects_line_id: 'b' }),
      line({ id: 'e', seq: 5, round_id: 'r3', corrects_line_id: 'c', price_changes: [{ grouping_id: 1, id: 'D', name: '-10', scope: 'LINE', type: 'PUBLIC', amount_cents: -42 }] }),
      line({ id: 'f', seq: 6, state: 'draft', round_id: null }),
      line({ id: 'g', seq: 7, round_id: null, name: 'Verplaatst' }),
    ];
    expect(lastRoundLines({ lines }).map((l) => l.id)).toEqual(['b', 'c']);
  });
  it('zonder verstuurde ronde: niets', () => {
    expect(lastRoundLines({ lines: [line({ state: 'draft', round_id: null })] })).toEqual([]);
  });
});

describe('KASSA-UX-6: fooi en contant', () => {
  it('5 %, 10 % en afronden tot de volgende hele euro', () => {
    expect(tipSuggestions(2340)).toEqual({ pct5: 117, pct10: 234, roundUp: 60 });
    expect(tipSuggestions(2000).roundUp).toBe(0);
    expect(tipSuggestions(0)).toEqual({ pct5: 0, pct10: 0, roundUp: 0 });
  });
  it('snelknoppen gegeven: exact bedrag, dan €5/€10/€20/€50/€100 die genoeg zijn', () => {
    expect(cashGivenOptions(435)).toEqual([435, 500, 1000, 2000, 5000, 10000]);
    expect(cashGivenOptions(1000)).toEqual([1000, 2000, 5000, 10000]);
    expect(cashGivenOptions(12000)).toEqual([12000]);
  });
});

describe('KASSA-UX-6: kas tellen', () => {
  it('telt biljetten en munten op; lege of ongeldige aantallen tellen niet', () => {
    expect(countTotal({ 5000: 2, 1000: 3, 200: 4, 5: 1 })).toBe(10000 + 3000 + 800 + 5);
    expect(countTotal({ 2000: -1, 100: Number.NaN, 50: 1.5 })).toBe(0);
    expect(DENOMINATIONS[0]).toBe(50000);
    expect(DENOMINATIONS.at(-1)).toBe(1);
  });
  it('vergrendeltijd: enkel de toegelaten waarden, anders 2 minuten', () => {
    expect(normalizeLockMinutes(5)).toBe(5);
    expect(normalizeLockMinutes('0')).toBe(0);
    expect(normalizeLockMinutes(3)).toBe(2);
    expect(normalizeLockMinutes(null)).toBe(2);
  });
});

describe('Review 1: aantal ligt vast met korting; vergrendeltijd eigenaar', () => {
  it('qtyLocked bij korting, correctie of tegenboeking; − op de tegel slaat die lijnen over', () => {
    const pc = [{ grouping_id: 1, id: 'D', name: 'Gratis', scope: 'LINE' as const, type: 'PUBLIC' as const, amount_cents: -2800 }];
    expect(qtyLocked(line({ price_changes: pc }))).toBe(true);
    expect(qtyLocked(line({ corrects_line_id: 'x' }))).toBe(true);
    expect(qtyLocked(line({ neg_reason: 'CORRECTION' }))).toBe(true);
    expect(qtyLocked(line({}))).toBe(false);
    const lines = [line({ id: 'free', seq: 2, state: 'draft', qty: 10, price_changes: pc }), line({ id: 'plain', seq: 1, state: 'draft', qty: 2 })];
    expect(planMinus({ lines }, 'p')).toEqual({ lineId: 'plain', qty: 1 });
    expect(planMinus({ lines: [lines[0]] }, 'p')).toBeNull();
  });
  it('eigenaar/verantwoordelijke hoogstens 2 minuten, ook bij "nooit"; anderen volgen de zaak', () => {
    expect(effectiveLockMinutes(0, 'owner')).toBe(2);
    expect(effectiveLockMinutes(10, 'manager')).toBe(2);
    expect(effectiveLockMinutes(1, 'owner')).toBe(1);
    expect(effectiveLockMinutes(0, 'waiter')).toBe(0);
    expect(effectiveLockMinutes(10, 'bartender')).toBe(10);
    expect(effectiveLockMinutes(5, undefined)).toBe(5);
  });
});

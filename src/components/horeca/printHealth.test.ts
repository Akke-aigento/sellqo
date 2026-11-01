import { describe, expect, it } from 'vitest';
import { hasPrintProblem, printHealth } from './printHealth';

const NOW = Date.parse('2026-11-01T20:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
const printers = [
  { id: 'p1', name: 'Keuken', is_active: true, last_seen_at: ago(5) },
  { id: 'p2', name: 'Bar', is_active: true, last_seen_at: ago(600) },
  { id: 'p3', name: 'Oud', is_active: false, last_seen_at: null },
];

describe('printHealth (KEUKEN-VEILIG-1)', () => {
  it('telt mislukte en hangende bonnen en printers zonder verbinding', () => {
    const h = printHealth(printers, [
      { id: 'a', printer_id: 'p1', status: 'failed', created_at: ago(60) },
      { id: 'b', printer_id: 'p1', status: 'queued', created_at: ago(200) },
      { id: 'c', printer_id: 'p1', status: 'queued', created_at: ago(10) },
      { id: 'd', printer_id: 'p3', status: 'failed', created_at: ago(10) },
      { id: 'e', printer_id: 'p1', status: 'failed', created_at: ago(4 * 3600) },
    ], NOW);
    expect(h).toMatchObject({ failed: 1, stuck: 1, offline: ['Bar'] });
    expect(hasPrintProblem(h, 0)).toBe(true);
  });
  it('"gezien" verbergt tot er iets nieuws is', () => {
    const h = printHealth([printers[0]], [{ id: 'a', printer_id: 'p1', status: 'failed', created_at: ago(60) }], NOW);
    expect(hasPrintProblem(h, NOW)).toBe(false);
    expect(hasPrintProblem(h, NOW - 120_000)).toBe(true);
  });
  it('alles in orde: geen melding', () => {
    expect(hasPrintProblem(printHealth([printers[0]], [], NOW), 0)).toBe(false);
  });
});

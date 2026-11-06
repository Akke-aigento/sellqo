import { describe, expect, it } from 'vitest';
import { activeGroupTables, checkWarnings, previousGuestChecks, type TableGroupsData } from './tableGroups';

const data: TableGroupsData = {
  last_reset: '2026-11-06T04:00:00Z',
  tables: [
    // De Wissel tafel 8: rekening van gisteren, met lijnen van vorige gasten, en nu een groep aan tafel.
    { table_id: 't8', check_id: 'c8', check_opened_at: '2026-11-05T07:07:00Z', stale: true, prev_open_lines: 3, group: { id: 'g8', started_at: '2026-11-06T11:30:00Z', last_activity_at: '2026-11-06T11:34:00Z' } },
    // Gewone rekening van vandaag, groep aan tafel, niets van vorige gasten.
    { table_id: 't2', check_id: 'c2', check_opened_at: '2026-11-06T12:00:00Z', stale: false, prev_open_lines: 0, group: { id: 'g2', started_at: '2026-11-06T11:58:00Z', last_activity_at: '2026-11-06T12:00:00Z' } },
    // Rekening zonder QR-groep, van vandaag: niets te melden.
    { table_id: 't3', check_id: 'c3', check_opened_at: '2026-11-06T12:00:00Z', stale: false, prev_open_lines: 0, group: null },
    // Groep zonder rekening.
    { table_id: 't4', check_id: null, check_opened_at: null, stale: false, prev_open_lines: 0, group: { id: 'g4', started_at: '2026-11-06T12:10:00Z', last_activity_at: '2026-11-06T12:10:00Z' } },
    // Rekening van gisteren zonder groep.
    { table_id: 't5', check_id: 'c5', check_opened_at: '2026-11-05T20:00:00Z', stale: true, prev_open_lines: 0, group: null },
    // R1b: groep al 3 u stil, nog iets open (vertrokken zonder te betalen?).
    { table_id: 't6', check_id: 'c6', check_opened_at: '2026-11-06T09:00:00Z', stale: false, prev_open_lines: 0, group: { id: 'g6', started_at: '2026-11-06T09:00:00Z', last_activity_at: '2026-11-06T09:10:00Z', idle_open: true } },
  ],
};

describe('TAFEL-SAMEN-1 tafelgroepen in Zaal en Nu', () => {
  it('waarschuwing per rekening', () => {
    const w = checkWarnings(data);
    expect(w.get('c8')).toMatchObject({ stale: true, prevLines: 3, groupActive: true, tableId: 't8' });
    expect(w.get('c2')).toMatchObject({ stale: false, prevLines: 0, groupActive: true });
    expect(w.has('c3')).toBe(false);
    expect(w.get('c5')).toMatchObject({ stale: true, groupActive: false });
  });
  it('R1b: stil maar nog open → minuten sinds de laatste activiteit', () => {
    const w = checkWarnings(data, Date.parse('2026-11-06T12:10:00Z'));
    expect(w.get('c6')).toMatchObject({ idleMinutes: 180, groupActive: true, tableId: 't6' });
    expect(w.get('c2')?.idleMinutes).toBeNull();
  });
  it('Nu-tegel telt rekeningen die aandacht vragen (één bron: horeca_table_groups)', () => {
    expect(previousGuestChecks(data)).toBe(3);
    expect(previousGuestChecks(null)).toBe(0);
  });
  it('Tafel vrijgeven kan aan tafels met een actieve groep, ook zonder rekening', () => {
    expect([...activeGroupTables(data)].sort()).toEqual(['t2', 't4', 't6', 't8']);
  });
});

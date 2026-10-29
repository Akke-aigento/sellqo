import { describe, expect, it } from 'vitest';
import {
  buildTemplate, chunk, clampToArea, compareLabels, dragTo, duplicateLabel, duplicateLabels, findFreeSpot,
  findOverlaps, fitCell, quarterTurn, quarterTurnHelps, isValidLabel, labelSeries, nextLabel, normRotation, overlappingIds, placeTemplate,
  rotatedBox, snap, splitLabel, stickerCell, tableQrUrl, TOKEN_RE,
} from './index';

const area = { grid_w: 40, grid_h: 24 };
const p = (id: string, x: number, y: number, w = 2, h = 2, rotation = 0) => ({ id, x, y, w, h, rotation });

describe('raster', () => {
  it('snapt naar hele cellen', () => {
    expect(snap(3.4)).toBe(3);
    expect(snap(3.6)).toBe(4);
    expect(snap(7, 2)).toBe(8);
    expect(snap(Number.NaN)).toBe(0);
  });
  it('normaliseert rotatie op 45°', () => {
    expect(normRotation(-90)).toBe(270);
    expect(normRotation(360)).toBe(0);
    expect(normRotation(100)).toBe(90);
    expect(normRotation(400)).toBe(45);
  });
  it('slepen in pixels → rastercellen', () => {
    expect(dragTo({ x: 2, y: 3 }, 61, -19, 20)).toEqual({ x: 5, y: 2 });
  });
});

describe('draaien en overlap', () => {
  it('wisselt breedte en hoogte bij 90°', () => {
    expect(rotatedBox(p('a', 0, 0, 4, 2, 90))).toEqual({ x: 1, y: -1, w: 2, h: 4 });
  });
  it('aangrenzend is geen overlap, half erover wel', () => {
    expect(findOverlaps([p('a', 0, 0), p('b', 2, 0)])).toEqual([]);
    expect(findOverlaps([p('a', 0, 0), p('b', 1, 1)])).toEqual([['a', 'b']]);
  });
  it('houdt rekening met draaien', () => {
    // 4×1 op (0,0) en 90° gedraaid wordt verticaal 1×4 rond (2, 0.5): raakt een 1×1 op (2,2).
    expect(overlappingIds([p('a', 0, 0, 4, 1, 90), p('b', 2, 2, 1, 1)])).toEqual(new Set(['a', 'b']));
    expect(overlappingIds([p('a', 0, 0, 4, 1, 0), p('b', 2, 2, 1, 1)])).toEqual(new Set());
  });
});

describe('binnen de ruimte', () => {
  it('duwt een tafel terug binnen het raster', () => {
    expect(clampToArea(p('a', 39, 23), area)).toMatchObject({ x: 38, y: 22 });
    expect(clampToArea(p('a', -3, -1), area)).toMatchObject({ x: 0, y: 0 });
  });
  it('gedraaide tafel past na clamp volledig', () => {
    const c = clampToArea(p('a', 0, 0, 5, 1, 90), area);
    const b = rotatedBox(c);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(c.x) && Number.isInteger(c.y)).toBe(true);
  });
  it('maakt een te grote tafel niet groter dan de ruimte', () => {
    expect(clampToArea(p('a', 0, 0, 60, 2), area)).toMatchObject({ w: 40, x: 0 });
  });
});

describe('schalen', () => {
  it('past de ruimte in de breedte, of in breedte én hoogte', () => {
    expect(fitCell(area, 1200)).toBe(30);
    expect(fitCell(area, 1200, 480)).toBe(20);
    expect(fitCell(area, 358)).toBe(8); // gsm: nooit onder de minimumcel
    expect(fitCell({ grid_w: 10, grid_h: 6 }, 2000)).toBe(48);
  });
});

describe('vrije plek', () => {
  it('eerste vrije plek van linksboven', () => {
    expect(findFreeSpot(area, [p('a', 0, 0)], 2, 2)).toEqual({ x: 2, y: 0 });
  });
  it('dupliceren komt rechts naast het origineel', () => {
    expect(findFreeSpot(area, [p('a', 10, 5)], 2, 2, { x: 10, y: 5 })).toEqual({ x: 12, y: 5 });
  });
  it('geen plek in een volle ruimte', () => {
    expect(findFreeSpot({ grid_w: 2, grid_h: 2 }, [p('a', 0, 0)], 1, 1)).toBeNull();
  });
});

describe('labels', () => {
  it('splitst voorvoegsel en nummer', () => {
    expect(splitLabel('Ter-12')).toEqual({ prefix: 'Ter-', n: 12 });
    expect(splitLabel('Salon/Club')).toEqual({ prefix: 'Salon/Club', n: null });
  });
  it('nummert door op het hoogste nummer', () => {
    expect(nextLabel(['B1', 'B2', 'B7', 'Ter-1'], 'B')).toBe('B8');
    expect(nextLabel([], 'Ter-')).toBe('Ter-1');
    expect(nextLabel(['1', '2', 'Blauw 3'], '')).toBe('3');
  });
  it('maakt een reeks B1..B9', () => {
    expect(labelSeries([], 'B', 9)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
    expect(labelSeries(['Ter-1'], 'Ter-', 2)).toEqual(['Ter-2', 'Ter-3']);
  });
  it('label voor een kopie', () => {
    expect(duplicateLabel(['Blauw 1', 'Blauw 2'], 'Blauw 1')).toBe('Blauw 3');
    expect(duplicateLabel(['Salon/Club'], 'Salon/Club')).toBe('Salon/Club 1');
  });
  it('vindt dubbels hoofdletterongevoelig', () => {
    expect(duplicateLabels(['B1', 'b1', 'B2'])).toEqual(new Set(['b1']));
  });
  it('controleert de vorm zoals de databank', () => {
    expect(isValidLabel('Rond tafel')).toBe(true);
    expect(isValidLabel('Ter-1')).toBe(true);
    expect(isValidLabel('-1')).toBe(false);
    expect(isValidLabel('<b>')).toBe(false);
    expect(isValidLabel('x'.repeat(17))).toBe(false);
  });
  it('sorteert natuurlijk', () => {
    expect(['B10', 'B2', 'B1'].sort(compareLabels)).toEqual(['B1', 'B2', 'B10']);
  });
});

describe('sjablonen', () => {
  it('rij barkrukken met toog', () => {
    const t = buildTemplate({ id: 'bar_row', count: 9, prefix: 'B' }, []);
    expect(t.tables.map((x) => x.label)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
    expect(t.tables.every((x) => x.kind === 'bar_seat' && x.y === 1)).toBe(true);
    expect(t.markers).toEqual([{ kind: 'bar', label: null, x: 0, y: 0, w: 9, h: 1, rotation: 0 }]);
  });
  it('terras 4× in een raster, zonder overlap', () => {
    const t = buildTemplate({ id: 'terrace', count: 6, prefix: 'Ter-', columns: 3 }, []);
    expect(t.tables).toHaveLength(6);
    expect(t.w).toBe(8);
    expect(t.h).toBe(5);
    expect(findOverlaps(t.tables.map((x, i) => ({ ...x, id: String(i) })))).toEqual([]);
  });
  it('plaatst het sjabloon op een vrije plek naast bestaande tafels', () => {
    const placed = placeTemplate({ id: 'terrace', count: 3, prefix: 'Ter-' }, area, [{ label: 'Ter-1' }], [p('x', 0, 0, 3, 3)]);
    expect(placed?.tables.map((x) => x.label)).toEqual(['Ter-2', 'Ter-3', 'Ter-4']);
    expect(placed?.tables[0].x).toBeGreaterThanOrEqual(3);
  });
  it('null als het niet past', () => {
    expect(placeTemplate({ id: 'bar_row', count: 20, prefix: 'B' }, { grid_w: 10, grid_h: 6 }, [], [])).toBeNull();
  });
});

describe('QR', () => {
  it('link met token, geen label', () => {
    expect(tableQrUrl('belgaleiro', 'a1b2c3d4e5f6a1b2c3d4e5f6')).toBe('https://belgaleiro.sellqo.shop/menu?t=a1b2c3d4e5f6a1b2c3d4e5f6');
    expect(TOKEN_RE.test('a1b2c3d4e5f6a1b2c3d4e5f6')).toBe(true);
    expect(TOKEN_RE.test('4')).toBe(false);
  });
  it('12 stickers per A4, binnen de pagina', () => {
    expect(chunk(Array.from({ length: 25 }, (_, i) => i), 12).map((c) => c.length)).toEqual([12, 12, 1]);
    const last = stickerCell(11);
    expect(last.col).toBe(2);
    expect(last.row).toBe(3);
    expect(last.x + last.w).toBeCloseTo(202, 5);
    expect(last.y + last.h).toBeCloseTo(289, 5);
  });
});

describe('KASSA-UX-2 kwartslag (gsm staand)', () => {
  const area = { id: 'a', grid_w: 40, grid_h: 24 };
  it('draait vakken met de klok mee rond hun middelpunt', () => {
    const { areas, items } = quarterTurn([area], [{ id: 't', area_id: 'a', x: 26, y: 3, w: 6, h: 4 }]);
    expect(areas[0]).toMatchObject({ grid_w: 24, grid_h: 40 });
    expect(items[0]).toMatchObject({ x: 24 - 3 - 4, y: 26, w: 4, h: 6 });
  });
  it('enkel als het de vakjes echt groter maakt', () => {
    expect(quarterTurnHelps(area, 366, 640)).toBe(true);   // gsm staand
    expect(quarterTurnHelps(area, 1000, 600)).toBe(false); // tablet liggend
    expect(quarterTurnHelps({ grid_w: 20, grid_h: 30 }, 366, 640)).toBe(false); // al staand
  });
});

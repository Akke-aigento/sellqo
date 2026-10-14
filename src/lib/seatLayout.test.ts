import { describe, expect, it } from 'vitest';
import { generateSection, placeSection, rowLabels, rowWidth, seatNumbers } from './seatLayout';

let n = 0;
const newId = () => `s${++n}`;

describe('seatLayout', () => {
  it('labels rows with letters, past Z, or numbers', () => {
    expect(rowLabels('A', 3)).toEqual(['A', 'B', 'C']);
    expect(rowLabels('Y', 3)).toEqual(['Y', 'Z', 'AA']);
    expect(rowLabels('m', 2)).toEqual(['M', 'N']);
    expect(rowLabels('1', 3)).toEqual(['1', '2', '3']);
  });
  it('numbers seats left to right, right to left, or odd/even from the middle', () => {
    expect(seatNumbers(4, 'ltr')).toEqual(['1', '2', '3', '4']);
    expect(seatNumbers(3, 'rtl')).toEqual(['3', '2', '1']);
    expect(seatNumbers(6, 'oddeven')).toEqual(['5', '3', '1', '2', '4', '6']);
    expect(seatNumbers(5, 'oddeven')).toEqual(['5', '3', '1', '2', '4']);
  });
  it('generates rows with an aisle gap and unique positions', () => {
    const seats = generateSection({ sectionId: 'p', rows: 2, perRow: 4, aisleAfter: [2], startLabel: 'A', numbering: 'ltr', startY: 0, offsetX: 0, priceClassId: null, newId });
    expect(seats).toHaveLength(8);
    expect(seats.filter((s) => s.y === 0).map((s) => s.x)).toEqual([0, 1, 3, 4]);
    expect(new Set(seats.map((s) => `${s.x},${s.y}`)).size).toBe(8);
    expect(rowWidth(4, [2])).toBe(5);
  });
  it('places a new section below the others, centred on the widest', () => {
    const parterre = generateSection({ sectionId: 'p', rows: 2, perRow: 22, aisleAfter: [11], startLabel: 'A', numbering: 'ltr', startY: 0, offsetX: 0, priceClassId: null, newId });
    const spot = placeSection(parterre, rowWidth(16, [8]), null);
    expect(spot.startY).toBe(3);
    expect(spot.offsetX).toBe(3);
  });
});

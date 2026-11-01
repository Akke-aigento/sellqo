// ALLERGEEN-ADMIN-1 — "geen" vs "niet ingevuld" vs aantal.
import { describe, expect, it } from 'vitest';
import { allergenState, isMissingColumn } from '../allergenState';

describe('allergenState', () => {
  it('aantal wint, ook zonder verklaring', () => {
    expect(allergenState(['milk', 'eggs'], false)).toEqual({ kind: 'count', n: 2 });
    expect(allergenState(['gluten'], undefined)).toEqual({ kind: 'count', n: 1 });
  });
  it('leeg + verklaard = geen; leeg + niet verklaard = niet ingevuld', () => {
    expect(allergenState([], true)).toEqual({ kind: 'none' });
    expect(allergenState(null, false)).toEqual({ kind: 'missing' });
    expect(allergenState([], null)).toEqual({ kind: 'missing' });
  });
  it('kolom nog niet gemigreerd: leeg telt als niet ingevuld', () => {
    expect(allergenState([], undefined)).toEqual({ kind: 'missing' });
    expect(isMissingColumn({ code: '42703' })).toBe(true);
    expect(isMissingColumn({ code: '42501' })).toBe(false);
  });
});

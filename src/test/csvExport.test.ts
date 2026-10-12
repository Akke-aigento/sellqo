import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/csvExport';

describe('APP-CLEAN-2c toCsv', () => {
  it('scheidt met puntkomma en laat lege waarden leeg', () => {
    expect(toCsv(['a', 'b'], [[1, null], ['x', undefined]])).toBe('a;b\r\n1;\r\nx;');
  });
  it('quote velden met ; " of regeleinde', () => {
    expect(toCsv(['n'], [['De "Fiere"; Margriet'], ['a\nb']])).toBe('n\r\n"De ""Fiere""; Margriet"\r\n"a\nb"');
  });
});

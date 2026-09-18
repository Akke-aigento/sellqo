import { describe, expect, it } from 'vitest';
import { contrastRatio, readableTextColor } from '../../supabase/functions/_shared/colorContrast.ts';

// MAIL-THEME-1: tekst op de witte mailcard moet minstens 4.5:1 halen (WCAG AA).
const CARD = '#ffffff';
const BRAND_TEXT = '#1a2332';

describe('contrastRatio', () => {
  it('geeft 21 voor zwart op wit en 1 voor wit op wit', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('is symmetrisch', () => {
    expect(contrastRatio('#f0f0f0', CARD)).toBeCloseTo(contrastRatio(CARD, '#f0f0f0')!, 10);
  });

  it('ziet de lichte themakleuren van VanXcel en Astra Sleep als onleesbaar op wit', () => {
    expect(contrastRatio('#f0f0f0', CARD)!).toBeLessThan(4.5);
    expect(contrastRatio('#f5f5f5', CARD)!).toBeLessThan(4.5);
  });

  it('geeft null voor iets wat geen hexkleur is', () => {
    expect(contrastRatio('rgb(0,0,0)', CARD)).toBeNull();
    expect(contrastRatio('', CARD)).toBeNull();
  });
});

describe('readableTextColor', () => {
  it('vervangt een lichte themakleur door de standaard tekstkleur', () => {
    expect(readableTextColor('#f0f0f0', CARD, BRAND_TEXT)).toBe(BRAND_TEXT);
  });

  it('laat een donkere themakleur staan', () => {
    expect(readableTextColor('#1c1917', CARD, BRAND_TEXT)).toBe('#1c1917');
    expect(readableTextColor('#292524', CARD, BRAND_TEXT)).toBe('#292524');
  });

  it('valt terug bij null, leeg of onleesbaar formaat', () => {
    expect(readableTextColor(null, CARD, BRAND_TEXT)).toBe(BRAND_TEXT);
    expect(readableTextColor('', CARD, BRAND_TEXT)).toBe(BRAND_TEXT);
    expect(readableTextColor('red', CARD, BRAND_TEXT)).toBe(BRAND_TEXT);
  });
});

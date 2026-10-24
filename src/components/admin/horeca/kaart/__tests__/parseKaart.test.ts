import { describe, expect, it } from 'vitest';
import { findDuplicates, parseKaartText, parsePrice, priceFromInput, priceToInput } from '../parseKaart';
import { STARTER_GROUPS } from '../starterKaart';

describe('parsePrice', () => {
  it.each([
    ['4,50', '4.50'], ['4.5', '4.50'], ['€ 12', '12.00'], ['12 €', '12.00'], ['3,2 eur', '3.20'], ['0', '0.00'],
  ])('%s → %s', (raw, out) => expect(parsePrice(raw)).toBe(out));
  it.each(['', 'abc', '4,555', '-1', '123456'])('%s is geen prijs', (raw) => expect(parsePrice(raw)).toBeNull());
});

describe('parseKaartText', () => {
  it('leest naam + prijs in alle gewone vormen', () => {
    const lines = parseKaartText([
      'Duvel 4,50',
      'Westmalle Tripel - € 5.20',
      'Orval ........ 5,80 €',
      '€3 Cola',
      'Kriek: 4',
    ].join('\n'));
    expect(lines).toEqual([
      { name: 'Duvel', price: '4.50', category: null },
      { name: 'Westmalle Tripel', price: '5.20', category: null },
      { name: 'Orval', price: '5.80', category: null },
      { name: 'Cola', price: '3.00', category: null },
      { name: 'Kriek', price: '4.00', category: null },
    ]);
  });

  it('kopjes zetten de categorie voor de volgende lijnen', () => {
    const lines = parseKaartText('Bieren:\nDuvel 4,5\n\n# Frisdrank\nCola 2,8\nFanta');
    expect(lines).toEqual([
      { name: 'Duvel', price: '4.50', category: 'Bieren' },
      { name: 'Cola', price: '2.80', category: 'Frisdrank' },
      { name: 'Fanta', price: null, category: 'Frisdrank' },
    ]);
  });

  it('kolommen uit Excel (tab) en csv (;) met categorie', () => {
    expect(parseKaartText('Duvel\t4,50\tBieren\nCola;2,80;Frisdrank\nNootjes;;')).toEqual([
      { name: 'Duvel', price: '4.50', category: 'Bieren' },
      { name: 'Cola', price: '2.80', category: 'Frisdrank' },
      { name: 'Nootjes', price: null, category: null },
    ]);
  });

  it('een getal zonder naam is geen product; een naam met getallen blijft heel', () => {
    expect(parseKaartText('4,50')).toEqual([]);
    expect(parseKaartText('Rochefort 10 6,20')).toEqual([{ name: 'Rochefort 10', price: '6.20', category: null }]);
    expect(parseKaartText('Jupiler 0,0')).toEqual([{ name: 'Jupiler 0,0', price: null, category: null }]);
    expect(parseKaartText('Jupiler 0,0 3,20')).toEqual([{ name: 'Jupiler 0,0', price: '3.20', category: null }]);
  });

  it('knipt te lange namen af op 150 tekens', () => {
    expect(parseKaartText(`${'x'.repeat(200)} 1`)[0].name).toHaveLength(150);
  });
});

describe('findDuplicates', () => {
  it('vindt bestaande en herhaalde namen, hoofdletterongevoelig', () => {
    expect(findDuplicates([{ name: 'Duvel' }, { name: 'cola' }, { name: 'COLA ' }, { name: 'Fanta' }], ['duvel'])).toEqual(['existing', null, 'repeat', null]);
  });
});

describe('prijs in invoervelden', () => {
  it('leest komma en punt, toont per taal', () => {
    expect(priceFromInput('4,5')).toBe('4.50');
    expect(priceFromInput('')).toBeNull();
    expect(priceToInput(4.5, 'nl')).toBe('4,50');
    expect(priceToInput('4.5', 'en')).toBe('4.50');
  });
});

describe('startkaart', () => {
  it('heeft geen dubbele namen binnen of over groepen', () => {
    const all = STARTER_GROUPS.flatMap((g) => [...g.basic, ...(g.more ?? [])].map((n) => n.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('guessVatKind', () => {
  it('raadt dranken, frisdrank en eten', async () => {
    const { guessVatKind } = await import('../starterKaart');
    expect(guessVatKind('Bieren')).toBe('alcohol');
    expect(guessVatKind('Frisdranken')).toBe('soft');
    expect(guessVatKind('Warme dranken')).toBe('soft');
    expect(guessVatKind('Bieren 0,0')).toBe('soft');
    expect(guessVatKind('Snacks')).toBe('food');
    expect(guessVatKind('Pizza')).toBe('food');
    // Review: geen deelwoorden.
    expect(guessVatKind('Shots')).toBe('alcohol');
    expect(guessVatKind('Steaks')).toBe('food');
    expect(guessVatKind('Warme gerechten')).toBe('food');
    expect(guessVatKind('Waterzooi')).toBe('food');
    expect(guessVatKind('Безалкогольні напої')).toBe('soft');
    expect(guessVatKind('Thé et infusions')).toBe('soft');
    expect(guessVatKind('Cafés')).toBe('soft');
    expect(guessVatKind('Mocktails')).toBe('soft');
    expect(guessVatKind('Закуски')).toBe('food');
    expect(guessVatKind('Hotdogs')).toBe('food');
    expect(guessVatKind('Hot drinks')).toBe('soft');
    expect(guessVatKind('Cocktails')).toBe('alcohol');
    expect(guessVatKind('Thee en koffie')).toBe('soft');
    expect(guessVatKind('Alcoholvrije bieren')).toBe('soft');
  });
});

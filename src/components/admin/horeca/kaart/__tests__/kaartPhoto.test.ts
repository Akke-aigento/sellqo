import { describe, expect, it } from 'vitest';
import { KAART_PHOTO_MAX_ITEMS, parseKaartPhotoResponse, validImage } from '../../../../../../supabase/functions/_shared/kaartPhoto';

describe('parseKaartPhotoResponse', () => {
  it('leest JSON, ook met tekst of code-hekjes errond', () => {
    const text = 'Hier is het:\n```json\n{"items":[{"name":" Duvel ","price":4.5,"category":"Bieren"},{"name":"Cola","price":"2,80","category":null},{"name":"Soep","price":null,"category":"  "}]}\n```';
    expect(parseKaartPhotoResponse(text)).toEqual([
      { name: 'Duvel', price: '4.50', category: 'Bieren' },
      { name: 'Cola', price: '2.80', category: null },
      { name: 'Soep', price: null, category: null },
    ]);
  });

  it('gooit lege namen en onzinprijzen weg', () => {
    expect(parseKaartPhotoResponse('{"items":[{"name":"","price":3},{"name":"X","price":-2},{"name":"Y","price":"gratis"},{"name":"Z","price":1e9}]}')).toEqual([
      { name: 'X', price: null, category: null },
      { name: 'Y', price: null, category: null },
      { name: 'Z', price: null, category: null },
    ]);
  });

  it('onleesbaar antwoord = null (dan wordt niets afgerekend)', () => {
    expect(parseKaartPhotoResponse('sorry, ik zie niets')).toBeNull();
    expect(parseKaartPhotoResponse('{"items": "geen"}')).toBeNull();
    expect(parseKaartPhotoResponse('{kapot')).toBeNull();
  });

  it('knipt af op het maximum', () => {
    const items = Array.from({ length: KAART_PHOTO_MAX_ITEMS + 20 }, (_, i) => ({ name: `p${i}`, price: 1 }));
    expect(parseKaartPhotoResponse(JSON.stringify({ items }))).toHaveLength(KAART_PHOTO_MAX_ITEMS);
  });
});

describe('validImage', () => {
  it('enkel jpeg/png/webp als data-URL', () => {
    expect(validImage('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(validImage('data:image/webp;base64,AAAA')).toBe(true);
    expect(validImage('data:image/gif;base64,AAAA')).toBe(false);
    expect(validImage('https://x/y.jpg')).toBe(false);
    expect(validImage(12)).toBe(false);
  });
});

// SOCIAL-4 — recept-hulpfuncties: tekstvakken lezen en invullen, en niets uitvoerbaars doorlaten.
import { describe, expect, it } from 'vitest';
import { applySlots, editableImageIndexes, parseRecipe, readSlots, sanitizeRecipeHtml } from '@/lib/social/imageRecipe';

const html = `<!doctype html><html><head><style>.x{color:red}</style></head><body>
<div data-slot="titel" data-label="Titel" data-max="10">Classic Tee</div>
<div data-slot="regels" data-label="Regels" data-max="40" data-multiline="true">een<br>twee</div>
<div onclick="alert(1)">vast</div><script>alert(2)</script><img src="javascript:alert(3)">
</body></html>`;

describe('imageRecipe', () => {
  it('leest de tekstvakken met label, max en meerdere regels', () => {
    expect(readSlots(html)).toEqual([
      { key: 'titel', label: 'Titel', max: 10, multiline: false, value: 'Classic Tee' },
      { key: 'regels', label: 'Regels', max: 40, multiline: true, value: 'een\ntwee' },
    ]);
  });

  it('vult teksten in, kapt af op max en zet regels om naar <br>', () => {
    const out = applySlots(html, { titel: 'Warm de winter in', regels: 'a\nb\nc', onbekend: 'x' });
    const slots = readSlots(out);
    expect(slots[0].value).toBe('Warm de wi');
    expect(slots[1].value).toBe('a\nb\nc');
    expect(out).toContain('.x{color:red}');
  });

  it('een gewone regel krijgt geen regeleinde', () => {
    expect(readSlots(applySlots(html, { titel: 'a\nb' }))[0].value).toBe('a b');
  });

  it('verwijdert scripts, on…-attributen en javascript:-URL\'s', () => {
    const doc = sanitizeRecipeHtml(html);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('[onclick]')).toBeNull();
    expect(doc.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(applySlots(html, {})).not.toMatch(/alert/);
  });

  it('parseRecipe weigert ongeldige vormen', () => {
    expect(parseRecipe({ html, width: 1080, height: 1350 })).not.toBeNull();
    expect(parseRecipe({ html, width: 50, height: 1350 })).toBeNull();
    expect(parseRecipe({ width: 1080, height: 1350 })).toBeNull();
    expect(parseRecipe(null)).toBeNull();
  });

  it('editableImageIndexes: enkel beelden met een recept met tekstvakken', () => {
    const r = { version: 1, width: 1080, height: 1350, html };
    const zonder = { version: 1, width: 1080, height: 1350, html: '<p>niets</p>' };
    expect(editableImageIndexes({ image_urls: ['a', 'b', 'c'], image_recipes: [r, null, zonder] })).toEqual([0]);
    expect(editableImageIndexes({ image_urls: ['a'], image_recipes: null })).toEqual([]);
  });
});

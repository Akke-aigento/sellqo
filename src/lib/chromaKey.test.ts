import { describe, expect, it } from 'vitest';
import { keyOut, pickKeyColor } from './chromaKey';

// Testbeeld: 20x20, achtergrond bijna-magenta (zoals een model hem tekent), in het midden een
// wit vierkant met daarin één magenta pixel die moet blijven staan (niet met de rand verbonden).
function makeImage(bg: [number, number, number]) {
  const w = 20, h = 20, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const inside = x >= 5 && x < 15 && y >= 5 && y < 15;
    const c = inside ? [250, 250, 250] : bg;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  const mid = (10 * w + 10) * 4; px[mid] = 255; px[mid + 1] = 0; px[mid + 2] = 255;
  return { px, w, h };
}
const alpha = (px: Uint8ClampedArray, w: number, x: number, y: number) => px[(y * w + x) * 4 + 3];

describe('keyOut', () => {
  it('maakt de verbonden achtergrond doorzichtig en laat het product staan', () => {
    const { px, w, h } = makeImage([248, 6, 250]);
    expect(keyOut(px, w, h, 'magenta')).toBe(true);
    expect(alpha(px, w, 0, 0)).toBe(0);
    expect(alpha(px, w, 19, 19)).toBe(0);
    expect(alpha(px, w, 7, 7)).toBe(255);
    // magenta pixel midden in het product is niet met de rand verbonden: blijft
    expect(alpha(px, w, 10, 10)).toBe(255);
  });

  it('weigert als er geen effen sleutelrand is (model volgde de opdracht niet)', () => {
    const { px, w, h } = makeImage([30, 30, 30]);
    const before = px.slice();
    expect(keyOut(px, w, h, 'magenta')).toBe(false);
    expect(px).toEqual(before);
  });
});

describe('pickKeyColor', () => {
  it('kiest groen als de foto veel magenta bevat', () => {
    const px = new Uint8ClampedArray(400 * 4).fill(255);
    for (let i = 0; i < px.length; i += 4) { px[i + 1] = 0; }
    expect(pickKeyColor(px)).toBe('green');
  });
  it('kiest standaard magenta', () => {
    expect(pickKeyColor(new Uint8ClampedArray(400 * 4).fill(200))).toBe('magenta');
  });
});

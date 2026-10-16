import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHOTO_STANDARD, detectBorderColor, findContentBox, fitIntoFrame, hexToRgba, isOffStandard,
  adjustDest, planStandardization, resolveBackground, rgbaToHex, targetSize, type PixelGrid, type Rgba,
} from '@/lib/photoStandard';

/** Beeld van w×h in kleur `bg`, met een rechthoek `fg` op (x,y,rw,rh). */
function grid(w: number, h: number, bg: Rgba, fg?: { x: number; y: number; w: number; h: number; c: Rgba }): PixelGrid {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inFg = fg && x >= fg.x && x < fg.x + fg.w && y >= fg.y && y < fg.y + fg.h;
    const c = inFg ? fg!.c : bg;
    const i = (y * w + x) * 4;
    data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = c.a;
  }
  return { data, width: w, height: h };
}
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Rgba = { r: 250, g: 250, b: 250, a: 255 };
const CLEAR: Rgba = { r: 0, g: 0, b: 0, a: 0 };
const ON = { ...DEFAULT_PHOTO_STANDARD, enabled: true };

describe('PHOTO-STD-1 — formaat', () => {
  it('doelgrootte volgt uit verhouding en breedte', () => {
    expect(targetSize({ aspect_w: 3, aspect_h: 4, target_width: 1200 })).toEqual({ width: 1200, height: 1600 });
    expect(targetSize({ aspect_w: 1, aspect_h: 1, target_width: 1000 })).toEqual({ width: 1000, height: 1000 });
  });
  it('afwijkend formaat met 2% speling', () => {
    expect(isOffStandard(1200, 1600, ON)).toBe(false);
    expect(isOffStandard(1210, 1600, ON)).toBe(false);
    expect(isOffStandard(1600, 1200, ON)).toBe(true);
    expect(isOffStandard(1000, 1000, ON)).toBe(true);
    expect(isOffStandard(null, 1600, ON)).toBe(false);
  });
  it('hex heen en terug', () => {
    expect(hexToRgba('#0a0B0c')).toEqual({ r: 10, g: 11, b: 12, a: 255 });
    expect(hexToRgba('rood')).toBeNull();
    expect(rgbaToHex({ r: 10, g: 11, b: 12, a: 255 })).toBe('#0a0b0c');
  });
});

describe('PHOTO-STD-1 — achtergrond en kader', () => {
  it('herkent een effen zwarte rand', () => {
    expect(detectBorderColor(grid(40, 30, BLACK, { x: 10, y: 5, w: 20, h: 20, c: WHITE }))).toEqual(BLACK);
  });
  it('herkent een transparante rand', () => {
    expect(detectBorderColor(grid(20, 20, CLEAR, { x: 5, y: 5, w: 5, h: 5, c: WHITE }))?.a).toBe(0);
  });
  it('geen effen rand = null (echte foto): dan knippen we niets', () => {
    const g = grid(20, 20, BLACK);
    for (let x = 0; x < 20; x += 2) { const i = x * 4; g.data[i] = 200; g.data[i + 1] = 120; g.data[i + 2] = 40; }
    for (let y = 0; y < 20; y += 2) { const i = (y * 20 + 19) * 4; g.data[i] = 30; g.data[i + 1] = 160; g.data[i + 2] = 220; }
    expect(detectBorderColor(g)).toBeNull();
  });
  it('vindt het kader rond het product', () => {
    expect(findContentBox(grid(40, 30, BLACK, { x: 10, y: 5, w: 20, h: 20, c: WHITE }), BLACK)).toEqual({ x: 10, y: 5, w: 20, h: 20 });
    expect(findContentBox(grid(10, 10, BLACK), BLACK)).toBeNull();
  });
});

describe('PHOTO-STD-1 — plaatsen', () => {
  it('breed product in staand kader: breedte vult de marge, verticaal gecentreerd', () => {
    const d = fitIntoFrame({ w: 200, h: 100 }, { width: 1200, height: 1600 }, 8);
    const margin = 0.08 * 1200;
    expect(d.w).toBeCloseTo(1200 - 2 * margin);
    expect(d.x).toBeCloseTo(margin);
    expect(d.y + d.h / 2).toBeCloseTo(800);
  });
  it('hoog product: hoogte vult de marge', () => {
    const d = fitIntoFrame({ w: 100, h: 400 }, { width: 1200, height: 1600 }, 8);
    expect(d.h).toBeCloseTo(1600 - 2 * 96);
    expect(d.x + d.w / 2).toBeCloseTo(600);
  });
  it('achtergrondkeuze', () => {
    expect(resolveBackground('auto', BLACK)).toEqual(BLACK);
    expect(resolveBackground('auto', null)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(resolveBackground('auto', CLEAR)).toBeNull();
    expect(resolveBackground('transparent', BLACK)).toBeNull();
    expect(resolveBackground('#112233', null)).toEqual({ r: 17, g: 34, b: 51, a: 255 });
  });
  it('volledig plan: knipt de zwarte rand weg en rekent terug naar bronpixels', () => {
    // analysebeeld op halve grootte van een bron van 800×600
    const analysis = grid(400, 300, BLACK, { x: 100, y: 50, w: 200, h: 200, c: WHITE });
    const plan = planStandardization(analysis, 2, { width: 800, height: 600 }, ON);
    expect(plan.trimmed).toBe(true);
    expect(plan.source).toEqual({ x: 198, y: 98, w: 404, h: 404 });
    expect(plan.background).toEqual(BLACK);
    expect(plan.target).toEqual({ width: 1200, height: 1600 });
  });
  it('auto_trim uit: hele bron, geen knip', () => {
    const analysis = grid(400, 300, BLACK, { x: 100, y: 50, w: 200, h: 200, c: WHITE });
    const plan = planStandardization(analysis, 2, { width: 800, height: 600 }, { ...ON, auto_trim: false });
    expect(plan.trimmed).toBe(false);
    expect(plan.source).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });
});

describe('EDITOR-2 — bijsturen', () => {
  const target = { width: 1000, height: 1000 };
  const dest = { x: 250, y: 250, w: 500, h: 500 };
  it('zonder bijsturing blijft het kader gelijk', () => {
    expect(adjustDest(dest, target)).toEqual(dest);
  });
  it('zoom 2 verdubbelt rond hetzelfde midden', () => {
    expect(adjustDest(dest, target, { zoom: 2 })).toEqual({ x: 0, y: 0, w: 1000, h: 1000 });
  });
  it('verschuiving in procent van het doel', () => {
    expect(adjustDest(dest, target, { offsetX: 10, offsetY: -20 })).toEqual({ x: 350, y: 50, w: 500, h: 500 });
  });
  it('zoom blijft binnen 0,2 en 4', () => {
    expect(adjustDest(dest, target, { zoom: 100 }).w).toBe(2000);
    expect(adjustDest(dest, target, { zoom: 0 }).w).toBe(100);
  });
});

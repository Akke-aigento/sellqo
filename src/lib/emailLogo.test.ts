import { describe, expect, it } from 'vitest';
import {
  compressionHeights,
  emailLogoPath,
  emailLogoState,
  logoFileMeta,
  fnvHex,
  emailLogoSize,
  findTrimBox,
  svgIntrinsicSize,
  EMAIL_LOGO_HEIGHT,
  EMAIL_LOGO_MAX_WIDTH,
} from './emailLogo';

/** RGBA-buffer w×h met achtergrond `bg` en een rechthoek `fg` op (x, y, rw, rh). */
function image(w: number, h: number, bg: number[], fg?: { x: number; y: number; w: number; h: number; c: number[] }) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = fg && x >= fg.x && x < fg.x + fg.w && y >= fg.y && y < fg.y + fg.h;
      d.set(inside ? fg!.c : bg, (y * w + x) * 4);
    }
  }
  return d;
}

const TRANSPARENT = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

describe('findTrimBox', () => {
  it('knipt transparante randen weg', () => {
    const d = image(100, 50, TRANSPARENT, { x: 10, y: 5, w: 30, h: 20, c: BLACK });
    expect(findTrimBox(d, 100, 50)).toEqual({ x: 10, y: 5, width: 30, height: 20 });
  });

  it('knipt witte en bijna-witte randen weg', () => {
    const d = image(80, 40, [250, 250, 250, 255], { x: 0, y: 10, w: 80, h: 5, c: [200, 0, 0, 255] });
    expect(findTrimBox(d, 80, 40)).toEqual({ x: 0, y: 10, width: 80, height: 5 });
  });

  it('bijna-transparante pixels tellen als rand', () => {
    const d = image(20, 20, [0, 0, 0, 10], { x: 5, y: 5, w: 1, h: 1, c: BLACK });
    expect(findTrimBox(d, 20, 20)).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });

  it('alles achtergrond (wit logo op transparant) → null, dan niet bijsnijden', () => {
    expect(findTrimBox(image(10, 10, TRANSPARENT, { x: 2, y: 2, w: 3, h: 3, c: WHITE }), 10, 10)).toBeNull();
    expect(findTrimBox(image(10, 10, WHITE), 10, 10)).toBeNull();
  });

  it('niets te knippen → volledig beeld', () => {
    expect(findTrimBox(image(7, 3, BLACK), 7, 3)).toEqual({ x: 0, y: 0, width: 7, height: 3 });
  });
});

describe('emailLogoSize', () => {
  it('schaalt naar 176 px hoog, proportioneel', () => {
    expect(emailLogoSize(800, 400)).toEqual({ width: 352, height: 176, blurry: false });
  });

  it('begrenst de breedte op 600 px', () => {
    const s = emailLogoSize(3000, 300);
    expect(s.width).toBe(EMAIL_LOGO_MAX_WIDTH);
    expect(s.height).toBe(60);
    expect(s.blurry).toBe(false);
  });

  it('vergroot nooit; onder 88 px hoog → wazig-waarschuwing', () => {
    expect(emailLogoSize(120, 60)).toEqual({ width: 120, height: 60, blurry: true });
    expect(emailLogoSize(200, 88).blurry).toBe(false);
    expect(emailLogoSize(200, 87).blurry).toBe(true);
  });

  it('kleinere doelhoogte voor de compressiestap', () => {
    expect(emailLogoSize(1000, 500, 88)).toEqual({ width: 176, height: 88, blurry: false });
  });

  it('lege afbeelding → fout', () => {
    expect(() => emailLogoSize(0, 10)).toThrow();
  });

  it('compressiestappen dalen van 176 naar 88', () => {
    const h = compressionHeights();
    expect(h[0]).toBe(EMAIL_LOGO_HEIGHT);
    expect(h[h.length - 1]).toBe(88);
    expect([...h].sort((a, b) => b - a)).toEqual(h);
  });
});

describe('svgIntrinsicSize', () => {
  it('width en height in px', () => {
    expect(svgIntrinsicSize({ width: '240px', height: '80' })).toEqual({ width: 240, height: 80 });
  });
  it('zonder width/height: viewBox', () => {
    expect(svgIntrinsicSize({ viewBox: '0 0 300 100' })).toEqual({ width: 300, height: 100 });
  });
  it('enkel width + viewBox: hoogte volgt de verhouding', () => {
    expect(svgIntrinsicSize({ width: '600', viewBox: '0,0,300,100' })).toEqual({ width: 600, height: 200 });
  });
  it('procenten of niets: standaardmaat', () => {
    expect(svgIntrinsicSize({ width: '100%', height: '100%' })).toEqual({ width: 600, height: 176 });
    expect(svgIntrinsicSize({})).toEqual({ width: 600, height: 176 });
  });
});

describe('emailLogoPath', () => {
  it('<tenant>/email-logo-<hash>.png (eerste map = tenant, voor de storage-policy)', () => {
    expect(emailLogoPath('t-1', 'abc123')).toBe('t-1/email-logo-abc123.png');
  });
});

describe('fnvHex (terugval zonder crypto.subtle)', () => {
  it('16 hex-tekens, stabiel en inhoudsgevoelig', () => {
    const a = fnvHex(new Uint8Array([1, 2, 3]));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(fnvHex(new Uint8Array([1, 2, 3]))).toBe(a);
    expect(fnvHex(new Uint8Array([3, 2, 1]))).not.toBe(a);
  });
});

describe('MAIL-UX-1 emailLogoState', () => {
  const T = 'https://x.supabase.co/storage/v1/object/public/tenant-logos/logo/1.png';
  const B = 'https://x.supabase.co/storage/v1/object/public/tenant-logos/t/logo.png';

  it('themalogo gaat voor; zonder bron is een mailversie nodig', () => {
    expect(emailLogoState({ themeLogo: T, tenantLogo: B, emailLogoSource: null })).toEqual({ currentLogo: T, target: 'theme', needsVariant: true });
  });

  it('zonder themalogo het bedrijfslogo', () => {
    expect(emailLogoState({ themeLogo: '  ', tenantLogo: B })).toEqual({ currentLogo: B, target: 'tenant', needsVariant: true });
  });

  it('niet opnieuw als de bron al bij dit logo hoort (ook als de variant leeg bleef)', () => {
    expect(emailLogoState({ themeLogo: T, emailLogoSource: T }).needsVariant).toBe(false);
  });

  it('wel opnieuw als de bron bij een vorig logo hoort', () => {
    expect(emailLogoState({ themeLogo: T, emailLogoSource: B }).needsVariant).toBe(true);
  });

  it('geen logo of geen http(s)-URL: niets te doen', () => {
    expect(emailLogoState({}).needsVariant).toBe(false);
    expect(emailLogoState({ tenantLogo: 'data:image/png;base64,AAA' }).needsVariant).toBe(false);
  });
});

describe('MAIL-UX-1 logoFileMeta', () => {
  it('neemt het type uit de response', () => {
    expect(logoFileMeta('https://x/a/logo.png', 'image/png; charset=binary')).toEqual({ name: 'logo.png', type: 'image/png' });
  });
  it('valt terug op de extensie (SVG blijft herkenbaar voor createEmailLogoVariant)', () => {
    expect(logoFileMeta('https://x/a/merk%20logo.svg', 'application/octet-stream')).toEqual({ name: 'merk logo.svg', type: 'image/svg+xml' });
  });
});

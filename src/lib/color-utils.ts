/**
 * WCAG 2.1 Contrast Ratio Utilities
 */

/** Parse hex color to RGB [0-255] */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Calculate relative luminance per WCAG 2.1 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Get WCAG contrast ratio between two hex colors (1:1 to 21:1) */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG compliance level */
export type ContrastLevel = 'good' | 'low' | 'fail';

export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return 'good';
  if (ratio >= 3.0) return 'low';
  return 'fail';
}

export function getContrastLabel(level: ContrastLevel): string {
  switch (level) {
    case 'good': return 'AA OK';
    case 'low': return 'Laag contrast – grote tekst OK';
    case 'fail': return 'Onleesbaar! Pas kleur aan';
  }
}

/** Convert hex to HSL */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(c => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Convert HSL to hex */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Adjust lightness of a hex color to meet minimum contrast against a background */
export function adjustForContrast(color: string, background: string, minRatio = 4.5): string {
  const ratio = getContrastRatio(color, background);
  if (ratio >= minRatio) return color;
  
  const [h, s, l] = hexToHsl(color);
  const bgLum = relativeLuminance(background);
  const isDarkBg = bgLum < 0.5;
  
  // Try adjusting lightness in the right direction
  for (let step = 1; step <= 80; step++) {
    const newL = isDarkBg 
      ? Math.min(95, l + step) 
      : Math.max(5, l - step);
    const adjusted = hslToHex(h, s, newL);
    if (getContrastRatio(adjusted, background) >= minRatio) return adjusted;
  }
  
  // Fallback: white or black
  return isDarkBg ? '#ffffff' : '#000000';
}

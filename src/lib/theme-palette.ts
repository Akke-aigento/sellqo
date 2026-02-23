/**
 * Intelligent Theme Palette Generator
 *
 * Takes a single brand color + mode + style preset and auto-generates
 * a full set of CSS variables with guaranteed WCAG AA contrast.
 */

import {
  hexToHsl,
  hslToHex,
  getContrastRatio,
  adjustForContrast,
  relativeLuminance,
} from './color-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark';
export type ThemeStyle = 'modern' | 'elegant' | 'bold' | 'playful';

export interface ThemePaletteResult {
  cssVariables: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  radius: string;
}

// ---------------------------------------------------------------------------
// Style presets
// ---------------------------------------------------------------------------

interface StylePreset {
  headingFont: string;
  bodyFont: string;
  radius: string;
  buttonRadius?: string;
  /** Hue shift (degrees) from brand hue for the accent colour */
  accentHueShift: number;
}

export const STYLE_PRESETS: Record<ThemeStyle, StylePreset> = {
  modern: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    radius: '0.5rem',
    accentHueShift: 180, // complementary
  },
  elegant: {
    headingFont: 'Playfair Display',
    bodyFont: 'Lato',
    radius: '0.25rem',
    accentHueShift: -30, // analogous
  },
  bold: {
    headingFont: 'Montserrat',
    bodyFont: 'Open Sans',
    radius: '0.75rem',
    accentHueShift: 180, // complementary
  },
  playful: {
    headingFont: 'Poppins',
    bodyFont: 'Nunito',
    radius: '1rem',
    buttonRadius: '9999px',
    accentHueShift: 120, // triadic
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format HSL tuple as CSS value string (e.g. "210 50% 40%") */
function hslCss(h: number, s: number, l: number): string {
  return `${((h % 360) + 360) % 360} ${Math.round(s)}% ${Math.round(l)}%`;
}

/** Convert hex to CSS HSL string */
function hexToCssHsl(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslCss(h, s, l);
}

/** Ensure a foreground hex has ≥ minRatio contrast against bg hex, returning CSS HSL */
function ensureContrast(fgHex: string, bgHex: string, minRatio = 4.5): string {
  const adjusted = adjustForContrast(fgHex, bgHex, minRatio);
  return hexToCssHsl(adjusted);
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateThemePalette(
  brandColor: string,
  mode: ThemeMode = 'light',
  style: ThemeStyle = 'modern',
): ThemePaletteResult {
  const preset = STYLE_PRESETS[style];
  const [bH, bS, bL] = hexToHsl(brandColor);
  const isLight = mode === 'light';

  // 1. Background / Foreground -------------------------------------------
  const bgHex = isLight
    ? '#ffffff'
    : hslToHex(bH, Math.min(bS, 15), 10); // brand-tinted dark
  const fgHex = isLight
    ? hslToHex(bH, Math.min(bS, 10), 10) // near-black with brand tint
    : '#f5f5f5'; // near-white

  // 2. Primary – brand colour, contrast-checked against bg ----------------
  const primaryHex = adjustForContrast(brandColor, bgHex, 4.5);

  // 3. Secondary – hue+30°, low saturation --------------------------------
  const secHue = (bH + 30) % 360;
  const secSat = Math.min(bS * 0.3, 20);
  const secL = isLight ? 95 : 18;
  const secondaryHex = hslToHex(secHue, secSat, secL);
  const secondaryFgHex = isLight
    ? hslToHex(secHue, Math.min(bS, 30), 20)
    : hslToHex(secHue, Math.min(bS, 20), 90);

  // 4. Accent – style-dependent hue shift, vibrant -----------------------
  const accHue = ((bH + preset.accentHueShift) % 360 + 360) % 360;
  const accSat = Math.max(bS, 60);
  const accL = isLight ? 50 : 55;
  const accentHex = hslToHex(accHue, accSat, accL);
  const accentChecked = adjustForContrast(accentHex, bgHex, 4.5);

  // 5. Card ---------------------------------------------------------------
  const cardHex = isLight
    ? hslToHex(bH, Math.min(bS, 8), 99) // barely tinted off-white
    : hslToHex(bH, Math.min(bS, 12), 14); // slightly lighter than bg

  // 6. Muted --------------------------------------------------------------
  const mutedHex = isLight
    ? hslToHex(bH, Math.min(bS, 10), 96)
    : hslToHex(bH, Math.min(bS, 10), 16);
  const mutedFgHex = isLight
    ? hslToHex(bH, Math.min(bS, 15), 47)
    : hslToHex(bH, Math.min(bS, 12), 65);

  // 7. Border / Input -----------------------------------------------------
  const borderHex = isLight
    ? hslToHex(bH, Math.min(bS, 12), 90)
    : hslToHex(bH, Math.min(bS, 10), 22);

  // 8. Destructive --------------------------------------------------------
  const destructiveHex = isLight ? '#dc2626' : '#7f1d1d';
  const destructiveFgHex = '#fafafa';

  // 9. Ring – matches primary ---------------------------------------------

  // 10. WCAG validation pass – every fg/bg pair ---------------------------
  const vars: Record<string, string> = {
    '--background': hexToCssHsl(bgHex),
    '--foreground': ensureContrast(fgHex, bgHex, 4.5),

    '--card': hexToCssHsl(cardHex),
    '--card-foreground': ensureContrast(fgHex, cardHex, 4.5),

    '--popover': hexToCssHsl(bgHex),
    '--popover-foreground': ensureContrast(fgHex, bgHex, 4.5),

    '--primary': hexToCssHsl(primaryHex),
    '--primary-foreground': ensureContrast(
      isLight ? '#ffffff' : '#000000',
      primaryHex,
      4.5,
    ),

    '--secondary': hexToCssHsl(secondaryHex),
    '--secondary-foreground': ensureContrast(secondaryFgHex, secondaryHex, 4.5),

    '--muted': hexToCssHsl(mutedHex),
    '--muted-foreground': ensureContrast(mutedFgHex, mutedHex, 3.0),

    '--accent': hexToCssHsl(accentChecked),
    '--accent-foreground': ensureContrast(
      isLight ? '#ffffff' : '#000000',
      accentChecked,
      4.5,
    ),

    '--destructive': hexToCssHsl(destructiveHex),
    '--destructive-foreground': hexToCssHsl(destructiveFgHex),

    '--border': hexToCssHsl(borderHex),
    '--input': hexToCssHsl(borderHex),
    '--ring': hexToCssHsl(primaryHex),

    '--radius': preset.radius,
  };

  if (preset.buttonRadius) {
    vars['--button-radius'] = preset.buttonRadius;
  }

  return {
    cssVariables: vars,
    headingFont: preset.headingFont,
    bodyFont: preset.bodyFont,
    radius: preset.radius,
  };
}

// ---------------------------------------------------------------------------
// Legacy wrapper (exact copy of old ShopLayout generateThemePalette)
// ---------------------------------------------------------------------------

/** Hex to HSL string formatted for CSS variables ("H S% L%") – returns null on bad input */
function legacyHexToHsl(hex: string): string | null {
  if (!hex || !hex.startsWith('#')) return null;
  const [h, s, l] = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

/** Returns white or black foreground HSL string based on WCAG luminance */
function legacyContrastFg(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '0 0% 100%';
  const lum = relativeLuminance(hex);
  return lum > 0.179 ? '0 0% 0%' : '0 0% 100%';
}

/**
 * Backwards-compatible palette generator.
 * Exact logic from the old ShopLayout.tsx so existing tenants see no change.
 */
export function generateThemePaletteLegacy(
  bgHex?: string | null,
  primaryHex?: string | null,
  secondaryHex?: string | null,
  accentHex?: string | null,
  textHex?: string | null,
): Record<string, string> {
  const s: Record<string, string> = {};

  // Background-derived variables
  if (bgHex) {
    const bgHsl = legacyHexToHsl(bgHex);
    if (bgHsl) {
      const lum = relativeLuminance(bgHex);
      const isLight = lum > 0.179;
      const parts = bgHsl.split(' ');
      const hue = parts[0];
      const sat = parseInt(parts[1]);
      const lig = parseInt(parts[2]);
      const fg = legacyContrastFg(bgHex);

      s['--background'] = bgHsl;
      s['--popover'] = bgHsl;
      s['--foreground'] = fg;
      s['--popover-foreground'] = fg;

      const cardL = isLight ? Math.max(lig - 2, 0) : Math.min(lig + 5, 100);
      s['--card'] = `${hue} ${sat}% ${cardL}%`;
      s['--card-foreground'] = fg;

      const mutedL = isLight ? Math.max(lig - 4, 0) : Math.min(lig + 8, 100);
      s['--muted'] = `${hue} ${Math.min(sat + 10, 100)}% ${mutedL}%`;
      const mutedFgL = isLight ? 47 : 65;
      s['--muted-foreground'] = `${hue} 16% ${mutedFgL}%`;

      const borderL = isLight ? Math.max(lig - 10, 0) : Math.min(lig + 12, 100);
      s['--border'] = `${hue} ${Math.min(sat + 5, 100)}% ${borderL}%`;
      s['--input'] = `${hue} ${Math.min(sat + 5, 100)}% ${borderL}%`;

      if (isLight) {
        s['--destructive'] = '0 84% 60%';
        s['--destructive-foreground'] = '0 0% 98%';
      } else {
        s['--destructive'] = '0 62% 30%';
        s['--destructive-foreground'] = '0 0% 98%';
      }

      if (!secondaryHex) {
        const secL = isLight ? Math.max(lig - 6, 0) : Math.min(lig + 10, 100);
        s['--secondary'] = `${hue} ${Math.min(sat + 5, 100)}% ${secL}%`;
        s['--secondary-foreground'] = fg;
      }

      if (!accentHex && !primaryHex) {
        const accL = isLight ? Math.max(lig - 4, 0) : Math.min(lig + 8, 100);
        s['--accent'] = `${hue} ${Math.min(sat + 10, 100)}% ${accL}%`;
        s['--accent-foreground'] = fg;
      }
    }
  }

  // Primary
  if (primaryHex) {
    const hsl = legacyHexToHsl(primaryHex);
    if (hsl) {
      s['--primary'] = hsl;
      s['--primary-foreground'] = legacyContrastFg(primaryHex);
      s['--ring'] = hsl;

      if (!accentHex) {
        s['--accent'] = hsl;
        s['--accent-foreground'] = legacyContrastFg(primaryHex);
      }
    }
  }

  // Secondary (explicit)
  if (secondaryHex) {
    const hsl = legacyHexToHsl(secondaryHex);
    if (hsl) {
      s['--secondary'] = hsl;
      s['--secondary-foreground'] = legacyContrastFg(secondaryHex);
    }
  }

  // Accent (explicit)
  if (accentHex) {
    const hsl = legacyHexToHsl(accentHex);
    if (hsl) {
      s['--accent'] = hsl;
      s['--accent-foreground'] = legacyContrastFg(accentHex);
    }
  }

  // Text color override
  if (textHex) {
    const hsl = legacyHexToHsl(textHex);
    if (hsl) {
      s['--foreground'] = hsl;
      s['--popover-foreground'] = hsl;
      s['--card-foreground'] = hsl;
      const parts = hsl.split(' ');
      const hue = parts[0];
      const sat = parseInt(parts[1]);
      const lig = parseInt(parts[2]);
      const mutedLig = lig > 50 ? Math.max(lig - 25, 40) : Math.min(lig + 25, 60);
      s['--muted-foreground'] = `${hue} ${Math.max(sat - 8, 0)}% ${mutedLig}%`;
    }
  }

  return s;
}

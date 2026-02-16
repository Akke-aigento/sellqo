import { useState } from 'react';
import { Wand2, Check, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hexToHsl, hslToHex, getContrastRatio, getContrastLevel, adjustForContrast } from '@/lib/color-utils';

interface PaletteColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface PaletteConfig {
  name: string;
  description: string;
  generate: (h: number, s: number, l: number) => PaletteColors;
}

const PALETTE_STRATEGIES: PaletteConfig[] = [
  {
    name: 'Complementair',
    description: 'Maximaal contrast',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, Math.min(l, 50)),
      secondary: hslToHex(h, Math.max(s - 20, 10), 70),
      accent: hslToHex((h + 180) % 360, s, 45),
      background: l > 50 ? '#ffffff' : '#0f0f0f',
      text: l > 50 ? '#1a1a1a' : '#f0f0f0',
    }),
  },
  {
    name: 'Analoog',
    description: 'Harmonieus',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, Math.min(l, 45)),
      secondary: hslToHex((h + 30) % 360, Math.max(s - 15, 10), 55),
      accent: hslToHex((h - 30 + 360) % 360, s, 50),
      background: '#ffffff',
      text: '#1a1a1a',
    }),
  },
  {
    name: 'Triadisch',
    description: 'Drie gelijke kleuren',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, Math.min(l, 45)),
      secondary: hslToHex((h + 120) % 360, Math.max(s - 10, 15), 50),
      accent: hslToHex((h + 240) % 360, s, 50),
      background: '#fafafa',
      text: '#111111',
    }),
  },
  {
    name: 'Monochroom',
    description: 'Clean & strak',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, 35),
      secondary: hslToHex(h, Math.max(s - 30, 10), 55),
      accent: hslToHex(h, s, 45),
      background: hslToHex(h, Math.max(s - 60, 5), 97),
      text: hslToHex(h, Math.max(s - 40, 10), 15),
    }),
  },
  {
    name: 'Split-Complement',
    description: 'Gebalanceerd',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, Math.min(l, 45)),
      secondary: hslToHex((h + 150) % 360, Math.max(s - 10, 15), 50),
      accent: hslToHex((h + 210) % 360, s, 50),
      background: '#ffffff',
      text: '#1a1a1a',
    }),
  },
];

function ensureContrast(palette: PaletteColors): PaletteColors {
  return {
    ...palette,
    primary: adjustForContrast(palette.primary, palette.background, 3.0),
    accent: adjustForContrast(palette.accent, palette.background, 3.0),
    text: adjustForContrast(palette.text, palette.background, 4.5),
  };
}

function getPaletteContrastLevel(palette: PaletteColors): 'good' | 'low' | 'fail' {
  const textRatio = getContrastRatio(palette.text, palette.background);
  const primaryRatio = getContrastRatio(palette.primary, palette.background);
  const accentRatio = getContrastRatio(palette.accent, palette.background);
  const worst = Math.min(textRatio, primaryRatio, accentRatio);
  return getContrastLevel(worst);
}

interface ColorPaletteGeneratorProps {
  currentColors: PaletteColors;
  onApply: (colors: PaletteColors) => void;
}

export function ColorPaletteGenerator({ currentColors, onApply }: ColorPaletteGeneratorProps) {
  const [h, s, l] = hexToHsl(currentColors.primary || '#3b82f6');

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {PALETTE_STRATEGIES.map((strategy) => {
          const rawPalette = strategy.generate(h, s, l);
          const palette = ensureContrast(rawPalette);
          const contrastLevel = getPaletteContrastLevel(palette);

          return (
            <button
              key={strategy.name}
              className="rounded-lg border p-2.5 hover:border-primary/50 transition-colors text-left flex items-center gap-3 group"
              onClick={() => onApply(palette)}
            >
              {/* Color strip */}
              <div className="flex rounded-md overflow-hidden h-8 w-28 shrink-0">
                {Object.entries(palette).map(([key, color]) => (
                  <div
                    key={key}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{strategy.name}</span>
                  {contrastLevel === 'good' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <AlertTriangle className={cn(
                      "h-3 w-3",
                      contrastLevel === 'low' ? 'text-orange-500' : 'text-red-500'
                    )} />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{strategy.description}</span>
              </div>

              {/* Mini preview */}
              <div
                className="rounded-sm p-1.5 flex items-center gap-1 shrink-0"
                style={{ backgroundColor: palette.background, color: palette.text }}
              >
                <div
                  className="px-1.5 py-0.5 rounded text-[7px] text-white font-medium"
                  style={{ backgroundColor: palette.primary }}
                >
                  Btn
                </div>
                <span className="text-[7px] font-bold" style={{ color: palette.accent }}>
                  €29
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

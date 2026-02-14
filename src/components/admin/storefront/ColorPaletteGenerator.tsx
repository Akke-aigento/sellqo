import { useState } from 'react';
import { Wand2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Color utility functions
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
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

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface PaletteConfig {
  name: string;
  description: string;
  generate: (h: number, s: number, l: number) => {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

const PALETTE_STRATEGIES: PaletteConfig[] = [
  {
    name: 'Complementair',
    description: 'Tegenovergestelde kleur voor maximaal contrast',
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
    description: 'Naburige kleuren voor een harmonieus geheel',
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
    description: 'Drie gelijkmatig verdeelde kleuren',
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
    description: 'Tinten van dezelfde kleur voor een clean look',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, 35),
      secondary: hslToHex(h, Math.max(s - 30, 10), 55),
      accent: hslToHex(h, s, 45),
      background: hslToHex(h, Math.max(s - 60, 5), 97),
      text: hslToHex(h, Math.max(s - 40, 10), 15),
    }),
  },
  {
    name: 'Split-Complementair',
    description: 'Twee kleuren naast de complement voor balans',
    generate: (h, s, l) => ({
      primary: hslToHex(h, s, Math.min(l, 45)),
      secondary: hslToHex((h + 150) % 360, Math.max(s - 10, 15), 50),
      accent: hslToHex((h + 210) % 360, s, 50),
      background: '#ffffff',
      text: '#1a1a1a',
    }),
  },
];

interface ColorPaletteGeneratorProps {
  baseColor: string;
  onApply: (colors: { primary: string; secondary: string; accent: string; background?: string; text?: string }) => void;
}

export function ColorPaletteGenerator({ baseColor, onApply }: ColorPaletteGeneratorProps) {
  const [inputColor, setInputColor] = useState(baseColor || '#3b82f6');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const [h, s, l] = hexToHsl(inputColor);

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          Kleurpalet Generator
        </h3>
        <p className="text-xs text-muted-foreground">
          Kies een basekleur en genereer automatisch harmonieuze paletten
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Basekleur</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={inputColor}
              onChange={(e) => setInputColor(e.target.value)}
              className="w-10 h-9 p-0.5 cursor-pointer"
            />
            <Input
              value={inputColor}
              onChange={(e) => setInputColor(e.target.value)}
              className="w-24 h-9 text-xs font-mono"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground pb-1">
          HSL: {h}° / {s}% / {l}%
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PALETTE_STRATEGIES.map((strategy) => {
          const palette = strategy.generate(h, s, l);
          return (
            <div
              key={strategy.name}
              className="rounded-lg border p-3 space-y-2 hover:border-primary/50 transition-colors"
            >
              <div>
                <p className="text-xs font-semibold">{strategy.name}</p>
                <p className="text-[10px] text-muted-foreground">{strategy.description}</p>
              </div>

              {/* Palette strip */}
              <div className="flex rounded-md overflow-hidden h-8">
                {Object.entries(palette).map(([key, color]) => (
                  <button
                    key={key}
                    className="flex-1 relative group"
                    style={{ backgroundColor: color }}
                    onClick={() => handleCopy(color)}
                    title={`${key}: ${color}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {copiedColor === color ? (
                        <Check className="h-3 w-3 text-white drop-shadow-md" />
                      ) : (
                        <Copy className="h-3 w-3 text-white drop-shadow-md" />
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {/* Mini preview */}
              <div
                className="rounded-sm p-2 h-12 flex items-center gap-2"
                style={{ backgroundColor: palette.background, color: palette.text }}
              >
                <div
                  className="px-2 py-0.5 rounded text-[7px] text-white font-medium"
                  style={{ backgroundColor: palette.primary }}
                >
                  Button
                </div>
                <span className="text-[7px] font-bold" style={{ color: palette.accent }}>
                  €29,99
                </span>
                <span className="text-[7px] opacity-60">Tekst</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => onApply({
                  primary: palette.primary,
                  secondary: palette.secondary,
                  accent: palette.accent,
                  background: palette.background,
                  text: palette.text,
                })}
              >
                Toepassen
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

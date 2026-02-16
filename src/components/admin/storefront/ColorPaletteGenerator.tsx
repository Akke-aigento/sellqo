import { useState, useEffect } from 'react';
import { Wand2, Copy, Check, Link2, Unlink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

/** Auto-correct palette colors for readability */
function ensureContrast(palette: PaletteColors): PaletteColors {
  return {
    ...palette,
    primary: adjustForContrast(palette.primary, palette.background, 3.0),
    accent: adjustForContrast(palette.accent, palette.background, 3.0),
    text: adjustForContrast(palette.text, palette.background, 4.5),
  };
}

/** Get worst contrast level across key pairs */
function getPaletteContrastLevel(palette: PaletteColors): 'good' | 'low' | 'fail' {
  const textRatio = getContrastRatio(palette.text, palette.background);
  const primaryRatio = getContrastRatio(palette.primary, palette.background);
  const accentRatio = getContrastRatio(palette.accent, palette.background);
  
  const worst = Math.min(textRatio, primaryRatio, accentRatio);
  return getContrastLevel(worst);
}

interface ColorPaletteGeneratorProps {
  baseColor: string;
  onApply: (colors: { primary: string; secondary: string; accent: string; background?: string; text?: string }) => void;
  activeMood?: { name: string; color: string };
}

export function ColorPaletteGenerator({ baseColor, onApply, activeMood }: ColorPaletteGeneratorProps) {
  const [inputColor, setInputColor] = useState(baseColor || '#3b82f6');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [linkedToMood, setLinkedToMood] = useState(!!activeMood);

  useEffect(() => {
    if (activeMood) {
      setInputColor(activeMood.color);
      setLinkedToMood(true);
    }
  }, [activeMood]);

  useEffect(() => {
    if (!activeMood) {
      setInputColor(baseColor || '#3b82f6');
    }
  }, [baseColor, activeMood]);

  const handleColorChange = (color: string) => {
    setInputColor(color);
    if (activeMood && color !== activeMood.color) {
      setLinkedToMood(false);
    }
  };

  const relinkToMood = () => {
    if (activeMood) {
      setInputColor(activeMood.color);
      setLinkedToMood(true);
    }
  };

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
          {activeMood && linkedToMood
            ? `Paletten gebaseerd op de "${activeMood.name}" mood`
            : 'Kies een basekleur en genereer automatisch harmonieuze paletten'
          }
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Basekleur</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={inputColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-10 h-9 p-0.5 cursor-pointer"
            />
            <Input
              value={inputColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-24 h-9 text-xs font-mono"
            />
          </div>
        </div>
        {activeMood && (
          <div className="flex items-center gap-1.5 pb-0.5">
            {linkedToMood ? (
              <Badge variant="secondary" className="text-[10px] gap-1 cursor-default">
                <Link2 className="h-3 w-3" />
                {activeMood.name}
              </Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] gap-1 text-muted-foreground"
                onClick={relinkToMood}
              >
                <Unlink className="h-3 w-3" />
                Herlink naar {activeMood.name}
              </Button>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground pb-1">
          HSL: {h}° / {s}% / {l}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PALETTE_STRATEGIES.map((strategy) => {
          const rawPalette = strategy.generate(h, s, l);
          const palette = ensureContrast(rawPalette);
          const contrastLevel = getPaletteContrastLevel(palette);
          
          return (
            <div
              key={strategy.name}
              className="rounded-lg border p-2 space-y-1.5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold">{strategy.name}</p>
                  <p className="text-[10px] text-muted-foreground">{strategy.description}</p>
                </div>
                {contrastLevel === 'good' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className={cn(
                    "h-3.5 w-3.5 shrink-0 mt-0.5",
                    contrastLevel === 'low' ? 'text-orange-500' : 'text-red-500'
                  )} />
                )}
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
                className="rounded-sm p-1.5 h-9 flex items-center gap-1.5"
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

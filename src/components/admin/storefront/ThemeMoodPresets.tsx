import { Sparkles, Gem, Zap, Leaf, Palette, Sun, Moon, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MoodPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  header_style: 'standard' | 'centered' | 'minimal';
  product_card_style: string;
}

const MOOD_PRESETS: MoodPreset[] = [
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'Elegant, donker, premium uitstraling',
    icon: <Gem className="h-4 w-4" />,
    primary_color: '#c9a96e',
    secondary_color: '#2c2c2c',
    accent_color: '#d4af37',
    background_color: '#0f0f0f',
    text_color: '#e8e8e8',
    heading_font: 'Playfair Display',
    body_font: 'Lato',
    header_style: 'minimal',
    product_card_style: 'minimal',
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Vrolijk, kleurrijk, energiek',
    icon: <Sparkles className="h-4 w-4" />,
    primary_color: '#ff6b6b',
    secondary_color: '#ffd93d',
    accent_color: '#6bcb77',
    background_color: '#fffdf7',
    text_color: '#2d3436',
    heading_font: 'Poppins',
    body_font: 'Nunito',
    header_style: 'centered',
    product_card_style: 'standard',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Sterk, contrasterend, impactvol',
    icon: <Zap className="h-4 w-4" />,
    primary_color: '#e63946',
    secondary_color: '#1d3557',
    accent_color: '#f1faee',
    background_color: '#ffffff',
    text_color: '#1d3557',
    heading_font: 'Montserrat',
    body_font: 'Work Sans',
    header_style: 'standard',
    product_card_style: 'detailed',
  },
  {
    id: 'organic',
    name: 'Organic',
    description: 'Natuurlijk, warm, aards',
    icon: <Leaf className="h-4 w-4" />,
    primary_color: '#606c38',
    secondary_color: '#dda15e',
    accent_color: '#bc6c25',
    background_color: '#fefae0',
    text_color: '#283618',
    heading_font: 'Merriweather',
    body_font: 'Source Sans Pro',
    header_style: 'standard',
    product_card_style: 'standard',
  },
  {
    id: 'minimal-light',
    name: 'Clean Light',
    description: 'Strak, wit, modern',
    icon: <Sun className="h-4 w-4" />,
    primary_color: '#000000',
    secondary_color: '#6b7280',
    accent_color: '#3b82f6',
    background_color: '#ffffff',
    text_color: '#111827',
    heading_font: 'DM Sans',
    body_font: 'Inter',
    header_style: 'minimal',
    product_card_style: 'minimal',
  },
  {
    id: 'minimal-dark',
    name: 'Clean Dark',
    description: 'Strak, donker, sophisticated',
    icon: <Moon className="h-4 w-4" />,
    primary_color: '#ffffff',
    secondary_color: '#a1a1aa',
    accent_color: '#22d3ee',
    background_color: '#09090b',
    text_color: '#fafafa',
    heading_font: 'Space Grotesk',
    body_font: 'Inter',
    header_style: 'minimal',
    product_card_style: 'minimal',
  },
  {
    id: 'warm',
    name: 'Warm & Cozy',
    description: 'Uitnodigend, gezellig, ambachtelijk',
    icon: <Flame className="h-4 w-4" />,
    primary_color: '#a0522d',
    secondary_color: '#d2691e',
    accent_color: '#cd853f',
    background_color: '#faf0e6',
    text_color: '#3e2723',
    heading_font: 'Playfair Display',
    body_font: 'Raleway',
    header_style: 'centered',
    product_card_style: 'standard',
  },
  {
    id: 'tech',
    name: 'Tech & Future',
    description: 'Futuristisch, neon, cutting-edge',
    icon: <Palette className="h-4 w-4" />,
    primary_color: '#8b5cf6',
    secondary_color: '#06b6d4',
    accent_color: '#f472b6',
    background_color: '#0c0a1a',
    text_color: '#e2e8f0',
    heading_font: 'Space Grotesk',
    body_font: 'DM Sans',
    header_style: 'standard',
    product_card_style: 'detailed',
  },
];

interface ThemeMoodPresetsProps {
  onSelect: (preset: MoodPreset) => void;
  activePresetId?: string;
}

export function ThemeMoodPresets({ onSelect, activePresetId }: ThemeMoodPresetsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Mood Presets
        </h3>
        <p className="text-xs text-muted-foreground">
          Kies een sfeer — kleuren, fonts en layout worden automatisch ingesteld
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {MOOD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={cn(
              'relative group rounded-lg border-2 p-3 text-left transition-all hover:shadow-md',
              activePresetId === preset.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50'
            )}
          >
            {/* Color dots preview */}
            <div className="flex gap-1 mb-2">
              {[preset.primary_color, preset.secondary_color, preset.accent_color].map((c, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
              <div
                className="w-4 h-4 rounded-full border border-black/10 ml-auto"
                style={{ backgroundColor: preset.background_color }}
              />
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-muted-foreground">{preset.icon}</span>
              <span className="text-xs font-semibold">{preset.name}</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">{preset.description}</p>

            {/* Mini preview strip */}
            <div
              className="mt-2 h-6 rounded-sm overflow-hidden flex"
              style={{ backgroundColor: preset.background_color }}
            >
              <div className="w-1/3 h-full" style={{ backgroundColor: preset.primary_color }} />
              <div className="flex-1 flex items-center justify-center">
                <span
                  className="text-[6px] font-bold"
                  style={{ color: preset.text_color, fontFamily: preset.heading_font }}
                >
                  Aa
                </span>
              </div>
              <div className="w-2 h-full" style={{ backgroundColor: preset.accent_color }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

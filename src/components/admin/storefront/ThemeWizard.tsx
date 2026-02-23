import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun, Moon, Palette, LayoutTemplate, Check, ChevronLeft, ChevronRight,
  Rocket, Settings2, Save, Eye,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { generateThemePalette, STYLE_PRESETS, type ThemeMode, type ThemeStyle } from '@/lib/theme-palette';
import { hslToHex, hexToHsl, getContrastRatio, getContrastLevel } from '@/lib/color-utils';
import { LiveThemePreview } from './LiveThemePreview';
import { GOOGLE_FONTS, HEADER_STYLES, PRODUCT_CARD_STYLES } from '@/types/storefront';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  { hex: '#0d9488', label: 'Teal' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#374151', label: 'Charcoal' },
];

type MoodId = 'light-clean' | 'dark-premium' | 'colorful-playful' | 'minimalist-sleek';

interface MoodOption {
  id: MoodId;
  i18nKey: string;
  mode: ThemeMode;
  style: ThemeStyle;
  icon: typeof Sun;
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: 'light-clean', i18nKey: 'lightClean', mode: 'light', style: 'modern', icon: Sun },
  { id: 'dark-premium', i18nKey: 'darkPremium', mode: 'dark', style: 'elegant', icon: Moon },
  { id: 'colorful-playful', i18nKey: 'colorfulPlayful', mode: 'light', style: 'playful', icon: Palette },
  { id: 'minimalist-sleek', i18nKey: 'minimalistSleek', mode: 'light', style: 'modern', icon: LayoutTemplate },
];

type StyleId = 'modern' | 'elegant' | 'bold';

interface StyleOption {
  id: StyleId;
  i18nKey: string;
  headingFont: string;
  bodyFont: string;
  themeStyle: ThemeStyle;
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'modern', i18nKey: 'modern', headingFont: 'Inter', bodyFont: 'Inter', themeStyle: 'modern' },
  { id: 'elegant', i18nKey: 'elegant', headingFont: 'Playfair Display', bodyFont: 'Lato', themeStyle: 'elegant' },
  { id: 'bold', i18nKey: 'bold', headingFont: 'Montserrat', bodyFont: 'Open Sans', themeStyle: 'bold' },
];

const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive all individual colors from the palette for the preview */
function paletteToColors(brandColor: string, mode: ThemeMode, style: ThemeStyle) {
  const palette = generateThemePalette(brandColor, mode, style);
  const vars = palette.cssVariables;

  // Convert CSS HSL string "H S% L%" back to hex
  const cssHslToHex = (val: string): string => {
    if (!val) return '#000000';
    // Handle non-HSL values (like "0.5rem")
    if (!val.includes('%')) return '#000000';
    const parts = val.split(/\s+/);
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    return hslToHex(h, s, l);
  };

  return {
    primary: cssHslToHex(vars['--primary']),
    secondary: cssHslToHex(vars['--secondary']),
    accent: cssHslToHex(vars['--accent']),
    background: cssHslToHex(vars['--background']),
    foreground: cssHslToHex(vars['--foreground']),
    card: cssHslToHex(vars['--card']),
    muted: cssHslToHex(vars['--muted']),
    border: cssHslToHex(vars['--border']),
    headingFont: palette.headingFont,
    bodyFont: palette.bodyFont,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            i + 1 === current
              ? 'w-8 bg-primary'
              : i + 1 < current
                ? 'w-2 bg-primary/60'
                : 'w-2 bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  );
}

/** Mini storefront preview card used in step 1 and mood cards */
function MiniPreviewCard({
  brandColor,
  mode,
  style,
  className,
}: {
  brandColor: string;
  mode: ThemeMode;
  style: ThemeStyle;
  className?: string;
}) {
  const c = useMemo(() => paletteToColors(brandColor, mode, style), [brandColor, mode, style]);

  return (
    <div
      className={cn('rounded-lg border overflow-hidden text-left', className)}
      style={{ backgroundColor: c.background, color: c.foreground, fontFamily: `"${c.bodyFont}", sans-serif` }}
    >
      {/* Header bar */}
      <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: c.border }}>
        <span className="text-[9px] font-bold" style={{ fontFamily: `"${c.headingFont}", serif` }}>
          MyShop
        </span>
        <div className="flex gap-2 text-[7px] opacity-60">
          <span>Home</span><span>Shop</span><span>Contact</span>
        </div>
      </div>
      {/* Hero */}
      <div className="px-3 py-3 text-center" style={{ background: `linear-gradient(135deg, ${c.primary}18, ${c.accent}12)` }}>
        <p className="text-[10px] font-bold mb-1" style={{ fontFamily: `"${c.headingFont}", serif` }}>
          Nieuwe Collectie
        </p>
        <div
          className="inline-block rounded-full px-2.5 py-0.5 text-[7px] font-medium text-white"
          style={{ backgroundColor: c.primary }}
        >
          Shop Nu
        </div>
      </div>
      {/* Products */}
      <div className="px-3 py-2 grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <div className="aspect-square rounded" style={{ backgroundColor: c.muted }} />
            <p className="text-[6px] mt-0.5 truncate opacity-70">Product {i}</p>
            <p className="text-[7px] font-bold" style={{ color: c.accent }}>
              €{(19 + i * 10).toFixed(2).replace('.', ',')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ThemeWizard
// ---------------------------------------------------------------------------

export function ThemeWizard() {
  const { t } = useTranslation();
  const { themeSettings, themes, saveThemeSettings, publishStorefront } = useStorefront();
  const { currentTenant } = useTenant();
  const tenantSlug = currentTenant?.slug || '';
  const { homepageSections } = usePublicStorefront(tenantSlug);
  const selectedTheme = themes.find(t => t.id === themeSettings?.theme_id);
  const defaults = selectedTheme?.default_settings;

  // Wizard state
  const [step, setStep] = useState(1);
  const [brandColor, setBrandColor] = useState('#3b82f6');
  const [selectedMood, setSelectedMood] = useState<MoodId>('light-clean');
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('modern');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced overrides (old ThemeCustomizer fields)
  const [advancedOverrides, setAdvancedOverrides] = useState({
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    background_color: '',
    text_color: '',
    heading_font: '',
    body_font: '',
    header_style: 'standard',
    product_card_style: 'standard',
    products_per_row: 4,
    show_breadcrumbs: true,
    show_wishlist: true,
    show_announcement_bar: false,
    announcement_text: '',
    footer_text: '',
    custom_css: '',
    logo_url: null as string | null,
    favicon_url: null as string | null,
  });

  // Initialize from existing settings
  useEffect(() => {
    if (themeSettings) {
      if (themeSettings.brand_color) {
        setBrandColor(themeSettings.brand_color);
      } else if (themeSettings.primary_color) {
        setBrandColor(themeSettings.primary_color);
      }

      if (themeSettings.theme_mode && themeSettings.theme_style) {
        // Determine mood from mode+style
        const mode = themeSettings.theme_mode as ThemeMode;
        const style = themeSettings.theme_style as ThemeStyle;
        const mood = MOOD_OPTIONS.find(m => m.mode === mode && m.style === style);
        if (mood) setSelectedMood(mood.id);

        // Determine style
        const styleOpt = STYLE_OPTIONS.find(s => s.themeStyle === style);
        if (styleOpt) setSelectedStyle(styleOpt.id);
      }

      setAdvancedOverrides(prev => ({
        ...prev,
        primary_color: themeSettings.primary_color || '',
        secondary_color: themeSettings.secondary_color || '',
        accent_color: themeSettings.accent_color || '',
        background_color: themeSettings.background_color || '',
        text_color: themeSettings.text_color || '',
        heading_font: themeSettings.heading_font || defaults?.heading_font || 'Inter',
        body_font: themeSettings.body_font || defaults?.body_font || 'Inter',
        header_style: themeSettings.header_style || defaults?.header_style || 'standard',
        product_card_style: themeSettings.product_card_style || defaults?.product_card_style || 'standard',
        products_per_row: themeSettings.products_per_row ?? defaults?.products_per_row ?? 4,
        show_breadcrumbs: themeSettings.show_breadcrumbs ?? defaults?.show_breadcrumbs ?? true,
        show_wishlist: themeSettings.show_wishlist ?? defaults?.show_wishlist ?? true,
        show_announcement_bar: themeSettings.show_announcement_bar ?? false,
        announcement_text: themeSettings.announcement_text || '',
        footer_text: themeSettings.footer_text || '',
        custom_css: themeSettings.custom_css || '',
        logo_url: themeSettings.logo_url || null,
        favicon_url: themeSettings.favicon_url || null,
      }));
    }
  }, [themeSettings, defaults]);

  // Derived values
  const currentMood = MOOD_OPTIONS.find(m => m.id === selectedMood)!;
  const currentStyleOpt = STYLE_OPTIONS.find(s => s.id === selectedStyle)!;

  // The final theme_mode and theme_style for the palette generator
  const finalMode: ThemeMode = currentMood.mode;
  const finalStyle: ThemeStyle = currentStyleOpt.themeStyle;

  // Generate full palette
  const palette = useMemo(
    () => generateThemePalette(brandColor, finalMode, finalStyle),
    [brandColor, finalMode, finalStyle]
  );

  const colors = useMemo(
    () => paletteToColors(brandColor, finalMode, finalStyle),
    [brandColor, finalMode, finalStyle]
  );

  // Computed preview props – use advanced overrides if set, otherwise palette values
  const previewPrimary = advancedOverrides.primary_color || colors.primary;
  const previewSecondary = advancedOverrides.secondary_color || colors.secondary;
  const previewAccent = advancedOverrides.accent_color || colors.accent;
  const previewBg = advancedOverrides.background_color || colors.background;
  const previewText = advancedOverrides.text_color || colors.foreground;
  const previewHeadingFont = advancedOverrides.heading_font || palette.headingFont;
  const previewBodyFont = advancedOverrides.body_font || palette.bodyFont;

  // Hex input state (separate to avoid losing cursor)
  const [hexInput, setHexInput] = useState(brandColor);
  useEffect(() => { setHexInput(brandColor); }, [brandColor]);

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setBrandColor(val);
    }
  };

  // Save all settings
  const handlePublish = () => {
    const payload: Record<string, unknown> = {
      brand_color: brandColor,
      theme_mode: finalMode,
      theme_style: finalStyle,
      primary_color: advancedOverrides.primary_color || colors.primary,
      secondary_color: advancedOverrides.secondary_color || colors.secondary,
      accent_color: advancedOverrides.accent_color || colors.accent,
      background_color: advancedOverrides.background_color || colors.background,
      text_color: advancedOverrides.text_color || colors.foreground,
      heading_font: advancedOverrides.heading_font || palette.headingFont,
      body_font: advancedOverrides.body_font || palette.bodyFont,
      header_style: advancedOverrides.header_style,
      product_card_style: advancedOverrides.product_card_style,
      products_per_row: advancedOverrides.products_per_row,
      show_breadcrumbs: advancedOverrides.show_breadcrumbs,
      show_wishlist: advancedOverrides.show_wishlist,
      show_announcement_bar: advancedOverrides.show_announcement_bar,
      announcement_text: advancedOverrides.announcement_text,
      footer_text: advancedOverrides.footer_text,
      custom_css: advancedOverrides.custom_css,
      logo_url: advancedOverrides.logo_url,
      favicon_url: advancedOverrides.favicon_url,
      is_published: true,
      published_at: new Date().toISOString(),
    };

    saveThemeSettings.mutate(payload as any);
  };

  const handleSaveDraft = () => {
    const payload: Record<string, unknown> = {
      brand_color: brandColor,
      theme_mode: finalMode,
      theme_style: finalStyle,
      primary_color: advancedOverrides.primary_color || colors.primary,
      secondary_color: advancedOverrides.secondary_color || colors.secondary,
      accent_color: advancedOverrides.accent_color || colors.accent,
      background_color: advancedOverrides.background_color || colors.background,
      text_color: advancedOverrides.text_color || colors.foreground,
      heading_font: advancedOverrides.heading_font || palette.headingFont,
      body_font: advancedOverrides.body_font || palette.bodyFont,
      header_style: advancedOverrides.header_style,
      product_card_style: advancedOverrides.product_card_style,
      products_per_row: advancedOverrides.products_per_row,
      show_breadcrumbs: advancedOverrides.show_breadcrumbs,
      show_wishlist: advancedOverrides.show_wishlist,
      show_announcement_bar: advancedOverrides.show_announcement_bar,
      announcement_text: advancedOverrides.announcement_text,
      footer_text: advancedOverrides.footer_text,
      custom_css: advancedOverrides.custom_css,
      logo_url: advancedOverrides.logo_url,
      favicon_url: advancedOverrides.favicon_url,
    };

    saveThemeSettings.mutate(payload as any);
  };

  // Navigation
  const canGoNext = step < TOTAL_STEPS;
  const canGoBack = step > 1;

  // -------------------------------------------------------------------------
  // STEP 1 — Pick brand color
  // -------------------------------------------------------------------------
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{t('theme.wizard.pickColor')}</h2>
        <p className="text-sm text-muted-foreground">{t('theme.wizard.pickColorDesc')}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Large color picker circle */}
        <div className="relative group">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-32 h-32 rounded-full cursor-pointer border-4 border-white shadow-lg appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
            style={{ backgroundColor: brandColor }}
          />
          <div className="absolute inset-0 rounded-full ring-2 ring-black/10 pointer-events-none" />
        </div>

        {/* Preset swatches */}
        <div className="flex flex-wrap justify-center gap-3">
          {PRESET_COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              onClick={() => setBrandColor(hex)}
              title={label}
              className={cn(
                'w-10 h-10 rounded-full border-2 transition-all hover:scale-110',
                brandColor === hex
                  ? 'border-foreground ring-2 ring-primary/40 scale-110'
                  : 'border-transparent shadow-md'
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>

        {/* Hex input */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md border shadow-sm shrink-0"
            style={{ backgroundColor: brandColor }}
          />
          <Input
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#3b82f6"
            className="w-32 font-mono text-sm"
          />
        </div>
      </div>

      {/* Mini preview */}
      <div className="max-w-xs mx-auto">
        <p className="text-xs text-muted-foreground mb-2 text-center">{t('theme.wizard.preview')}</p>
        <MiniPreviewCard
          brandColor={brandColor}
          mode={currentMood.mode}
          style={currentStyleOpt.themeStyle}
          className="shadow-md"
        />
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // STEP 2 — Pick mood
  // -------------------------------------------------------------------------
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{t('theme.wizard.pickMood')}</h2>
        <p className="text-sm text-muted-foreground">{t('theme.wizard.pickMoodDesc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {MOOD_OPTIONS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          const Icon = mood.icon;
          return (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              className={cn(
                'relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-sm">
                  {t(`theme.wizard.moods.${mood.i18nKey}.title`)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t(`theme.wizard.moods.${mood.i18nKey}.desc`)}
              </p>
              <MiniPreviewCard
                brandColor={brandColor}
                mode={mood.mode}
                style={mood.id === 'minimalist-sleek' ? 'modern' : mood.style}
                className="pointer-events-none"
              />
            </button>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // STEP 3 — Pick style (typography)
  // -------------------------------------------------------------------------
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{t('theme.wizard.pickStyle')}</h2>
        <p className="text-sm text-muted-foreground">{t('theme.wizard.pickStyleDesc')}</p>
      </div>

      <div className="space-y-3 max-w-xl mx-auto">
        {STYLE_OPTIONS.map((opt) => {
          const isSelected = selectedStyle === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedStyle(opt.id)}
              className={cn(
                'relative w-full rounded-xl border-2 p-5 text-left transition-all hover:shadow-lg',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div className="pr-8">
                <p className="font-semibold text-sm mb-1">
                  {t(`theme.wizard.styles.${opt.i18nKey}.title`)}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t(`theme.wizard.styles.${opt.i18nKey}.desc`)}
                </p>
                {/* Font preview */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                  <p
                    className="text-lg font-bold"
                    style={{ fontFamily: `"${opt.headingFont}", serif` }}
                  >
                    {t(`theme.wizard.styles.${opt.i18nKey}.sampleHeading`)}
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    style={{ fontFamily: `"${opt.bodyFont}", sans-serif` }}
                  >
                    {t(`theme.wizard.styles.${opt.i18nKey}.sampleBody`)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // STEP 4 — Preview + Publish
  // -------------------------------------------------------------------------
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{t('theme.wizard.previewTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('theme.wizard.previewDesc')}</p>
      </div>

      {/* Full-width preview */}
      <div className="max-w-2xl mx-auto">
        <LiveThemePreview
          primaryColor={previewPrimary}
          secondaryColor={previewSecondary}
          accentColor={previewAccent}
          backgroundColor={previewBg}
          textColor={previewText}
          headingFont={previewHeadingFont}
          bodyFont={previewBodyFont}
          headerStyle={advancedOverrides.header_style}
          productCardStyle={advancedOverrides.product_card_style}
          productsPerRow={advancedOverrides.products_per_row}
          logoUrl={advancedOverrides.logo_url}
          shopName={currentTenant?.name || 'Mijn Webshop'}
          homepageSections={homepageSections}
        />
      </div>

      {/* Publish actions */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handlePublish}
          disabled={saveThemeSettings.isPending}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          {t('theme.wizard.publish')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSaveDraft}
          disabled={saveThemeSettings.isPending}
          className="gap-2"
        >
          <Save className="h-3.5 w-3.5" />
          {t('theme.wizard.saveDraft')}
        </Button>
      </div>

      {/* Advanced settings toggle */}
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <Settings2 className="h-4 w-4" />
          <span>{t('theme.wizard.advancedSettings')}</span>
          <ChevronRight className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-90')} />
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6 border rounded-lg p-5">
            {/* Color overrides */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('theme.wizard.colorOverrides')}
              </h4>
              <div className="space-y-2.5">
                {[
                  { key: 'primary_color', label: t('theme.wizard.colors.primary'), desc: t('theme.wizard.colors.primaryDesc'), fallback: colors.primary, checkContrast: true },
                  { key: 'secondary_color', label: t('theme.wizard.colors.secondary'), desc: t('theme.wizard.colors.secondaryDesc'), fallback: colors.secondary, checkContrast: false },
                  { key: 'accent_color', label: t('theme.wizard.colors.accent'), desc: t('theme.wizard.colors.accentDesc'), fallback: colors.accent, checkContrast: true },
                  { key: 'background_color', label: t('theme.wizard.colors.background'), desc: t('theme.wizard.colors.backgroundDesc'), fallback: colors.background, checkContrast: false },
                  { key: 'text_color', label: t('theme.wizard.colors.text'), desc: t('theme.wizard.colors.textDesc'), fallback: colors.foreground, checkContrast: true },
                ].map(({ key, label, desc, fallback, checkContrast }) => {
                  const colorVal = (advancedOverrides as any)[key] || fallback;
                  const bgColor = advancedOverrides.background_color || colors.background;
                  const ratio = checkContrast ? getContrastRatio(colorVal, bgColor) : 0;
                  const level = checkContrast ? getContrastLevel(ratio) : 'good' as const;
                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      <Input
                        type="color"
                        value={colorVal}
                        onChange={(e) => setAdvancedOverrides({ ...advancedOverrides, [key]: e.target.value })}
                        className="w-9 h-9 p-0.5 cursor-pointer shrink-0 rounded-md border-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{label}</span>
                          <span className="text-[10px] text-muted-foreground">— {desc}</span>
                        </div>
                        <Input
                          value={colorVal}
                          onChange={(e) => setAdvancedOverrides({ ...advancedOverrides, [key]: e.target.value })}
                          className="h-7 text-xs font-mono mt-0.5"
                        />
                      </div>
                      {checkContrast && (
                        <div className={cn(
                          'flex items-center gap-1 shrink-0',
                          level === 'good' && 'text-green-600',
                          level === 'low' && 'text-orange-500',
                          level === 'fail' && 'text-red-500',
                        )}>
                          {level === 'good' && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {level === 'low' && <AlertTriangle className="h-3.5 w-3.5" />}
                          {level === 'fail' && <XCircle className="h-3.5 w-3.5" />}
                          <span className="text-[10px] font-medium">{ratio.toFixed(1)}:1</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedOverrides(prev => ({
                  ...prev,
                  primary_color: '',
                  secondary_color: '',
                  accent_color: '',
                  background_color: '',
                  text_color: '',
                }))}
                className="text-xs"
              >
                {t('theme.wizard.resetToGenerated')}
              </Button>
            </div>

            {/* Typography overrides */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('theme.wizard.typographyOverrides')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Heading</Label>
                  <Select
                    value={advancedOverrides.heading_font || palette.headingFont}
                    onValueChange={(v) => setAdvancedOverrides({ ...advancedOverrides, heading_font: v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOOGLE_FONTS.map(f => (
                        <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Body</Label>
                  <Select
                    value={advancedOverrides.body_font || palette.bodyFont}
                    onValueChange={(v) => setAdvancedOverrides({ ...advancedOverrides, body_font: v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOOGLE_FONTS.map(f => (
                        <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Layout overrides */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Layout
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('theme.wizard.layout.headerStyle')}</Label>
                  <Select
                    value={advancedOverrides.header_style}
                    onValueChange={(v) => setAdvancedOverrides({ ...advancedOverrides, header_style: v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HEADER_STYLES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('theme.wizard.layout.cardStyle')}</Label>
                  <Select
                    value={advancedOverrides.product_card_style}
                    onValueChange={(v) => setAdvancedOverrides({ ...advancedOverrides, product_card_style: v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CARD_STYLES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('theme.wizard.layout.productsPerRow')}</Label>
                <Select
                  value={String(advancedOverrides.products_per_row)}
                  onValueChange={(v) => setAdvancedOverrides({ ...advancedOverrides, products_per_row: parseInt(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {t('theme.wizard.layout.products')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  { key: 'show_breadcrumbs', label: 'Breadcrumbs', desc: t('theme.wizard.layout.breadcrumbsDesc') },
                  { key: 'show_wishlist', label: 'Wishlist', desc: t('theme.wizard.layout.wishlistDesc') },
                  { key: 'show_announcement_bar', label: 'Announcement Bar', desc: t('theme.wizard.layout.announcementDesc') },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">{label}</Label>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={(advancedOverrides as any)[key]}
                      onCheckedChange={(c) => setAdvancedOverrides({ ...advancedOverrides, [key]: c })}
                    />
                  </div>
                ))}
                {advancedOverrides.show_announcement_bar && (
                  <div className="pl-4 border-l-2 space-y-1.5">
                    <Label className="text-xs">{t('theme.wizard.layout.announcementText')}</Label>
                    <Input
                      value={advancedOverrides.announcement_text}
                      onChange={(e) => setAdvancedOverrides({ ...advancedOverrides, announcement_text: e.target.value })}
                      placeholder="Gratis verzending vanaf €50!"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Custom CSS */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('theme.wizard.advanced.customCss')}
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs">Footer</Label>
                <Textarea
                  value={advancedOverrides.footer_text}
                  onChange={(e) => setAdvancedOverrides({ ...advancedOverrides, footer_text: e.target.value })}
                  placeholder="© 2026 Jouw Webshop"
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Custom CSS</Label>
                <Textarea
                  value={advancedOverrides.custom_css}
                  onChange={(e) => setAdvancedOverrides({ ...advancedOverrides, custom_css: e.target.value })}
                  placeholder={`.my-class { color: red; }`}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Step indicator */}
      <StepIndicator current={step} total={TOTAL_STEPS} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={!canGoBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <span className="text-xs text-muted-foreground">
          {t('theme.wizard.stepOf', { current: step, total: TOTAL_STEPS })}
        </span>

        {canGoNext ? (
          <Button onClick={() => setStep(s => s + 1)} className="gap-2">
            {t('common.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handlePublish} disabled={saveThemeSettings.isPending} className="gap-2">
            <Rocket className="h-4 w-4" />
            {t('theme.wizard.publish')}
          </Button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import {
  generateThemePalette,
  paletteToHexColors,
  type ThemeMode,
  type ThemeStyle,
} from '@/lib/theme-palette';
import { LiveThemePreview } from '../LiveThemePreview';
import { BrandingUploader } from '../BrandingUploader';
import { TemplatePreview } from './TemplatePreview';
import { TemplateGallery } from './TemplateGallery';

const BRAND_SWATCHES = [
  '#0d9488', '#3b82f6', '#f97316', '#ef4444',
  '#22c55e', '#8b5cf6', '#ec4899', '#374151',
];

const STYLES: Array<{ id: ThemeStyle; label: string; hint: string }> = [
  { id: 'modern', label: 'Modern', hint: 'Strak en zakelijk' },
  { id: 'elegant', label: 'Elegant', hint: 'Klassiek, met serif' },
  { id: 'bold', label: 'Bold', hint: 'Stevig en opvallend' },
  { id: 'playful', label: 'Speels', hint: 'Rond en vriendelijk' },
];

/**
 * Design als één scherm: gekozen template bovenaan, dan merkkleur en stijl,
 * dan fijnregeling. Vervangt de ThemeWizard, die als tweede begeleide flow
 * naast de launch-checklist stond (zie docs/webshop-batch-1-recon.md §3.2).
 */
export function DesignPanel() {
  const { themeSettings, themes, sections, saveThemeSettings, settingsLoading } = useStorefront();
  const { currentTenant } = useTenant();

  const [showGallery, setShowGallery] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [brandColor, setBrandColor] = useState('#3b82f6');
  const [hexInput, setHexInput] = useState('#3b82f6');
  const [mode, setMode] = useState<ThemeMode>('light');
  const [style, setStyle] = useState<ThemeStyle>('modern');

  const [overrides, setOverrides] = useState({
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
    logo_url: null as string | null,
    favicon_url: null as string | null,
  });

  const activeTemplate = themes.find((t) => t.id === themeSettings?.theme_id);

  // Formulier vullen zodra de instellingen binnen zijn.
  useEffect(() => {
    if (!themeSettings) return;
    const brand = themeSettings.brand_color || themeSettings.primary_color || '#3b82f6';
    setBrandColor(brand);
    setHexInput(brand);
    setMode((themeSettings.theme_mode as ThemeMode) || 'light');
    setStyle((themeSettings.theme_style as ThemeStyle) || 'modern');
    setOverrides({
      primary_color: themeSettings.primary_color || '',
      secondary_color: themeSettings.secondary_color || '',
      accent_color: themeSettings.accent_color || '',
      background_color: themeSettings.background_color || '',
      text_color: themeSettings.text_color || '',
      heading_font: themeSettings.heading_font || '',
      body_font: themeSettings.body_font || '',
      header_style: themeSettings.header_style || 'standard',
      product_card_style: themeSettings.product_card_style || 'standard',
      products_per_row: themeSettings.products_per_row ?? 4,
      show_breadcrumbs: themeSettings.show_breadcrumbs ?? true,
      show_wishlist: themeSettings.show_wishlist ?? true,
      logo_url: themeSettings.logo_url,
      favicon_url: themeSettings.favicon_url,
    });
  }, [themeSettings]);

  const palette = useMemo(
    () => generateThemePalette(brandColor, mode, style),
    [brandColor, mode, style]
  );
  const colors = useMemo(
    () => paletteToHexColors(brandColor, mode, style),
    [brandColor, mode, style]
  );

  const handleSave = () => {
    saveThemeSettings.mutate({
      brand_color: brandColor,
      theme_mode: mode,
      theme_style: style,
      primary_color: overrides.primary_color || colors.primary,
      secondary_color: overrides.secondary_color || colors.secondary,
      accent_color: overrides.accent_color || colors.accent,
      background_color: overrides.background_color || colors.background,
      text_color: overrides.text_color || colors.foreground,
      heading_font: overrides.heading_font || palette.headingFont,
      body_font: overrides.body_font || palette.bodyFont,
      header_style: overrides.header_style,
      product_card_style: overrides.product_card_style,
      products_per_row: overrides.products_per_row,
      show_breadcrumbs: overrides.show_breadcrumbs,
      show_wishlist: overrides.show_wishlist,
      logo_url: overrides.logo_url,
      favicon_url: overrides.favicon_url,
    });
  };

  const applyHex = (value: string) => {
    setHexInput(value);
    if (/^#[0-9a-f]{6}$/i.test(value)) setBrandColor(value);
  };

  if (settingsLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Zonder template staat de gallery hier — geen lege kaart.
  if (!activeTemplate || showGallery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {activeTemplate ? 'Ander template kiezen' : 'Kies een startpunt'}
          </CardTitle>
          <CardDescription>
            Je krijgt een ingerichte homepage en voorbeeldpagina's. Daarna pas je alles
            aan naar wens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateGallery onApplied={() => setShowGallery(false)} />
          {activeTemplate && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowGallery(false)}>
                Annuleren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {/* Actief template — dit ontbrak volledig in de oude wizard */}
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded border bg-muted">
              <TemplatePreview theme={activeTemplate} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Je template</p>
              <p className="truncate font-semibold">{activeTemplate.name}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowGallery(true)}>
              Ander template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              Merkkleur en stijl
            </CardTitle>
            <CardDescription>
              Eén kleur is genoeg — de rest van het palet wordt automatisch afgeleid,
              met voldoende contrast.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Merkkleur</Label>
              <div className="flex flex-wrap gap-2">
                {BRAND_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      setBrandColor(hex);
                      setHexInput(hex);
                    }}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                      brandColor.toLowerCase() === hex ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={hex}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => {
                      setBrandColor(e.target.value);
                      setHexInput(e.target.value);
                    }}
                    className="h-8 w-8 cursor-pointer rounded border bg-transparent p-0"
                    aria-label="Eigen kleur"
                  />
                  <Input
                    value={hexInput}
                    onChange={(e) => applyHex(e.target.value)}
                    className="h-8 w-24 font-mono text-xs"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Stijl</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      style === s.id
                        ? 'border-primary bg-muted/50'
                        : 'hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Donkere winkel</Label>
                <p className="text-xs text-muted-foreground">
                  Lichte tekst op een donkere achtergrond
                </p>
              </div>
              <Switch
                checked={mode === 'dark'}
                onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
              />
            </div>

            <div className="space-y-3">
              <Label>Logo en favicon</Label>
              <BrandingUploader
                logoUrl={overrides.logo_url}
                faviconUrl={overrides.favicon_url}
                onLogoChange={(url) => setOverrides((p) => ({ ...p, logo_url: url }))}
                onFaviconChange={(url) => setOverrides((p) => ({ ...p, favicon_url: url }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fijnregeling */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <Card>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="text-sm font-medium">Fijnregeling</p>
                  <p className="text-xs text-muted-foreground">
                    Losse kleuren, lettertypen en layout overschrijven
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    showAdvanced && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="space-y-5 border-t pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ['primary_color', 'Primair', colors.primary],
                    ['secondary_color', 'Secundair', colors.secondary],
                    ['accent_color', 'Accent', colors.accent],
                    ['background_color', 'Achtergrond', colors.background],
                    ['text_color', 'Tekst', colors.foreground],
                  ] as const).map(([key, label, fallback]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={overrides[key] || fallback}
                          onChange={(e) =>
                            setOverrides((p) => ({ ...p, [key]: e.target.value }))
                          }
                          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0"
                        />
                        <Input
                          value={overrides[key]}
                          onChange={(e) =>
                            setOverrides((p) => ({ ...p, [key]: e.target.value }))
                          }
                          placeholder={fallback}
                          className="h-8 font-mono text-xs"
                        />
                        {overrides[key] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setOverrides((p) => ({ ...p, [key]: '' }))}
                          >
                            Herstel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Koptekst-lettertype</Label>
                    <Input
                      value={overrides.heading_font}
                      onChange={(e) =>
                        setOverrides((p) => ({ ...p, heading_font: e.target.value }))
                      }
                      placeholder={palette.headingFont}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tekst-lettertype</Label>
                    <Input
                      value={overrides.body_font}
                      onChange={(e) =>
                        setOverrides((p) => ({ ...p, body_font: e.target.value }))
                      }
                      placeholder={palette.bodyFont}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Header-stijl</Label>
                    <Select
                      value={overrides.header_style}
                      onValueChange={(v) => setOverrides((p) => ({ ...p, header_style: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standaard</SelectItem>
                        <SelectItem value="centered">Gecentreerd</SelectItem>
                        <SelectItem value="minimal">Minimaal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Productkaart</Label>
                    <Select
                      value={overrides.product_card_style}
                      onValueChange={(v) =>
                        setOverrides((p) => ({ ...p, product_card_style: v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standaard</SelectItem>
                        <SelectItem value="minimal">Minimaal</SelectItem>
                        <SelectItem value="detailed">Uitgebreid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Producten per rij</Label>
                    <Select
                      value={String(overrides.products_per_row)}
                      onValueChange={(v) =>
                        setOverrides((p) => ({ ...p, products_per_row: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label className="text-sm">Breadcrumbs tonen</Label>
                    <Switch
                      checked={overrides.show_breadcrumbs}
                      onCheckedChange={(c) =>
                        setOverrides((p) => ({ ...p, show_breadcrumbs: c }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label className="text-sm">Verlanglijst tonen</Label>
                    <Switch
                      checked={overrides.show_wishlist}
                      onCheckedChange={(c) => setOverrides((p) => ({ ...p, show_wishlist: c }))}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveThemeSettings.isPending}>
            {saveThemeSettings.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Opslaan
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <LiveThemePreview
          primaryColor={overrides.primary_color || colors.primary}
          secondaryColor={overrides.secondary_color || colors.secondary}
          accentColor={overrides.accent_color || colors.accent}
          backgroundColor={overrides.background_color || colors.background}
          textColor={overrides.text_color || colors.foreground}
          headingFont={overrides.heading_font || palette.headingFont}
          bodyFont={overrides.body_font || palette.bodyFont}
          headerStyle={overrides.header_style}
          productCardStyle={overrides.product_card_style}
          productsPerRow={overrides.products_per_row}
          logoUrl={overrides.logo_url}
          shopName={currentTenant?.name || 'Mijn Webshop'}
          homepageSections={sections}
          cssVariables={palette.cssVariables}
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Palette, Type, Layout, Code, Save, Image as ImageIcon, RotateCcw, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { GOOGLE_FONTS, HEADER_STYLES, PRODUCT_CARD_STYLES } from '@/types/storefront';
import { BrandingUploader } from './BrandingUploader';
import { LiveThemePreview } from './LiveThemePreview';
import { ThemeMoodPresets, type MoodPreset } from './ThemeMoodPresets';
import { ColorPaletteGenerator } from './ColorPaletteGenerator';
import { FontPairingSuggestions } from './FontPairingSuggestions';
import { ThemeGalleryInline } from './ThemeGalleryInline';
import { cn } from '@/lib/utils';

export function ThemeCustomizer() {
  const { themeSettings, themes, saveThemeSettings } = useStorefront();
  const { currentTenant } = useTenant();
  const selectedTheme = themes.find(t => t.id === themeSettings?.theme_id);
  const defaults = selectedTheme?.default_settings;
  const [activeMoodId, setActiveMoodId] = useState<string>();
  const [moodOpen, setMoodOpen] = useState(false);

  const [formData, setFormData] = useState({
    logo_url: null as string | null,
    favicon_url: null as string | null,
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    background_color: '#ffffff',
    text_color: '#1a1a1a',
    heading_font: 'Inter',
    body_font: 'Inter',
    header_style: 'standard',
    show_breadcrumbs: true,
    show_wishlist: true,
    product_card_style: 'standard',
    products_per_row: 4,
    show_announcement_bar: false,
    announcement_text: '',
    footer_text: '',
    custom_css: '',
  });

  useEffect(() => {
    if (themeSettings && defaults) {
      setFormData({
        logo_url: themeSettings.logo_url || null,
        favicon_url: themeSettings.favicon_url || null,
        primary_color: themeSettings.primary_color || defaults.primary_color,
        secondary_color: themeSettings.secondary_color || defaults.secondary_color,
        accent_color: themeSettings.accent_color || defaults.accent_color,
        background_color: themeSettings.background_color || defaults.background_color || '#ffffff',
        text_color: themeSettings.text_color || defaults.text_color || '#1a1a1a',
        heading_font: themeSettings.heading_font || defaults.heading_font,
        body_font: themeSettings.body_font || defaults.body_font,
        header_style: themeSettings.header_style || defaults.header_style,
        show_breadcrumbs: themeSettings.show_breadcrumbs ?? defaults.show_breadcrumbs,
        show_wishlist: themeSettings.show_wishlist ?? defaults.show_wishlist,
        product_card_style: themeSettings.product_card_style || defaults.product_card_style,
        products_per_row: themeSettings.products_per_row ?? defaults.products_per_row,
        show_announcement_bar: themeSettings.show_announcement_bar ?? false,
        announcement_text: themeSettings.announcement_text || '',
        footer_text: themeSettings.footer_text || '',
        custom_css: themeSettings.custom_css || '',
      });
    }
  }, [themeSettings, defaults]);

  const handleSave = () => { saveThemeSettings.mutate(formData); };

  const handleResetToDefaults = () => {
    if (defaults) {
      setFormData({
        logo_url: null, favicon_url: null,
        primary_color: defaults.primary_color, secondary_color: defaults.secondary_color,
        accent_color: defaults.accent_color, background_color: defaults.background_color || '#ffffff',
        text_color: defaults.text_color || '#1a1a1a', heading_font: defaults.heading_font,
        body_font: defaults.body_font, header_style: defaults.header_style,
        show_breadcrumbs: defaults.show_breadcrumbs, show_wishlist: defaults.show_wishlist,
        product_card_style: defaults.product_card_style, products_per_row: defaults.products_per_row,
        show_announcement_bar: false, announcement_text: '', footer_text: '', custom_css: '',
      });
      setActiveMoodId(undefined);
    }
  };

  const handleMoodSelect = (preset: MoodPreset) => {
    setActiveMoodId(preset.id);
    setFormData(prev => ({
      ...prev,
      primary_color: preset.primary_color, secondary_color: preset.secondary_color,
      accent_color: preset.accent_color, background_color: preset.background_color,
      text_color: preset.text_color, heading_font: preset.heading_font,
      body_font: preset.body_font, header_style: preset.header_style,
      product_card_style: preset.product_card_style,
    }));
  };

  const handlePaletteApply = (colors: { primary: string; secondary: string; accent: string; background?: string; text?: string }) => {
    setActiveMoodId(undefined);
    setFormData(prev => ({
      ...prev, primary_color: colors.primary, secondary_color: colors.secondary, accent_color: colors.accent,
      ...(colors.background && { background_color: colors.background }),
      ...(colors.text && { text_color: colors.text }),
    }));
  };

  const handleFontPairSelect = (heading: string, body: string) => {
    setFormData(prev => ({ ...prev, heading_font: heading, body_font: body }));
  };

  return (
    <div className="space-y-6">
      {/* Compact Theme Gallery */}
      <ThemeGalleryInline />

      {/* Design Studio: Split Layout */}
      <div className="flex gap-6 items-start">
        {/* Left: Settings Sidebar */}
        <div className="flex-1 min-w-0 relative">
          <ScrollArea className="h-[calc(100vh-320px)] pr-4">
            {/* Mood Presets - Collapsible */}
            <Collapsible open={moodOpen} onOpenChange={setMoodOpen} className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Mood Presets</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", moodOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <ThemeMoodPresets onSelect={handleMoodSelect} activePresetId={activeMoodId} />
              </CollapsibleContent>
            </Collapsible>

            {/* Accordion Sections */}
            <Accordion type="multiple" defaultValue={['branding', 'colors']} className="space-y-1">
              {/* Branding */}
              <AccordionItem value="branding" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Branding</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <BrandingUploader
                    logoUrl={formData.logo_url} faviconUrl={formData.favicon_url}
                    onLogoChange={(url) => setFormData({ ...formData, logo_url: url })}
                    onFaviconChange={(url) => setFormData({ ...formData, favicon_url: url })}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Kleuren */}
              <AccordionItem value="colors" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span>Kleuren</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-6">
                  <ColorPaletteGenerator baseColor={formData.primary_color || '#3b82f6'} onApply={handlePaletteApply} />
                  <div className="border-t pt-4">
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Handmatig</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { key: 'primary_color', label: 'Primair', desc: 'Knoppen & accenten' },
                        { key: 'secondary_color', label: 'Secundair', desc: 'Subtiele elementen' },
                        { key: 'accent_color', label: 'Accent', desc: 'Prijzen & badges' },
                        { key: 'background_color', label: 'Achtergrond', desc: 'Pagina achtergrond' },
                        { key: 'text_color', label: 'Tekst', desc: 'Standaard tekst' },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center gap-3">
                          <Input type="color" value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} className="w-10 h-10 p-1 cursor-pointer shrink-0 rounded-lg" />
                          <div className="flex-1 min-w-0">
                            <Label className="text-xs">{label}</Label>
                            <Input value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} className="h-8 text-xs mt-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Typografie */}
              <AccordionItem value="typography" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-muted-foreground" />
                    <span>Typografie</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-6">
                  <FontPairingSuggestions currentHeading={formData.heading_font} currentBody={formData.body_font} onSelect={handleFontPairSelect} />
                  <div className="border-t pt-4">
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Handmatig</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Heading</Label>
                        <Select value={formData.heading_font} onValueChange={(v) => setFormData({ ...formData, heading_font: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GOOGLE_FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Body</Label>
                        <Select value={formData.body_font} onValueChange={(v) => setFormData({ ...formData, body_font: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GOOGLE_FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Layout */}
              <AccordionItem value="layout" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Layout className="h-4 w-4 text-muted-foreground" />
                    <span>Layout</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Header Stijl</Label>
                      <Select value={formData.header_style} onValueChange={(v) => setFormData({ ...formData, header_style: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HEADER_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Card Stijl</Label>
                      <Select value={formData.product_card_style} onValueChange={(v) => setFormData({ ...formData, product_card_style: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CARD_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Producten per rij</Label>
                    <Select value={String(formData.products_per_row)} onValueChange={(v) => setFormData({ ...formData, products_per_row: parseInt(v) })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} producten</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 pt-2">
                    {[
                      { key: 'show_breadcrumbs', label: 'Breadcrumbs', desc: 'Navigatie pad' },
                      { key: 'show_wishlist', label: 'Wishlist', desc: 'Verlanglijstje' },
                      { key: 'show_announcement_bar', label: 'Announcement Bar', desc: 'Mededeling boven header' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs">{label}</Label>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                        <Switch checked={(formData as any)[key]} onCheckedChange={(c) => setFormData({ ...formData, [key]: c })} />
                      </div>
                    ))}
                    {formData.show_announcement_bar && (
                      <div className="pl-4 border-l-2 space-y-1.5">
                        <Label className="text-xs">Tekst</Label>
                        <Input value={formData.announcement_text} onChange={(e) => setFormData({ ...formData, announcement_text: e.target.value })} placeholder="Gratis verzending vanaf €50!" className="h-8 text-xs" />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Geavanceerd */}
              <AccordionItem value="advanced" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span>Geavanceerd</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Footer tekst</Label>
                    <Textarea value={formData.footer_text} onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })} placeholder="© 2026 Jouw Webshop" rows={2} className="text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custom CSS</Label>
                    <Textarea value={formData.custom_css} onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })} placeholder={`.my-class { color: red; }`} rows={6} className="font-mono text-xs" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Spacer for sticky footer */}
            <div className="h-16" />
          </ScrollArea>

          {/* Sticky Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t py-3 pr-4 flex gap-2 justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                  <AlertDialogDescription>Alle aanpassingen worden gereset naar de standaard thema-instellingen.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetToDefaults} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSave} disabled={saveThemeSettings.isPending} size="sm">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Opslaan
            </Button>
          </div>
        </div>

        {/* Right: Live Preview (always visible) */}
        <div className="hidden lg:block w-[340px] shrink-0 sticky top-24 self-start">
          <LiveThemePreview
            primaryColor={formData.primary_color} secondaryColor={formData.secondary_color}
            accentColor={formData.accent_color} backgroundColor={formData.background_color}
            textColor={formData.text_color} headingFont={formData.heading_font}
            bodyFont={formData.body_font} headerStyle={formData.header_style}
            productCardStyle={formData.product_card_style} productsPerRow={formData.products_per_row}
            logoUrl={formData.logo_url} shopName={currentTenant?.name || 'Mijn Webshop'}
          />
        </div>
      </div>
    </div>
  );
}

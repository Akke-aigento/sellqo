import { useState, useEffect } from 'react';
import { Palette, Type, Layout, Code, Save, Image as ImageIcon, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { GOOGLE_FONTS, HEADER_STYLES, PRODUCT_CARD_STYLES } from '@/types/storefront';
import { BrandingUploader } from './BrandingUploader';
import { LiveThemePreview } from './LiveThemePreview';
import { ThemeMoodPresets, type MoodPreset } from './ThemeMoodPresets';
import { ColorPaletteGenerator } from './ColorPaletteGenerator';
import { FontPairingSuggestions } from './FontPairingSuggestions';

export function ThemeCustomizer() {
  const { themeSettings, themes, saveThemeSettings } = useStorefront();
  const { currentTenant } = useTenant();
  const selectedTheme = themes.find(t => t.id === themeSettings?.theme_id);
  const defaults = selectedTheme?.default_settings;
  const [showPreview, setShowPreview] = useState(true);
  const [activeMoodId, setActiveMoodId] = useState<string>();

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

  const handleSave = () => {
    saveThemeSettings.mutate(formData);
  };

  const handleResetToDefaults = () => {
    if (defaults) {
      setFormData({
        logo_url: null,
        favicon_url: null,
        primary_color: defaults.primary_color,
        secondary_color: defaults.secondary_color,
        accent_color: defaults.accent_color,
        background_color: defaults.background_color || '#ffffff',
        text_color: defaults.text_color || '#1a1a1a',
        heading_font: defaults.heading_font,
        body_font: defaults.body_font,
        header_style: defaults.header_style,
        show_breadcrumbs: defaults.show_breadcrumbs,
        show_wishlist: defaults.show_wishlist,
        product_card_style: defaults.product_card_style,
        products_per_row: defaults.products_per_row,
        show_announcement_bar: false,
        announcement_text: '',
        footer_text: '',
        custom_css: '',
      });
      setActiveMoodId(undefined);
    }
  };

  const handleMoodSelect = (preset: MoodPreset) => {
    setActiveMoodId(preset.id);
    setFormData(prev => ({
      ...prev,
      primary_color: preset.primary_color,
      secondary_color: preset.secondary_color,
      accent_color: preset.accent_color,
      background_color: preset.background_color,
      text_color: preset.text_color,
      heading_font: preset.heading_font,
      body_font: preset.body_font,
      header_style: preset.header_style,
      product_card_style: preset.product_card_style,
    }));
  };

  const handlePaletteApply = (colors: { primary: string; secondary: string; accent: string; background?: string; text?: string }) => {
    setActiveMoodId(undefined);
    setFormData(prev => ({
      ...prev,
      primary_color: colors.primary,
      secondary_color: colors.secondary,
      accent_color: colors.accent,
      ...(colors.background && { background_color: colors.background }),
      ...(colors.text && { text_color: colors.text }),
    }));
  };

  const handleFontPairSelect = (heading: string, body: string) => {
    setFormData(prev => ({ ...prev, heading_font: heading, body_font: body }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aanpassen
            </CardTitle>
            <CardDescription>
              Pas kleuren, fonts en layout aan naar je merk
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>Alle aanpassingen worden gereset naar de standaard thema-instellingen.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetToDefaults}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Ja, reset alles
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSave} disabled={saveThemeSettings.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Opslaan
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mood Presets - always visible at top */}
        <div className="mb-6">
          <ThemeMoodPresets onSelect={handleMoodSelect} activePresetId={activeMoodId} />
        </div>

        <div className="flex gap-6">
          {/* Main customizer */}
          <div className={showPreview ? 'flex-1 min-w-0' : 'w-full'}>
            <Tabs defaultValue="branding" className="space-y-6">
              <TabsList>
                <TabsTrigger value="branding" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="colors" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Kleuren
                </TabsTrigger>
                <TabsTrigger value="typography" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Typografie
                </TabsTrigger>
                <TabsTrigger value="layout" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Layout
                </TabsTrigger>
                <TabsTrigger value="advanced" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Geavanceerd
                </TabsTrigger>
              </TabsList>

              <TabsContent value="branding" className="space-y-6">
                <BrandingUploader
                  logoUrl={formData.logo_url}
                  faviconUrl={formData.favicon_url}
                  onLogoChange={(url) => setFormData({ ...formData, logo_url: url })}
                  onFaviconChange={(url) => setFormData({ ...formData, favicon_url: url })}
                />
              </TabsContent>

              <TabsContent value="colors" className="space-y-8">
                {/* Color Palette Generator */}
                <ColorPaletteGenerator
                  baseColor={formData.primary_color || '#3b82f6'}
                  onApply={handlePaletteApply}
                />

                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-4">Handmatig aanpassen</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { key: 'primary_color', label: 'Primaire kleur', desc: 'Knoppen, links en accenten' },
                      { key: 'secondary_color', label: 'Secundaire kleur', desc: 'Subtiele elementen' },
                      { key: 'accent_color', label: 'Accent kleur', desc: 'Prijzen, badges, CTAs' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={(formData as any)[key]}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            className="w-12 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={(formData as any)[key]}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {[
                      { key: 'background_color', label: 'Achtergrond', desc: 'Pagina achtergrondkleur' },
                      { key: 'text_color', label: 'Tekstkleur', desc: 'Standaard tekstkleur' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={(formData as any)[key]}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            className="w-12 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={(formData as any)[key]}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color Preview */}
                <div className="p-6 rounded-lg border" style={{ backgroundColor: formData.background_color, color: formData.text_color }}>
                  <p className="text-sm mb-4 opacity-60">Preview</p>
                  <div className="flex gap-4 items-center flex-wrap">
                    <Button style={{ backgroundColor: formData.primary_color, color: '#fff' }}>
                      Primaire Knop
                    </Button>
                    <Button variant="outline" style={{ borderColor: formData.secondary_color, color: formData.secondary_color }}>
                      Secundaire Knop
                    </Button>
                    <span style={{ color: formData.accent_color, fontWeight: 'bold' }}>€29,99</span>
                    <span>Normale tekst</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="typography" className="space-y-8">
                {/* Font Pairing Suggestions */}
                <FontPairingSuggestions
                  currentHeading={formData.heading_font}
                  currentBody={formData.body_font}
                  onSelect={handleFontPairSelect}
                />

                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-4">Handmatig kiezen</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Heading Font</Label>
                      <Select
                        value={formData.heading_font}
                        onValueChange={(value) => setFormData({ ...formData, heading_font: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOOGLE_FONTS.map((font) => (
                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Body Font</Label>
                      <Select
                        value={formData.body_font}
                        onValueChange={(value) => setFormData({ ...formData, body_font: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOOGLE_FONTS.map((font) => (
                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Typography Preview */}
                <div className="p-6 rounded-lg border" style={{ backgroundColor: formData.background_color, color: formData.text_color }}>
                  <p className="text-sm mb-4 opacity-60">Preview</p>
                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{ fontFamily: `"${formData.heading_font}", serif` }}
                  >
                    Dit is een heading
                  </h2>
                  <p style={{ fontFamily: `"${formData.body_font}", sans-serif` }}>
                    Dit is een voorbeeld van body tekst. Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="layout" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Header Stijl</Label>
                    <Select
                      value={formData.header_style}
                      onValueChange={(value) => setFormData({ ...formData, header_style: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HEADER_STYLES.map((style) => (
                          <SelectItem key={style.value} value={style.value}>
                            <div>
                              <span className="font-medium">{style.label}</span>
                              <span className="text-muted-foreground ml-2">- {style.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Product Card Stijl</Label>
                    <Select
                      value={formData.product_card_style}
                      onValueChange={(value) => setFormData({ ...formData, product_card_style: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_CARD_STYLES.map((style) => (
                          <SelectItem key={style.value} value={style.value}>
                            <div>
                              <span className="font-medium">{style.label}</span>
                              <span className="text-muted-foreground ml-2">- {style.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Producten per rij</Label>
                    <Select
                      value={String(formData.products_per_row)}
                      onValueChange={(value) => setFormData({ ...formData, products_per_row: parseInt(value) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 producten</SelectItem>
                        <SelectItem value="3">3 producten</SelectItem>
                        <SelectItem value="4">4 producten</SelectItem>
                        <SelectItem value="5">5 producten</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Toon Breadcrumbs</Label>
                      <p className="text-xs text-muted-foreground">Navigatie pad bovenaan pagina's</p>
                    </div>
                    <Switch
                      checked={formData.show_breadcrumbs}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_breadcrumbs: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Toon Wishlist</Label>
                      <p className="text-xs text-muted-foreground">Verlanglijstje functionaliteit</p>
                    </div>
                    <Switch
                      checked={formData.show_wishlist}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_wishlist: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Announcement Bar</Label>
                      <p className="text-xs text-muted-foreground">Balk bovenaan met mededeling</p>
                    </div>
                    <Switch
                      checked={formData.show_announcement_bar}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_announcement_bar: checked })}
                    />
                  </div>

                  {formData.show_announcement_bar && (
                    <div className="space-y-2 pl-4 border-l-2">
                      <Label>Announcement tekst</Label>
                      <Input
                        value={formData.announcement_text}
                        onChange={(e) => setFormData({ ...formData, announcement_text: e.target.value })}
                        placeholder="Gratis verzending vanaf €50!"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
                <div className="space-y-2">
                  <Label>Footer tekst</Label>
                  <Textarea
                    value={formData.footer_text}
                    onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                    placeholder="© 2024 Jouw Webshop. Alle rechten voorbehouden."
                    rows={3}
                  />
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="custom-css">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Custom CSS
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Voeg aangepaste CSS toe voor geavanceerde styling.
                        </p>
                        <Textarea
                          value={formData.custom_css}
                          onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
                          placeholder={`.my-custom-class {\n  color: red;\n}`}
                          rows={10}
                          className="font-mono text-sm"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
            </Tabs>
          </div>

          {/* Live Preview Sidebar */}
          {showPreview && (
            <div className="hidden lg:block w-[320px] shrink-0 sticky top-24 self-start">
              <LiveThemePreview
                primaryColor={formData.primary_color}
                secondaryColor={formData.secondary_color}
                accentColor={formData.accent_color}
                backgroundColor={formData.background_color}
                textColor={formData.text_color}
                headingFont={formData.heading_font}
                bodyFont={formData.body_font}
                headerStyle={formData.header_style}
                productCardStyle={formData.product_card_style}
                productsPerRow={formData.products_per_row}
                logoUrl={formData.logo_url}
                shopName={currentTenant?.name || 'Mijn Webshop'}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { Palette, Type, Layout, Code, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useStorefront } from '@/hooks/useStorefront';
import { GOOGLE_FONTS, HEADER_STYLES, PRODUCT_CARD_STYLES } from '@/types/storefront';

export function ThemeCustomizer() {
  const { themeSettings, themes, saveThemeSettings } = useStorefront();
  const selectedTheme = themes.find(t => t.id === themeSettings?.theme_id);
  const defaults = selectedTheme?.default_settings;

  const [formData, setFormData] = useState({
    primary_color: '',
    secondary_color: '',
    accent_color: '',
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
        primary_color: themeSettings.primary_color || defaults.primary_color,
        secondary_color: themeSettings.secondary_color || defaults.secondary_color,
        accent_color: themeSettings.accent_color || defaults.accent_color,
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
        primary_color: defaults.primary_color,
        secondary_color: defaults.secondary_color,
        accent_color: defaults.accent_color,
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
    }
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
            <Button variant="outline" onClick={handleResetToDefaults}>
              Reset naar standaard
            </Button>
            <Button onClick={handleSave} disabled={saveThemeSettings.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Opslaan
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList>
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

          <TabsContent value="colors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primaire kleur</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primary_color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1"
                    placeholder="#000000"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Gebruikt voor knoppen, links en accenten</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secundaire kleur</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="secondary_color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1"
                    placeholder="#666666"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Ondersteunende kleur voor subtiele elementen</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accent_color">Accent kleur</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="accent_color"
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="flex-1"
                    placeholder="#0ea5e9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Voor prijzen, badges en call-to-actions</p>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-6 rounded-lg border" style={{ backgroundColor: '#f8f9fa' }}>
              <p className="text-sm text-muted-foreground mb-4">Preview</p>
              <div className="flex gap-4 items-center">
                <Button style={{ backgroundColor: formData.primary_color }}>
                  Primaire Knop
                </Button>
                <Button variant="outline" style={{ borderColor: formData.secondary_color, color: formData.secondary_color }}>
                  Secundaire Knop
                </Button>
                <span style={{ color: formData.accent_color, fontWeight: 'bold' }}>€29,99</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="typography" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="heading_font">Heading Font</Label>
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
                <p className="text-xs text-muted-foreground">Gebruikt voor titels en koppen</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="body_font">Body Font</Label>
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
                <p className="text-xs text-muted-foreground">Gebruikt voor tekst en paragrafen</p>
              </div>
            </div>

            {/* Typography Preview */}
            <div className="p-6 rounded-lg border bg-background">
              <p className="text-sm text-muted-foreground mb-4">Preview</p>
              <h2 
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: formData.heading_font }}
              >
                Dit is een heading
              </h2>
              <p style={{ fontFamily: formData.body_font }}>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Label htmlFor="announcement_text">Announcement tekst</Label>
                  <Input
                    id="announcement_text"
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
              <Label htmlFor="footer_text">Footer tekst</Label>
              <Textarea
                id="footer_text"
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
                      Voeg aangepaste CSS toe voor geavanceerde styling. Wees voorzichtig - onjuiste CSS kan je webshop breken.
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
      </CardContent>
    </Card>
  );
}

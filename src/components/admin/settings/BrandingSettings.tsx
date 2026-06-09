import { useState, useEffect } from 'react';
import { Palette, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BrandingUploader } from '@/components/admin/storefront/BrandingUploader';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { useStorefront } from '@/hooks/useStorefront';

export function BrandingSettings() {
  const { themeSettings, saveThemeSettings } = useStorefront();

  const [form, setForm] = useState({
    logo_url: '' as string | null,
    favicon_url: '' as string | null,
    brand_color: '#000000',
    primary_color: '#000000',
  });
  const [initial, setInitial] = useState(form);

  useEffect(() => {
    if (themeSettings) {
      const next = {
        logo_url: (themeSettings as any).logo_url ?? null,
        favicon_url: (themeSettings as any).favicon_url ?? null,
        brand_color: (themeSettings as any).brand_color ?? '#000000',
        primary_color: (themeSettings as any).primary_color ?? '#000000',
      };
      setForm(next);
      setInitial(next);
    }
  }, [themeSettings]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const handleSave = async () => {
    await saveThemeSettings.mutateAsync(form as any);
    setInitial(form);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Logo, favicon en hoofdkleur — gebruikt in je webshop, e-mails en facturen
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/storefront">
                <ExternalLink className="h-4 w-4 mr-2" />
                Volledig theme
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <BrandingUploader
            logoUrl={form.logo_url}
            faviconUrl={form.favicon_url}
            onLogoChange={(url) => setForm((p) => ({ ...p, logo_url: url }))}
            onFaviconChange={(url) => setForm((p) => ({ ...p, favicon_url: url }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="brand_color">Merkkleur</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brand_color"
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_color: e.target.value }))}
                  className="h-10 w-16 p-1 cursor-pointer"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_color: e.target.value }))}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hoofdaccent voor e-mails en branding-elementen
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primary_color">Primaire kleur (webshop)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                  className="h-10 w-16 p-1 cursor-pointer"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Knoppen en links in je webshop
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-4">
            Tip: voor het volledige design (typografie, secundaire kleuren, theme-stijl) ga je naar{' '}
            <Link to="/admin/storefront" className="text-primary hover:underline">
              Webshop → Theme
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={saveThemeSettings.isPending}
        onSave={handleSave}
        onCancel={() => setForm(initial)}
      />
    </div>
  );
}
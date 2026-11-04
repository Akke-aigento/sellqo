import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, ExternalLink, Info, Loader2, Pipette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BrandingUploader } from '@/components/admin/storefront/BrandingUploader';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { useStorefront } from '@/hooks/useStorefront';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { useTenant } from '@/hooks/useTenant';
import { brandDiverges, syncTenantBrand } from '@/lib/branding';
import { colorFromLogo } from '@/lib/colorFromLogo';

// UREN-1b — Instellingen › Branding is de enige plek voor logo, favicon en merkkleur. Ze gelden voor je website,
// je mails, facturen en kassabonnen (zie src/lib/branding.ts). Website › Aanpassen toont enkel een voorbeeld.
// Eigen frontends: ongewijzigd (twee kleuren, enkel tenant_theme_settings; eerste wet).
const SWATCHES = ['#0d9488', '#00a0a8', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#374151'];

export function BrandingSettings() {
  const { t } = useTranslation();
  const { themeSettings, saveThemeSettings } = useStorefront();
  const { isCustomFrontend } = useFrontendMode();
  const { currentTenant, refreshTenants } = useTenant();

  const [form, setForm] = useState({
    logo_url: '' as string | null,
    favicon_url: '' as string | null,
    brand_color: '#000000',
    primary_color: '#000000',
  });
  const [initial, setInitial] = useState(form);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (themeSettings) {
      const ts = themeSettings as unknown as Record<string, string | null | undefined>;
      const next = {
        logo_url: ts.logo_url ?? null,
        favicon_url: ts.favicon_url ?? null,
        brand_color: ts.brand_color ?? ts.primary_color ?? '#000000',
        primary_color: ts.primary_color ?? '#000000',
      };
      setForm(next);
      setInitial(next);
    }
  }, [themeSettings]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  const tenant = currentTenant as { id?: string; logo_url?: string | null; primary_color?: string | null } | null;
  const differs = !isCustomFrontend && tenant ? brandDiverges({ logo_url: initial.logo_url, brand_color: initial.brand_color }, tenant) : { logo: false, color: false };

  const handleSave = async () => {
    if (isCustomFrontend) {
      // Eigen frontend: zoals voorheen.
      await saveThemeSettings.mutateAsync(form as never);
      setInitial(form);
      return;
    }
    // SellQo-website: één merkkleur (ook de knoppen op je site), en dezelfde waarden voor facturen en mails.
    const next = { ...form, primary_color: form.brand_color };
    await saveThemeSettings.mutateAsync(next as never);
    try {
      if (tenant?.id) await syncTenantBrand(tenant.id, { logo_url: next.logo_url, brand_color: next.brand_color });
      await refreshTenants();
    } catch (e) {
      toast.error(t('settings.branding.sync_failed', { reason: e instanceof Error ? e.message : String(e) }));
    }
    setForm(next);
    setInitial(next);
  };

  const pickFromLogo = async () => {
    if (!form.logo_url) { toast.error(t('admin.storefrontCustomize.upload_logo_first')); return; }
    setPicking(true);
    try {
      const c = await colorFromLogo(form.logo_url);
      if (c) { setForm((p) => ({ ...p, brand_color: c })); toast.success(t('admin.storefrontCustomize.brand_from_logo', { color: c })); }
      else toast.error(t('admin.storefrontCustomize.no_logo_color'));
    } catch {
      toast.error(t('admin.storefrontCustomize.no_logo_color'));
    } finally {
      setPicking(false);
    }
  };

  const colorInput = (key: 'brand_color' | 'primary_color', id: string) => (
    <div className="flex items-center gap-2">
      <Input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(form[key]) ? form[key] : '#000000'}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="h-10 w-16 p-1 cursor-pointer" />
      <Input value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} placeholder="#000000" className="flex-1 font-mono" aria-label={t('admin.storefrontCustomize.hex_color')} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>{t('settings.sections.branding')}</CardTitle>
              <CardDescription>
                {isCustomFrontend ? t('settings.branding.subtitle') : t('settings.branding.subtitle_one_place')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/storefront/aanpassen">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('settings.branding.fullTheme')}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {differs.logo || differs.color ? (
            <p role="status" className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('settings.branding.diverges')}
            </p>
          ) : null}
          <BrandingUploader
            logoUrl={form.logo_url}
            primaryColor={isCustomFrontend ? form.primary_color : form.brand_color}
            faviconUrl={form.favicon_url}
            onLogoChange={(url) => setForm((p) => ({ ...p, logo_url: url }))}
            onFaviconChange={(url) => setForm((p) => ({ ...p, favicon_url: url }))}
          />

          {isCustomFrontend ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="brand_color">{t('settings.branding.brandColor')}</Label>
                {colorInput('brand_color', 'brand_color')}
                <p className="text-xs text-muted-foreground">{t('settings.branding.accentHint')}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="primary_color">{t('settings.branding.primaryColor')}</Label>
                {colorInput('primary_color', 'primary_color')}
                <p className="text-xs text-muted-foreground">{t('settings.branding.primaryColorHint')}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2.5">
              <Label htmlFor="brand_color">{t('settings.branding.brandColor')}</Label>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((hex) => (
                  <button key={hex} type="button" aria-label={hex} onClick={() => setForm((p) => ({ ...p, brand_color: hex }))}
                    className={`h-8 w-8 rounded-full border-2 ${form.brand_color.toLowerCase() === hex ? 'border-foreground' : 'border-transparent'}`} style={{ background: hex }} />
                ))}
              </div>
              <div className="max-w-sm">{colorInput('brand_color', 'brand_color')}</div>
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={pickFromLogo} disabled={picking}>
                {picking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Pipette className="mr-1.5 h-4 w-4" />}{t('settings.branding.from_logo')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('settings.branding.brand_one_hint')}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-4">
            {t('settings.branding.theme_tip')}{' '}
            <Link to="/admin/storefront/aanpassen" className="text-primary hover:underline">
              {t('settings.branding.themePath')}
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

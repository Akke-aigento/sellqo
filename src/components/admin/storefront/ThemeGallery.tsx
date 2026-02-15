import { useState } from 'react';
import { Check, Crown, Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';

export function ThemeGallery() {
  const { themes, themeSettings, themesLoading, saveThemeSettings } = useStorefront();
  const { currentTenant } = useTenant();
  const { canonicalDomain } = useTenantDomains();
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);
  const pendingTheme = themes.find(t => t.id === pendingThemeId);

  const handleSelectTheme = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;

    // Apply theme default_settings as starting values alongside the theme_id
    const defaults = theme.default_settings;
    saveThemeSettings.mutate({
      theme_id: themeId,
      primary_color: defaults.primary_color,
      secondary_color: defaults.secondary_color,
      accent_color: defaults.accent_color,
      background_color: defaults.background_color,
      text_color: defaults.text_color,
      heading_font: defaults.heading_font,
      body_font: defaults.body_font,
      header_style: defaults.header_style,
      product_card_style: defaults.product_card_style,
      products_per_row: defaults.products_per_row,
      show_breadcrumbs: defaults.show_breadcrumbs,
      show_wishlist: defaults.show_wishlist,
    });
  };

  const storefrontUrl = canonicalDomain?.domain
    ? `https://${canonicalDomain.domain}`
    : currentTenant ? `/shop/${currentTenant.slug}` : null;

  if (themesLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Kies een Theme
        </CardTitle>
        <CardDescription>
          Selecteer een van onze professionele themes als basis voor je webshop
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {themes.map((theme) => {
            const isSelected = themeSettings?.theme_id === theme.id;
            const colors = theme.default_settings;
            
            return (
              <div
                key={theme.id}
                className={cn(
                  'relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all hover:shadow-lg',
                  isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                )}
                onClick={() => {
                  if (theme.id === themeSettings?.theme_id) return;
                  setPendingThemeId(theme.id);
                }}
              >
                {/* Theme Preview */}
                <div 
                  className="h-40 relative"
                  style={{ backgroundColor: colors.background_color }}
                >
                  {/* Mock Header */}
                  <div 
                    className="h-10 flex items-center px-4"
                    style={{ backgroundColor: colors.primary_color }}
                  >
                    <div className="w-20 h-4 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
                    {colors.header_style === 'centered' ? (
                      <div className="flex-1 flex justify-center gap-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />
                        ))}
                      </div>
                    ) : (
                      <div className="ml-auto flex gap-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Mock Products */}
                  <div className="p-4 grid grid-cols-4 gap-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="space-y-1">
                        <div 
                          className="aspect-square rounded"
                          style={{ backgroundColor: colors.secondary_color + '30' }}
                        />
                        <div 
                          className="h-2 rounded"
                          style={{ backgroundColor: colors.text_color + '40' }}
                        />
                        <div 
                          className="h-2 w-2/3 rounded"
                          style={{ backgroundColor: colors.accent_color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Theme Info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{theme.name}</h3>
                    {theme.is_premium && (
                      <Badge variant="secondary">
                        <Crown className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {theme.description}
                  </p>
                  
                  {/* Color Preview */}
                  <div className="flex gap-1">
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: colors.primary_color }}
                      title="Primary"
                    />
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: colors.secondary_color }}
                      title="Secondary"
                    />
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: colors.accent_color }}
                      title="Accent"
                    />
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {themeSettings?.theme_id && storefrontUrl && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Bekijk je winkel
              </a>
            </Button>
          </div>
        )}

        <AlertDialog open={!!pendingThemeId} onOpenChange={(open) => { if (!open) setPendingThemeId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Theme wijzigen?</AlertDialogTitle>
              <AlertDialogDescription>
                Als je naar <strong>{pendingTheme?.name}</strong> wisselt, worden al je huidige aanpassingen (kleuren, fonts, layout) gereset naar de standaardwaarden van dit theme.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (pendingThemeId) { handleSelectTheme(pendingThemeId); setPendingThemeId(null); } }}>
                Doorgaan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

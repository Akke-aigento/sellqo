import { Check, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useStorefront } from '@/hooks/useStorefront';

export function ThemeGalleryInline() {
  const { themes, themeSettings, themesLoading, saveThemeSettings } = useStorefront();

  const handleSelectTheme = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
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

  if (themesLoading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 flex-1 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {themes.map((theme) => {
        const isSelected = themeSettings?.theme_id === theme.id;
        const colors = theme.default_settings;
        return (
          <button
            key={theme.id}
            onClick={() => handleSelectTheme(theme.id)}
            className={cn(
              'relative flex-1 min-w-[160px] rounded-lg border-2 overflow-hidden transition-all hover:shadow-md text-left',
              isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
            )}
          >
            {/* Mini preview */}
            <div className="h-16 relative" style={{ backgroundColor: colors.background_color }}>
              <div className="h-6 flex items-center px-2" style={{ backgroundColor: colors.primary_color }}>
                <div className="w-10 h-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
                <div className="ml-auto flex gap-1">
                  {[1,2].map(i => <div key={i} className="w-4 h-1.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />)}
                </div>
              </div>
              <div className="px-2 pt-1 grid grid-cols-3 gap-1">
                {[1,2,3].map(i => (
                  <div key={i}>
                    <div className="aspect-square rounded-sm" style={{ backgroundColor: colors.secondary_color + '30' }} />
                    <div className="h-1 mt-0.5 rounded" style={{ backgroundColor: colors.accent_color }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">{theme.name}</p>
                <div className="flex gap-0.5 mt-1">
                  {[colors.primary_color, colors.secondary_color, colors.accent_color].map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              {theme.is_premium && <Badge variant="secondary" className="text-[9px] px-1.5 py-0"><Crown className="h-2.5 w-2.5 mr-0.5" />Pro</Badge>}
            </div>
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

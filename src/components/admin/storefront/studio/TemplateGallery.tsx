import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useStorefront } from '@/hooks/useStorefront';
import { useTemplateSeed } from '@/hooks/useTemplateSeed';
import { TemplatePreview } from './TemplatePreview';
import type { Theme } from '@/types/storefront';

interface TemplateGalleryProps {
  /** Getoond na een geslaagde keuze, bijv. om de gallery weer in te klappen. */
  onApplied?: () => void;
}

export function TemplateGallery({ onApplied }: TemplateGalleryProps) {
  const { themes, themeSettings, themesLoading, sections, pages } = useStorefront();
  const { applyTemplate } = useTemplateSeed();
  const [pendingTheme, setPendingTheme] = useState<Theme | null>(null);

  // Alleen rijen met een bouwplan zijn templates. De oudere themes
  // (Modern/Classic/Bold) blijven geldig voor tenants die er al op staan,
  // maar worden niet meer als keuze aangeboden.
  const templates = themes
    .filter((t) => !!t.seed_definition)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const hasContent = sections.some((s) => s.is_visible) || pages.length > 0;

  const handleConfirm = async () => {
    if (!pendingTheme) return;
    const theme = pendingTheme;
    setPendingTheme(null);
    await applyTemplate.mutateAsync(theme).catch(() => undefined);
    onApplied?.();
  };

  if (themesLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm font-medium">Nog geen templates beschikbaar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          De migratie met de launch-templates is nog niet uitgevoerd.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((theme) => {
          const isActive = themeSettings?.theme_id === theme.id;
          const isBusy = applyTemplate.isPending && pendingTheme?.id === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              disabled={applyTemplate.isPending}
              onClick={() => !isActive && setPendingTheme(theme)}
              className={cn(
                'group relative overflow-hidden rounded-lg border-2 text-left transition-all',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:shadow-lg',
                applyTemplate.isPending && 'opacity-60'
              )}
            >
              <div className="aspect-[4/3] w-full border-b bg-muted">
                <TemplatePreview theme={theme} />
              </div>

              <div className="space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{theme.name}</h3>
                  {theme.category && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {theme.category}
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {theme.description}
                </p>
              </div>

              {isActive && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {isBusy && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AlertDialog
        open={!!pendingTheme}
        onOpenChange={(open) => !open && setPendingTheme(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingTheme?.name} gebruiken?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Je krijgt de homepage-secties, voorbeeldpagina's en kleuren van dit
                  template. Daarna kun je alles naar wens aanpassen.
                </p>
                {hasContent && (
                  <p>
                    Wat je al had blijft bestaan: bestaande secties worden{' '}
                    <strong>verborgen, niet verwijderd</strong>, en pagina's die je al
                    hebt blijven ongewijzigd.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Template gebruiken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

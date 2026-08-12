import { ExternalLink, Rocket, Loader2, Globe, EyeOff, LayoutTemplate } from 'lucide-react';
import { TemplatePreview } from './TemplatePreview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';

/**
 * Kopkaart van de Shop Studio: waar staat de winkel, waar is hij te zien,
 * en één werkende knop om te publiceren.
 */
interface StudioHeaderProps {
  /** Opent de Design-sectie; het template is daar te wisselen. */
  onOpenDesign?: () => void;
}

export function StudioHeader({ onOpenDesign }: StudioHeaderProps) {
  const { themeSettings, themes, publishStorefront } = useStorefront();
  const { currentTenant } = useTenant();
  const { canonicalDomain } = useTenantDomains();

  const activeTemplate = themes.find((t) => t.id === themeSettings?.theme_id);

  const isOffline = themeSettings?.storefront_status === 'offline';
  const isPublished = !!themeSettings?.is_published;

  const storefrontUrl = canonicalDomain?.domain
    ? `https://${canonicalDomain.domain}`
    : currentTenant
      ? `/shop/${currentTenant.slug}`
      : null;

  const publishedAt = themeSettings?.published_at
    ? new Date(themeSettings.published_at).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Welk template draait deze winkel — dit was nergens zichtbaar. */}
          <button
            type="button"
            onClick={onOpenDesign}
            className="flex shrink-0 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted/50"
          >
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted">
              {activeTemplate ? (
                <TemplatePreview theme={activeTemplate} />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Template</p>
              <p className="truncate text-sm font-medium">
                {activeTemplate?.name ?? 'Nog niet gekozen'}
              </p>
            </div>
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {isOffline ? (
                <Badge variant="secondary" className="gap-1">
                  <EyeOff className="h-3 w-3" />
                  Offline
                </Badge>
              ) : isPublished ? (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <Rocket className="h-3 w-3" />
                  Live
                </Badge>
              ) : (
                <Badge variant="secondary">Nog niet gepubliceerd</Badge>
              )}

              {publishedAt && !isOffline && (
                <span className="text-xs text-muted-foreground">
                  Laatst gepubliceerd op {publishedAt}
                </span>
              )}
            </div>

            {storefrontUrl && (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground truncate"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {canonicalDomain?.domain ?? `${window.location.host}/shop/${currentTenant?.slug}`}
                </span>
              </a>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {storefrontUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Bekijk winkel
                </a>
              </Button>
            )}
            {/* Bewust niet meer afhankelijk van theme_id: die kolom is voor de
                meeste tenants leeg, waardoor deze knop onbruikbaar was. */}
            <Button
              size="sm"
              onClick={() => publishStorefront.mutate()}
              disabled={publishStorefront.isPending}
            >
              {publishStorefront.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              {isPublished ? 'Opnieuw publiceren' : 'Publiceren'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { ExternalLink, Rocket, Loader2, Globe, EyeOff } from 'lucide-react';
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
export function StudioHeader() {
  const { themeSettings, publishStorefront } = useStorefront();
  const { currentTenant } = useTenant();
  const { canonicalDomain } = useTenantDomains();

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
          <div className="min-w-0 space-y-1.5">
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

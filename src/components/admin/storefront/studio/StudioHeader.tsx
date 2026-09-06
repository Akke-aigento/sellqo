import { ExternalLink, Rocket, Loader2, Globe, EyeOff, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { TemplatePreview } from './TemplatePreview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { isExternalUrl, openExternal } from '@/lib/openExternal';

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

  const navigate = useNavigate();

  /**
   * "Bekijk winkel".
   *
   * Met een eigen domein is dit een externe URL en gaat hij via de in-app
   * browser (native) of een nieuw tabblad (web), nooit via een blank-target —
   * dat verlaat de Capacitor-WebView naar Safari, zonder weg terug.
   *
   * Zonder eigen domein is het `/shop/<slug>`, en dat blijft in de native app
   * bewust bínnen de app. De in-app browser deelt de sessie niet: de eigenaar
   * komt daar als anonieme bezoeker binnen en RLS geeft zijn eigen,
   * niet-gepubliceerde winkel dan niet terug ("Webshop niet gevonden").
   *
   * `?preview=true` doet twee dingen: het slaat de redirects in ShopLayout over
   * (custom frontend én canoniek domein), en het zet daar de terug-balk aan, zodat
   * de eigenaar niet vastloopt zoals eerder wél gebeurde.
   *
   * Op web verandert er niets: daar blijft het een nieuw tabblad, en resolvet
   * de browser het relatieve pad zelf tegen de juiste origin (ook op een
   * preview- of stagingdomein).
   */
  const handleOpenStorefront = () => {
    if (!storefrontUrl) return;

    if (isExternalUrl(storefrontUrl)) {
      void openExternal(storefrontUrl);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      navigate(`${storefrontUrl}?preview=true`);
      return;
    }

    window.open(storefrontUrl, '_blank', 'noopener,noreferrer');
  };

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
              <button
                type="button"
                onClick={handleOpenStorefront}
                className="flex items-center gap-1.5 text-left text-sm text-muted-foreground hover:text-foreground truncate"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {canonicalDomain?.domain ?? `${window.location.host}/shop/${currentTenant?.slug}`}
                </span>
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {storefrontUrl && (
              <Button variant="outline" size="sm" onClick={handleOpenStorefront}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Bekijk winkel
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

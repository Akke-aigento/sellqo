import { Link } from 'react-router-dom';
import { ExternalLink, Settings2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFrontendMode } from '@/hooks/useFrontendMode';

interface CustomFrontendStateProps {
  /** Toont alsnog de studio; de SellQo-winkel blijft immers beheerbaar. */
  onOpenStudio: () => void;
}

/**
 * Rustige alternatieve staat voor tenants op een eigen frontend.
 *
 * Vervangt de amber waarschuwingsbalk die eerder boven elke tab hing: één
 * duidelijke uitleg in plaats van een herhaalde waarschuwing. De studio blijft
 * bereikbaar — deze tenants kunnen nog steeds de SellQo-winkel inrichten.
 */
export function CustomFrontendState({ onOpenStudio }: CustomFrontendStateProps) {
  const { customFrontendUrl } = useFrontendMode();

  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto max-w-md space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Code2 className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Je draait een eigen frontend</h2>
            <p className="text-sm text-muted-foreground">
              Deze winkel wordt geserveerd door je eigen website, niet door de
              SellQo-webshop. Wat je hier instelt raakt je live site dus niet — de
              studio beheert alleen de ingebouwde SellQo-winkel.
            </p>
          </div>

          {customFrontendUrl && (
            <a
              href={customFrontendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {customFrontendUrl}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <div className="flex flex-col justify-center gap-2 pt-1 sm:flex-row">
            <Button asChild variant="default" size="sm">
              <Link to="/admin/settings?section=webshop-general">
                <Settings2 className="mr-2 h-4 w-4" />
                Frontend-instellingen
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenStudio}>
              Toch de SellQo-winkel beheren
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

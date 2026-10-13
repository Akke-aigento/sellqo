import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Globe, Home, FileText, Scale, Wand2, ExternalLink, Info, ChevronRight, Link2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollHint } from '@/components/ui/scroll-hint';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { StorefrontPagesManager } from '@/components/admin/storefront/StorefrontPagesManager';
import { LegalPagesManager } from '@/components/admin/storefront/LegalPagesManager';
import { StorefrontFeaturesSettings } from '@/components/admin/storefront/studio/StorefrontFeaturesSettings';

// WEBSHOP-PAGE-1 (13-10-2026): de Webshop-pagina draait rond de standaardshop op
// <slug>.sellqo.shop en de "Aanpassen"-editor. Design en Homepage zitten in de editor;
// de oude schermen (design-wizard, homepage-bouwer, status/publiceren, functies) gingen
// over de oude ingebouwde winkel en staan hier niet meer. Oude links (?section=design,
// ?section=homepage) gaan naar de editor.
const baseNav = [
  { id: 'overview', label: 'Overzicht', icon: Home },
  { id: 'pages', label: "Pagina's", icon: FileText },
  { id: 'legal', label: 'Juridisch', icon: Scale },
];
// Eigen websites lezen sommige van deze instellingen via de API (bv. gastafrekenen):
// voor die winkels blijft het scherm bereikbaar.
const featuresNav = { id: 'features', label: 'Functies (eigen website)', icon: SlidersHorizontal };
const TO_EDITOR = ['design', 'homepage'];

function ShopOverview({ slug, onNavigate }: { slug: string; onNavigate: (s: string) => void }) {
  const { isCustomFrontend, customFrontendUrl } = useFrontendMode();
  const shopUrl = `https://${slug}.sellqo.shop`;
  return (
    <div className="space-y-6">
      {isCustomFrontend ? (
        <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Je hebt ook een eigen website{customFrontendUrl ? <> (<a href={customFrontendUrl} target="_blank" rel="noreferrer" className="underline">{customFrontendUrl.replace(/^https?:\/\//, '')}</a>)</> : null}.
            Die blijft gewoon werken; deze SellQo-webshop draait ernaast op {slug}.sellqo.shop.
          </p>
        </div>
      ) : null}

      {/* Je winkel: voorbeeld + de twee acties die je echt nodig hebt. */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="relative h-56 overflow-hidden border-b bg-muted md:h-auto md:min-h-[260px] md:border-b-0 md:border-r">
            {/* Verkleinde, niet-klikbare weergave van de echte winkel. */}
            <iframe
              title="Voorbeeld van je winkel"
              src={shopUrl}
              tabIndex={-1}
              aria-hidden="true"
              loading="lazy"
              className="pointer-events-none absolute left-0 top-0 h-[300%] w-[300%] origin-top-left scale-[0.3333] border-0"
            />
          </div>
          <CardContent className="flex flex-col justify-center gap-4 p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Je winkel</p>
              <a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-lg font-semibold hover:underline">
                {slug}.sellqo.shop <ExternalLink className="h-4 w-4" />
              </a>
              <p className="text-sm text-muted-foreground">
                Kleuren, logo, lettertypes en je homepage pas je aan in één scherm, met je winkel ernaast.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/admin/storefront/aanpassen"><Wand2 className="mr-2 h-4 w-4" />Aanpassen</Link>
              </Button>
              <Button asChild variant="outline">
                <a href={shopUrl} target="_blank" rel="noreferrer">Bekijk winkel</a>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { id: 'pages', icon: FileText, title: "Pagina's", text: 'Over ons, contact en andere eigen pagina’s' },
          { id: 'legal', icon: Scale, title: 'Juridisch', text: 'Voorwaarden, privacy, retour en verzending' },
        ].map((c) => (
          <button key={c.id} type="button" onClick={() => onNavigate(c.id)}
            className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50">
            <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.title}</span>
              <span className="block text-sm text-muted-foreground">{c.text}</span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span>
            <span className="block font-medium">Eigen domein</span>
            <span className="block text-sm text-muted-foreground">Binnenkort: je eigen domein zelf koppelen.</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function StorefrontPage() {
  const { currentTenant } = useTenant();
  const { isCustomFrontend } = useFrontendMode();
  const navItems = isCustomFrontend ? [...baseNav, featuresNav] : baseNav;
  const [searchParams, setSearchParams] = useSearchParams();

  const sectionParam = searchParams.get('section');
  const activeSection = navItems.some((i) => i.id === sectionParam) ? (sectionParam as string) : 'overview';

  const goToSection = (section: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (section === 'overview') next.delete('section');
        else next.set('section', section);
        return next;
      },
      { replace: true }
    );
  };

  if (sectionParam && TO_EDITOR.includes(sectionParam)) return <Navigate to="/admin/storefront/aanpassen" replace />;

  if (!currentTenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Selecteer een winkel om door te gaan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'pages':
        return <StorefrontPagesManager />;
      case 'legal':
        return <LegalPagesManager />;
      case 'features':
        return <StorefrontFeaturesSettings />;
      default:
        return <ShopOverview slug={currentTenant.slug} onNavigate={goToSection} />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Globe className="h-8 w-8 text-primary" />
            Webshop
          </h1>
          <p className="mt-1 text-muted-foreground">Je winkel op {currentTenant.slug}.sellqo.shop</p>
        </div>
        <Button asChild>
          <Link to="/admin/storefront/aanpassen">
            <Wand2 className="mr-2 h-4 w-4" />
            Aanpassen
          </Link>
        </Button>
      </div>

      {/* Mobiel: horizontaal scrollbare navigatie */}
      <ScrollHint className="-mx-1 pb-2 md:hidden">
        <div className="flex min-w-max gap-1.5 px-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => goToSection(item.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                activeSection === item.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </ScrollHint>

      <div className="flex gap-6">
        {/* Desktop: zijnavigatie */}
        <nav className="hidden w-48 shrink-0 flex-col gap-1 md:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => goToSection(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                activeSection === item.id
                  ? 'border-l-2 border-primary bg-muted text-foreground'
                  : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">{renderSection()}</div>
      </div>
    </div>
  );
}

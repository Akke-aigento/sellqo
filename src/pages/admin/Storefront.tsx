import { useState } from 'react';
import { Globe, Paintbrush, LayoutDashboard, FileText, ExternalLink, Rocket, Scale, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { ThemeWizard } from '@/components/admin/storefront/ThemeWizard';
import { HomepageBuilder } from '@/components/admin/storefront/HomepageBuilder';
import { StorefrontPagesManager } from '@/components/admin/storefront/StorefrontPagesManager';
import { LegalPagesManager } from '@/components/admin/storefront/LegalPagesManager';
import { Card, CardContent } from '@/components/ui/card';

const navItems = [
  { id: 'theme', label: 'Theme', icon: Paintbrush },
  { id: 'homepage', label: 'Homepage', icon: LayoutDashboard },
  { id: 'pages', label: "Pagina's", icon: FileText },
  { id: 'legal', label: 'Juridisch', icon: Scale },
];

export default function StorefrontPage() {
  const { currentTenant } = useTenant();
  const { themeSettings, publishStorefront } = useStorefront();
  const [activeTab, setActiveTab] = useState('theme');
  const { canonicalDomain } = useTenantDomains();
  const { isCustomFrontend } = useFrontendMode();

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

  const isPublished = themeSettings?.is_published;
  const storefrontUrl = canonicalDomain?.domain
    ? `https://${canonicalDomain.domain}`
    : `/shop/${currentTenant.slug}`;

  const renderContent = () => {
    switch (activeTab) {
      case 'theme': return <ThemeWizard />;
      case 'homepage': return <HomepageBuilder />;
      case 'pages': return <StorefrontPagesManager />;
      case 'legal': return <LegalPagesManager />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Webshop
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer de content van je SellQo-webshop: theme, homepage en pagina's
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPublished ? (
            <Badge variant="default" className="bg-green-500">
              <Rocket className="h-3 w-3 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </a>
          </Button>
          <Button
            onClick={() => publishStorefront.mutate()}
            disabled={publishStorefront.isPending || !themeSettings?.theme_id}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {isPublished ? 'Opnieuw Publiceren' : 'Publiceren'}
          </Button>
        </div>
      </div>

      {isCustomFrontend && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
          <div className="text-amber-900 dark:text-amber-100">
            <strong className="font-medium">Custom frontend actief.</strong>{' '}
            Wijzigingen aan theme, homepage en pagina's beïnvloeden alleen de SellQo-frontend
            en hebben geen effect op je live custom website. Frontend-modus beheren kan via{' '}
            <a href="/admin/settings?section=webshop-general" className="underline font-medium">
              Instellingen › Webshop
            </a>.
          </div>
        </div>
      )}

      {/* Mobile: horizontal scrollable nav */}
      <div className="md:hidden overflow-x-auto pb-2 -mx-1">
        <div className="flex gap-1.5 px-1 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex gap-6">
        {/* Sidebar nav - desktop only */}
        <nav className="hidden md:flex flex-col gap-1 w-48 shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                activeTab === item.id
                  ? 'bg-muted text-foreground border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

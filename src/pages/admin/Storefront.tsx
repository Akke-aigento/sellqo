import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe,
  Paintbrush,
  LayoutDashboard,
  FileText,
  Scale,
  Home,
  Power,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { DesignPanel } from '@/components/admin/storefront/studio/DesignPanel';
import { HomepageBuilder } from '@/components/admin/storefront/HomepageBuilder';
import { StorefrontPagesManager } from '@/components/admin/storefront/StorefrontPagesManager';
import { LegalPagesManager } from '@/components/admin/storefront/LegalPagesManager';
import { StudioHeader } from '@/components/admin/storefront/studio/StudioHeader';
import { LaunchChecklist } from '@/components/admin/storefront/studio/LaunchChecklist';
import { CustomFrontendState } from '@/components/admin/storefront/studio/CustomFrontendState';
import { StatusSection } from '@/components/admin/storefront/studio/StatusSection';
import { StorefrontFeaturesSettings } from '@/components/admin/storefront/studio/StorefrontFeaturesSettings';

const navItems = [
  { id: 'overview', label: 'Overzicht', icon: Home },
  { id: 'design', label: 'Design', icon: Paintbrush },
  { id: 'homepage', label: 'Homepage', icon: LayoutDashboard },
  { id: 'pages', label: "Pagina's", icon: FileText },
  { id: 'legal', label: 'Juridisch', icon: Scale },
  { id: 'features', label: 'Functies & Gedrag', icon: SlidersHorizontal },
  { id: 'status', label: 'Status', icon: Power },
];

export default function StorefrontPage() {
  const { currentTenant } = useTenant();
  const { isCustomFrontend } = useFrontendMode();
  const [searchParams, setSearchParams] = useSearchParams();
  // Custom-frontend tenants zien eerst de uitleg; hiermee openen ze de studio alsnog.
  const [studioForced, setStudioForced] = useState(false);

  const sectionParam = searchParams.get('section');
  const activeSection = navItems.some((i) => i.id === sectionParam)
    ? (sectionParam as string)
    : 'overview';

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
      case 'overview':
        return (
          <div className="space-y-6">
            <StudioHeader onOpenDesign={() => goToSection('design')} />
            <LaunchChecklist onNavigate={goToSection} />
          </div>
        );
      case 'design':
        return <DesignPanel />;
      case 'homepage':
        return <HomepageBuilder />;
      case 'pages':
        return <StorefrontPagesManager />;
      case 'legal':
        return <LegalPagesManager />;
      case 'features':
        return <StorefrontFeaturesSettings />;
      case 'status':
        return <StatusSection />;
      default:
        return null;
    }
  };

  const header = (
    <div>
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <Globe className="h-8 w-8 text-primary" />
        Webshop
      </h1>
      <p className="mt-1 text-muted-foreground">
        Richt je SellQo-winkel in: design, homepage, pagina's en status
      </p>
    </div>
  );

  // Eén rustige uitleg in plaats van een waarschuwingsbalk boven elke sectie.
  if (isCustomFrontend && !studioForced) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <CustomFrontendState onOpenStudio={() => setStudioForced(true)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      {/* Mobiel: horizontaal scrollbare navigatie */}
      <div className="-mx-1 overflow-x-auto pb-2 md:hidden">
        <div className="flex min-w-max gap-1.5 px-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => goToSection(item.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                activeSection === item.id
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

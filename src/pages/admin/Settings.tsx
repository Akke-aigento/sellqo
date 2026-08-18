import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

import { 
  User,
  Building2,
  CreditCard,
  Users, 
  Receipt, 
  FileCheck, 
  Percent, 
  Network, 
  Bell,
  ChevronRight,
  ChevronLeft,
  Share2,
  Mail,
  Globe,
  Banknote,
  FileText,
  MessageCircle,
  MessageSquare,
  Bot,
  Inbox,
  Undo2,
  Palette,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AccountSettings } from '@/components/admin/settings/AccountSettings';
import { BusinessSettings } from '@/components/admin/settings/BusinessSettings';
import { BrandingSettings } from '@/components/admin/settings/BrandingSettings';
import { PaymentSettings } from '@/components/admin/settings/PaymentSettings';
import { TeamSettings } from '@/components/admin/settings/TeamSettings';
import { TaxSettings } from '@/components/admin/settings/TaxSettings';
import { InvoiceComplianceCard } from '@/components/admin/settings/InvoiceComplianceCard';
import { VatRatesSettings } from '@/components/admin/settings/VatRatesSettings';
import { PeppolSettings } from '@/components/admin/settings/PeppolSettings';
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings';
import { SocialMediaHub } from '@/components/admin/settings/SocialMediaHub';
import { NewsletterSettings } from '@/components/admin/storefront/NewsletterSettings';
import { MultiDomainSettings } from '@/components/admin/settings/MultiDomainSettings';
import { TransactionFeeSettings } from '@/components/admin/settings/TransactionFeeSettings';
import { InvoiceAutomationSettings } from '@/components/admin/settings/InvoiceAutomationSettings';
import { FulfillmentAPISettings } from '@/components/admin/settings/FulfillmentAPISettings';
import { WhatsAppSettings } from '@/components/admin/settings/WhatsAppSettings';
import { CustomerCommunicationSettings } from '@/components/admin/settings/CustomerCommunicationSettings';
import { AIAssistantSettings } from '@/components/admin/settings/AIAssistantSettings';
import { InboundEmailSettings } from '@/components/admin/settings/InboundEmailSettings';
import { PlatformToolsSettings } from '@/components/admin/settings/PlatformToolsSettings';
import { ReturnSettingsPage } from '@/components/admin/settings/ReturnSettings';
import { StorefrontSettings } from '@/components/admin/storefront/StorefrontSettings';
import { ReviewsHub } from '@/components/admin/storefront/ReviewsHub';
import { useAuth } from '@/hooks/useAuth';
import { useCan, type Resource } from '@/hooks/useCan';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { Wrench } from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  adminOnly?: boolean;
  featureKey?: string;
  /**
   * PERM-2 — sectie alleen zichtbaar wanneer de rol dit recht heeft.
   * Geen waarde = zichtbaar voor iedereen (persoonlijke instellingen).
   */
  requiredRead?: Resource;
}

interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  sections: SettingsSection[];
}

const settingsGroups: SettingsGroup[] = [
  {
    id: 'account',
    title: 'Account & Team',
    description: 'Beheer je persoonlijke gegevens en teamleden',
    sections: [
      { id: 'profile', title: 'Mijn profiel', icon: User, component: AccountSettings },
      { id: 'team', title: 'Teamleden', icon: Users, component: TeamSettings, adminOnly: true },
    ],
  },
  {
    id: 'business',
    title: 'Bedrijfsinformatie',
    description: 'Bedrijfsgegevens, branding en domeinen',
    sections: [
      { id: 'company', title: 'Bedrijfsgegevens', icon: Building2, component: BusinessSettings, requiredRead: 'settings_general' },
      { id: 'branding', title: 'Branding', icon: Palette, component: BrandingSettings, requiredRead: 'settings_general' },
      { id: 'domain', title: 'Domeinen', icon: Globe, component: MultiDomainSettings, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'webshop',
    title: 'Webshop',
    // Theme, homepage, pagina's, juridisch, functies en status zitten sinds
    // WEBSHOP-2 t/m 4 in de Shop Studio op /admin/storefront. Hier blijft
    // alleen wat over de frontend zelf gaat.
    description: 'Frontend-modus, storefront API-keys en tracking',
    sections: [
      { id: 'webshop-general', title: 'Webshop-instellingen', icon: Globe, component: StorefrontSettings, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'financial',
    title: 'Financieel & BTW',
    description: 'BTW-instellingen, tarieven en e-facturatie',
    sections: [
      { id: 'tax', title: 'BTW instellingen', icon: Receipt, component: TaxSettings, requiredRead: 'settings_financial' },
      { id: 'vat_rates', title: 'BTW Tarieven', icon: Percent, component: VatRatesSettings, requiredRead: 'settings_financial' },
      { id: 'invoicing', title: 'Automatische Facturatie', icon: FileText, component: InvoiceAutomationSettings, requiredRead: 'settings_financial' },
      { id: 'peppol', title: 'Peppol & E-facturatie', icon: Network, component: PeppolSettings, featureKey: 'peppol', requiredRead: 'settings_financial' },
      { id: 'compliance', title: 'Compliance', icon: FileCheck, component: InvoiceComplianceCard, requiredRead: 'settings_financial' },
    ],
  },
  {
    id: 'payments',
    title: 'Betalingen',
    description: 'Betalingsmethoden en transactiekosten',
    sections: [
      { id: 'payments', title: 'Betalingsmethoden', icon: CreditCard, component: PaymentSettings, requiredRead: 'settings_financial' },
      { id: 'transactions', title: 'Transacties & Kosten', icon: Banknote, component: TransactionFeeSettings, requiredRead: 'settings_financial' },
    ],
  },
  {
    id: 'returns',
    title: 'Retouren',
    description: 'Retourbeleid, refund logica en klant-portaal',
    sections: [
      { id: 'return-settings', title: 'Retourinstellingen', icon: Undo2, component: ReturnSettingsPage, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'channels',
    title: 'SellQo Connect',
    description: 'Beheer al je externe kanalen en koppelingen',
    sections: [
      { id: 'shop-notifications', title: 'Winkel Notificaties', icon: Bell, component: NotificationSettings, requiredRead: 'settings_general' },
      { id: 'customer-communication', title: 'Klant Communicatie', icon: MessageSquare, component: CustomerCommunicationSettings, requiredRead: 'settings_general' },
      { id: 'inbound-email', title: 'Email Inbox', icon: Inbox, component: InboundEmailSettings, requiredRead: 'settings_general' },
      { id: 'ai-assistant', title: 'AI Assistent', icon: Bot, component: AIAssistantSettings, featureKey: 'ai_marketing', requiredRead: 'marketing' },
      { id: 'whatsapp', title: 'WhatsApp Koppeling', icon: MessageCircle, component: WhatsAppSettings, featureKey: 'whatsapp', requiredRead: 'marketing' },
      { id: 'newsletter', title: 'Nieuwsbrief', icon: Mail, component: NewsletterSettings, featureKey: 'newsletter', requiredRead: 'marketing' },
      { id: 'social', title: 'Social Media', icon: Share2, component: SocialMediaHub, featureKey: 'social_commerce', requiredRead: 'marketing' },
      { id: 'reviews', title: 'Reviews', icon: Star, component: ReviewsHub, requiredRead: 'marketing' },
      { id: 'fulfillment-api', title: 'Fulfillment API', icon: Network, component: FulfillmentAPISettings, adminOnly: true, featureKey: 'fulfillment_api' },
    ],
  },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  // On mobile: drill-down navigation. Menu visible by default, content shown
  // only after a section is picked. Deep-link (?section=...) opens content directly.
  const [mobileShowContent, setMobileShowContent] = useState(
    !!searchParams.get('section')
  );
  const { roles } = useAuth();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const isMobile = useIsMobile();

  // PERM-2 — hooks kunnen niet in een loop; lees de gebruikte rechten hier uit.
  const canReadSettingsGeneral = useCan('read', 'settings_general');
  const canReadSettingsFinancial = useCan('read', 'settings_financial');
  const canReadMarketing = useCan('read', 'marketing');

  const isPlatformAdmin = roles.some(r => r.role === 'platform_admin');
  const isAdminView = isPlatformAdmin && sessionStorage.getItem('admin_view_mode') === 'true';
  const isTenantAdmin = roles.some(
    r => r.role === 'tenant_admin' || r.role === 'platform_admin'
  );

  const allGroups: SettingsGroup[] = [
    ...settingsGroups,
    ...(isPlatformAdmin && isAdminView ? [{
      id: 'platform-tools',
      title: 'Platform Tools',
      description: 'Beheertools voor het platform',
      sections: [
        { id: 'platform-tools', title: 'Platform Tools', icon: Wrench, component: PlatformToolsSettings } as SettingsSection,
      ],
    }] : []),
  ];

  const isSectionFeatureVisible = (section: SettingsSection): boolean => {
    if (!section.featureKey) return true;
    if (isPlatformAdmin && isAdminView) return true;
    if (isFeatureGranted(section.featureKey)) return true;
    const features = subscription?.pricing_plan?.features as unknown as Record<string, boolean> | undefined;
    if (!features) return true;
    return features[section.featureKey] !== false;
  };

  const isSectionPermitted = (section: SettingsSection): boolean => {
    if (!section.requiredRead) return true;
    switch (section.requiredRead) {
      case 'settings_general':
        return canReadSettingsGeneral;
      case 'settings_financial':
        return canReadSettingsFinancial;
      case 'marketing':
        return canReadMarketing;
      default:
        return true;
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
    if (isMobile) {
      setMobileShowContent(true);
      // Reset outer scroll container so content starts at top.
      requestAnimationFrame(() => {
        const scrollContainer =
          (document.querySelector('main.overflow-y-auto') as HTMLElement | null) ||
          (document.querySelector('main') as HTMLElement | null);
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' });
      });
    }
  };

  const handleBackToMenu = () => {
    setMobileShowContent(false);
    setSearchParams({});
  };

  // PERM-2 — deep-links naar een niet-toegestane sectie vallen terug op 'Mijn profiel'.
  const activeSectionMeta =
    allGroups
      .flatMap(g => g.sections)
      .find(
        s =>
          s.id === activeSection &&
          (!s.adminOnly || isTenantAdmin) &&
          isSectionPermitted(s),
      ) ??
    allGroups.flatMap(g => g.sections).find(s => s.id === 'profile');

  const ActiveComponent = activeSectionMeta?.component;

  const showMenu = !isMobile || !mobileShowContent;
  const showContent = !isMobile || mobileShowContent;

  return (
    <div className="space-y-6">
      {showMenu && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
          <p className="text-muted-foreground">
            Beheer je account, winkel en betalingsconfiguratie
          </p>
        </div>
      )}

      {isMobile && mobileShowContent && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToMenu}
            className="-ml-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Instellingen
          </Button>
          {activeSectionMeta && (
            <h2 className="text-lg font-semibold truncate">
              {activeSectionMeta.title}
            </h2>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {showMenu && (
        <aside className="lg:w-64 flex-shrink-0">
          <Card>
            <ScrollArea className="h-auto lg:h-[calc(100vh-220px)]">
              <CardContent className="p-2">
                <nav className="space-y-4">
                  {allGroups.map((group) => {
                    const visibleSections = group.sections.filter(
                      s => (!s.adminOnly || isTenantAdmin) && isSectionFeatureVisible(s) && isSectionPermitted(s)
                    );
                    if (visibleSections.length === 0) return null;

                    return (
                      <div key={group.id}>
                        <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.title}
                        </h3>
                        <div className="space-y-1">
                          {visibleSections.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            
                            return (
                              <button
                                key={section.id}
                                onClick={() => handleSectionChange(section.id)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                                  isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted text-foreground'
                                )}
                              >
                                <Icon className="h-4 w-4 flex-shrink-0" />
                                <span className="flex-1 text-left">{section.title}</span>
                                {isActive && (
                                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </CardContent>
            </ScrollArea>
          </Card>
        </aside>
        )}

        {showContent && (
          <main className="flex-1 min-w-0">
            {ActiveComponent && <ActiveComponent />}
          </main>
        )}
      </div>
    </div>
  );
}
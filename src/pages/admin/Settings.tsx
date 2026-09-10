import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  /** i18n-key; render met t(titleKey). Nooit een letterlijke tekst. */
  titleKey: string;
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
  titleKey: string;
  descriptionKey: string;
  sections: SettingsSection[];
}

const settingsGroups: SettingsGroup[] = [
  {
    id: 'account',
    titleKey: 'settings.groups.account.title',
    descriptionKey: 'settings.groups.account.description',
    sections: [
      { id: 'profile', titleKey: 'settings.sections.profile', icon: User, component: AccountSettings },
      { id: 'team', titleKey: 'settings.sections.team', icon: Users, component: TeamSettings, adminOnly: true },
    ],
  },
  {
    id: 'business',
    titleKey: 'settings.groups.business.title',
    descriptionKey: 'settings.groups.business.description',
    sections: [
      { id: 'company', titleKey: 'settings.sections.company', icon: Building2, component: BusinessSettings, requiredRead: 'settings_general' },
      { id: 'branding', titleKey: 'settings.sections.branding', icon: Palette, component: BrandingSettings, requiredRead: 'settings_general' },
      { id: 'domain', titleKey: 'settings.sections.domain', icon: Globe, component: MultiDomainSettings, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'webshop',
    titleKey: 'settings.groups.webshop.title',
    // Theme, homepage, pagina's, juridisch, functies en status zitten sinds
    // WEBSHOP-2 t/m 4 in de Shop Studio op /admin/storefront. Hier blijft
    // alleen wat over de frontend zelf gaat.
    descriptionKey: 'settings.groups.webshop.description',
    sections: [
      { id: 'webshop-general', titleKey: 'settings.sections.webshop_general', icon: Globe, component: StorefrontSettings, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'financial',
    titleKey: 'settings.groups.financial.title',
    descriptionKey: 'settings.groups.financial.description',
    sections: [
      { id: 'tax', titleKey: 'settings.sections.tax', icon: Receipt, component: TaxSettings, requiredRead: 'settings_financial' },
      { id: 'vat_rates', titleKey: 'settings.sections.vat_rates', icon: Percent, component: VatRatesSettings, requiredRead: 'settings_financial' },
      { id: 'invoicing', titleKey: 'settings.sections.invoicing', icon: FileText, component: InvoiceAutomationSettings, requiredRead: 'settings_financial' },
      { id: 'peppol', titleKey: 'settings.sections.peppol', icon: Network, component: PeppolSettings, featureKey: 'peppol', requiredRead: 'settings_financial' },
      { id: 'compliance', titleKey: 'settings.sections.compliance', icon: FileCheck, component: InvoiceComplianceCard, requiredRead: 'settings_financial' },
    ],
  },
  {
    id: 'payments',
    titleKey: 'settings.groups.payments.title',
    descriptionKey: 'settings.groups.payments.description',
    sections: [
      { id: 'payments', titleKey: 'settings.sections.payments', icon: CreditCard, component: PaymentSettings, requiredRead: 'settings_financial' },
      { id: 'transactions', titleKey: 'settings.sections.transactions', icon: Banknote, component: TransactionFeeSettings, requiredRead: 'settings_financial' },
    ],
  },
  {
    id: 'returns',
    titleKey: 'settings.groups.returns.title',
    descriptionKey: 'settings.groups.returns.description',
    sections: [
      { id: 'return-settings', titleKey: 'settings.sections.return_settings', icon: Undo2, component: ReturnSettingsPage, requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'channels',
    titleKey: 'settings.groups.channels.title',
    descriptionKey: 'settings.groups.channels.description',
    sections: [
      { id: 'shop-notifications', titleKey: 'settings.sections.shop_notifications', icon: Bell, component: NotificationSettings, requiredRead: 'settings_general' },
      { id: 'customer-communication', titleKey: 'settings.sections.customer_communication', icon: MessageSquare, component: CustomerCommunicationSettings, requiredRead: 'settings_general' },
      { id: 'inbound-email', titleKey: 'settings.sections.inbound_email', icon: Inbox, component: InboundEmailSettings, requiredRead: 'settings_general' },
      { id: 'ai-assistant', titleKey: 'settings.sections.ai_assistant', icon: Bot, component: AIAssistantSettings, featureKey: 'ai_marketing', requiredRead: 'marketing' },
      { id: 'whatsapp', titleKey: 'settings.sections.whatsapp', icon: MessageCircle, component: WhatsAppSettings, featureKey: 'whatsapp', requiredRead: 'marketing' },
      { id: 'newsletter', titleKey: 'settings.sections.newsletter', icon: Mail, component: NewsletterSettings, featureKey: 'newsletter', requiredRead: 'marketing' },
      { id: 'social', titleKey: 'settings.sections.social', icon: Share2, component: SocialMediaHub, featureKey: 'social_commerce', requiredRead: 'marketing' },
      { id: 'reviews', titleKey: 'settings.sections.reviews', icon: Star, component: ReviewsHub, requiredRead: 'marketing' },
      { id: 'fulfillment-api', titleKey: 'settings.sections.fulfillment_api', icon: Network, component: FulfillmentAPISettings, adminOnly: true, featureKey: 'fulfillment_api' },
    ],
  },
];

export default function SettingsPage() {
  const { t } = useTranslation();
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
      titleKey: 'settings.groups.platform.title',
      descriptionKey: 'settings.groups.platform.description',
      sections: [
        { id: 'platform-tools', titleKey: 'settings.sections.platform_tools', icon: Wrench, component: PlatformToolsSettings } as SettingsSection,
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
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.subtitle')}
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
              {t(activeSectionMeta.titleKey)}
            </h2>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {showMenu && (
        <aside className="lg:w-64 flex-shrink-0">
          <Card>
            <ScrollArea className="h-auto lg:h-[calc(100dvh-220px)]">
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
                          {t(group.titleKey)}
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
                                <span className="flex-1 text-left">{t(section.titleKey)}</span>
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
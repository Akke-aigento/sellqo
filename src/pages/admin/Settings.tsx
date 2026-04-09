import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Store, 
  CreditCard, 
  Users, 
  Receipt, 
  FileCheck, 
  Percent, 
  Network, 
  Bell,
  ChevronRight,
  Share2,
  Mail,
  Globe,
  Banknote,
  FileText,
  MessageCircle,
  MessageSquare,
  Bot,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AccountSettings } from '@/components/admin/settings/AccountSettings';
import { BusinessSettings } from '@/components/admin/settings/BusinessSettings';
import { StoreSettings } from '@/components/admin/settings/StoreSettings';
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
import { useAuth } from '@/hooks/useAuth';
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
    description: 'Bedrijfsgegevens en winkelinstellingen',
    sections: [
      { id: 'company', title: 'Bedrijfsgegevens', icon: Building2, component: BusinessSettings },
      { id: 'store', title: 'Winkelinstellingen', icon: Store, component: StoreSettings },
      { id: 'domain', title: 'Domeinen', icon: Globe, component: MultiDomainSettings },
    ],
  },
  {
    id: 'financial',
    title: 'Financieel & BTW',
    description: 'BTW-instellingen, tarieven en e-facturatie',
    sections: [
      { id: 'tax', title: 'BTW instellingen', icon: Receipt, component: TaxSettings },
      { id: 'vat_rates', title: 'BTW Tarieven', icon: Percent, component: VatRatesSettings },
      { id: 'invoicing', title: 'Automatische Facturatie', icon: FileText, component: InvoiceAutomationSettings },
      { id: 'peppol', title: 'Peppol & E-facturatie', icon: Network, component: PeppolSettings, featureKey: 'peppol' },
      { id: 'compliance', title: 'Compliance', icon: FileCheck, component: InvoiceComplianceCard },
    ],
  },
  {
    id: 'payments',
    title: 'Betalingen',
    description: 'Betalingsmethoden en transactiekosten',
    sections: [
      { id: 'payments', title: 'Betalingsmethoden', icon: CreditCard, component: PaymentSettings },
      { id: 'transactions', title: 'Transacties & Kosten', icon: Banknote, component: TransactionFeeSettings },
    ],
  },
  {
    id: 'channels',
    title: 'SellQo Connect',
    description: 'Beheer al je externe kanalen en koppelingen',
    sections: [
      { id: 'shop-notifications', title: 'Winkel Notificaties', icon: Bell, component: NotificationSettings },
      { id: 'customer-communication', title: 'Klant Communicatie', icon: MessageSquare, component: CustomerCommunicationSettings },
      { id: 'inbound-email', title: 'Email Inbox', icon: Inbox, component: InboundEmailSettings },
      { id: 'ai-assistant', title: 'AI Assistent', icon: Bot, component: AIAssistantSettings, featureKey: 'ai_marketing' },
      { id: 'whatsapp', title: 'WhatsApp Koppeling', icon: MessageCircle, component: WhatsAppSettings, featureKey: 'whatsapp' },
      { id: 'newsletter', title: 'Nieuwsbrief', icon: Mail, component: NewsletterSettings, featureKey: 'newsletter' },
      { id: 'social', title: 'Social Media', icon: Share2, component: SocialMediaHub, featureKey: 'social_commerce' },
      { id: 'fulfillment-api', title: 'Fulfillment API', icon: Network, component: FulfillmentAPISettings, adminOnly: true, featureKey: 'fulfillment_api' },
    ],
  },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const { roles } = useAuth();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();

  const isPlatformAdmin = roles.some(r => r.role === 'platform_admin');
  const isAdminView = isPlatformAdmin && sessionStorage.getItem('admin_view_mode') === 'true';
  const isTenantAdmin = roles.some(
    r => r.role === 'tenant_admin' || r.role === 'platform_admin'
  );

  const isSectionFeatureVisible = (section: SettingsSection): boolean => {
    if (!section.featureKey) return true;
    if (isPlatformAdmin && isAdminView) return true;
    if (isFeatureGranted(section.featureKey)) return true;
    const features = subscription?.pricing_plan?.features as unknown as Record<string, boolean> | undefined;
    if (!features) return true;
    return features[section.featureKey] !== false;
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  const ActiveComponent = settingsGroups
    .flatMap(g => g.sections)
    .find(s => s.id === activeSection)?.component;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">
          Beheer je account, winkel en betalingsconfiguratie
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 flex-shrink-0">
          <Card>
            <ScrollArea className="h-auto lg:h-[calc(100vh-220px)]">
              <CardContent className="p-2">
                <nav className="space-y-4">
                  {settingsGroups.map((group) => {
                    const visibleSections = group.sections.filter(
                      s => (!s.adminOnly || isTenantAdmin) && isSectionFeatureVisible(s)
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

        <main className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  );
}
import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
  BookOpen,
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
import { SignatureSettings } from '@/components/admin/settings/SignatureSettings';
import { TrackingNotificationSettings } from '@/components/admin/settings/TrackingNotificationSettings';
import { DocumentationSettings } from '@/components/admin/settings/DocumentationSettings';
import { useAuth } from '@/hooks/useAuth';
import { Inbox, Truck, PenLine } from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  adminOnly?: boolean;
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
      { id: 'peppol', title: 'Peppol & E-facturatie', icon: Network, component: PeppolSettings },
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
    title: 'Koppelingen & Kanalen',
    description: 'Communicatie en externe koppelingen',
    sections: [
      { id: 'shop-notifications', title: 'Winkel Notificaties', icon: Bell, component: NotificationSettings },
      { id: 'customer-communication', title: 'Klant Communicatie', icon: MessageSquare, component: CustomerCommunicationSettings },
      { id: 'inbound-email', title: 'Email Inbox', icon: Inbox, component: InboundEmailSettings },
      { id: 'email-signatures', title: 'E-mail Handtekeningen', icon: PenLine, component: SignatureSettings },
      { id: 'ai-assistant', title: 'AI Assistent', icon: Bot, component: AIAssistantSettings },
      { id: 'whatsapp', title: 'WhatsApp Koppeling', icon: MessageCircle, component: WhatsAppSettings },
      { id: 'newsletter', title: 'Nieuwsbrief', icon: Mail, component: NewsletterSettings },
      { id: 'social', title: 'Social Media', icon: Share2, component: SocialMediaHub },
      { id: 'tracking', title: 'Verzending & Tracking', icon: Truck, component: TrackingNotificationSettings },
      { id: 'fulfillment-api', title: 'Fulfillment API', icon: Network, component: FulfillmentAPISettings, adminOnly: true },
      { id: 'documentation', title: 'Documentatie', icon: BookOpen, component: DocumentationSettings },
    ],
  },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const [menuOpen, setMenuOpen] = useState(false);
  const { roles } = useAuth();
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);

  const isTenantAdmin = roles.some(
    r => r.role === 'tenant_admin' || r.role === 'platform_admin'
  );

  const allSections = settingsGroups.flatMap(g => g.sections);
  const activeInfo = allSections.find(s => s.id === activeSection);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
    if (isMobile) {
      setMenuOpen(false);
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  // Find the active section's component
  const ActiveComponent = activeInfo?.component;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">
          Beheer je account, winkel en betalingsconfiguratie
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          {isMobile ? (
            <Collapsible open={menuOpen} onOpenChange={setMenuOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-card border rounded-lg text-sm font-medium">
                  {activeInfo && (
                    <>
                      <activeInfo.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="flex-1 text-left">{activeInfo.title}</span>
                    </>
                  )}
                  <ChevronRight className={cn('h-4 w-4 flex-shrink-0 transition-transform', menuOpen && 'rotate-90')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="p-2">
                    <nav className="space-y-4">
                      {settingsGroups.map((group) => {
                        const visibleSections = group.sections.filter(
                          s => !s.adminOnly || isTenantAdmin
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
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </nav>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Card>
              <ScrollArea className="h-auto lg:h-[calc(100vh-220px)]">
                <CardContent className="p-2">
                  <nav className="space-y-4">
                    {settingsGroups.map((group) => {
                      const visibleSections = group.sections.filter(
                        s => !s.adminOnly || isTenantAdmin
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
          )}
        </aside>

        {/* Main Content */}
        <main ref={contentRef} className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  );
}

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
  Palette,
  Share2,
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
import { useAuth } from '@/hooks/useAuth';

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
    ],
  },
  {
    id: 'financial',
    title: 'Financieel & BTW',
    description: 'BTW-instellingen, tarieven en e-facturatie',
    sections: [
      { id: 'tax', title: 'BTW instellingen', icon: Receipt, component: TaxSettings },
      { id: 'vat_rates', title: 'BTW Tarieven', icon: Percent, component: VatRatesSettings },
      { id: 'peppol', title: 'Peppol & E-facturatie', icon: Network, component: PeppolSettings },
      { id: 'compliance', title: 'Compliance', icon: FileCheck, component: InvoiceComplianceCard },
    ],
  },
  {
    id: 'integrations',
    title: 'Betalingen & Notificaties',
    description: 'Betalingsmethoden en meldingsvoorkeuren',
    sections: [
      { id: 'payments', title: 'Betalingsmethoden', icon: CreditCard, component: PaymentSettings },
      { id: 'notifications', title: 'Notificaties', icon: Bell, component: NotificationSettings },
      { id: 'social', title: 'Social Media', icon: Share2, component: SocialMediaHub },
    ],
  },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const { roles } = useAuth();

  const isTenantAdmin = roles.some(
    r => r.role === 'tenant_admin' || r.role === 'platform_admin'
  );

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  // Find the active section's component
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
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  );
}

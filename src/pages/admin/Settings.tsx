import { User, Building2, Store, CreditCard, Users, Image } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountSettings } from '@/components/admin/settings/AccountSettings';
import { BusinessSettings } from '@/components/admin/settings/BusinessSettings';
import { StoreSettings } from '@/components/admin/settings/StoreSettings';
import { PaymentSettings } from '@/components/admin/settings/PaymentSettings';
import { TeamSettings } from '@/components/admin/settings/TeamSettings';
import { LogoProcessor } from '@/components/admin/LogoProcessor';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { roles } = useAuth();
  
  // Check if user is tenant admin or platform admin
  const isTenantAdmin = roles.some(
    r => r.role === 'tenant_admin' || r.role === 'platform_admin'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">
          Beheer je account, winkel en betalingsconfiguratie
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1">
          <TabsTrigger value="account" className="flex items-center gap-2 py-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2 py-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Bedrijf</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center gap-2 py-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Winkel</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2 py-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Betalingen</span>
          </TabsTrigger>
          {isTenantAdmin && (
            <TabsTrigger value="team" className="flex items-center gap-2 py-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="branding" className="flex items-center gap-2 py-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="business">
          <BusinessSettings />
        </TabsContent>

        <TabsContent value="store">
          <StoreSettings />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentSettings />
        </TabsContent>

        {isTenantAdmin && (
          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>
        )}

        <TabsContent value="branding">
          <LogoProcessor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

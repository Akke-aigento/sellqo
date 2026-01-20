import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { TenantOverviewTab } from '@/components/platform/TenantOverviewTab';
import { TenantSubscriptionTab } from '@/components/platform/TenantSubscriptionTab';
import { TenantCreditsTab } from '@/components/platform/TenantCreditsTab';
import { TenantInvoicesTab } from '@/components/platform/TenantInvoicesTab';
import { TenantModulesTab } from '@/components/platform/TenantModulesTab';
import { TenantActivityTab } from '@/components/platform/TenantActivityTab';

export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { useTenantDetail } = usePlatformAdmin();
  const { data: tenant, isLoading } = useTenantDetail(tenantId || '');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Tenant niet gevonden</p>
        <Button variant="outline" onClick={() => navigate('/admin/platform')}>
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/platform')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <p className="text-sm text-muted-foreground">{tenant.slug}</p>
          </div>
          <Badge variant={tenant.subscription_status === 'active' ? 'default' : 'secondary'}>
            {tenant.subscription_status || 'Geen'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="subscription">Abonnement</TabsTrigger>
          <TabsTrigger value="credits">AI Credits</TabsTrigger>
          <TabsTrigger value="invoices">Facturen</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="activity">Activiteit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TenantOverviewTab tenantId={tenantId!} />
        </TabsContent>

        <TabsContent value="subscription">
          <TenantSubscriptionTab tenantId={tenantId!} />
        </TabsContent>

        <TabsContent value="credits">
          <TenantCreditsTab tenantId={tenantId!} />
        </TabsContent>

        <TabsContent value="invoices">
          <TenantInvoicesTab tenantId={tenantId!} />
        </TabsContent>

        <TabsContent value="modules">
          <TenantModulesTab tenantId={tenantId!} />
        </TabsContent>

        <TabsContent value="activity">
          <TenantActivityTab tenantId={tenantId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

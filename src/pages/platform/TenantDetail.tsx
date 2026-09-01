import { useState } from 'react';
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
import { TenantActionsTab } from '@/components/platform/TenantActionsTab';
import { TenantTeamTab } from '@/components/platform/TenantTeamTab';

export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { useTenantDetail } = usePlatformAdmin();
  const { data: tenant, isLoading } = useTenantDetail(tenantId || '');

  // TENANT-TABS-1: lazy mount, daarna keep-alive.
  // Radix unmount inactieve TabsContent, dus elke tab-switch remountte de
  // tab-component: react-query-observers opnieuw opgebouwd (met refetch zodra
  // de 30s staleTime verlopen was), lokale formstate weg, en in TenantTeamTab
  // — die geen react-query gebruikt — een volledige herfetch met skeleton.
  //
  // `visited` houdt bij welke tabs al geopend zijn, zodat forceMount niet alle
  // acht tabs tegelijk op page-load laadt maar elke tab pas bij het eerste
  // bezoek. Daarna blijft hij gemount en is terugwisselen instant.
  const [tab, setTab] = useState('overview');
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['overview']));

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
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setVisited((prev) => new Set(prev).add(v));
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="subscription">Abonnement</TabsTrigger>
          <TabsTrigger value="credits">AI Credits</TabsTrigger>
          <TabsTrigger value="actions">Acties</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="invoices">Facturen</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="activity">Activiteit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('overview') && <TenantOverviewTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="subscription" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('subscription') && <TenantSubscriptionTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="credits" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('credits') && <TenantCreditsTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="actions" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('actions') && <TenantActionsTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="team" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('team') && <TenantTeamTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="invoices" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('invoices') && <TenantInvoicesTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="modules" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('modules') && <TenantModulesTab tenantId={tenantId!} />}
        </TabsContent>

        <TabsContent value="activity" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('activity') && <TenantActivityTab tenantId={tenantId!} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

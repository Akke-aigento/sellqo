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
import { TenantCommandStrip } from '@/components/platform/TenantCommandStrip';

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
  const [tab, setTab] = useState('billing');
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['billing']));

  // TENANT-CMD-1: de command-strook activeert een tab via deze functie in
  // plaats van de updateSubscription-flow uit TenantSubscriptionTab te kopieren.
  const goToTab = (value: string) => {
    setTab(value);
    setVisited((prev) => new Set(prev).add(value));
  };

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

      {/* TENANT-CMD-1: command-strook — status en dagelijkse acties bovenaan. */}
      <TenantCommandStrip tenantId={tenantId!} tenant={tenant} onNavigate={goToTab} />

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={goToTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="billing">Facturatie</TabsTrigger>
          <TabsTrigger value="access">Toegang &amp; modules</TabsTrigger>
          <TabsTrigger value="history">Historie</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('billing') && (
            <div className="space-y-6">
              <TenantOverviewTab tenantId={tenantId!} />
              <TenantSubscriptionTab tenantId={tenantId!} />
              <TenantInvoicesTab tenantId={tenantId!} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="access" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('access') && (
            <div className="space-y-6">
              <TenantTeamTab tenantId={tenantId!} />
              <TenantModulesTab tenantId={tenantId!} />
              <TenantCreditsTab tenantId={tenantId!} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="data-[state=inactive]:hidden" forceMount>
          {visited.has('history') && (
            <div className="space-y-6">
              <TenantActivityTab tenantId={tenantId!} />
              <TenantActionsTab tenantId={tenantId!} />
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

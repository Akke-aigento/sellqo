import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Package, ShoppingCart, Calendar } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface TenantOverviewTabProps {
  tenantId: string;
}

export function TenantOverviewTab({ tenantId }: TenantOverviewTabProps) {
  const { useTenantDetail, useTenantSubscription, useTenantCredits } = usePlatformAdmin();
  const { data: tenant, isLoading: tenantLoading } = useTenantDetail(tenantId);
  const { data: subscription, isLoading: subLoading } = useTenantSubscription(tenantId);
  const { data: credits, isLoading: creditsLoading } = useTenantCredits(tenantId);

  const isLoading = tenantLoading || subLoading || creditsLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const planName = (subscription?.pricing_plans as { name?: string } | null)?.name || 'Geen plan';

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abonnement</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planName}</div>
            <p className="text-xs text-muted-foreground">
              Status: {subscription?.status || 'Geen'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Credits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {credits ? credits.credits_total - credits.credits_used : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {credits?.credits_used || 0} gebruikt van {credits?.credits_total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gekochte Credits</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.credits_purchased || 0}</div>
            <p className="text-xs text-muted-foreground">Extra gekocht</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aangemaakt</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenant?.created_at
                ? format(new Date(tenant.created_at), 'dd MMM yyyy', { locale: nl })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Registratiedatum</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Details */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Naam</p>
              <p className="text-lg">{tenant?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Slug</p>
              <p className="text-lg">{tenant?.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg">{tenant?.subscription_status || 'Onbekend'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Laatst bijgewerkt</p>
              <p className="text-lg">
                {tenant?.updated_at
                  ? format(new Date(tenant.updated_at), 'dd MMM yyyy HH:mm', { locale: nl })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

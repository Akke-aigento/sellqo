import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useCan, useScopedRoles } from '@/hooks/useCan';
import { useTracks } from '@/hooks/useBusinessModules';
import { useCockpitRevenue } from '@/hooks/useCockpitRevenue';
import { useCockpitShipping, useCockpitStock } from '@/hooks/useCockpitSignals';
import { CockpitHeader } from '@/components/admin/cockpit/CockpitHeader';
import { MorningBrief } from '@/components/admin/cockpit/MorningBrief';
import { ChannelRevenueCard } from '@/components/admin/cockpit/ChannelRevenueCard';
import { TodayRevenueTiles } from '@/components/admin/cockpit/TodayRevenueTiles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

// DASH-2a — cockpit-dashboard fase 1. Het oude DashboardGrid (src/components/admin/
// DashboardGrid.tsx) wordt niet meer gerenderd maar blijft staan tot fase 4 opruimt.
export default function AdminDashboard() {
  const { t } = useTranslation();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformAdmin } = useAuth();
  const { hasTrack, ready: tracksReady } = useTracks();

  // Omzet = financiële rapportage (zelfde recht als de rapporten/exports).
  const canRevenue = useCan('read', 'reports_financial');
  // useCan is false zolang de rollen laden: dan een skeleton, niet meteen "geen toegang".
  const rolesLoading = useScopedRoles() === null;
  const canOrders = useCan('read', 'orders');
  const canProducts = useCan('read', 'products');
  const hasTenant = !!currentTenant;
  // Verzendingen horen bij het webshopspoor; een events-winkel verstuurt geen pakjes.
  const shippingApplies = tracksReady && hasTrack('webshop');

  const revenue = useCockpitRevenue(hasTenant && canRevenue);
  const shipping = useCockpitShipping(hasTenant && canOrders && shippingApplies);
  const stock = useCockpitStock(hasTenant && canProducts);

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentTenant && !isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('admin.dashboard.geen_winkel_gevonden')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {t('admin.dashboard.je_hebt_nog_geen_toegang_tot')}
        </p>
      </div>
    );
  }

  const revenueProps = {
    canRead: canRevenue || rolesLoading,
    data: revenue.data,
    isLoading: rolesLoading || revenue.isLoading,
    isError: revenue.isError,
  };

  const briefLoading =
    rolesLoading ||
    (canRevenue && revenue.isLoading) ||
    (shippingApplies && canOrders && shipping.isLoading) ||
    (canProducts && stock.isLoading);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {currentTenant && (
        <>
          <CockpitHeader />

          {/* Mobiel: de twee getallen voor onderweg. Snelknoppen zitten in AdminMobileBottomNav. */}
          <div className="md:hidden">
            <TodayRevenueTiles {...revenueProps} />
          </div>

          <MorningBrief
            isLoading={briefLoading}
            input={{
              yesterday: canRevenue ? revenue.data?.yesterdayChannels ?? null : null,
              shipping: shippingApplies && canOrders ? shipping.data ?? null : null,
              products: canProducts ? stock.data ?? null : null,
            }}
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <ChannelRevenueCard {...revenueProps} />
          </div>
        </>
      )}

      {/* Platform Admin Notice */}
      {isPlatformAdmin && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.platform_administrator')}</CardTitle>
            <CardDescription>
              {t('admin.dashboard.je_hebt_volledige_toegang_tot_het')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin/platform">
                {t('admin.dashboard.ga_naar_platform_beheer')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

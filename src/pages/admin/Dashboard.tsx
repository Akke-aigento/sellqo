import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { DashboardGrid } from '@/components/admin/DashboardGrid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformAdmin } = useAuth();

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

  return (
    <div className="space-y-6">
      {/* Dynamic Dashboard Grid */}
      <DashboardGrid />

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

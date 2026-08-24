import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  RefreshCw, 
  ArrowRight, 
  TrendingUp,
  Clock,
  AlertCircle,
  Calculator
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useOdooConnection } from '@/hooks/useOdooConnection';
import { useTenantOdooSettings } from '@/hooks/useTenantOdooSettings';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

const marketplaceIcons: Record<string, { icon: typeof ShoppingBag; color: string; bgColor: string }> = {
  bol_com: { icon: ShoppingBag, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  amazon: { icon: ShoppingBag, color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

export function DashboardMarketplaceWidget() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { activeConnections, liveOrderCounts, isLoading, error } = useMarketplaceConnections();
  const { currentTenant } = useTenant();
  const { status: odooStatus } = useOdooConnection(currentTenant?.id);
  const { settings: odooSettings } = useTenantOdooSettings(currentTenant?.id);
  const odooActive = !!odooStatus.data?.configured && !!odooSettings?.odoo_sync_enabled;

  const { data: odooStats } = useQuery({
    queryKey: ['odoo-invoice-sync-summary', currentTenant?.id],
    enabled: !!currentTenant?.id && odooActive,
    queryFn: async () => {
      const [{ count }, { data: recent }] = await Promise.all([
        supabase
          .from('odoo_invoice_sync_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant!.id)
          .eq('sync_status', 'synced'),
        supabase
          .from('odoo_invoice_sync_log')
          .select('synced_at')
          .eq('tenant_id', currentTenant!.id)
          .eq('sync_status', 'synced')
          .order('synced_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { count: count ?? 0, lastSyncedAt: recent?.synced_at as string | null };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (activeConnections.length === 0 && !odooActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t('admin.marketplace.dashboardMarketplaceWidget.sellqo_connect')}
          </CardTitle>
          <CardDescription>
            {t('admin.marketplace.dashboardMarketplaceWidget.verbind_je_verkoopkanalen')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.marketplace.dashboardMarketplaceWidget.verbind_bol_com_of_amazon_om')}
            </p>
            <Button asChild size="sm">
              <Link to="/admin/connect">
                {t('admin.marketplace.dashboardMarketplaceWidget.verbind_marktplaats')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalConnections = activeConnections.length + (odooActive ? 1 : 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t('admin.marketplace.dashboardMarketplaceWidget.sellqo_connect')}
          </CardTitle>
          <CardDescription>
            {totalConnections} actieve {totalConnections === 1 ? 'connectie' : 'connecties'}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/connect">
            {t('admin.marketplace.dashboardMarketplaceWidget.beheer')}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeConnections.slice(0, 3).map((connection) => {
          const config = marketplaceIcons[connection.marketplace_type] || marketplaceIcons.bol_com;
          const Icon = config.icon;
          const totalOrders = liveOrderCounts[connection.id] ?? 0;
          const hasError = !!connection.last_error;

          return (
            <div 
              key={connection.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {connection.marketplace_name || (connection.marketplace_type === 'bol_com' ? 'Bol.com' : 'Amazon')}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {hasError ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {t('admin.marketplace.dashboardMarketplaceWidget.sync_fout')}
                      </span>
                    ) : connection.last_sync_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(connection.last_sync_at), { 
                          addSuffix: true, 
                          locale: dateLocale 
                        })}
                      </span>
                    ) : (
                      <span>{t('admin.marketplace.dashboardMarketplaceWidget.nog_niet_gesynchroniseerd')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">orders</p>
              </div>
            </div>
          );
        })}

        {odooActive && (
          <Link
            to="/admin/connect?tab=accounting"
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Calculator className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-sm">{t('admin.marketplace.dashboardMarketplaceWidget.odoo_boekhouding')}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {odooStats?.lastSyncedAt ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(odooStats.lastSyncedAt), { addSuffix: true, locale: dateLocale })}
                    </span>
                  ) : (
                    <span>{t('admin.marketplace.dashboardMarketplaceWidget.nog_niet_gesynchroniseerd_2')}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">{odooStats?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">documenten</p>
            </div>
          </Link>
        )}

        {activeConnections.length > 3 && (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/admin/connect">
              +{activeConnections.length - 3} meer bekijken
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

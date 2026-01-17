import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  RefreshCw, 
  ArrowRight, 
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const marketplaceIcons: Record<string, { icon: typeof ShoppingBag; color: string; bgColor: string }> = {
  bol_com: { icon: ShoppingBag, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  amazon: { icon: ShoppingBag, color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

export function DashboardMarketplaceWidget() {
  const { connections, activeConnections, isLoading, error } = useMarketplaceConnections();

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

  if (activeConnections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Marktplaatsen
          </CardTitle>
          <CardDescription>
            Verbind je verkoopkanalen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Verbind Bol.com of Amazon om orders automatisch te importeren
            </p>
            <Button asChild size="sm">
              <Link to="/admin/marketplaces">
                Verbind Marktplaats
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Marktplaatsen
          </CardTitle>
          <CardDescription>
            {activeConnections.length} actieve {activeConnections.length === 1 ? 'connectie' : 'connecties'}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/marketplaces">
            Beheer
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeConnections.slice(0, 3).map((connection) => {
          const config = marketplaceIcons[connection.marketplace_type] || marketplaceIcons.bol_com;
          const Icon = config.icon;
          const stats = connection.stats;
          const totalOrders = stats?.totalOrders || 0;
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
                        Sync fout
                      </span>
                    ) : connection.last_sync_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(connection.last_sync_at), { 
                          addSuffix: true, 
                          locale: nl 
                        })}
                      </span>
                    ) : (
                      <span>Nog niet gesynchroniseerd</span>
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

        {activeConnections.length > 3 && (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/admin/marketplaces">
              +{activeConnections.length - 3} meer bekijken
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

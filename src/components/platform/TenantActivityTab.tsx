import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, User, Settings, CreditCard, Coins } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface TenantActivityTabProps {
  tenantId: string;
}

export function TenantActivityTab({ tenantId }: TenantActivityTabProps) {
  const { useTenantAdminActions } = usePlatformAdmin();
  const { data: actions, isLoading } = useTenantAdminActions(tenantId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'credits_adjusted':
        return <Coins className="h-4 w-4" />;
      case 'subscription_changed':
      case 'gift_month_added':
        return <CreditCard className="h-4 w-4" />;
      case 'feature_override_updated':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'credits_adjusted':
        return 'Credits aangepast';
      case 'subscription_changed':
        return 'Abonnement gewijzigd';
      case 'gift_month_added':
        return 'Gratis maand toegevoegd';
      case 'feature_override_updated':
        return 'Module instellingen gewijzigd';
      default:
        return actionType;
    }
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const entries = Object.entries(details).slice(0, 3);
    return entries
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Admin Activiteit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions && actions.length > 0 ? (
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
              >
                <div className="p-2 bg-muted rounded-full">
                  {getActionIcon(action.action_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getActionLabel(action.action_type)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(action.created_at), 'dd MMM yyyy HH:mm', {
                        locale: nl,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {formatDetails(action.action_details as Record<string, unknown>)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="font-mono truncate max-w-[100px]">
                    {action.admin_user_id.slice(0, 8)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Geen admin activiteit gevonden voor deze tenant
          </p>
        )}
      </CardContent>
    </Card>
  );
}

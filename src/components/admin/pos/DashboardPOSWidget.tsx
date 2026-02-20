import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor,
  Euro,
  Receipt,
  Clock,
  Play,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

interface POSDashboardStats {
  activeSessions: number;
  todayRevenue: number;
  todayTransactions: number;
  avgTransactionValue: number;
  terminals: Array<{
    id: string;
    name: string;
    isActive: boolean;
    sessionOpenedAt?: string;
  }>;
}

export function DashboardPOSWidget() {
  const { currentTenant } = useTenant();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['pos-dashboard-stats', currentTenant?.id],
    queryFn: async (): Promise<POSDashboardStats> => {
      if (!currentTenant?.id) {
        return {
          activeSessions: 0,
          todayRevenue: 0,
          todayTransactions: 0,
          avgTransactionValue: 0,
          terminals: [],
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch terminals with active sessions
      const { data: terminals } = await supabase
        .from('pos_terminals')
        .select(`
          id,
          name,
          status
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active');

      // Fetch active sessions
      const { data: sessions } = await supabase
        .from('pos_sessions')
        .select('id, terminal_id, opened_at')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'open');

      // Fetch today's transactions
      const { data: transactions } = await supabase
        .from('pos_transactions')
        .select('id, total, status')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString());

      const activeSessionMap = new Map(
        (sessions || []).map(s => [s.terminal_id, s])
      );

      const terminalsList = (terminals || []).map(t => ({
        id: t.id,
        name: t.name,
        isActive: activeSessionMap.has(t.id),
        sessionOpenedAt: activeSessionMap.get(t.id)?.opened_at,
      }));

      const completedTransactions = transactions || [];
      const todayRevenue = completedTransactions.reduce(
        (sum, t) => sum + Number(t.total || 0),
        0
      );

      return {
        activeSessions: sessions?.length || 0,
        todayRevenue,
        todayTransactions: completedTransactions.length,
        avgTransactionValue:
          completedTransactions.length > 0
            ? todayRevenue / completedTransactions.length
            : 0,
        terminals: terminalsList,
      };
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-10" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.terminals.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Kassa (POS)
          </CardTitle>
          <CardDescription>Start met fysieke verkoop</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Monitor className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Nog geen kassaterminals ingesteld
            </p>
            <Button asChild size="sm">
              <Link to="/admin/pos">
                <Play className="mr-2 h-4 w-4" />
                POS instellen
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-5 w-5 text-primary" />
            Kassa (POS)
          </CardTitle>
          <CardDescription>Vandaag</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/pos">
            Openen
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Euro className="h-4 w-4 mx-auto mb-1 text-green-600" />
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(stats.todayRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">Omzet</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Receipt className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{stats.todayTransactions}</p>
            <p className="text-xs text-muted-foreground">Transacties</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-bold">
              {formatCurrency(stats.avgTransactionValue)}
            </p>
            <p className="text-xs text-muted-foreground">Gem.</p>
          </div>
        </div>

        {/* Terminals Status */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Terminals
          </p>
          {stats.terminals.slice(0, 3).map((terminal) => (
            <Link
              key={terminal.id}
              to={`/admin/pos/${terminal.id}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{terminal.name}</span>
              </div>
              {terminal.isActive ? (
                <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Actief
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Inactief
                </Badge>
              )}
            </Link>
          ))}
          {stats.terminals.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{stats.terminals.length - 3} meer
            </p>
          )}
        </div>

        {/* Active Sessions Summary */}
        {stats.activeSessions > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-700 dark:text-green-300">
              {stats.activeSessions} actieve{' '}
              {stats.activeSessions === 1 ? 'sessie' : 'sessies'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

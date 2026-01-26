import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  History,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useSyncHistory, type SyncActivityLog } from '@/hooks/useSyncHistory';
import { SyncLogDialog } from './SyncLogDialog';
import type { SyncDataType } from '@/types/syncRules';

const LABELS: Record<SyncDataType, string> = {
  orders: 'Bestellingen',
  products: 'Producten',
  inventory: 'Voorraad',
  customers: 'Klanten',
  invoices: 'Facturen',
  returns: 'Retouren',
  shipments: 'Verzendingen',
  categories: 'Categorieën',
  taxes: 'BTW/Belastingen',
};

interface SyncHistoryWidgetProps {
  connectionId: string;
}

export function SyncHistoryWidget({ connectionId }: SyncHistoryWidgetProps) {
  const [showFullLog, setShowFullLog] = useState(false);
  const { data: logs, isLoading, refetch } = useSyncHistory(connectionId, 5);

  const getStatusIcon = (status: SyncActivityLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (log: SyncActivityLog) => {
    if (log.status === 'success') {
      return (
        <span className="text-xs text-muted-foreground">
          {log.records_processed} {log.direction === 'import' ? 'geïmporteerd' : 'geëxporteerd'}
        </span>
      );
    }
    if (log.status === 'partial') {
      return (
        <Badge variant="outline" className="text-xs text-amber-600">
          {log.records_failed} van {log.records_processed + log.records_failed} mislukt
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-xs">
        Mislukt
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="w-4 h-4" />
            Laatste Synchronisaties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              Laatste Synchronisaties
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nog geen synchronisaties</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="text-sm font-medium">
                        {LABELS[log.data_type]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.completed_at), {
                          addSuffix: true,
                          locale: nl,
                        })}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(log)}
                </div>
              ))}
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowFullLog(true)}
              >
                Bekijk volledige historie →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SyncLogDialog
        open={showFullLog}
        onOpenChange={setShowFullLog}
        connectionId={connectionId}
      />
    </>
  );
}

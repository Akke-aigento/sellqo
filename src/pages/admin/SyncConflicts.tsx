import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Filter,
  ChevronDown,
  ArrowLeftRight,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSyncConflicts, useSyncConflictActions } from '@/hooks/useSyncConflicts';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { MARKETPLACE_INFO } from '@/types/marketplace';
import type { SyncDataType } from '@/types/syncRules';

const DATA_TYPE_LABELS: Record<SyncDataType, string> = {
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

export default function SyncConflictsPage() {
  const navigate = useNavigate();
  const { conflicts, isLoading, refetch } = useSyncConflicts();
  const { resolveConflict, isResolving } = useSyncConflictActions();
  const { connections } = useMarketplaceConnections();
  
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterDataType, setFilterDataType] = useState<string>('all');
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [confirmResolve, setConfirmResolve] = useState<{
    id: string;
    resolution: 'sellqo' | 'platform' | 'dismissed';
  } | null>(null);

  const pendingConflicts = conflicts?.filter(c => !c.resolved_at) || [];
  const resolvedConflicts = conflicts?.filter(c => !!c.resolved_at) || [];

  const filteredPendingConflicts = pendingConflicts.filter(c => {
    if (filterConnection !== 'all' && c.connection_id !== filterConnection) return false;
    if (filterDataType !== 'all' && c.data_type !== filterDataType) return false;
    return true;
  });

  const getConnectionName = (connectionId: string) => {
    const conn = connections?.find(c => c.id === connectionId);
    if (!conn) return 'Onbekend';
    const info = MARKETPLACE_INFO[conn.marketplace_type];
    return conn.marketplace_name || info?.name || 'Onbekend';
  };

  const handleResolve = async () => {
    if (!confirmResolve) return;
    
    await resolveConflict(confirmResolve.id, confirmResolve.resolution);
    setConfirmResolve(null);
    setExpandedConflict(null);
    refetch();
  };

  const renderFieldComparison = (
    sellqoData: Record<string, unknown>,
    platformData: Record<string, unknown>
  ) => {
    const allKeys = new Set([
      ...Object.keys(sellqoData || {}),
      ...Object.keys(platformData || {}),
    ]);

    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <h4 className="text-sm font-medium mb-2 text-primary">SellQo Data</h4>
          <div className="bg-primary/5 rounded-lg p-3 space-y-2">
            {Array.from(allKeys).map(key => (
              <div key={key} className="text-sm">
                <span className="text-muted-foreground">{key}:</span>{' '}
                <span className="font-mono">
                  {JSON.stringify(sellqoData?.[key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2 text-orange-600">Platform Data</h4>
          <div className="bg-orange-50 rounded-lg p-3 space-y-2">
            {Array.from(allKeys).map(key => (
              <div key={key} className="text-sm">
                <span className="text-muted-foreground">{key}:</span>{' '}
                <span className="font-mono">
                  {JSON.stringify(platformData?.[key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/connect')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/connect')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Sync Conflicten
            </h1>
            <p className="text-sm text-muted-foreground">
              Review en los data conflicten op tussen SellQo en je marketplace platformen
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Vernieuwen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Openstaand</p>
                <p className="text-2xl font-bold">{pendingConflicts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opgelost</p>
                <p className="text-2xl font-bold">{resolvedConflicts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connecties</p>
                <p className="text-2xl font-bold">
                  {new Set(pendingConflicts.map(c => c.connection_id)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterConnection} onValueChange={setFilterConnection}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Connectie" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">Alle connecties</SelectItem>
            {connections?.map(conn => (
              <SelectItem key={conn.id} value={conn.id}>
                {conn.marketplace_name || MARKETPLACE_INFO[conn.marketplace_type]?.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDataType} onValueChange={setFilterDataType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Data type" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">Alle types</SelectItem>
            {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conflict List */}
      {filteredPendingConflicts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Geen conflicten</h3>
            <p className="text-muted-foreground">
              Alle data is gesynchroniseerd zonder conflicten.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPendingConflicts.map(conflict => (
            <Collapsible
              key={conflict.id}
              open={expandedConflict === conflict.id}
              onOpenChange={(open) => setExpandedConflict(open ? conflict.id : null)}
            >
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <div className="text-left">
                        <CardTitle className="text-base">
                          {DATA_TYPE_LABELS[conflict.data_type as SyncDataType]} Conflict
                        </CardTitle>
                        <CardDescription>
                          Record: {conflict.record_id} • {getConnectionName(conflict.connection_id)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        {formatDistanceToNow(new Date(conflict.detected_at), {
                          addSuffix: true,
                          locale: nl,
                        })}
                      </Badge>
                      <ChevronDown className={`w-5 h-5 transition-transform ${
                        expandedConflict === conflict.id ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    {renderFieldComparison(
                      conflict.sellqo_data as Record<string, unknown>,
                      conflict.platform_data as Record<string, unknown>
                    )}

                    <div className="flex gap-3 mt-6 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setConfirmResolve({
                          id: conflict.id,
                          resolution: 'dismissed',
                        })}
                        disabled={isResolving}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Negeren
                      </Button>
                      <Button
                        variant="outline"
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => setConfirmResolve({
                          id: conflict.id,
                          resolution: 'platform',
                        })}
                        disabled={isResolving}
                      >
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Platform Gebruiken
                      </Button>
                      <Button
                        onClick={() => setConfirmResolve({
                          id: conflict.id,
                          resolution: 'sellqo',
                        })}
                        disabled={isResolving}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        SellQo Gebruiken
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Resolve Confirmation */}
      <AlertDialog open={!!confirmResolve} onOpenChange={() => setConfirmResolve(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflict Oplossen</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmResolve?.resolution === 'sellqo' && (
                'De SellQo data wordt naar het platform gestuurd en overschrijft de platform data.'
              )}
              {confirmResolve?.resolution === 'platform' && (
                'De platform data wordt geïmporteerd naar SellQo en overschrijft de SellQo data.'
              )}
              {confirmResolve?.resolution === 'dismissed' && (
                'Dit conflict wordt genegeerd. Beide versies blijven ongewijzigd.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve} disabled={isResolving}>
              {isResolving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Bevestigen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

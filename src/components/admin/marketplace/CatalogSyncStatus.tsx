import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Package,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { SocialChannelConnection, SyncStatus } from '@/types/socialChannels';

interface CatalogSyncStatusProps {
  connection: SocialChannelConnection;
  onSync: () => void;
  isSyncing?: boolean;
}

const statusConfig: Record<SyncStatus, { 
  icon: typeof CheckCircle2; 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
}> = {
  idle: { icon: Clock, label: 'Niet gesynchroniseerd', variant: 'secondary', color: 'text-muted-foreground' },
  syncing: { icon: RefreshCw, label: 'Synchroniseren...', variant: 'default', color: 'text-primary' },
  synced: { icon: CheckCircle2, label: 'Gesynchroniseerd', variant: 'default', color: 'text-green-600' },
  error: { icon: XCircle, label: 'Fout bij sync', variant: 'destructive', color: 'text-destructive' },
};

export function CatalogSyncStatus({ connection, onSync, isSyncing }: CatalogSyncStatusProps) {
  const [errorsOpen, setErrorsOpen] = useState(false);
  
  const status = (isSyncing ? 'syncing' : connection.sync_status) as SyncStatus;
  const config = statusConfig[status] || statusConfig.idle;
  const StatusIcon = config.icon;

  const lastSyncTime = connection.last_sync_at 
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: nl })
    : null;

  const hasErrors = connection.sync_errors && connection.sync_errors.length > 0;
  const errorCount = connection.sync_errors?.length || 0;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-5 w-5', config.color, isSyncing && 'animate-spin')} />
          <span className={cn('font-medium', config.color)}>{config.label}</span>
        </div>
        <Button 
          size="sm" 
          onClick={onSync} 
          disabled={isSyncing}
          variant="outline"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Bezig...' : 'Sync Nu'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Producten in catalogus:</span>
          <span className="font-medium">{connection.products_in_catalog || 0}</span>
        </div>
        {lastSyncTime && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Laatste sync:</span>
            <span className="font-medium">{lastSyncTime}</span>
          </div>
        )}
      </div>

      {/* Sync progress when syncing */}
      {isSyncing && (
        <div className="space-y-2">
          <Progress value={undefined} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Producten worden gesynchroniseerd met Meta Commerce...
          </p>
        </div>
      )}

      {/* Errors section */}
      {hasErrors && (
        <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-destructive hover:text-destructive">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{errorCount} product(en) met fouten</span>
              </div>
              {errorsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {connection.sync_errors?.slice(0, 5).map((error, index) => (
                <div key={index} className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                  <p className="font-medium text-destructive">{error.product_name}</p>
                  <p className="text-muted-foreground">{error.message}</p>
                </div>
              ))}
              {errorCount > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  En {errorCount - 5} andere fouten...
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Catalog info */}
      {connection.catalog_id && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Catalogus ID: </span>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{connection.catalog_id}</code>
          </div>
          <Button variant="link" size="sm" className="text-xs" asChild>
            <a 
              href={`https://business.facebook.com/commerce/catalogs/${connection.catalog_id}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Bekijk in Meta
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

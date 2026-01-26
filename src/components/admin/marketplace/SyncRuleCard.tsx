import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  Settings2,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  FileText,
  RotateCcw,
  Truck,
  FolderTree,
  Percent,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncDirectionSelector } from './SyncDirectionSelector';
import { FieldMappingEditor } from './FieldMappingEditor';
import { StatusMappingDialog } from './StatusMappingDialog';
import { ConflictStrategySelector } from './ConflictStrategySelector';
import { SyncFrequencySelector } from './SyncFrequencySelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { 
  SyncRuleConfig, 
  SyncDataType, 
  SyncDirection,
  SupportedDirections,
  StatusMapping,
  ConflictStrategy,
  SyncFrequency,
} from '@/types/syncRules';

const ICONS: Record<SyncDataType, typeof ShoppingCart> = {
  orders: ShoppingCart,
  products: Package,
  inventory: Warehouse,
  customers: Users,
  invoices: FileText,
  returns: RotateCcw,
  shipments: Truck,
  categories: FolderTree,
  taxes: Percent,
};

const COLORS: Record<SyncDataType, string> = {
  orders: 'bg-blue-100 text-blue-600',
  products: 'bg-green-100 text-green-600',
  inventory: 'bg-amber-100 text-amber-600',
  customers: 'bg-purple-100 text-purple-600',
  invoices: 'bg-emerald-100 text-emerald-600',
  returns: 'bg-red-100 text-red-600',
  shipments: 'bg-cyan-100 text-cyan-600',
  categories: 'bg-indigo-100 text-indigo-600',
  taxes: 'bg-slate-100 text-slate-600',
};

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

interface SyncRuleCardProps {
  dataType: SyncDataType;
  config: SyncRuleConfig | undefined;
  capabilities: SupportedDirections | null;
  platformName: string;
  connectionId: string;
  onToggle: (enabled: boolean) => void;
  onDirectionChange: (direction: SyncDirection) => void;
  onAutoSyncChange: (autoSync: boolean) => void;
  onFieldToggle: (fieldId: string, enabled: boolean) => void;
  onStatusMappingsChange: (mappings: StatusMapping[]) => void;
  onCustomSettingsChange: (settings: Record<string, unknown>) => void;
  onConflictStrategyChange?: (strategy: ConflictStrategy) => void;
  onSyncFrequencyChange?: (frequency: SyncFrequency) => void;
  onSyncComplete?: () => void;
}

export function SyncRuleCard({
  dataType,
  config,
  capabilities,
  platformName,
  connectionId,
  onToggle,
  onDirectionChange,
  onAutoSyncChange,
  onFieldToggle,
  onStatusMappingsChange,
  onCustomSettingsChange,
  onConflictStrategyChange,
  onSyncFrequencyChange,
  onSyncComplete,
}: SyncRuleCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // If not supported, don't render
  if (!capabilities) return null;

  const Icon = ICONS[dataType];
  const colorClass = COLORS[dataType];
  const label = LABELS[dataType];
  const enabled = config?.enabled ?? false;
  const direction = config?.direction ?? 'import';
  const autoSync = config?.autoSync ?? false;
  const fieldMappings = config?.fieldMappings ?? [];
  const statusMappings = config?.statusMappings ?? [];
  const customSettings = config?.customSettings ?? {};
  const conflictStrategy = config?.conflictStrategy;
  const syncFrequency = config?.syncFrequency;
  const lastSyncedAt = config?.lastSyncedAt;
  const lastSyncStatus = config?.lastSyncStatus;
  const lastSyncStats = config?.lastSyncStats;

  const enabledFieldCount = fieldMappings.filter(f => f.enabled).length;
  const showConflictStrategy = direction === 'bidirectional';
  const canManualSync = ['orders', 'products', 'inventory', 'customers'].includes(dataType);

  const handleManualSync = async () => {
    if (!connectionId || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-manual-sync', {
        body: {
          connectionId,
          dataType,
          direction,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Synchronisatie voltooid',
          description: `${data.recordsProcessed} ${label.toLowerCase()} verwerkt${data.recordsFailed > 0 ? `, ${data.recordsFailed} mislukt` : ''}`,
        });
        onSyncComplete?.();
      } else {
        throw new Error(data.error || 'Synchronisatie mislukt');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      toast({
        title: 'Synchronisatie mislukt',
        description: error instanceof Error ? error.message : 'Er is een fout opgetreden',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!lastSyncStatus) return null;
    switch (lastSyncStatus) {
      case 'success':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'partial':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className={cn(
          "transition-all",
          !enabled && "opacity-60"
        )}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colorClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{label}</span>
                      {enabled && (
                        <Badge variant="outline" className="text-xs">
                          {direction === 'import' ? '↓ Import' : 
                           direction === 'export' ? '↑ Export' : '↕ Beide'}
                        </Badge>
                      )}
                      {enabled && autoSync && (
                        <Badge variant="secondary" className="text-xs">
                          Auto
                        </Badge>
                      )}
                      {enabled && syncFrequency && (
                        <Badge variant="outline" className="text-xs bg-muted">
                          <Clock className="w-3 h-3 mr-1" />
                          {syncFrequency}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {enabled && fieldMappings.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {enabledFieldCount} velden
                        </p>
                      )}
                      {enabled && lastSyncedAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getStatusIcon()}
                          <span>
                            {formatDistanceToNow(new Date(lastSyncedAt), { 
                              addSuffix: true, 
                              locale: nl 
                            })}
                          </span>
                          {lastSyncStats && lastSyncStats.processed > 0 && (
                            <span className="text-muted-foreground/70">
                              ({lastSyncStats.processed} verwerkt)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {enabled && canManualSync && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManualSync();
                      }}
                      disabled={isSyncing}
                      className="h-8 px-2"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">
                        {isSyncing ? 'Bezig...' : 'Nu Syncen'}
                      </span>
                    </Button>
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      onToggle(checked);
                      if (checked && !isOpen) setIsOpen(true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <ChevronDown className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {/* Direction Selector */}
              <SyncDirectionSelector
                value={direction}
                onChange={onDirectionChange}
                capabilities={capabilities}
                disabled={!enabled}
              />

              {/* Conflict Strategy - Only for bidirectional */}
              {showConflictStrategy && onConflictStrategyChange && (
                <ConflictStrategySelector
                  value={conflictStrategy}
                  onChange={onConflictStrategyChange}
                  disabled={!enabled}
                />
              )}

              {/* Sync Frequency */}
              {onSyncFrequencyChange && (
                <SyncFrequencySelector
                  value={syncFrequency}
                  onChange={onSyncFrequencyChange}
                  disabled={!enabled}
                />
              )}

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Automatisch synchroniseren</Label>
                  <p className="text-xs text-muted-foreground">
                    Sync automatisch bij wijzigingen
                  </p>
                </div>
                <Switch
                  checked={autoSync}
                  onCheckedChange={onAutoSyncChange}
                  disabled={!enabled}
                />
              </div>

              {/* Field Mappings */}
              {fieldMappings.length > 0 && (
                <FieldMappingEditor
                  mappings={fieldMappings}
                  onToggle={onFieldToggle}
                  disabled={!enabled}
                />
              )}

              {/* Status Mapping (Orders only) */}
              {dataType === 'orders' && statusMappings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status Mapping</Label>
                  <Button
                    variant="outline"
                    onClick={() => setShowStatusDialog(true)}
                    disabled={!enabled}
                    className="w-full justify-start"
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Configureer status mapping
                  </Button>
                </div>
              )}

              {/* Custom Settings per Type */}
              {dataType === 'inventory' && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-medium">Voorraad Instellingen</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Veiligheidsvoorraad</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={customSettings.safetyStock ?? 0}
                          onChange={(e) => onCustomSettingsChange({ safetyStock: parseInt(e.target.value) || 0 })}
                          disabled={!enabled}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">stuks aftrekken</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs text-muted-foreground">Realtime Updates</Label>
                        <p className="text-xs text-muted-foreground">Direct bij verkoop</p>
                      </div>
                      <Switch
                        checked={customSettings.realtimeUpdates ?? false}
                        onCheckedChange={(checked) => onCustomSettingsChange({ realtimeUpdates: checked })}
                        disabled={!enabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {dataType === 'orders' && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-medium">Order Instellingen</Label>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Historische orders importeren</Label>
                      <p className="text-xs text-muted-foreground">Eenmalig bij eerste sync</p>
                    </div>
                    <Switch
                      checked={customSettings.importHistorical ?? false}
                      onCheckedChange={(checked) => onCustomSettingsChange({ importHistorical: checked })}
                      disabled={!enabled}
                    />
                  </div>

                  {customSettings.importHistorical && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Periode (dagen)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="730"
                        value={customSettings.historicalDays ?? 30}
                        onChange={(e) => onCustomSettingsChange({ historicalDays: parseInt(e.target.value) || 30 })}
                        disabled={!enabled}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              )}

              {dataType === 'invoices' && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-medium">Factuur Instellingen</Label>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Automatisch aanmaken</Label>
                      <p className="text-xs text-muted-foreground">Factuur aanmaken bij betaalde order</p>
                    </div>
                    <Switch
                      checked={customSettings.autoCreate ?? false}
                      onCheckedChange={(checked) => onCustomSettingsChange({ autoCreate: checked })}
                      disabled={!enabled}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Status Mapping Dialog */}
      <StatusMappingDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        mappings={statusMappings}
        onSave={onStatusMappingsChange}
        platformName={platformName}
      />
    </>
  );
}

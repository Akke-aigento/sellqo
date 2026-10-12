import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Loader2,
  TrendingUp,
  ShoppingCart,
  Package,
  ExternalLink,
  Download,
  FileText,
  MoreVertical,
  CheckCircle,
  Copy,
  Bell,
  Unlink,
  AlertCircle,
  ShoppingBag,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useMarketplaceConnection, useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { MARKETPLACE_INFO, type MarketplaceSettings } from '@/types/marketplace';
import { SyncRulesTab } from '@/components/admin/marketplace/SyncRulesTab';
import { BolVVBSettings } from '@/components/admin/marketplace/BolVVBSettings';
import { AmazonBuyShippingSettings } from '@/components/admin/marketplace/AmazonBuyShippingSettings';
import { OdooB2CAggregationSettings } from '@/components/admin/marketplace/OdooB2CAggregationSettings';
import { SyncHistoryWidget } from '@/components/admin/marketplace/SyncHistoryWidget';
import { BolCsvImport } from '@/components/admin/marketplace/BolCsvImport';
import { useAutoSync } from '@/hooks/useAutoSync';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useIsMobile } from '@/hooks/use-mobile';
import { toCsv, downloadCsv } from '@/lib/csvExport';

export default function MarketplaceDetailPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const isMobile = useIsMobile();
  const { connection, isLoading } = useMarketplaceConnection(connectionId);
  const { updateConnection, deleteConnection } = useMarketplaceConnections();

  // Enable auto-sync when viewing this page
  useAutoSync({
    connection,
    enabled: !!connection?.is_active,
  });

  const [syncing, setSyncing] = useState(false);
  const [importingHistorical, setImportingHistorical] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  
  // Settings state
  const [connectionName, setConnectionName] = useState('');
  const [autoImportOrders, setAutoImportOrders] = useState(true);
  const [syncInterval, setSyncInterval] = useState('15');
  const [autoSyncInventory, setAutoSyncInventory] = useState(true);
  const [safetyStock, setSafetyStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  // APP-CLEAN-2c: de velden hieronder werden nooit gevuld uit de opgeslagen
  // instellingen. De pagina toonde standaarden (bv. 15 min terwijl VanXcel op 5
  // stond) en "Opslaan" overschreef de echte instellingen daarmee. Nu: laden bij
  // openen, en "Annuleer" zet terug naar wat opgeslagen is.
  const resetSettingsForm = () => {
    if (!connection) return;
    const st = (connection.settings ?? {}) as Partial<MarketplaceSettings>;
    setConnectionName(connection.marketplace_name ?? '');
    setAutoImportOrders(st.autoImport ?? true);
    setSyncInterval(String(st.syncInterval ?? 15));
    setAutoSyncInventory(st.autoSyncInventory ?? true);
    setSafetyStock(String(st.safetyStock ?? 0));
    setLowStockThreshold(String(st.lowStockThreshold ?? 5));
  };
  const settingsKey = connection ? `${connection.id}:${JSON.stringify(connection.settings ?? {})}:${connection.marketplace_name ?? ''}` : '';
  useEffect(() => {
    resetSettingsForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  const info = connection ? MARKETPLACE_INFO[connection.marketplace_type] : null;

  // Query real orders from database
  const { data: realOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['marketplace-orders', connectionId, currentTenant?.id],
    queryFn: async () => {
      if (!connectionId || !currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, marketplace_order_id, customer_name, total, status, created_at')
        .eq('marketplace_connection_id', connectionId)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!connectionId && !!currentTenant?.id,
  });

  // Query sync activity logs
  const { data: syncActivities = [] } = useQuery({
    queryKey: ['sync-activities', connectionId],
    queryFn: async () => {
      if (!connectionId) return [];
      
      const { data, error } = await supabase
        .from('sync_activity_log')
        .select('*')
        .eq('connection_id', connectionId)
        .order('started_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Error fetching sync activities:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!connectionId,
  });

  // Query products with marketplace mappings
  const { data: linkedProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['marketplace-products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, images, bol_ean, stock, sync_inventory, last_inventory_sync, marketplace_mappings')
        .eq('tenant_id', currentTenant.id)
        .eq('sync_inventory', true)
        .not('bol_ean', 'is', null)
        .order('name')
        .limit(50);
      
      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Get the sync function name based on marketplace type
  const getSyncFunctions = (type: string) => {
    switch (type) {
      case 'shopify':
        return { orders: 'sync-shopify-orders', inventory: 'sync-shopify-inventory' };
      case 'woocommerce':
        return { orders: 'sync-woocommerce-orders', inventory: 'sync-woocommerce-inventory' };
      case 'amazon':
        return { orders: 'sync-amazon-orders', inventory: 'sync-amazon-inventory' };
      case 'odoo':
        return { orders: 'sync-odoo-orders', inventory: 'sync-odoo-inventory' };
      case 'ebay':
        return { orders: 'sync-ebay-orders', inventory: 'sync-ebay-inventory' };
      default:
        return { orders: 'sync-bol-orders', inventory: 'sync-bol-inventory' };
    }
  };

  const handleSyncNow = async () => {
    if (!connection) return;
    
    setSyncing(true);
    const syncFns = getSyncFunctions(connection.marketplace_type);
    
    try {
      // Sync orders
      toast.info('Orders synchroniseren...');
      const orderResult = await supabase.functions.invoke(syncFns.orders, {
        body: { connectionId: connection.id }
      });
      
      if (orderResult.error) {
        console.error('Order sync error:', orderResult.error);
        toast.error('Order sync mislukt: ' + orderResult.error.message);
      } else {
        const imported = orderResult.data?.ordersImported ?? orderResult.data?.orders_imported ?? 0;
        toast.success(`${imported} orders geïmporteerd`);
      }
      
      // Sync inventory
      toast.info('Voorraad synchroniseren...');
      const inventoryResult = await supabase.functions.invoke(syncFns.inventory, {
        body: { connectionId: connection.id }
      });
      
      if (inventoryResult.error) {
        console.error('Inventory sync error:', inventoryResult.error);
        toast.error('Voorraad sync mislukt: ' + inventoryResult.error.message);
      } else {
        const synced = inventoryResult.data?.productsSynced ?? inventoryResult.data?.products_synced ?? 0;
        toast.success(`${synced} producten gesynchroniseerd`);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connection', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      queryClient.invalidateQueries({ queryKey: ['sync-activities', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['sync-history', connectionId] });
      
      toast.success('Synchronisatie voltooid!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout';
      toast.error('Synchronisatie mislukt: ' + message);
    } finally {
      setSyncing(false);
    }
  };

  const handleHistoricalImport = async () => {
    if (!connection) return;
    
    setImportingHistorical(true);
    
    try {
      // For Bol.com, use shipments-based import for historical orders
      if (connection.marketplace_type === 'bol_com') {
        toast.info('Historische orders importeren via verzendingen... Dit kan even duren.');
        
        const result = await supabase.functions.invoke('import-bol-shipments', {
          body: { connectionId: connection.id }
        });
        
        if (result.error) {
          console.error('Shipments import error:', result.error);
          toast.error('Import mislukt: ' + result.error.message);
        } else {
          const imported = result.data?.ordersImported ?? 0;
          const skipped = result.data?.ordersSkipped ?? 0;
          if (imported > 0) {
            toast.success(`${imported} historische orders geïmporteerd! (${skipped} al aanwezig)`);
          } else {
            toast.info(`Geen nieuwe historische orders gevonden (${skipped} al aanwezig)`);
          }
        }
      } else {
        // For other marketplaces, use the regular sync with historical flag
        const syncFns = getSyncFunctions(connection.marketplace_type);
        toast.info('Historische orders importeren... Dit kan even duren.');
        
        const result = await supabase.functions.invoke(syncFns.orders, {
          body: { 
            connectionId: connection.id,
            forceHistoricalImport: true,
            historicalPeriodDays: 730
          }
        });
        
        if (result.error) {
          console.error('Historical import error:', result.error);
          toast.error('Import mislukt: ' + result.error.message);
        } else {
          const imported = result.data?.ordersImported ?? result.data?.orders_imported ?? 0;
          if (imported > 0) {
            toast.success(`${imported} historische orders geïmporteerd!`);
          } else {
            toast.info('Geen nieuwe historische orders gevonden');
          }
        }
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connection', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      queryClient.invalidateQueries({ queryKey: ['sync-activities', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['sync-history', connectionId] });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout';
      toast.error('Import mislukt: ' + message);
    } finally {
      setImportingHistorical(false);
    }
  };

  // APP-CLEAN-2c: echte CSV-export van alle orders van deze koppeling (niet alleen de 50 op het scherm).
  const handleExportOrders = async () => {
    if (!connection || !currentTenant?.id) return;
    const all: Array<Record<string, unknown>> = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase
        .from('orders')
        .select('order_number, marketplace_order_id, created_at, customer_name, customer_email, status, payment_status, total, currency')
        .eq('marketplace_connection_id', connection.id)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (error) {
        toast.error('Export mislukt: ' + error.message);
        return;
      }
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (all.length === 0) {
      toast.info('Geen orders om te exporteren');
      return;
    }
    const csv = toCsv(
      ['Ordernummer', `${info?.name ?? 'Marketplace'}-ordernummer`, 'Datum', 'Klant', 'E-mail', 'Status', 'Betaalstatus', 'Totaal', 'Munt'],
      all.map((o) => [
        o.order_number as string, o.marketplace_order_id as string,
        o.created_at ? format(new Date(o.created_at as string), 'yyyy-MM-dd HH:mm') : '',
        o.customer_name as string, o.customer_email as string, o.status as string, o.payment_status as string,
        o.total != null ? String(o.total).replace('.', ',') : '', o.currency as string,
      ]),
    );
    downloadCsv(`orders-${connection.marketplace_type}-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
    toast.success(`${all.length} orders geëxporteerd`);
  };

  // APP-CLEAN-2c: echte export van de sync-logs (de tabel toont alleen de laatste 10).
  const handleExportLogs = async () => {
    if (!connection) return;
    const { data, error } = await supabase
      .from('sync_activity_log')
      .select('started_at, completed_at, data_type, direction, status, records_processed, records_failed, error_details')
      .eq('connection_id', connection.id)
      .order('started_at', { ascending: false })
      .limit(5000);
    if (error) {
      toast.error('Export mislukt: ' + error.message);
      return;
    }
    if (!data?.length) {
      toast.info('Geen logs om te exporteren');
      return;
    }
    const csv = toCsv(
      ['Start', 'Einde', 'Type', 'Richting', 'Status', 'Verwerkt', 'Mislukt', 'Fout'],
      data.map((l) => [
        l.started_at ? format(new Date(l.started_at), 'yyyy-MM-dd HH:mm:ss') : '',
        l.completed_at ? format(new Date(l.completed_at), 'yyyy-MM-dd HH:mm:ss') : '',
        l.data_type, l.direction, l.status, l.records_processed, l.records_failed,
        l.error_details ? (typeof l.error_details === 'string' ? l.error_details : JSON.stringify(l.error_details)) : '',
      ]),
    );
    downloadCsv(`sync-logs-${connection.marketplace_type}-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
  };

  // APP-CLEAN-2c: "Sync Nu" per product — sync-bol-inventory kent productId.
  const handleSyncProduct = async (productId: string) => {
    if (!connection) return;
    const syncFns = getSyncFunctions(connection.marketplace_type);
    const { error } = await supabase.functions.invoke(syncFns.inventory, {
      body: { connectionId: connection.id, productId },
    });
    if (error) toast.error('Voorraad sync mislukt: ' + error.message);
    else toast.success('Voorraad gesynchroniseerd');
    queryClient.invalidateQueries({ queryKey: ['marketplace-products', currentTenant?.id] });
  };

  // APP-CLEAN-2c: voorraadsync per product pauzeren. De lijst toont alleen
  // producten met sync aan, dus een gepauzeerd product verdwijnt hieruit.
  const handlePauseProductSync = async (productId: string) => {
    if (!currentTenant?.id) return;
    const { error } = await supabase
      .from('products')
      .update({ sync_inventory: false })
      .eq('id', productId)
      .eq('tenant_id', currentTenant.id);
    if (error) {
      toast.error('Pauzeren mislukt: ' + error.message);
      return;
    }
    toast.success('Voorraadsync gepauzeerd voor dit product. Zet hem terug aan op de productpagina.');
    queryClient.invalidateQueries({ queryKey: ['marketplace-products', currentTenant.id] });
  };

  const copyClientId = async () => {
    const id = connection?.credentials?.clientId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success('Client ID gekopieerd');
    } catch {
      toast.error('Kopiëren lukte niet');
    }
  };

  const handleSaveSettings = async () => {
    if (!connection) return;
    
    await updateConnection.mutateAsync({
      id: connection.id,
      updates: {
        marketplace_name: connectionName || connection.marketplace_name,
        settings: {
          ...connection.settings,
          syncInterval: parseInt(syncInterval),
          autoImport: autoImportOrders,
          autoSyncInventory,
          safetyStock: parseInt(safetyStock),
          lowStockThreshold: parseInt(lowStockThreshold),
        },
      },
    });
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    
    await deleteConnection.mutateAsync(connection.id);
    navigate('/admin/connect');
  };

  // Format activity for display
  const formatActivity = (activity: any) => {
    const type = activity.data_type === 'orders' ? 'order' : 
                 activity.data_type === 'inventory' ? 'inventory' : 'sync';
    const isError = activity.status === 'failed';
    
    let message = '';
    if (activity.data_type === 'orders') {
      message = activity.status === 'success' 
        ? `${activity.records_created || 0} orders geïmporteerd`
        : `Order sync mislukt`;
    } else if (activity.data_type === 'inventory') {
      message = activity.status === 'success'
        ? `${activity.records_processed || 0} producten gesynchroniseerd`
        : `Voorraad sync mislukt`;
    } else {
      message = activity.status === 'success' ? 'Sync voltooid' : 'Sync mislukt';
    }
    
    return {
      id: activity.id,
      type: isError ? 'error' : type,
      message,
      timestamp: activity.started_at 
        ? formatDistanceToNow(new Date(activity.started_at), { addSuffix: true, locale: nl })
        : 'Onbekend'
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection || !info) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Connectie niet gevonden</p>
        <Button variant="link" onClick={() => navigate('/admin/connect')}>
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  const lastSyncFormatted = connection.last_sync_at
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: nl })
    : 'Nog niet';

  const formattedActivities = syncActivities.map(formatActivity);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/connect')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", info.bgColor)}>
              <ShoppingBag className={cn("w-6 h-6", info.color)} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {connection.marketplace_name || info.name}
              </h1>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-600">Actief</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  Verbonden sinds {format(new Date(connection.created_at), 'd MMM yyyy', { locale: nl })}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {connection.marketplace_type === 'bol_com' && (
            <BolCsvImport 
              connectionId={connection.id}
              onImportComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['marketplace-orders', connectionId] });
                queryClient.invalidateQueries({ queryKey: ['sync-activities', connectionId] });
              }}
            />
          )}
          <Button 
            variant="outline" 
            onClick={handleHistoricalImport} 
            disabled={syncing || importingHistorical}
          >
            {importingHistorical ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importeren...
              </>
            ) : (
              <>
                <History className="w-4 h-4 mr-2" />
                Import Historisch
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleSyncNow} disabled={syncing || importingHistorical}>
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Synchroniseren...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Nu
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList scrollHint>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="orders">Orders ({realOrders.length})</TabsTrigger>
          <TabsTrigger value="inventory">Voorraad</TabsTrigger>
          <TabsTrigger value="sync-rules">Sync Regels</TabsTrigger>
          <TabsTrigger value="settings">Instellingen</TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Totaal Orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{connection.stats?.totalOrders || realOrders.length || 0}</div>
                <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  Via {info.name}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Totale Omzet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">€{connection.stats?.totalRevenue?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-muted-foreground mt-1">Via {info.name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Producten Gesynchroniseerd</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{connection.stats?.productsLinked || linkedProducts.length || 0}</div>
                <p className="text-sm text-muted-foreground mt-1">Gekoppeld</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Laatste Sync</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{lastSyncFormatted.split(' ')[0]}</div>
                <p className="text-sm text-muted-foreground mt-1">geleden</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recente Activiteit</CardTitle>
            </CardHeader>
            <CardContent>
              {formattedActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nog geen sync activiteit</p>
                  <Button variant="link" onClick={handleSyncNow} disabled={syncing}>
                    Start je eerste sync
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {formattedActivities.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        activity.type === 'order' && 'bg-blue-100',
                        activity.type === 'inventory' && 'bg-green-100',
                        activity.type === 'error' && 'bg-red-100'
                      )}>
                        {activity.type === 'order' && <ShoppingCart className="w-4 h-4 text-blue-600" />}
                        {activity.type === 'inventory' && <Package className="w-4 h-4 text-green-600" />}
                        {activity.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Sync History */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Snelle Acties</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button variant="outline" className="justify-start" onClick={handleHistoricalImport} disabled={importingHistorical}>
                  <History className="w-4 h-4 mr-2" />
                  Import Historische Orders
                </Button>
                <Button variant="outline" className="justify-start" onClick={handleExportOrders}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Orders
                </Button>
              </CardContent>
            </Card>
            
            {/* Sync History Widget */}
            <SyncHistoryWidget connectionId={connection.id} />
          </div>
        </TabsContent>

        {/* ORDERS TAB */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{info.name} Orders</CardTitle>
                  <CardDescription>Alle bestellingen gesynchroniseerd van {info.name}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleHistoricalImport} disabled={importingHistorical}>
                    <History className="w-4 h-4 mr-2" />
                    Import Historisch
                  </Button>
                  <Button variant="outline" onClick={handleExportOrders}>
                    <Download className="w-4 h-4 mr-2" />
                    Exporteer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="pending">Open</SelectItem>
                    <SelectItem value="shipped">Verzonden</SelectItem>
                    <SelectItem value="cancelled">Geannuleerd</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Zoek order..." className="flex-1" />
              </div>

              {ordersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : realOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Geen orders gevonden</h3>
                  <p className="text-muted-foreground mb-4">
                    Er zijn nog geen orders gesynchroniseerd van {info.name}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={handleHistoricalImport} disabled={importingHistorical}>
                      <History className="w-4 h-4 mr-2" />
                      Import Historisch
                    </Button>
                    <Button onClick={handleSyncNow} disabled={syncing}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Nu
                    </Button>
                  </div>
                </div>
              ) : isMobile ? (
                /*
                  Kaart per bestelling. De tabel is 640px in een venster van 293,
                  dus de link naar de bestelling zat 347px buiten beeld.
                */
                <div className="space-y-3">
                  {realOrders.map(order => (
                    <div key={order.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* min-w-0 en truncate: zonder die twee duwt een lange
                            klantnaam de knop opnieuw het scherm uit. */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-medium">
                            {order.marketplace_order_id || order.order_number}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {order.customer_name || '-'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={order.status === 'shipped' ? 'default' : 'secondary'}>
                          {order.status === 'shipped' ? 'Verzonden' :
                           order.status === 'processing' ? 'In behandeling' :
                           order.status === 'cancelled' ? 'Geannuleerd' : 'Open'}
                        </Badge>
                        <div className="text-right">
                          <p className="font-medium">€{Number(order.total || 0).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {realOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          {order.marketplace_order_id || order.order_number}
                        </TableCell>
                        <TableCell>{order.customer_name || '-'}</TableCell>
                        <TableCell>€{Number(order.total || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'shipped' ? 'default' : 'secondary'}>
                            {order.status === 'shipped' ? 'Verzonden' : 
                             order.status === 'processing' ? 'In behandeling' : 
                             order.status === 'cancelled' ? 'Geannuleerd' : 'Open'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Voorraad Synchronisatie</CardTitle>
                  <CardDescription>
                    Producten gekoppeld aan {info.name} met real-time voorraad sync
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSyncNow} disabled={syncing}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Alles
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle producten</SelectItem>
                    <SelectItem value="active">Voorraad actief</SelectItem>
                    <SelectItem value="paused">Voorraad gepauzeerd</SelectItem>
                    <SelectItem value="unlinked">Niet gekoppeld</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Zoek product..." className="flex-1" />
              </div>

              {productsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : linkedProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Geen producten gekoppeld</h3>
                  <p className="text-muted-foreground mb-4">
                    Koppel producten aan {info.name} door een EAN toe te voegen en sync in te schakelen
                  </p>
                  <Button variant="outline" onClick={() => navigate('/admin/products')}>
                    Naar Producten
                  </Button>
                </div>
              ) : isMobile ? (
                <div className="space-y-3">
                  {/*
                    Kaart per product. De tabel is 640px in een venster van 293,
                    dus het menu zat 347px buiten beeld. Het menu is
                    ongewijzigd overgenomen — inclusief het feit dat de items
                    geen onClick hebben; dat is een bestaand hiaat op deze
                    pagina, geen nieuw.
                  */}
                  {linkedProducts.map(product => (
                    <div key={product.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={product.images?.[0] || '/placeholder.svg'}
                          alt={product.name}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {product.bol_ean}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSyncProduct(product.id)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync Nu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePauseProductSync(product.id)}>
                              Pauzeer Sync
                            </DropdownMenuItem>
                            {connection.marketplace_type === 'bol_com' && product.bol_ean && (
                              <DropdownMenuItem asChild>
                                <a href={`https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(product.bol_ean)}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Bekijk op {info.name}
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        {product.sync_inventory ? (
                          <Badge variant="default" className="flex w-fit items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Actief
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Gepauzeerd</Badge>
                        )}
                        <div className="text-right">
                          <p className={(product.stock || 0) < 5 ? 'font-semibold text-destructive' : 'font-medium'}>
                            {product.stock || 0} op voorraad
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.last_inventory_sync
                              ? formatDistanceToNow(new Date(product.last_inventory_sync), { addSuffix: true, locale: nl })
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU / EAN</TableHead>
                      <TableHead>SellQo Voorraad</TableHead>
                      <TableHead>Sync Status</TableHead>
                      <TableHead>Laatste Sync</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={product.images?.[0] || '/placeholder.svg'}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.bol_ean}</TableCell>
                        <TableCell>
                          <span className={(product.stock || 0) < 5 ? 'text-destructive font-semibold' : ''}>
                            {product.stock || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {product.sync_inventory ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              Actief
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Gepauzeerd</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.last_inventory_sync
                            ? formatDistanceToNow(new Date(product.last_inventory_sync), { addSuffix: true, locale: nl })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSyncProduct(product.id)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Sync Nu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePauseProductSync(product.id)}>
                                Pauzeer Sync
                              </DropdownMenuItem>
                              {connection.marketplace_type === 'bol_com' && product.bol_ean && (
                                <DropdownMenuItem asChild>
                                  <a href={`https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(product.bol_ean)}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Bekijk op {info.name}
                                  </a>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYNC RULES TAB */}
        <TabsContent value="sync-rules">
          <SyncRulesTab 
            connection={connection} 
            platformName={info.name} 
          />
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Verbinding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Connectie naam</Label>
                  <Input
                    value={connectionName || connection.marketplace_name || ''}
                    onChange={(e) => setConnectionName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Client ID</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={connection.credentials?.clientId || '••••••••'}
                      readOnly
                      className="flex-1 bg-muted font-mono text-sm"
                    />
                    {connection.credentials?.clientId && (
                      <Button variant="outline" size="icon" onClick={copyClientId} aria-label="Kopieer Client ID">
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Client Secret</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="password"
                      value="••••••••••••••••"
                      readOnly
                      className="flex-1 bg-muted"
                    />
                  </div>
                </div>
                {/* APP-CLEAN-2c: "Update API Credentials" en het potlood deden niets; bijwerken van
                    bestaande credentials bestaat (nog) niet. Eerlijk zeggen in plaats van een dode knop. */}
                <p className="text-xs text-muted-foreground">
                  API-gegevens gewijzigd bij {info.name}? Neem contact op met SellQo-support om ze bij te werken.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Instellingen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automatisch orders importeren</p>
                    <p className="text-sm text-muted-foreground">
                      Nieuwe bestellingen worden automatisch opgehaald
                    </p>
                  </div>
                  <Switch checked={autoImportOrders} onCheckedChange={setAutoImportOrders} />
                </div>
                <div>
                  <Label>Sync interval</Label>
                  <Select value={syncInterval} onValueChange={setSyncInterval}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Elke 5 minuten (Business)</SelectItem>
                      <SelectItem value="15">Elke 15 minuten (Pro)</SelectItem>
                      <SelectItem value="30">Elke 30 minuten</SelectItem>
                      <SelectItem value="60">Elk uur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voorraad Instellingen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automatisch voorraad synchroniseren</p>
                    <p className="text-sm text-muted-foreground">
                      Wijzigingen in SellQo worden direct naar {info.name} gestuurd
                    </p>
                  </div>
                  <Switch checked={autoSyncInventory} onCheckedChange={setAutoSyncInventory} />
                </div>
                <div>
                  <Label>Veiligheidsvoorraad</Label>
                  <Input
                    type="number"
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(e.target.value)}
                    className="mt-1"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dit aantal wordt afgetrokken van je werkelijke voorraad op {info.name}
                  </p>
                </div>
                <div>
                  <Label>Waarschuwing bij lage voorraad</Label>
                  <Input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="mt-1"
                    placeholder="5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* VVB Settings - only for Bol.com */}
            {connection.marketplace_type === 'bol_com' && (
              <BolVVBSettings
                settings={connection.settings}
                onSettingsChange={(updates) => {
                  updateConnection.mutate({
                    id: connection.id,
                    updates: {
                      settings: {
                        ...connection.settings,
                        ...updates,
                      },
                    },
                  });
                }}
              />
            )}

            {/* Amazon Buy Shipping Settings */}
            {connection.marketplace_type === 'amazon' && (
              <AmazonBuyShippingSettings
                settings={connection.settings}
                onSettingsChange={(updates) => {
                  updateConnection.mutate({
                    id: connection.id,
                    updates: {
                      settings: {
                        ...connection.settings,
                        ...updates,
                      },
                    },
                  });
                }}
              />
            )}

            {/* Odoo B2C aggregation settings */}
            {connection.marketplace_type === 'odoo' &&
              (connection.settings as { odooModuleAccounting?: boolean })?.odooModuleAccounting && (
                <OdooB2CAggregationSettings tenantId={connection.tenant_id} />
              )}
            {/* APP-CLEAN-2c: kaart "Notificaties" weg — 4 schakelaars zonder state die niets lazen of schreven.
                Meldingen lopen via de centrale notificatie-instellingen. */}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetSettingsForm}>Annuleer</Button>
              <Button onClick={handleSaveSettings}>
                Instellingen Opslaan
              </Button>
            </div>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Gevaren Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Verbreek {info.name} Integratie</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Dit verwijdert de connectie met {info.name}. Je orders en producten blijven bewaard in SellQo, maar nieuwe orders worden niet meer geïmporteerd en voorraad wordt niet meer gesynchroniseerd.
                  </p>
                  <Button variant="destructive" onClick={() => setShowDisconnectDialog(true)}>
                    <Unlink className="w-4 h-4 mr-2" />
                    Verbreek Integratie
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Synchronisatie Logs</CardTitle>
                  <CardDescription>
                    Laatste 10 sync-activiteiten (export bevat de volledige geschiedenis)
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={handleExportLogs}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle types</SelectItem>
                    <SelectItem value="order">Order Import</SelectItem>
                    <SelectItem value="inventory">Inventory Sync</SelectItem>
                    <SelectItem value="status">Status Update</SelectItem>
                    <SelectItem value="error">Errors</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="w-[180px]" />
              </div>

              {syncActivities.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Geen sync logs</h3>
                  <p className="text-muted-foreground">
                    Logs verschijnen hier zodra je een sync uitvoert
                  </p>
                </div>
              ) : (
                <div className="w-full">
                <Table className="min-w-[640px]" scrollHint>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncActivities.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {log.started_at && format(new Date(log.started_at), 'd MMM yyyy HH:mm', { locale: nl })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.data_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.records_processed > 0 ? `${log.records_processed} verwerkt` : '-'}
                          {log.records_failed > 0 && `, ${log.records_failed} mislukt`}
                          {log.status === 'failed' && log.error_details && (
                            <span className="block max-w-[280px] truncate text-xs text-destructive" title={typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details)}>
                              {typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.status === 'success' && (
                            <Badge variant="default">Success</Badge>
                          )}
                          {log.status === 'failed' && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                          {log.status === 'running' && (
                            <Badge variant="secondary">Running</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{log.records_processed || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disconnect Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie verbreekt de verbinding met {info.name}. Nieuwe orders worden niet meer geïmporteerd en voorraadsynchronisatie stopt. Bestaande data blijft bewaard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
              Ja, verbreek verbinding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

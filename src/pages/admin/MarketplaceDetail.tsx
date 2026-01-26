import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Upload,
  FileText,
  Eye,
  MoreVertical,
  CheckCircle,
  Copy,
  Edit,
  Key,
  Bell,
  Unlink,
  AlertCircle,
  ShoppingBag,
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
  DropdownMenuSeparator,
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Mock data for demonstration
const mockActivities = [
  { id: '1', type: 'order', message: 'Nieuwe order #12345 geïmporteerd', timestamp: '5 minuten geleden' },
  { id: '2', type: 'inventory', message: 'Voorraad voor 12 producten bijgewerkt', timestamp: '15 minuten geleden' },
  { id: '3', type: 'order', message: 'Nieuwe order #12344 geïmporteerd', timestamp: '22 minuten geleden' },
  { id: '4', type: 'error', message: 'Voorraad sync mislukt voor SKU-001', timestamp: '1 uur geleden' },
];

const mockOrders = [
  { id: '1', marketplace_order_id: 'BOL-12345678', customer_name: 'Jan de Vries', items_count: 2, total_amount: '49.99', status: 'shipped', created_at: new Date().toISOString() },
  { id: '2', marketplace_order_id: 'BOL-12345679', customer_name: 'Piet Janssen', items_count: 1, total_amount: '29.99', status: 'pending', created_at: new Date().toISOString() },
  { id: '3', marketplace_order_id: 'BOL-12345680', customer_name: 'Marie Bakker', items_count: 3, total_amount: '89.99', status: 'shipped', created_at: new Date().toISOString() },
];

const mockProducts = [
  { id: '1', name: 'Product A', image: '/placeholder.svg', bol_ean: '8712345678901', quantity: 25, bol_quantity: 25, sync_enabled: true, last_sync: new Date().toISOString() },
  { id: '2', name: 'Product B', image: '/placeholder.svg', bol_ean: '8712345678902', quantity: 3, bol_quantity: 3, sync_enabled: true, last_sync: new Date().toISOString() },
  { id: '3', name: 'Product C', image: '/placeholder.svg', bol_ean: '8712345678903', quantity: 50, bol_quantity: 50, sync_enabled: false, last_sync: null },
];

const mockLogs = [
  { id: '1', created_at: new Date().toISOString(), sync_type: 'Order Import', details: '5 orders geïmporteerd', status: 'success', duration: 234 },
  { id: '2', created_at: new Date().toISOString(), sync_type: 'Inventory Sync', details: '12 producten bijgewerkt', status: 'success', duration: 567 },
  { id: '3', created_at: new Date().toISOString(), sync_type: 'Order Import', details: 'API timeout', status: 'failed', duration: 30000 },
];

export default function MarketplaceDetailPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { connection, isLoading } = useMarketplaceConnection(connectionId);
  const { updateConnection, deleteConnection } = useMarketplaceConnections();

  const [syncing, setSyncing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  
  // Settings state
  const [connectionName, setConnectionName] = useState('');
  const [autoImportOrders, setAutoImportOrders] = useState(true);
  const [syncInterval, setSyncInterval] = useState('15');
  const [autoSyncInventory, setAutoSyncInventory] = useState(true);
  const [safetyStock, setSafetyStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const info = connection ? MARKETPLACE_INFO[connection.marketplace_type] : null;

  const handleSyncNow = async () => {
    if (!connection) return;
    
    setSyncing(true);
    
    try {
      // Sync orders
      toast.info('Orders synchroniseren...');
      const orderResult = await supabase.functions.invoke('sync-bol-orders', {
        body: { connectionId: connection.id }
      });
      
      if (orderResult.error) {
        console.error('Order sync error:', orderResult.error);
        toast.error('Order sync mislukt: ' + orderResult.error.message);
      } else {
        toast.success(`${orderResult.data?.ordersImported || 0} orders geïmporteerd`);
      }
      
      // Sync inventory
      toast.info('Voorraad synchroniseren...');
      const inventoryResult = await supabase.functions.invoke('sync-bol-inventory', {
        body: { connectionId: connection.id }
      });
      
      if (inventoryResult.error) {
        console.error('Inventory sync error:', inventoryResult.error);
        toast.error('Voorraad sync mislukt: ' + inventoryResult.error.message);
      } else {
        toast.success(`${inventoryResult.data?.productsSynced || 0} producten gesynchroniseerd`);
      }
      
      toast.success('Synchronisatie voltooid!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout';
      toast.error('Synchronisatie mislukt: ' + message);
    } finally {
      setSyncing(false);
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
    navigate('/admin/settings/marketplaces');
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
        <Button variant="link" onClick={() => navigate('/admin/settings/marketplaces')}>
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  const lastSyncFormatted = connection.last_sync_at
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: nl })
    : 'Nog niet';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/settings/marketplaces')}>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncNow} disabled={syncing}>
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
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
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
                <div className="text-3xl font-bold">{connection.stats?.totalOrders || 0}</div>
                <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  +12% deze maand
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
                <div className="text-3xl font-bold">{connection.stats?.productsLinked || 0}</div>
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
              <div className="space-y-4">
                {mockActivities.map(activity => (
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
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Snelle Acties</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="justify-start">
                <Download className="w-4 h-4 mr-2" />
                Export Orders
              </Button>
              <Button variant="outline" className="justify-start">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Voorraad Update
              </Button>
              <Button variant="outline" className="justify-start">
                <FileText className="w-4 h-4 mr-2" />
                Sync Rapport
              </Button>
            </CardContent>
          </Card>
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
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exporteer
                </Button>
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Klant</TableHead>
                    <TableHead>Producten</TableHead>
                    <TableHead>Bedrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.marketplace_order_id}
                      </TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>{order.items_count} items</TableCell>
                      <TableCell>€{order.total_amount}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'shipped' ? 'default' : 'secondary'}>
                          {order.status === 'shipped' ? 'Verzonden' : 'Open'}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Update
                  </Button>
                  <Button onClick={handleSyncNow}>
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU / EAN</TableHead>
                    <TableHead>SellQo Voorraad</TableHead>
                    <TableHead>{info.name} Voorraad</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Laatste Sync</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.bol_ean}</TableCell>
                      <TableCell>
                        <span className={product.quantity < 5 ? 'text-destructive font-semibold' : ''}>
                          {product.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{product.bol_quantity}</TableCell>
                      <TableCell>
                        {product.sync_enabled ? (
                          <Badge variant="default" className="flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" />
                            Actief
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Gepauzeerd</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.last_sync
                          ? formatDistanceToNow(new Date(product.last_sync), { addSuffix: true, locale: nl })
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
                            <DropdownMenuItem>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync Nu
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {product.sync_enabled ? 'Pauseer Sync' : 'Activeer Sync'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Bekijk op {info.name}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              Ontkoppel Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                    <Button variant="outline" size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
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
                    <Button variant="outline" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline">
                  <Key className="w-4 h-4 mr-2" />
                  Update API Credentials
                </Button>
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

            <Card>
              <CardHeader>
                <CardTitle>Notificaties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij nieuwe orders</p>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij sync fouten</p>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij lage voorraad</p>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Dagelijkse sync rapport</p>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Annuleer</Button>
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
                    Volledige geschiedenis van alle sync activiteiten
                  </CardDescription>
                </div>
                <Button variant="outline">
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duur</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.sync_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.details}</TableCell>
                      <TableCell>
                        {log.status === 'success' && (
                          <Badge variant="default">Success</Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                        {log.status === 'pending' && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{log.duration}ms</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marketplace verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de connectie met {info.name}. Je orders en producten blijven bewaard in SellQo, maar nieuwe orders worden niet meer geïmporteerd en voorraad wordt niet meer gesynchroniseerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verbreek Integratie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

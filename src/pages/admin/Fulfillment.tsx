import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  PackageCheck, 
  Search, 
  RefreshCw, 
  Truck, 
  Package,
  ExternalLink,
  Printer,
  CheckCircle2,
  Upload,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CARRIER_PATTERNS, generateTrackingUrl } from '@/lib/carrierPatterns';
import { useNavigate } from 'react-router-dom';
import { TrackingImportDialog } from '@/components/admin/fulfillment/TrackingImportDialog';
import { FulfillmentBulkActions } from '@/components/admin/FulfillmentBulkActions';

type FulfillmentStatus = 'unfulfilled' | 'partial' | 'shipped' | 'delivered';

interface FulfillmentOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  shipping_address: unknown;
  fulfillment_status: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  marketplace_source: string | null;
  created_at: string;
  item_count: number;
}

export default function Fulfillment() {
  const { currentTenant } = useTenant();
  const { isWarehouse, hasFinancialAccess } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('unfulfilled');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customTrackingUrl, setCustomTrackingUrl] = useState('');

  // Fetch orders for fulfillment
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['fulfillment-orders', currentTenant?.id, statusFilter, search],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Always query from orders table - RLS handles access
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          shipping_address,
          fulfillment_status,
          carrier,
          tracking_number,
          tracking_url,
          marketplace_source,
          created_at
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter by status
      if (statusFilter === 'unfulfilled') {
        query = query.or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.pending');
      } else if (statusFilter === 'shipped') {
        // Include legacy 'fulfilled' value as 'shipped'
        query = query.or('fulfillment_status.eq.shipped,fulfillment_status.eq.fulfilled');
      } else if (statusFilter !== 'all') {
        query = query.eq('fulfillment_status', statusFilter);
      }

      // Search
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get item counts for each order
      const orderIds = data?.map(o => o.id) || [];
      if (orderIds.length === 0) return [];

      const { data: itemCounts } = await supabase
        .from('order_items')
        .select('order_id, quantity')
        .in('order_id', orderIds);

      const countMap = (itemCounts || []).reduce((acc, item) => {
        acc[item.order_id] = (acc[item.order_id] || 0) + item.quantity;
        return acc;
      }, {} as Record<string, number>);

      return (data || []).map(order => ({
        ...order,
        item_count: countMap[order.id] || 0,
      })) as FulfillmentOrder[];
    },
    enabled: !!currentTenant?.id,
  });

  // Update tracking mutation
  const updateTracking = useMutation({
    mutationFn: async ({ orderId, carrier, trackingNumber, trackingUrl }: {
      orderId: string;
      carrier: string;
      trackingNumber: string;
      trackingUrl: string;
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          carrier,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          fulfillment_status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      setTrackingDialogOpen(false);
      setSelectedOrder(null);
      setTrackingCarrier('');
      setTrackingNumber('');
      setCustomTrackingUrl('');
      toast({
        title: 'Tracking opgeslagen',
        description: 'De verzending is geregistreerd.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = () => {
    if (!orders) return;
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const openTrackingDialog = (order: FulfillmentOrder) => {
    setSelectedOrder(order);
    setTrackingCarrier(order.carrier || '');
    setTrackingNumber(order.tracking_number || '');
    setCustomTrackingUrl(order.tracking_url || '');
    setTrackingDialogOpen(true);
  };

  const handleSaveTracking = () => {
    if (!selectedOrder || !trackingCarrier || !trackingNumber) return;

    let finalUrl = customTrackingUrl;
    if (!finalUrl && trackingCarrier !== 'other') {
      finalUrl = generateTrackingUrl(trackingCarrier, trackingNumber) || '';
    }

    updateTracking.mutate({
      orderId: selectedOrder.id,
      carrier: trackingCarrier,
      trackingNumber,
      trackingUrl: finalUrl,
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'shipped':
        return <Badge variant="default" className="bg-blue-500">Verzonden</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-green-500">Afgeleverd</Badge>;
      case 'partial':
        return <Badge variant="secondary">Deels verzonden</Badge>;
      default:
        return <Badge variant="outline">Te verzenden</Badge>;
    }
  };

  const getMarketplaceBadge = (source: string | null) => {
    if (!source) return null;
    const labels: Record<string, string> = {
      bol_com: 'Bol.com',
      amazon: 'Amazon',
      shopify: 'Shopify',
      sellqo_webshop: 'Webshop',
    };
    return <Badge variant="outline" className="text-xs">{labels[source] || source}</Badge>;
  };

  const parseAddress = (address: unknown) => {
    if (!address || typeof address !== 'object') return 'Geen adres';
    const addr = address as Record<string, string>;
    const parts = [addr.street, addr.city, addr.postal_code, addr.country].filter(Boolean);
    return parts.join(', ') || 'Geen adres';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <PackageCheck className="h-6 w-6 sm:h-8 sm:w-8" />
            Fulfillment Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Beheer verzendingen en tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">CSV Import</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Vernieuwen</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op ordernummer of klant..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unfulfilled">Te verzenden</SelectItem>
                <SelectItem value="shipped">Verzonden</SelectItem>
                <SelectItem value="delivered">Afgeleverd</SelectItem>
                <SelectItem value="all">Alles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      <FulfillmentBulkActions
        selectedOrderIds={Array.from(selectedOrders)}
        orders={orders || []}
        onClearSelection={() => setSelectedOrders(new Set())}
        onComplete={() => setSelectedOrders(new Set())}
      />

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Orders
          </CardTitle>
          <CardDescription>
            {orders?.length || 0} orders gevonden
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen orders gevonden</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-2 px-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border bg-card p-3 cursor-pointer active:bg-muted/50"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{order.order_number}</span>
                    {getStatusBadge(order.fulfillment_status)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground truncate">{order.customer_name || 'Onbekend'}</span>
                    {getMarketplaceBadge(order.marketplace_source)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">
                      {order.item_count} items · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: nl })}
                    </span>
                    {!order.tracking_number ? (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openTrackingDialog(order); }}>
                        <Truck className="h-3 w-3 mr-1" />
                        Track
                      </Button>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">{order.tracking_number}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedOrders.size === orders.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Tracking</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={() => handleSelectOrder(order.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.order_number}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {formatDistanceToNow(new Date(order.created_at), {
                          addSuffix: true,
                          locale: nl,
                        })}
                        {getMarketplaceBadge(order.marketplace_source)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{order.customer_name || 'Onbekend'}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {parseAddress(order.shipping_address)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{order.item_count} items</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.fulfillment_status)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {order.tracking_number ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{order.tracking_number}</span>
                          {order.tracking_url && (
                            <a
                              href={order.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        {!order.tracking_number ? (
                          <Button
                            size="sm"
                            onClick={() => openTrackingDialog(order)}
                          >
                            <Truck className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Tracking</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTrackingDialog(order)}
                          >
                            <span className="hidden sm:inline">Bewerken</span>
                            <span className="sm:hidden">Edit</span>
                          </Button>
                        )}
                        {!isWarehouse && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                          >
                            <span className="hidden sm:inline">Details</span>
                            <Eye className="h-4 w-4 sm:hidden" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Dialog */}
      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tracking toevoegen</DialogTitle>
            <DialogDescription>
              Voer de tracking informatie in voor order {selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer carrier" />
                </SelectTrigger>
                <SelectContent>
                  {CARRIER_PATTERNS.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tracking nummer</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Bijv. 3STEST123456789"
              />
            </div>
            {trackingCarrier === 'other' && (
              <div className="space-y-2">
                <Label>Tracking URL (optioneel)</Label>
                <Input
                  value={customTrackingUrl}
                  onChange={(e) => setCustomTrackingUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleSaveTracking}
              disabled={!trackingCarrier || !trackingNumber || updateTracking.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Opslaan & Verzenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <TrackingImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => refetch()}
      />
    </div>
  );
}

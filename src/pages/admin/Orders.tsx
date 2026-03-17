import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, MoreHorizontal, Truck, CheckCircle, XCircle, Clock, Printer, Download, Trash2, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useOrders } from '@/hooks/useOrders';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderFilters } from '@/components/admin/OrderFilters';
import { OrderMarketplaceBadge } from '@/components/admin/marketplace/OrderMarketplaceBadge';
import { OrderBulkActions } from '@/components/admin/OrderBulkActions';
import type { Order, OrderFilters as OrderFiltersType, OrderStatus } from '@/types/order';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [filters, setFilters] = useState<OrderFiltersType>({});
  const { orders, isLoading, updateOrderStatus, deleteOrder } = useOrders(filters);
  
  // Batch selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      deleteOrder.mutate(orderToDelete.id);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateOrderStatus.mutate({ orderId, status });
  };

  // Batch selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(orders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(prev => [...prev, orderId]);
    } else {
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;
  const isSomeSelected = selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length;

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <Alert>
        <AlertDescription>Geen winkel gevonden. Neem contact op met een beheerder.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Bestellingen</h1>
          <p className="text-sm text-muted-foreground">Beheer alle bestellingen van je winkel</p>
        </div>
      </div>

      {/* Filters */}
      <OrderFilters filters={filters} onFiltersChange={setFilters} />

      {/* Bulk Actions Bar */}
      <OrderBulkActions
        selectedOrderIds={selectedOrderIds}
        orders={orders}
        onClearSelection={() => setSelectedOrderIds([])}
        onComplete={() => setSelectedOrderIds([])}
      />

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Alle bestellingen
          </CardTitle>
          <CardDescription>
            {orders.length} bestelling{orders.length !== 1 ? 'en' : ''} gevonden
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Geen bestellingen gevonden</h3>
              <p className="text-muted-foreground text-sm">
                {filters.status || filters.payment_status || filters.search
                  ? 'Probeer andere filters'
                  : 'Bestellingen verschijnen hier zodra klanten iets bestellen'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecteer alle orders"
                      className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    />
                  </TableHead>
                  <TableHead>Bestelling</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead className="hidden lg:table-cell">Bron</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Betaling</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead className="hidden sm:table-cell">Datum</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderIds.includes(order.id)}
                    onSelect={(checked) => handleSelectOrder(order.id, checked)}
                    onView={() => navigate(`/admin/orders/${order.id}`)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteOrder}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestelling verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je bestelling {orderToDelete?.order_number} wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onView: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onDelete: (order: Order) => void;
  formatCurrency: (amount: number) => string;
}

function OrderRow({ order, isSelected, onSelect, onView, onStatusChange, onDelete, formatCurrency }: OrderRowProps) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Selecteer order ${order.order_number}`}
        />
      </TableCell>
      <TableCell onClick={onView}>
        <div className="font-medium">{order.order_number}</div>
        <div className="text-xs text-muted-foreground">
          {order.order_items?.length || 0} artikel{(order.order_items?.length || 0) !== 1 ? 'en' : ''}
        </div>
      </TableCell>
      <TableCell onClick={onView} className="max-w-[200px]">
        <div className="font-medium truncate">{order.customer_name || '-'}</div>
        <div className="text-sm text-muted-foreground truncate">{order.customer_email}</div>
      </TableCell>
      <TableCell className="hidden lg:table-cell" onClick={onView}>
        <OrderMarketplaceBadge source={order.marketplace_source} salesChannel={order.sales_channel} />
      </TableCell>
      <TableCell onClick={onView}>
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell className="hidden md:table-cell" onClick={onView}>
        <PaymentStatusBadge status={order.payment_status} />
      </TableCell>
      <TableCell className="text-right font-medium" onClick={onView}>
        {formatCurrency(Number(order.total))}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-muted-foreground" onClick={onView}>
        {format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4 mr-2" />
              Bekijken
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {order.status !== 'processing' && order.status !== 'cancelled' && (
              <DropdownMenuItem onClick={() => onStatusChange(order.id, 'processing')}>
                <Clock className="h-4 w-4 mr-2" />
                In behandeling
              </DropdownMenuItem>
            )}
            {order.status !== 'shipped' && order.status !== 'cancelled' && order.status !== 'delivered' && (
              <DropdownMenuItem onClick={() => onStatusChange(order.id, 'shipped')}>
                <Truck className="h-4 w-4 mr-2" />
                Markeer als verzonden
              </DropdownMenuItem>
            )}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <DropdownMenuItem onClick={() => onStatusChange(order.id, 'delivered')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Markeer als afgeleverd
              </DropdownMenuItem>
            )}
            {order.status !== 'cancelled' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onStatusChange(order.id, 'cancelled')}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Annuleren
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(order)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

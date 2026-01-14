import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, MoreHorizontal, Truck, CheckCircle, XCircle, Clock, CreditCard } from 'lucide-react';
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
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderFilters } from '@/components/admin/OrderFilters';
import type { Order, OrderFilters as OrderFiltersType, OrderStatus } from '@/types/order';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [filters, setFilters] = useState<OrderFiltersType>({});
  const { orders, isLoading, updateOrderStatus } = useOrders(filters);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateOrderStatus.mutate({ orderId, status });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestellingen</h1>
          <p className="text-muted-foreground">Beheer alle bestellingen van je winkel</p>
        </div>
      </div>

      {/* Filters */}
      <OrderFilters filters={filters} onFiltersChange={setFilters} />

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
        <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bestelling</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Betaling</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onView={() => navigate(`/admin/orders/${order.id}`)}
                    onStatusChange={handleStatusChange}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  onView: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  formatCurrency: (amount: number) => string;
}

function OrderRow({ order, onView, onStatusChange, formatCurrency }: OrderRowProps) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onView}>
      <TableCell>
        <div className="font-medium">{order.order_number}</div>
        <div className="text-xs text-muted-foreground">
          {order.order_items?.length || 0} artikel{(order.order_items?.length || 0) !== 1 ? 'en' : ''}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{order.customer_name || '-'}</div>
        <div className="text-sm text-muted-foreground">{order.customer_email}</div>
      </TableCell>
      <TableCell>
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell>
        <PaymentStatusBadge status={order.payment_status} />
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(Number(order.total))}
      </TableCell>
      <TableCell className="text-muted-foreground">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

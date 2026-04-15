import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useOrderSearchForReturn } from '@/hooks/useOrderSearch';
import { useTenant } from '@/hooks/useTenant';
import { CreateReturnDialog } from '@/components/admin/CreateReturnDialog';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewReturnFromScratchDialog({ open, onOpenChange }: Props) {
  const { currentTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: searchResults = [], isLoading } = useOrderSearchForReturn(search);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currentTenant?.currency || 'EUR' }).format(amount);

  // When order is selected, fetch its items
  const { data: orderDetails } = useQuery({
    queryKey: ['order-for-return', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', selectedOrderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrderId,
  });

  const [showReturnDialog, setShowReturnDialog] = useState(false);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const handleStartReturn = () => {
    setShowReturnDialog(true);
  };

  const handleReset = () => {
    setSelectedOrderId(null);
    setSearch('');
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  if (showReturnDialog && orderDetails) {
    return (
      <CreateReturnDialog
        open={true}
        onOpenChange={(v) => {
          setShowReturnDialog(v);
          if (!v) handleClose();
        }}
        orderId={orderDetails.id}
        customerId={orderDetails.customer_id || undefined}
        customerName={orderDetails.customer_name || undefined}
        orderItems={(orderDetails.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || 'Product',
          variant_id: item.variant_id,
          variant_name: item.variant_name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.unit_price || 0,
        }))}
        orderSubtotal={orderDetails.subtotal}
        orderDiscountAmount={orderDetails.discount_amount}
        orderDiscountCode={orderDetails.discount_code}
        shippingCost={orderDetails.shipping_cost || 0}
        orderSource={orderDetails.marketplace_source || undefined}
        paymentMethod={
          orderDetails.marketplace_source === 'bol_com' ? 'bolcom' :
          orderDetails.marketplace_source === 'amazon' ? 'amazon' :
          orderDetails.stripe_payment_intent_id ? 'stripe' : 'manual'
        }
        marketplaceConnectionId={orderDetails.marketplace_connection_id}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe retour aanmaken</DialogTitle>
        </DialogHeader>

        {!selectedOrderId ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op ordernummer, klantnaam of email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {isLoading && search.length >= 2 && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            )}

            {!isLoading && search.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Geen orders gevonden</p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {searchResults.map((order: any) => (
                  <Card key={order.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSelectOrder(order.id)}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_name || order.customer_email || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(order.total_amount || 0)}</p>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {search.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-6">Voer minimaal 2 tekens in om te zoeken</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Andere order kiezen
            </Button>

            {orderDetails ? (
              <Card>
                <CardContent className="py-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-mono font-medium">{orderDetails.order_number}</span>
                    <span className="font-medium">{formatCurrency(orderDetails.total_amount)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{orderDetails.customer_name || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    {orderDetails.order_items?.length || 0} items · {format(new Date(orderDetails.created_at), 'd MMM yyyy', { locale: nl })}
                  </p>
                  <Button className="w-full mt-3" onClick={handleStartReturn}>
                    Retour aanmaken voor deze order
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Skeleton className="h-32" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

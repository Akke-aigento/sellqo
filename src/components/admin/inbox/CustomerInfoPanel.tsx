import { useState } from 'react';
import { ChevronRight, Package, Mail, Phone, Tag, Calendar, X, ExternalLink, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomers } from '@/hooks/useCustomers';
import { useToast } from '@/hooks/use-toast';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/OrderStatusBadge';
import type { Conversation } from '@/hooks/useInbox';

interface CustomerInfoPanelProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedOrderId?: string | null;
  onCustomerCreated?: () => void;
}

export function CustomerInfoPanel({ conversation, open, onOpenChange, linkedOrderId, onCustomerCreated }: CustomerInfoPanelProps) {
  const isMobile = useIsMobile();
  const customer = conversation.customer;
  const { createCustomer } = useCustomers();
  const { toast } = useToast();
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Fetch customer details + recent orders
  const { data: customerDetails } = useQuery({
    queryKey: ['customer-info-panel', customer?.id],
    queryFn: async () => {
      if (!customer?.id) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*, orders(id, order_number, status, total, created_at, payment_status)')
        .eq('id', customer.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!customer?.id,
  });

  // Fetch linked order details with items
  const { data: linkedOrder } = useQuery({
    queryKey: ['linked-order-detail', linkedOrderId],
    queryFn: async () => {
      if (!linkedOrderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(id, product_name, quantity, unit_price, total_price)')
        .eq('id', linkedOrderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!linkedOrderId,
  });

  const orders = (customerDetails?.orders || [])
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const handleCreateCustomer = async () => {
    if (!customer?.email) return;
    setIsCreatingCustomer(true);
    try {
      const nameParts = (customer.name || '').split(' ');
      await createCustomer.mutateAsync({
        email: customer.email,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        phone: customer.phone || undefined,
        customer_type: 'prospect',
      });
      toast({ title: 'Klant aangemaakt', description: `${customer.name || customer.email} is toegevoegd als prospect.` });
      onCustomerCreated?.();
    } catch {
      toast({ title: 'Fout', description: 'Kon klant niet aanmaken.', variant: 'destructive' });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4">
        {/* Customer info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{customer?.name || 'Onbekend'}</h3>
          {customer?.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer?.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{customer.phone}</span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-1.5">
          {customer?.id && (
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <Link to={`/admin/customers/${customer.id}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Klantprofiel bekijken
              </Link>
            </Button>
          )}
          {linkedOrderId && (
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <Link to={`/admin/orders/${linkedOrderId}`}>
                <Package className="h-3.5 w-3.5 mr-2" />
                Bestelling bekijken
              </Link>
            </Button>
          )}
          {!customer?.id && customer?.email && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleCreateCustomer}
              disabled={isCreatingCustomer}
            >
              <UserPlus className="h-3.5 w-3.5 mr-2" />
              {isCreatingCustomer ? 'Aanmaken...' : 'Maak klant aan'}
            </Button>
          )}
        </div>

        {/* Linked order detail */}
        {linkedOrder && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Gekoppelde bestelling
              </h4>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{linkedOrder.order_number}</span>
                  <span className="text-sm font-semibold">€{(linkedOrder.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={linkedOrder.status} />
                  <PaymentStatusBadge status={linkedOrder.payment_status} />
                </div>
                {linkedOrder.order_items && linkedOrder.order_items.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {linkedOrder.order_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate mr-2">{item.quantity}× {item.product_name}</span>
                        <span className="shrink-0">€{(item.total_price || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {customerDetails && (
          <>
            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground">Bestellingen</p>
                <p className="text-lg font-semibold">{customerDetails.total_orders || 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground">Totaal besteed</p>
                <p className="text-lg font-semibold">€{(customerDetails.total_spent || 0).toFixed(0)}</p>
              </div>
            </div>

            {customerDetails.customer_type && (
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">
                  {customerDetails.customer_type}
                </Badge>
              </div>
            )}

            {customerDetails.created_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Klant sinds {format(new Date(customerDetails.created_at), 'd MMM yyyy', { locale: nl })}
              </div>
            )}

            {/* Recent orders */}
            {orders.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Recente bestellingen
                  </h4>
                  <div className="space-y-2">
                    {orders.map((order: any) => (
                      <Link
                        key={order.id}
                        to={`/admin/orders/${order.id}`}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), 'd MMM', { locale: nl })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm">€{(order.total || 0).toFixed(2)}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="text-sm">Klantinformatie</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full">{content}</ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div className="w-72 border-l flex flex-col shrink-0 bg-background">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Klantinfo</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">{content}</ScrollArea>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { BankTransferPayment } from '@/components/storefront/BankTransferPayment';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  total: number;
  ogm_reference?: string | null;
  created_at: string;
  shipping_address: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    street?: string;
    house_number?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  } | null;
}

export default function ShopOrderConfirmation() {
  const { tenantSlug, orderId } = useParams<{ tenantSlug: string; orderId: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, payment_method, subtotal, shipping_cost, tax_amount, total, ogm_reference, created_at, shipping_address')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error loading order:', orderError);
        setIsLoading(false);
        return;
      }

      setOrder(orderData as unknown as Order);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price')
        .eq('order_id', orderId);

      if (itemsData) {
        setOrderItems(itemsData);
      }

      setIsLoading(false);
    };

    loadOrder();
  }, [orderId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: tenant?.currency || 'EUR',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ShopLayout>
    );
  }

  if (!order) {
    return (
      <ShopLayout>
        <Helmet>
          <title>Bestelling niet gevonden | {tenant?.name || 'Shop'}</title>
        </Helmet>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Bestelling niet gevonden</h1>
          <p className="text-muted-foreground mb-6">
            We konden de bestelling niet vinden. Controleer de link of neem contact met ons op.
          </p>
          <Button asChild>
            <Link to={`/shop/${tenantSlug}`}>Terug naar shop</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const isBankTransfer = order.payment_method === 'bank_transfer';
  const shippingAddress = order.shipping_address;

  return (
    <ShopLayout>
      <Helmet>
        <title>Bestelling {order.order_number} | {tenant?.name || 'Shop'}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isPaid ? 'Bedankt voor je bestelling!' : 'Bestelling ontvangen!'}
          </h1>
          <p className="text-muted-foreground">
            Bestelnummer: <span className="font-mono font-medium">{order.order_number}</span>
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bank Transfer Payment Instructions */}
            {isBankTransfer && !isPaid && order.ogm_reference && tenant && (
              <BankTransferPayment
                orderNumber={order.order_number}
                amount={order.total}
                iban={tenant.iban || ''}
                bic={tenant.bic || undefined}
                beneficiaryName={tenant.name}
                ogmReference={order.ogm_reference}
                currency={tenant.currency || 'EUR'}
              />
            )}

            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Bestelstatus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant={isPaid ? 'default' : 'secondary'}>
                    {isPaid ? 'Betaald' : 'Wacht op betaling'}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    Besteld op {formatDate(order.created_at)}
                  </span>
                </div>

                {isPaid && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Je ontvangt een bevestigingsmail met trackinginformatie zodra je bestelling is verzonden.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {shippingAddress && (
              <Card>
                <CardHeader>
                  <CardTitle>Verzendadres</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    {shippingAddress.company_name && (
                      <p className="font-medium">{shippingAddress.company_name}</p>
                    )}
                    <p>
                      {shippingAddress.first_name} {shippingAddress.last_name}
                    </p>
                    <p>
                      {shippingAddress.street} {shippingAddress.house_number}
                    </p>
                    <p>
                      {shippingAddress.postal_code} {shippingAddress.city}
                    </p>
                    {shippingAddress.country && (
                      <p>{shippingAddress.country}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Besteloverzicht</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Items */}
                <div className="space-y-3 mb-4">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.product_name}
                      </span>
                      <span>{formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotaal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verzending</span>
                    <span>{order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : 'Gratis'}</span>
                  </div>
                  {order.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BTW</span>
                      <span>{formatPrice(order.tax_amount)}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between font-semibold text-lg mb-6">
                  <span>Totaal</span>
                  <span>{formatPrice(order.total)}</span>
                </div>

                <Button asChild className="w-full">
                  <Link to={`/shop/${tenantSlug}/products`}>
                    Verder winkelen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}

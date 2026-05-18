import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
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
}

export default function ShopOrderConfirmation() {
  const { tenantSlug, orderId } = useParams<{ tenantSlug: string; orderId: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const { clearCart } = useCart();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Clear cart on mount — safety net after successful checkout
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Load order and set up realtime subscription
  useEffect(() => {
    loadOrder();
  }, [orderId, tenant?.id]);

  const loadOrder = async () => {
    if (!orderId || !tenant?.id) return;
    setIsLoading(true);

    const { data, error } = await supabase.functions.invoke('storefront-api', {
      body: {
        action: 'get_order_confirmation',
        tenant_id: tenant.id,
        params: { order_id: orderId },
      },
    });

    if (error || !data?.success) {
      console.error('Error loading order:', error || data?.error);
      setIsLoading(false);
      return;
    }

    setOrder(data.order as Order);
    setOrderItems((data.items || []) as OrderItem[]);
    setIsLoading(false);
  };

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

  const getStatusBadge = () => {
    switch (order?.payment_status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Betaald</Badge>;
      case 'awaiting_payment':
        return <Badge variant="secondary">Wacht op betaling</Badge>;
      case 'failed':
        return <Badge variant="destructive">Mislukt</Badge>;
      default:
        return <Badge variant="secondary">{order?.payment_status}</Badge>;
    }
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

  return (
    <ShopLayout>
      <Helmet>
        <title>Bestelling {order.order_number} | {tenant?.name || 'Shop'}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isPaid ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {isPaid ? <CheckCircle className="h-8 w-8" /> : <RefreshCw className="h-8 w-8" />}
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

            {/* Payment Received Notification */}
            {isPaid && isBankTransfer && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-800">Betaling ontvangen!</h3>
                      <p className="text-sm text-green-700">
                        Je betaling is succesvol verwerkt. We gaan je bestelling nu klaarmaken.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  {getStatusBadge()}
                  <span className="text-muted-foreground text-sm">
                    Besteld op {formatDate(order.created_at)}
                  </span>
                </div>

                {isPaid && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Je ontvangt een bevestigingsmail met trackinginformatie zodra je bestelling is verzonden.
                  </p>
                )}

                {!isPaid && isBankTransfer && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Klik op "Status vernieuwen" zodra je betaald hebt om de status bij te werken.
                  </p>
                )}
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={loadOrder}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Status vernieuwen
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address — verzonden per e-mail */}
            <Card>
              <CardHeader>
                <CardTitle>Verzendadres</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Verzendadres bevestigd per e-mail.
                </p>
              </CardContent>
            </Card>
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

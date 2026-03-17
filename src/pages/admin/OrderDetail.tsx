import { useParams, useNavigate } from 'react-router-dom';
import { useIsCompact } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ArrowLeft, Package, User, MapPin, CreditCard, Clock, Truck, CheckCircle, XCircle, FileText, Download, Mail, FileCode, MessageSquare, Printer } from 'lucide-react';
import { useOrder, useOrders } from '@/hooks/useOrders';
import { useOrderInvoice } from '@/hooks/useInvoices';
import { useTenant } from '@/hooks/useTenant';
import { usePaymentConfirmation } from '@/hooks/usePaymentConfirmation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/OrderStatusBadge';
import { InvoiceStatusBadge } from '@/components/admin/InvoiceStatusBadge';
import { CustomerMessageDialog } from '@/components/admin/CustomerMessageDialog';
import { MessageHistoryPanel } from '@/components/admin/MessageHistoryPanel';
import { TrackingInfoCard } from '@/components/admin/TrackingInfoCard';
import { ServicePointCard } from '@/components/admin/ServicePointCard';
import { OrderMarketplaceBadge } from '@/components/admin/marketplace/OrderMarketplaceBadge';
import { BolActionsCard } from '@/components/admin/BolActionsCard';
import { MarkAsPaidButton, PaymentMethodType } from '@/components/admin/MarkAsPaidButton';
import type { OrderStatus, PaymentStatus } from '@/types/order';
import type { ServicePointData } from '@/types/servicePoint';
import { useState, useCallback } from 'react';
import { generatePackingSlipPdf } from '@/utils/packingSlipPdf';
import { toast } from 'sonner';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { order, isLoading, error } = useOrder(id);
  const { invoice, resendInvoice } = useOrderInvoice(id);
  const { updateOrderStatus, updatePaymentStatus, updateOrderNotes } = useOrders();
  const { confirmPayment } = usePaymentConfirmation();
  const [internalNotes, setInternalNotes] = useState('');
  const isCompact = useIsCompact();
  const [showMessageDialog, setShowMessageDialog] = useState(false);

  const handleMarkAsPaid = (data: { 
    paymentMethod: PaymentMethodType; 
    reference?: string; 
    notes?: string; 
  }) => {
    if (!order || !currentTenant?.id) return;
    confirmPayment.mutate({
      orderId: order.id,
      tenantId: currentTenant.id,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      notes: data.notes,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const formatAddress = (address: unknown) => {
    if (!address || typeof address !== 'object') return '-';
    const addr = address as { street?: string; postal_code?: string; city?: string; country?: string };
    if (!addr.street) return '-';
    return `${addr.street}, ${addr.postal_code} ${addr.city}, ${addr.country}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[300px] lg:col-span-2" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar bestellingen
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Bestelling niet gevonden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{order.order_number}</h1>
              <OrderMarketplaceBadge source={order.marketplace_source} />
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
            <p className="text-muted-foreground">
              {format(new Date(order.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
              {order.marketplace_order_id && (
                <span className="ml-2 text-xs">
                  • Marketplace ID: <span className="font-mono">{order.marketplace_order_id}</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Orderregels
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {isCompact ? (
                <div className="space-y-3">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex gap-3 py-2 border-b last:border-0">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{item.product_name}</div>
                        {item.product_sku && <div className="text-xs text-muted-foreground">SKU: {item.product_sku}</div>}
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {item.quantity} × {formatCurrency(Number(item.unit_price))} = <span className="font-medium text-foreground">{formatCurrency(Number(item.total_price))}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <div className="px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Aantal</TableHead>
                          <TableHead className="text-right">Prijs</TableHead>
                          <TableHead className="text-right">Totaal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.order_items?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {item.product_image ? (
                                  <img src={item.product_image} alt={item.product_name} className="h-10 w-10 rounded object-cover" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{item.product_name}</div>
                                  {item.product_sku && <div className="text-xs text-muted-foreground">SKU: {item.product_sku}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(Number(item.total_price))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(Number(order.subtotal))}</span>
                </div>
                {Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Korting</span>
                    <span>-{formatCurrency(Number(order.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW</span>
                  <span>{formatCurrency(Number(order.tax_amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verzendkosten</span>
                  <span>{formatCurrency(Number(order.shipping_cost))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Totaal</span>
                  <span>{formatCurrency(Number(order.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tijdlijn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem
                  icon={<Package className="h-4 w-4" />}
                  title="Bestelling geplaatst"
                  date={order.created_at}
                  completed
                />
                {order.status !== 'pending' && order.status !== 'cancelled' && (
                  <TimelineItem
                    icon={<Clock className="h-4 w-4" />}
                    title="In behandeling genomen"
                    date={order.updated_at}
                    completed={['processing', 'shipped', 'delivered'].includes(order.status)}
                  />
                )}
                {order.shipped_at && (
                  <TimelineItem
                    icon={<Truck className="h-4 w-4" />}
                    title={order.tracking_number 
                      ? `Verzonden via ${order.carrier || 'carrier'}`
                      : "Verzonden"
                    }
                    subtitle={order.tracking_number ? `Track: ${order.tracking_number}` : undefined}
                    date={order.shipped_at}
                    completed
                  />
                )}
                {order.delivered_at && (
                  <TimelineItem
                    icon={<CheckCircle className="h-4 w-4" />}
                    title="Afgeleverd"
                    date={order.delivered_at}
                    completed
                  />
                )}
                {order.cancelled_at && (
                  <TimelineItem
                    icon={<XCircle className="h-4 w-4" />}
                    title="Geannuleerd"
                    date={order.cancelled_at}
                    completed
                    variant="destructive"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Consolidated */}
        <div className="space-y-4">
          {/* Card 1: Acties & Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acties & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.payment_status === 'pending' && (
                <MarkAsPaidButton
                  orderId={order.id}
                  orderNumber={order.order_number}
                  isPending={confirmPayment.isPending}
                  onConfirm={handleMarkAsPaid}
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Orderstatus</label>
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateOrderStatus.mutate({ orderId: order.id, status: value as OrderStatus })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">In afwachting</SelectItem>
                      <SelectItem value="processing">In behandeling</SelectItem>
                      <SelectItem value="shipped">Verzonden</SelectItem>
                      <SelectItem value="delivered">Afgeleverd</SelectItem>
                      <SelectItem value="cancelled">Geannuleerd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Betaalstatus</label>
                  <Select
                    value={order.payment_status}
                    onValueChange={(value) => updatePaymentStatus.mutate({ orderId: order.id, paymentStatus: value as PaymentStatus })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Onbetaald</SelectItem>
                      <SelectItem value="paid">Betaald</SelectItem>
                      <SelectItem value="refunded">Terugbetaald</SelectItem>
                      <SelectItem value="failed">Mislukt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Klant & Adressen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Klant & Adressen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Klantinfo */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="text-sm">
                  <div className="font-medium">{order.customer_name || 'Onbekend'}</div>
                  <div className="text-muted-foreground">{order.customer_email}</div>
                  {order.customer_phone && (
                    <div className="text-muted-foreground">{order.customer_phone}</div>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowMessageDialog(true)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Email
                  </Button>
                  {order.customer_id && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/admin/customers/${order.customer_id}`)}
                    >
                      Profiel
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Adressen in 2 kolommen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-xs">{order.delivery_type === 'service_point' ? 'Klantadres' : 'Verzendadres'}</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{formatAddress(order.shipping_address)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-xs">Factuuradres</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{formatAddress(order.billing_address)}</p>
                </div>
              </div>

              {/* Service Point */}
              {order.delivery_type === 'service_point' && order.service_point_data && (
                <>
                  <Separator />
                  <ServicePointCard 
                    servicePoint={order.service_point_data as unknown as ServicePointData}
                    embedded
                  />
                </>
              )}

              {/* Berichtenhistorie */}
              {order.id && (
                <>
                  <Separator />
                  <MessageHistoryPanel 
                    entityType="order" 
                    entityId={order.id} 
                    compact
                    embedded
                    maxItems={3}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Verzending & Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Verzending & Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrackingInfoCard order={order} embedded />

              <Separator />

              {/* Pakbon - Download + Print */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    if (!order || !currentTenant) return;
                    try {
                      const pdfBytes = await generatePackingSlipPdf(order, {
                        name: currentTenant.name,
                        address: currentTenant.address,
                        city: currentTenant.city,
                        postal_code: currentTenant.postal_code,
                        country: currentTenant.country,
                        phone: currentTenant.phone,
                        logo_url: currentTenant.logo_url,
                        document_logo_url: (currentTenant as any).document_logo_url,
                      });
                      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      // Use window.open for mobile compatibility (a.click() fails on iOS Safari)
                      const newWindow = window.open(url, '_blank');
                      if (!newWindow) {
                        // Fallback: direct location change
                        window.location.href = url;
                      }
                      setTimeout(() => URL.revokeObjectURL(url), 10000);
                    } catch (err) {
                      toast.error('Fout bij genereren pakbon');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Pakbon
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    if (!order || !currentTenant) return;
                    try {
                      const pdfBytes = await generatePackingSlipPdf(order, {
                        name: currentTenant.name,
                        address: currentTenant.address,
                        city: currentTenant.city,
                        postal_code: currentTenant.postal_code,
                        country: currentTenant.country,
                        phone: currentTenant.phone,
                        logo_url: currentTenant.logo_url,
                        document_logo_url: (currentTenant as any).document_logo_url,
                      });
                      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      // Open in iframe for printing (works on mobile)
                      const printWindow = window.open(url, '_blank');
                      if (printWindow) {
                        printWindow.addEventListener('load', () => {
                          printWindow.print();
                        });
                      } else {
                        // Fallback: just open the PDF
                        window.location.href = url;
                      }
                      setTimeout(() => URL.revokeObjectURL(url), 30000);
                    } catch (err) {
                      toast.error('Fout bij printen pakbon');
                    }
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>

              {/* Bol.com acties */}
              <BolActionsCard order={order} embedded />
            </CardContent>
          </Card>

          {/* Card 4: Documenten & Notities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documenten & Notities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Factuur */}
              {invoice ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{invoice.invoice_number}</span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {invoice.pdf_url && (
                      <Button variant="outline" size="sm" onClick={() => window.open(invoice.pdf_url!, '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    )}
                    {invoice.ubl_url && (
                      <Button variant="outline" size="sm" onClick={() => window.open(invoice.ubl_url!, '_blank')}>
                        <FileCode className="h-4 w-4 mr-2" />
                        UBL
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendInvoice.mutate(invoice.id)}
                      disabled={resendInvoice.isPending}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Versturen
                    </Button>
                  </div>
                  {invoice.sent_at && (
                    <p className="text-xs text-muted-foreground">
                      Verstuurd op {format(new Date(invoice.sent_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen factuur beschikbaar
                </p>
              )}

              <Separator />

              {/* Interne notities */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Interne notities</label>
                <Textarea
                  placeholder="Voeg een interne notitie toe..."
                  value={internalNotes || order.internal_notes || ''}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => updateOrderNotes.mutate({ orderId: order.id, internalNotes })}
                  disabled={updateOrderNotes.isPending}
                >
                  Opslaan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Message Dialog */}
      <CustomerMessageDialog
        open={showMessageDialog}
        onOpenChange={setShowMessageDialog}
        customerEmail={order.customer_email}
        customerName={order.customer_name || ''}
        contextType="order"
        orderId={order.id}
        customerId={order.customer_id || undefined}
        orderNumber={order.order_number}
      />
    </div>
  );
}

interface TimelineItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  date: string;
  completed?: boolean;
  variant?: 'default' | 'destructive';
}

function TimelineItem({ icon, title, subtitle, date, completed, variant = 'default' }: TimelineItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-full ${
        variant === 'destructive' 
          ? 'bg-destructive/10 text-destructive' 
          : completed 
            ? 'bg-primary/10 text-primary' 
            : 'bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground font-mono">{subtitle}</div>
        )}
        <div className="text-sm text-muted-foreground">
          {format(new Date(date), "d MMM yyyy 'om' HH:mm", { locale: nl })}
        </div>
      </div>
    </div>
  );
}

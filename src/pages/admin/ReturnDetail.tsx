import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ArrowLeft, RotateCcw, CreditCard, Package, AlertTriangle, Truck } from 'lucide-react';
import { useReturn, useReturnMutations, type ReturnStatus } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { toast } from 'sonner';

const STATUS_FLOW: { from: ReturnStatus[]; to: ReturnStatus; label: string; variant?: 'default' | 'destructive' }[] = [
  { from: ['registered'], to: 'in_transit', label: 'Markeer als in transit' },
  { from: ['registered', 'in_transit'], to: 'received', label: 'Markeer als ontvangen' },
  { from: ['received'], to: 'approved', label: 'Goedkeuren' },
  { from: ['received'], to: 'rejected', label: 'Afwijzen', variant: 'destructive' },
];

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { returnRecord, isLoading, error } = useReturn(id);
  const { updateReturnStatus, updateReturnNotes, processRefund } = useReturnMutations();
  const [notes, setNotes] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);

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

  if (error || !returnRecord) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/returns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar retouren
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Retour niet gevonden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const items = (returnRecord.items as any[]) || [];
  const currentNotes = notes ?? returnRecord.internal_notes ?? '';
  const marketplaceSource = returnRecord.orders?.marketplace_source || returnRecord.source;
  const isMarketplaceReturn = marketplaceSource === 'bolcom' || marketplaceSource === 'amazon' || marketplaceSource === 'bol_com';
  const isStripeReturn = returnRecord.refund_method === 'stripe';

  const availableActions = STATUS_FLOW.filter((sf) =>
    sf.from.includes(returnRecord.status as ReturnStatus)
  );

  const handleStatusChange = (status: ReturnStatus) => {
    updateReturnStatus.mutate({ returnId: returnRecord.id, status });
  };

  const handleSaveNotes = () => {
    updateReturnNotes.mutate({ returnId: returnRecord.id, notes: currentNotes });
  };

  const handleRefund = () => {
    processRefund.mutate({ returnId: returnRecord.id });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/returns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Retour
              </h1>
              <ReturnStatusBadge status={returnRecord.status} />
              <ReturnSourceBadge source={returnRecord.source} />
            </div>
            <p className="text-muted-foreground">
              {format(new Date(returnRecord.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
              {returnRecord.orders?.order_number && (
                <span className="ml-2">
                  • Order:{' '}
                  <button
                    className="underline text-primary"
                    onClick={() => navigate(`/admin/orders/${returnRecord.order_id}`)}
                  >
                    {returnRecord.orders.order_number}
                  </button>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Items + status actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Retourproducten
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-muted-foreground">Geen producten opgegeven.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Aantal</TableHead>
                      <TableHead className="text-right">Prijs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <p className="font-medium">{item.product_name || item.product_id}</p>
                          {item.variant_name && (
                            <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {item.price ? formatCurrency(item.price * item.quantity) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Status Actions */}
          {availableActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Acties</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                  <Button
                    key={action.to}
                    variant={action.variant || 'default'}
                    onClick={() => handleStatusChange(action.to)}
                    disabled={updateReturnStatus.isPending}
                  >
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Refund Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Terugbetaling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Methode</p>
                  <p className="font-medium capitalize">{returnRecord.refund_method || 'Niet ingesteld'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <RefundStatusBadge status={returnRecord.refund_status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bedrag</p>
                  <p className="font-medium">
                    {returnRecord.refund_amount ? formatCurrency(returnRecord.refund_amount) : '-'}
                  </p>
                </div>
              </div>

              {returnRecord.stripe_refund_id && (
                <p className="text-xs text-muted-foreground font-mono">
                  Stripe Refund: {returnRecord.stripe_refund_id}
                </p>
              )}

              {isMarketplaceReturn && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    De terugbetaling voor deze retour verloopt via{' '}
                    {marketplaceSource === 'bolcom' ? 'Bol.com' : 'Amazon'}. Pas alleen de interne
                    status aan.
                  </AlertDescription>
                </Alert>
              )}

              {returnRecord.status === 'approved' && returnRecord.refund_status !== 'completed' && (
                <>
                  {isStripeReturn && (
                    <Button onClick={handleRefund} disabled={processRefund.isPending}>
                      {processRefund.isPending ? 'Bezig...' : 'Terugbetalen via Stripe'}
                    </Button>
                  )}
                  {isMarketplaceReturn && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'refunded' });
                      }}
                    >
                      Markeer als terugbetaald
                    </Button>
                  )}
                  {!isStripeReturn && !isMarketplaceReturn && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'refunded' });
                      }}
                    >
                      Markeer als terugbetaald (handmatig)
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Klant</p>
                <p className="font-medium">{returnRecord.customer_name || '-'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Reden</p>
                <p className="font-medium">
                  {returnRecord.return_reason || returnRecord.return_reason_code || '-'}
                </p>
              </div>
              {returnRecord.handling_result && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Afhandeling</p>
                    <p className="font-medium">{returnRecord.handling_result}</p>
                  </div>
                </>
              )}
              {returnRecord.marketplace_return_id && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Marketplace retour-ID</p>
                    <p className="font-mono text-xs">{returnRecord.marketplace_return_id}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Interne notities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Interne notities..."
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNotes}
                disabled={updateReturnNotes.isPending}
              >
                Opslaan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

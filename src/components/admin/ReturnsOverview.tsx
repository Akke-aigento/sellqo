import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { RotateCcw, ExternalLink, Package } from 'lucide-react';
import { useReturns, ReturnRecord } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    registered: { label: 'Geregistreerd', variant: 'outline' },
    approved: { label: 'Goedgekeurd', variant: 'default' },
    rejected: { label: 'Afgewezen', variant: 'destructive' },
    received: { label: 'Ontvangen', variant: 'secondary' },
  };
  const info = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function getRefundBadge(refundStatus: string | null, method: string | null) {
  if (!refundStatus || refundStatus === 'none') return null;
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'In afwachting', variant: 'outline' },
    processed: { label: method === 'stripe' ? 'Stripe ✓' : 'Verwerkt', variant: 'default' },
    failed: { label: 'Mislukt', variant: 'destructive' },
    manual: { label: 'Handmatig', variant: 'secondary' },
  };
  const info = map[refundStatus] || { label: refundStatus, variant: 'outline' as const };
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
}

function getSourceBadge(source: string | null) {
  if (source === 'manual') return <Badge variant="secondary" className="text-xs">Webshop</Badge>;
  if (source === 'marketplace') return <Badge variant="outline" className="text-xs">Marketplace</Badge>;
  return <Badge variant="outline" className="text-xs">{source || 'Onbekend'}</Badge>;
}

export function ReturnsOverview() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { returns, isLoading } = useReturns();

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RotateCcw className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg">Geen retouren</h3>
        <p className="text-muted-foreground text-sm">
          Retouren verschijnen hier wanneer ze worden aangemaakt of binnengehaald via marktplaatsen
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bestelling</TableHead>
            <TableHead>Klant</TableHead>
            <TableHead>Bron</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Terugbetaling</TableHead>
            <TableHead className="text-right">Bedrag</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {returns.map((ret) => (
            <TableRow key={ret.id}>
              <TableCell>
                <div className="font-medium">
                  {ret.order?.order_number || ret.marketplace_return_id || '-'}
                </div>
                {ret.return_reason && (
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {ret.return_reason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">{ret.customer_name || '-'}</TableCell>
              <TableCell>{getSourceBadge(ret.source)}</TableCell>
              <TableCell>{getStatusBadge(ret.status)}</TableCell>
              <TableCell>{getRefundBadge(ret.refund_status, ret.refund_method)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(ret.refund_amount)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {ret.registration_date
                  ? format(new Date(ret.registration_date), 'd MMM yyyy', { locale: nl })
                  : format(new Date(ret.created_at), 'd MMM yyyy', { locale: nl })}
              </TableCell>
              <TableCell>
                {ret.order_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(`/admin/orders/${ret.order_id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

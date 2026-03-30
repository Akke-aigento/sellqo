import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useReturns, type ReturnFilters as ReturnFiltersType } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { ReturnFilters } from '@/components/admin/ReturnFilters';

export default function ReturnsPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [filters, setFilters] = useState<ReturnFiltersType>({});
  const { returns, isLoading } = useReturns(filters);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <Alert>
        <AlertDescription>Selecteer eerst een winkel om retouren te bekijken.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <RotateCcw className="h-6 w-6" />
          Retouren
        </h1>
        <p className="text-muted-foreground">Beheer alle retouren van alle kanalen.</p>
      </div>

      <ReturnFilters filters={filters} onFiltersChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle>Alle retouren</CardTitle>
          <CardDescription>{returns.length} retouren gevonden</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Geen retouren gevonden.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Klant</TableHead>
                    <TableHead>Producten</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bron</TableHead>
                    <TableHead>Terugbetaling</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret) => {
                    const items = (ret.items as any[]) || [];
                    return (
                      <TableRow
                        key={ret.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/returns/${ret.id}`)}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(ret.created_at), 'd MMM yyyy', { locale: nl })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {ret.orders?.order_number || ret.marketplace_order_id || '-'}
                        </TableCell>
                        <TableCell>{ret.customer_name || '-'}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {items.length} product{items.length !== 1 ? 'en' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ReturnStatusBadge status={ret.status} />
                        </TableCell>
                        <TableCell>
                          <ReturnSourceBadge source={ret.source} />
                        </TableCell>
                        <TableCell>
                          <RefundStatusBadge status={ret.refund_status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {ret.refund_amount ? formatCurrency(ret.refund_amount) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

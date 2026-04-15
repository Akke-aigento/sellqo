import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, MoreHorizontal, Eye, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useReturns, useReturnMutations, type ReturnFilters as ReturnFiltersType } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { ReturnFilters } from '@/components/admin/ReturnFilters';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

export default function ReturnsPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [filters, setFilters] = useState<ReturnFiltersType>({});
  const { returns, isLoading } = useReturns(filters);
  const { updateReturnStatus } = useReturnMutations();

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
            <div className="text-center py-12">
              <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nog geen retouren.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Retours kunnen worden aangemaakt vanaf de order detail pagina.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RMA</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead>Bron</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Refund</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-10"></TableHead>
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
                          <TableCell className="font-mono text-sm font-medium">
                            {ret.rma_number || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {ret.orders?.order_number || ret.marketplace_order_id || '-'}
                          </TableCell>
                          <TableCell>{ret.customer_name || '-'}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm">{items.length}</span>
                          </TableCell>
                          <TableCell>
                            <ReturnSourceBadge source={ret.source} />
                          </TableCell>
                          <TableCell>
                            <ReturnStatusBadge status={ret.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {ret.refund_amount ? formatCurrency(ret.refund_amount) : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(new Date(ret.created_at), { addSuffix: true, locale: nl })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {format(new Date(ret.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => navigate(`/admin/returns/${ret.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Bekijken
                                </DropdownMenuItem>
                                {ret.status !== 'cancelled' && ret.status !== 'completed' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => updateReturnStatus.mutate({ returnId: ret.id, status: 'cancelled' })}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Annuleren
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

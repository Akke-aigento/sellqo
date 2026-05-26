import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Eye, XCircle, Plus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useReturns, useReturnMutations, type ReturnFilters as ReturnFiltersType } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { ReturnFilters } from '@/components/admin/ReturnFilters';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { NewReturnFromScratchDialog } from '@/components/admin/NewReturnFromScratchDialog';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveDataTable, type ColumnDef } from '@/components/ui/responsive-data-table';
import { ActionsMenu, type ActionItem } from '@/components/ui/actions-menu';

export default function ReturnsPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [filters, setFilters] = useState<ReturnFiltersType>({});
  const { returns, isLoading } = useReturns(filters);
  const { updateReturnStatus } = useReturnMutations();
  const [showNewReturn, setShowNewReturn] = useState(false);

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

  type ReturnRow = (typeof returns)[number];

  const buildActions = (ret: ReturnRow): ActionItem[] => {
    const items: ActionItem[] = [
      { label: 'Bekijken', icon: <Eye className="h-4 w-4" />, onClick: () => navigate(`/admin/returns/${ret.id}`) },
    ];
    if (ret.status !== 'cancelled' && ret.status !== 'closed' && ret.status !== 'completed') {
      items.push({
        label: 'Annuleren',
        icon: <XCircle className="h-4 w-4" />,
        variant: 'destructive',
        separator: true,
        onClick: () => updateReturnStatus.mutate({ returnId: ret.id, status: 'cancelled' }),
      });
    }
    return items;
  };

  const columns: ColumnDef<ReturnRow>[] = [
    { id: 'rma', header: 'RMA', render: (r) => <span className="font-mono text-sm font-medium">{r.rma_number || '-'}</span> },
    { id: 'order', header: 'Order', render: (r) => <span className="font-mono text-sm">{r.orders?.order_number || r.marketplace_order_id || '-'}</span> },
    { id: 'customer', header: 'Klant', priority: 'md', render: (r) => r.customer_name || '-' },
    { id: 'items', header: 'Items', align: 'center', priority: 'lg', render: (r) => <span className="text-sm">{((r.items as any[]) || []).length}</span> },
    { id: 'source', header: 'Bron', priority: 'lg', render: (r) => <ReturnSourceBadge source={r.source} /> },
    { id: 'logistics', header: 'Logistiek', render: (r) => <ReturnStatusBadge status={r.status} /> },
    { id: 'refund', header: 'Refund', priority: 'md', render: (r) => <RefundStatusBadge status={r.refund_status} /> },
    { id: 'amount', header: 'Bedrag', align: 'right', render: (r) => r.refund_amount ? formatCurrency(r.refund_amount) : '-' },
    {
      id: 'date', header: 'Datum', priority: 'lg', render: (r) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: nl })}
            </span>
          </TooltipTrigger>
          <TooltipContent>{format(new Date(r.created_at), 'd MMM yyyy HH:mm', { locale: nl })}</TooltipContent>
        </Tooltip>
      ),
    },
    { id: 'actions', header: '', align: 'right', width: '50px', render: (r) => <ActionsMenu items={buildActions(r)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retouren"
        description="Beheer alle retouren van alle kanalen."
        actions={
          <Button onClick={() => setShowNewReturn(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nieuwe retour
          </Button>
        }
      />

      <ReturnFilters filters={filters} onFiltersChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle>Alle retouren</CardTitle>
          <CardDescription>{returns.length} retouren gevonden</CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <ResponsiveDataTable
              columns={columns}
              rows={returns}
              getRowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/admin/returns/${r.id}`)}
              isLoading={isLoading}
              cardModeBreakpoint="compact"
              emptyState={
                <div className="flex flex-col items-center py-6">
                  <RotateCcw className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nog geen retouren.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Retours kunnen worden aangemaakt vanaf de order detail pagina of via "+ Nieuwe retour".
                  </p>
                </div>
              }
              mobileCardRender={(ret) => {
                const items = (ret.items as any[]) || [];
                return (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-medium">{ret.rma_number || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          Order {ret.orders?.order_number || ret.marketplace_order_id || '-'} · {ret.customer_name || '-'}
                        </div>
                      </div>
                      <ActionsMenu items={buildActions(ret)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ReturnSourceBadge source={ret.source} />
                      <ReturnStatusBadge status={ret.status} />
                      <RefundStatusBadge status={ret.refund_status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{items.length} items · {formatDistanceToNow(new Date(ret.created_at), { addSuffix: true, locale: nl })}</span>
                      <span className="font-medium">{ret.refund_amount ? formatCurrency(ret.refund_amount) : '-'}</span>
                    </div>
                  </div>
                );
              }}
            />
          </TooltipProvider>
        </CardContent>
      </Card>

      <NewReturnFromScratchDialog
        open={showNewReturn}
        onOpenChange={setShowNewReturn}
      />
    </div>
  );
}

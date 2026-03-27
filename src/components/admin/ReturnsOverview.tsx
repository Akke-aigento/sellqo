import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  RotateCcw, ExternalLink, Package, Search, SlidersHorizontal,
  CheckCircle2, XCircle, Clock, Archive, MessageSquare, CreditCard
} from 'lucide-react';
import { useReturns, useUpdateReturnStatus, useProcessRefund, ReturnRecord } from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatsCard } from '@/components/admin/StatsCard';

const STATUS_OPTIONS = [
  { value: 'registered', label: 'Geregistreerd' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'rejected', label: 'Afgewezen' },
  { value: 'received', label: 'Ontvangen' },
];

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
  if (!refundStatus || refundStatus === 'none') return <span className="text-xs text-muted-foreground">—</span>;
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
  const updateReturn = useUpdateReturnStatus();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [notes, setNotes] = useState('');

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  // Stats
  const stats = useMemo(() => {
    const total = returns.length;
    const open = returns.filter(r => r.status === 'registered' || r.status === 'approved').length;
    const done = returns.filter(r => r.status === 'received').length;
    const rejected = returns.filter(r => r.status === 'rejected').length;
    return { total, open, done, rejected };
  }, [returns]);

  // Filtered list
  const filtered = useMemo(() => {
    return returns.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchOrder = r.order?.order_number?.toLowerCase().includes(q);
        const matchCustomer = r.customer_name?.toLowerCase().includes(q);
        const matchMarketplace = r.marketplace_return_id?.toLowerCase().includes(q);
        if (!matchOrder && !matchCustomer && !matchMarketplace) return false;
      }
      return true;
    });
  }, [returns, statusFilter, sourceFilter, search]);

  const openDetail = (ret: ReturnRecord) => {
    setSelectedReturn(ret);
    setNotes(ret.internal_notes || '');
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedReturn) return;
    updateReturn.mutate(
      { returnId: selectedReturn.id, status: newStatus },
      {
        onSuccess: (data) => {
          setSelectedReturn({ ...selectedReturn, status: newStatus, updated_at: data.updated_at });
        },
      }
    );
  };

  const handleSaveNotes = () => {
    if (!selectedReturn) return;
    updateReturn.mutate(
      { returnId: selectedReturn.id, internal_notes: notes },
      {
        onSuccess: (data) => {
          setSelectedReturn({ ...selectedReturn, internal_notes: notes, updated_at: data.updated_at });
        },
      }
    );
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

  const items = selectedReturn?.items as any[] | null;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Totaal" value={stats.total} icon={Package} />
        <StatsCard title="Open / In behandeling" value={stats.open} icon={Clock} />
        <StatsCard title="Afgehandeld" value={stats.done} icon={CheckCircle2} />
        <StatsCard title="Afgewezen" value={stats.rejected} icon={XCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op bestelnummer of klantnaam..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Bron" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle bronnen</SelectItem>
            <SelectItem value="manual">Webshop</SelectItem>
            <SelectItem value="marketplace">Marketplace</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-md">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ret) => (
              <TableRow
                key={ret.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openDetail(ret)}
              >
                <TableCell>
                  <div className="font-medium">
                    {ret.order?.order_number || ret.marketplace_return_id || '—'}
                  </div>
                  {ret.return_reason && (
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {ret.return_reason}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{ret.customer_name || '—'}</TableCell>
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
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Geen retouren gevonden met deze filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedReturn && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Retour Details
                </SheetTitle>
                <SheetDescription>
                  {selectedReturn.order?.order_number || selectedReturn.marketplace_return_id || selectedReturn.id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 mt-4">
                {/* Status + Source */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(selectedReturn.status)}
                  {getSourceBadge(selectedReturn.source)}
                  {getRefundBadge(selectedReturn.refund_status, selectedReturn.refund_method)}
                </div>

                {/* Customer info */}
                <div className="space-y-1">
                  <p className="text-sm font-medium">Klant</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReturn.customer_name || '—'}
                  </p>
                  {selectedReturn.order?.customer_email && (
                    <p className="text-xs text-muted-foreground">{selectedReturn.order.customer_email}</p>
                  )}
                </div>

                {/* Reason */}
                {selectedReturn.return_reason && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Reden</p>
                    <p className="text-sm text-muted-foreground">{selectedReturn.return_reason}</p>
                  </div>
                )}

                {/* Items */}
                {items && items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Items</p>
                    <div className="space-y-1.5">
                      {items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm bg-muted/50 rounded-md px-3 py-2">
                          <div>
                            <span className="font-medium">{item.product_name || item.title || 'Product'}</span>
                            <span className="text-muted-foreground ml-2">×{item.quantity || 1}</span>
                          </div>
                          {item.unit_price != null && (
                            <span className="text-muted-foreground">{formatCurrency(item.unit_price)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Refund info */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" /> Terugbetaling
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Bedrag</span>
                    <span className="font-medium">{formatCurrency(selectedReturn.refund_amount)}</span>
                    <span className="text-muted-foreground">Status</span>
                    <span>{getRefundBadge(selectedReturn.refund_status, selectedReturn.refund_method)}</span>
                    <span className="text-muted-foreground">Methode</span>
                    <span className="capitalize">{selectedReturn.refund_method || '—'}</span>
                  </div>
                  {selectedReturn.refund_notes && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{selectedReturn.refund_notes}</p>
                  )}
                </div>

                <Separator />

                {/* Status wijzigen */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status wijzigen</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(opt => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={selectedReturn.status === opt.value ? 'default' : 'outline'}
                        disabled={selectedReturn.status === opt.value || updateReturn.isPending}
                        onClick={() => handleStatusChange(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Internal notes */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> Interne notities
                  </p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Voeg interne notities toe..."
                    rows={3}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={notes === (selectedReturn.internal_notes || '') || updateReturn.isPending}
                    onClick={handleSaveNotes}
                  >
                    Notities opslaan
                  </Button>
                </div>

                <Separator />

                {/* Link to order */}
                {selectedReturn.order_id && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedReturn(null);
                      navigate(`/admin/orders/${selectedReturn.order_id}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Bekijk bestelling
                  </Button>
                )}

                {/* Dates */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Aangemaakt: {format(new Date(selectedReturn.created_at), 'd MMM yyyy HH:mm', { locale: nl })}</p>
                  <p>Bijgewerkt: {format(new Date(selectedReturn.updated_at), 'd MMM yyyy HH:mm', { locale: nl })}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

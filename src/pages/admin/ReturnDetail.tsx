import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  ArrowLeft, RotateCcw, CreditCard, Package, AlertTriangle,
  ExternalLink, MessageSquarePlus, ChevronDown, CheckCircle2, Clock,
} from 'lucide-react';
import {
  useReturn, useReturnItems, useReturnStatusHistory,
  useReturnMutations, type ReturnStatus, type ReturnItemRecord,
} from '@/hooks/useReturns';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_TIMELINE: ReturnStatus[] = [
  'approved', 'received', 'inspecting', 'awaiting_refund', 'completed',
];

const CONDITION_LABELS: Record<string, string> = {
  new_unopened: 'Nieuw / ongeopend',
  opened_unused: 'Geopend, ongebruikt',
  used_good: 'Gebruikt, goede staat',
  damaged: 'Beschadigd',
  defective: 'Defect',
};

const REASON_LABELS: Record<string, string> = {
  defect: 'Defect',
  damaged_in_transit: 'Beschadigd bij transport',
  wrong_product: 'Verkeerd product ontvangen',
  wrong_size: 'Verkeerde maat',
  not_as_described: 'Niet zoals beschreven',
  changed_mind: 'Bedacht / niet nodig',
  late_delivery: 'Te late levering',
  duplicate_order: 'Dubbele bestelling',
  other: 'Anders',
};

const ALL_STATUSES: ReturnStatus[] = [
  'registered', 'requested', 'approved', 'shipped_by_customer', 'in_transit',
  'received', 'inspecting', 'awaiting_refund', 'completed', 'rejected', 'cancelled',
];

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { returnRecord, isLoading, error } = useReturn(id);
  const { data: returnItems = [], isLoading: itemsLoading } = useReturnItems(id);
  const { data: statusHistory = [] } = useReturnStatusHistory(id);
  const { updateReturnStatus, updateReturnNotes, inspectReturnItem, addStatusNote, processRefund } = useReturnMutations();

  const [notes, setNotes] = useState<string | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [manualStatus, setManualStatus] = useState<string>('');
  const [noteText, setNoteText] = useState('');

  // Inspection state per item
  const [inspectionData, setInspectionData] = useState<Record<string, { qty: number; notes: string }>>({});

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currentTenant?.currency || 'EUR' }).format(amount);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[400px] lg:col-span-2" />
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

  const currentNotes = notes ?? returnRecord.internal_notes ?? '';
  const marketplaceSource = returnRecord.orders?.marketplace_source || returnRecord.source;
  const isMarketplace = marketplaceSource === 'bolcom' || marketplaceSource === 'amazon' || marketplaceSource === 'bol_com';
  const isStripe = returnRecord.refund_method === 'stripe';
  const currentStatusIdx = STATUS_TIMELINE.indexOf(returnRecord.status as ReturnStatus);

  // Context-dependent actions
  const getActions = (): { label: string; status: ReturnStatus; variant?: 'default' | 'destructive' }[] => {
    switch (returnRecord.status) {
      case 'approved': return [{ label: 'Markeer als ontvangen', status: 'received' }];
      case 'received': return [{ label: 'Start inspectie', status: 'inspecting' }];
      case 'inspecting': {
        const allInspected = returnItems.length > 0 && returnItems.every((it) => it.received_quantity != null);
        return allInspected ? [{ label: 'Inspectie afronden', status: 'awaiting_refund' }] : [];
      }
      case 'awaiting_refund': return [{ label: 'Markeer refund als verwerkt', status: 'completed' }];
      default: return [];
    }
  };

  const handleStatusChange = (status: ReturnStatus) => {
    updateReturnStatus.mutate({ returnId: returnRecord.id, status });
  };

  const handleSaveNotes = () => {
    updateReturnNotes.mutate({ returnId: returnRecord.id, notes: currentNotes });
  };

  const handleInspect = (item: ReturnItemRecord) => {
    const data = inspectionData[item.id] || { qty: item.quantity, notes: '' };
    inspectReturnItem.mutate({
      itemId: item.id,
      receivedQuantity: data.qty,
      inspectionNotes: data.notes,
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addStatusNote.mutate({ returnId: returnRecord.id, notes: noteText });
    setNoteText('');
    setShowNoteDialog(false);
  };

  const handleManualStatus = () => {
    if (!manualStatus) return;
    updateReturnStatus.mutate({ returnId: returnRecord.id, status: manualStatus as ReturnStatus });
    setShowStatusDialog(false);
    setManualStatus('');
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
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                {returnRecord.rma_number || 'Retour'}
              </h1>
              <ReturnStatusBadge status={returnRecord.status} />
              <ReturnSourceBadge source={returnRecord.source} />
            </div>
            <p className="text-muted-foreground text-sm">
              {format(new Date(returnRecord.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
              {returnRecord.orders?.order_number && (
                <span className="ml-2">
                  • Order:{' '}
                  <button className="underline text-primary" onClick={() => navigate(`/admin/orders/${returnRecord.order_id}`)}>
                    {returnRecord.orders.order_number}
                  </button>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {STATUS_TIMELINE.map((st, idx) => {
          const isActive = returnRecord.status === st;
          const isPast = currentStatusIdx >= 0 && idx < currentStatusIdx;
          const historyEntry = statusHistory.find((h) => h.to_status === st);
          return (
            <div key={st} className="flex items-center">
              <div className="flex flex-col items-center gap-1 min-w-[80px]" title={historyEntry ? format(new Date(historyEntry.created_at!), 'dd-MM-yyyy HH:mm') : ''}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs',
                  isActive ? 'bg-primary text-primary-foreground' :
                    isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : isActive ? <Clock className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={cn('text-[10px] text-center', isActive ? 'font-medium' : 'text-muted-foreground')}>
                  {st === 'approved' ? 'Goedgekeurd' :
                    st === 'received' ? 'Ontvangen' :
                      st === 'inspecting' ? 'Inspectie' :
                        st === 'awaiting_refund' ? 'Refund' :
                          'Afgerond'}
                </span>
              </div>
              {idx < STATUS_TIMELINE.length - 1 && (
                <div className={cn('h-0.5 w-8', isPast ? 'bg-primary/40' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Items + audit */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Retourproducten ({returnItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {itemsLoading ? (
                <Skeleton className="h-20" />
              ) : returnItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">Geen items gevonden (legacy retour).</p>
              ) : (
                returnItems.map((item) => {
                  const inspection = inspectionData[item.id] || { qty: item.quantity, notes: '' };
                  const canInspect = returnRecord.status === 'inspecting' && !item.inspected_at;
                  return (
                    <div key={item.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          {item.variant_title && <p className="text-xs text-muted-foreground">{item.variant_title}</p>}
                          {item.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>}
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{formatCurrency(item.refund_amount)}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} stuk(s)</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{REASON_LABELS[item.reason_code] || item.reason_code}</Badge>
                        {item.condition && <Badge variant="secondary">{CONDITION_LABELS[item.condition] || item.condition}</Badge>}
                        {item.restock && <Badge variant="outline" className="text-green-600">Restock</Badge>}
                        {(item.restocking_fee ?? 0) > 0 && (
                          <Badge variant="outline" className="text-amber-600">Fee: {formatCurrency(item.restocking_fee!)}</Badge>
                        )}
                      </div>

                      {item.reason_notes && (
                        <p className="text-xs text-muted-foreground italic">"{item.reason_notes}"</p>
                      )}

                      {/* Inspection section */}
                      {item.inspected_at ? (
                        <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                          <p className="font-medium text-green-600">✓ Geïnspecteerd op {format(new Date(item.inspected_at), 'dd-MM-yyyy HH:mm')}</p>
                          <p>Ontvangen: {item.received_quantity} van {item.quantity}</p>
                          {item.inspection_notes && <p className="italic">"{item.inspection_notes}"</p>}
                        </div>
                      ) : canInspect ? (
                        <div className="bg-muted/30 rounded p-2 space-y-2">
                          <div className="flex gap-2 items-end">
                            <div>
                              <Label className="text-xs">Ontvangen aantal</Label>
                              <Input
                                type="number"
                                min={0}
                                max={item.quantity}
                                value={inspection.qty}
                                onChange={(e) => setInspectionData((prev) => ({
                                  ...prev,
                                  [item.id]: { ...inspection, qty: Number(e.target.value) },
                                }))}
                                className="h-7 w-20 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Inspectie notities</Label>
                              <Input
                                value={inspection.notes}
                                onChange={(e) => setInspectionData((prev) => ({
                                  ...prev,
                                  [item.id]: { ...inspection, notes: e.target.value },
                                }))}
                                placeholder="Notities..."
                                className="h-7 text-sm"
                              />
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleInspect(item)} disabled={inspectReturnItem.isPending}>
                              Inspecteer
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {getActions().length > 0 && (
            <Card>
              <CardHeader><CardTitle>Acties</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {getActions().map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant || 'default'}
                    onClick={() => handleStatusChange(action.status)}
                    disabled={updateReturnStatus.isPending}
                  >
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Audit trail */}
          <Collapsible open={showAuditTrail} onOpenChange={setShowAuditTrail}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>Audit trail ({statusHistory.length})</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', showAuditTrail && 'rotate-180')} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {statusHistory.map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm py-1 border-b last:border-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {entry.created_at && format(new Date(entry.created_at), 'dd-MM HH:mm')}
                      </span>
                      <div className="flex-1">
                        {entry.from_status ? (
                          <span>
                            <Badge variant="outline" className="text-xs mr-1">{entry.from_status}</Badge>
                            →{' '}
                            <Badge variant="outline" className="text-xs">{entry.to_status}</Badge>
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">{entry.to_status}</Badge>
                        )}
                        {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                      </div>
                    </div>
                  ))}
                  {statusHistory.length === 0 && <p className="text-xs text-muted-foreground">Geen geschiedenis.</p>}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* RIGHT sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Klant</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{returnRecord.customer_name || '-'}</p>
              {returnRecord.customer_id && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate(`/admin/customers/${returnRecord.customer_id}`)}
                >
                  Bekijk klant →
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Refund overzicht</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {returnRecord.subtotal != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal items</span>
                  <span>{formatCurrency(returnRecord.subtotal)}</span>
                </div>
              )}
              {(returnRecord.restocking_fees_total ?? 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Restocking fees</span>
                  <span>-{formatCurrency(returnRecord.restocking_fees_total!)}</span>
                </div>
              )}
              {(returnRecord.shipping_refund ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verzendkosten</span>
                  <span>{formatCurrency(returnRecord.shipping_refund!)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Totaal refund</span>
                <span className="text-primary">
                  {returnRecord.refund_amount ? formatCurrency(returnRecord.refund_amount) : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Refund method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4" />
                Terugbetaling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Methode</p>
                  <p className="font-medium capitalize">{returnRecord.refund_method || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <RefundStatusBadge status={returnRecord.refund_status} />
                </div>
              </div>

              {returnRecord.refund_method === 'stripe' && (
                <p className="text-xs text-muted-foreground">
                  Stripe refund komt in fase 2. Voor nu handmatig markeren.
                </p>
              )}
              {(returnRecord.refund_method === 'bolcom' || returnRecord.refund_method === 'bol_com') && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Marketplace refund via Bol.com dashboard.</p>
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <a href="https://partner.bol.com" target="_blank" rel="noopener noreferrer">
                      Open Bol.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}
              {returnRecord.refund_method === 'amazon' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Marketplace refund via Amazon dashboard.</p>
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <a href="https://sellercentral.amazon.com" target="_blank" rel="noopener noreferrer">
                      Open Amazon <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}
              {returnRecord.refund_method === 'manual' && (
                <p className="text-xs text-muted-foreground">Handmatige refund — verwerk via je eigen kanaal.</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Interne notities</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Interne notities..."
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={updateReturnNotes.isPending}>
                Opslaan
              </Button>
            </CardContent>
          </Card>

          {/* Manual overrides */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Admin acties</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowStatusDialog(true)}>
                Status handmatig wijzigen
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowNoteDialog(true)}>
                <MessageSquarePlus className="h-3 w-3" />
                Notitie toevoegen aan trail
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual status dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Status handmatig wijzigen</DialogTitle></DialogHeader>
          <Select value={manualStatus} onValueChange={setManualStatus}>
            <SelectTrigger><SelectValue placeholder="Kies status..." /></SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.filter((s) => s !== returnRecord.status).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Annuleren</Button>
            <Button onClick={handleManualStatus} disabled={!manualStatus || updateReturnStatus.isPending}>Wijzigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notitie toevoegen</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Notitie..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Annuleren</Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim() || addStatusNote.isPending}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

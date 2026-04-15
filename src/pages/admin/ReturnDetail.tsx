import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  ArrowLeft, Package, CreditCard, ExternalLink, MessageSquarePlus,
  ChevronDown, CheckCircle2, Clock, AlertTriangle, Lock, XCircle, Loader2,
} from 'lucide-react';
import {
  useReturn, useReturnItems, useReturnStatusHistory,
  useReturnMutations, type ReturnStatus, type RefundStatusEnum, type ReturnItemRecord,
} from '@/hooks/useReturns';
import { useReturnSettings } from '@/hooks/useReturnSettings';
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReturnStatusBadge, RefundStatusBadge, ReturnSourceBadge } from '@/components/admin/ReturnStatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CANCEL_BLOCKED_STATUSES: ReturnStatus[] = ['cancelled', 'closed', 'completed'];

const LOGISTICS_TIMELINE: ReturnStatus[] = [
  'approved', 'label_sent', 'shipped', 'received', 'inspecting', 'inspected', 'closed',
];

const REFUND_TIMELINE: RefundStatusEnum[] = [
  'pending', 'approved_for_refund', 'initiated', 'completed',
];

const LOGISTICS_LABELS: Record<string, string> = {
  approved: 'Goedgekeurd',
  label_sent: 'Label verstuurd',
  shipped: 'Verzonden',
  received: 'Ontvangen',
  inspecting: 'Inspectie',
  inspected: 'Geïnspecteerd',
  closed: 'Gesloten',
};

const REFUND_LABELS: Record<string, string> = {
  pending: 'In afwachting',
  approved_for_refund: 'Goedgekeurd',
  initiated: 'Geïnitieerd',
  completed: 'Voltooid',
};

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
  wrong_product: 'Verkeerd product',
  wrong_size: 'Verkeerde maat',
  not_as_described: 'Niet zoals beschreven',
  changed_mind: 'Bedacht / niet nodig',
  late_delivery: 'Te late levering',
  duplicate_order: 'Dubbele bestelling',
  other: 'Anders',
};

const ALL_LOGISTICS_STATUSES: ReturnStatus[] = [
  'registered', 'requested', 'approved', 'label_sent', 'shipped_by_customer',
  'shipped', 'in_transit', 'received', 'inspecting', 'inspected',
  'awaiting_refund', 'completed', 'closed', 'rejected', 'cancelled',
];

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { returnRecord, isLoading, error } = useReturn(id);
  const { data: returnItems = [], isLoading: itemsLoading } = useReturnItems(id);
  const { data: statusHistory = [] } = useReturnStatusHistory(id);
  const { settings } = useReturnSettings();
  const {
    updateReturnStatus, updateReturnRefundStatus, closeReturn,
    updateReturnNotes, inspectReturnItem, addStatusNote, executeRefund,
  } = useReturnMutations();

  const [notes, setNotes] = useState<string | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [showRefundWarning, setShowRefundWarning] = useState(false);
  const [manualStatus, setManualStatus] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [failReason, setFailReason] = useState('');
  const [inspectionData, setInspectionData] = useState<Record<string, { qty: number; notes: string }>>({});

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currentTenant?.currency || 'EUR' }).format(amount);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error || !returnRecord) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/returns')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Terug naar retouren
        </Button>
        <Alert variant="destructive"><AlertDescription>Retour niet gevonden.</AlertDescription></Alert>
      </div>
    );
  }

  const currentNotes = notes ?? returnRecord.internal_notes ?? '';
  const logisticsStatus = returnRecord.status;
  const refundStatus = (returnRecord.refund_status || 'pending') as RefundStatusEnum;
  const refundRequiresInspection = settings?.refund_requires_inspection ?? true;
  const logisticsInspected = ['inspected', 'closed'].includes(logisticsStatus);
  const showManualConfirmUI = returnRecord.refund_method !== 'stripe'
    || settings?.default_refund_method !== 'auto_stripe';
  const refundBlocked = refundRequiresInspection && !logisticsInspected;
  const allItemsInspected = returnItems.length > 0 && returnItems.every((it) => it.received_quantity != null);

  const logisticsIdx = LOGISTICS_TIMELINE.indexOf(logisticsStatus as ReturnStatus);

  const refundIdx = REFUND_TIMELINE.indexOf(refundStatus);

  // Marketplace
  const marketplaceSource = returnRecord.orders?.marketplace_source || returnRecord.source;
  const isMarketplace = marketplaceSource && !['sellqo', 'manual', 'pos'].includes(marketplaceSource);

  const getMarketplaceUrl = () => {
    if (returnRecord.refund_method === 'bolcom' || returnRecord.refund_method === 'bol_com')
      return { label: 'Open Bol.com', url: 'https://partner.bol.com' };
    if (returnRecord.refund_method === 'amazon')
      return { label: 'Open Amazon', url: 'https://sellercentral.amazon.com' };
    return null;
  };

  const canClose =
    logisticsStatus === 'inspected' &&
    ['completed', 'not_applicable', 'denied'].includes(refundStatus);

  const handleInspect = (item: ReturnItemRecord) => {
    const data = inspectionData[item.id] || { qty: item.quantity, notes: '' };
    inspectReturnItem.mutate({ itemId: item.id, receivedQuantity: data.qty, inspectionNotes: data.notes });
  };

  const handleRefundAction = (action: RefundStatusEnum) => {
    if (action === 'initiated' && !logisticsInspected && !refundRequiresInspection) {
      setShowRefundWarning(true);
      return;
    }
    updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: action });
  };

  const handleSaveNotes = () => {
    updateReturnNotes.mutate({ returnId: returnRecord.id, notes: currentNotes });
  };

  const filteredHistory = auditFilter === 'all'
    ? statusHistory
    : statusHistory.filter((h) => h.flow_type === auditFilter);

  return (
    <div className="space-y-6">
      {/* HEADER */}
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
              <ReturnSourceBadge source={returnRecord.source} />
            </div>
            <p className="text-muted-foreground text-sm">
              {format(new Date(returnRecord.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
        </div>
      </div>

      {/* ORDER + CUSTOMER INFO */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Order</p>
            {returnRecord.orders?.order_number ? (
              <button className="font-medium underline text-primary" onClick={() => navigate(`/admin/orders/${returnRecord.order_id}`)}>
                {returnRecord.orders.order_number}
              </button>
            ) : <p className="font-medium">-</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Klant</p>
            <p className="font-medium">{returnRecord.customer_name || '-'}</p>
          </div>
          {returnRecord.expected_arrival_date && (
            <div>
              <p className="text-muted-foreground text-xs">Verwachte aankomst</p>
              <p className="font-medium">{format(new Date(returnRecord.expected_arrival_date), 'd MMM yyyy', { locale: nl })}</p>
            </div>
          )}
          {isMarketplace && (
            <Badge variant="outline" className="self-center bg-amber-500/10 text-amber-700 border-amber-500/30">
              Marketplace order
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LOGISTICS FLOW */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Logistiek
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timeline */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {LOGISTICS_TIMELINE.map((st, idx) => {
                const isActive = logisticsStatus === st;
                const isPast = logisticsIdx >= 0 && idx < logisticsIdx;
                const entry = statusHistory.find((h) => h.to_status === st && h.flow_type === 'logistics');
                return (
                  <div key={st} className="flex items-center">
                    <div className="flex flex-col items-center gap-1 min-w-[60px]" title={entry?.created_at ? format(new Date(entry.created_at), 'dd-MM-yyyy HH:mm') : ''}>
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                        isActive ? 'bg-primary text-primary-foreground' :
                          isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : isActive ? <Clock className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span className={cn('text-[9px] text-center leading-tight', isActive ? 'font-medium' : 'text-muted-foreground')}>
                        {LOGISTICS_LABELS[st] || st}
                      </span>
                    </div>
                    {idx < LOGISTICS_TIMELINE.length - 1 && (
                      <div className={cn('h-0.5 w-4', isPast ? 'bg-primary/40' : 'bg-muted')} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Logistics actions */}
            <div className="flex flex-wrap gap-2">
              {logisticsStatus === 'approved' && (
                <>
                  <Button size="sm" variant="outline" disabled>
                    Genereer label <Badge variant="secondary" className="ml-1 text-[10px]">Fase 3</Badge>
                  </Button>
                  <Button size="sm" onClick={() => updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'label_sent' as ReturnStatus })}>
                    Label als verstuurd markeren
                  </Button>
                </>
              )}
              {logisticsStatus === 'label_sent' && (
                <Button size="sm" onClick={() => updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'shipped' as ReturnStatus })}>
                  Verzonden door klant
                </Button>
              )}
              {logisticsStatus === 'shipped' && (
                <Button size="sm" onClick={() => updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'received' as ReturnStatus })}>
                  Markeer als ontvangen
                </Button>
              )}
              {logisticsStatus === 'received' && (
                <Button size="sm" onClick={() => updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'inspecting' as ReturnStatus })}>
                  Start inspectie
                </Button>
              )}
              {logisticsStatus === 'inspecting' && allItemsInspected && (
                <Button size="sm" onClick={() => updateReturnStatus.mutate({ returnId: returnRecord.id, status: 'inspected' as ReturnStatus })}>
                  Inspectie afronden
                </Button>
              )}
              {logisticsStatus === 'inspecting' && !allItemsInspected && (
                <p className="text-xs text-muted-foreground">Inspecteer eerst alle items hieronder</p>
              )}
            </div>

            <Separator />

            {/* Return items */}
            <div className="space-y-3">
              {itemsLoading ? (
                <Skeleton className="h-20" />
              ) : returnItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">Geen items (legacy retour).</p>
              ) : returnItems.map((item) => {
                const inspection = inspectionData[item.id] || { qty: item.quantity, notes: '' };
                const canInspect = logisticsStatus === 'inspecting' && !item.inspected_at;
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
                      {item.restock && <Badge variant="outline" className="text-green-600 border-green-500/30">Restock</Badge>}
                      {(item.restocking_fee ?? 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30">Fee: {formatCurrency(item.restocking_fee!)}</Badge>
                      )}
                    </div>
                    {item.reason_notes && <p className="text-xs text-muted-foreground italic">"{item.reason_notes}"</p>}

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
                            <Label className="text-xs">Ontvangen</Label>
                            <Input
                              type="number" min={0} max={item.quantity}
                              value={inspection.qty}
                              onChange={(e) => setInspectionData((prev) => ({
                                ...prev, [item.id]: { ...inspection, qty: Number(e.target.value) },
                              }))}
                              className="h-7 w-20 text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Notities</Label>
                            <Input
                              value={inspection.notes}
                              onChange={(e) => setInspectionData((prev) => ({
                                ...prev, [item.id]: { ...inspection, notes: e.target.value },
                              }))}
                              placeholder="Inspectie notities..."
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
              })}
            </div>
          </CardContent>
        </Card>

        {/* FINANCIAL FLOW */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Financieel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timeline */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {REFUND_TIMELINE.map((st, idx) => {
                const isActive = refundStatus === st;
                const isPast = refundIdx >= 0 && idx < refundIdx;
                const isTerminal = ['denied', 'not_applicable', 'failed'].includes(refundStatus);
                const entry = statusHistory.find((h) => h.to_status === st && h.flow_type === 'financial');
                return (
                  <div key={st} className="flex items-center">
                    <div className="flex flex-col items-center gap-1 min-w-[70px]" title={entry?.created_at ? format(new Date(entry.created_at), 'dd-MM-yyyy HH:mm') : ''}>
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                        isActive ? 'bg-primary text-primary-foreground' :
                          isPast ? 'bg-primary/20 text-primary' :
                            isTerminal ? 'bg-muted text-muted-foreground opacity-50' : 'bg-muted text-muted-foreground'
                      )}>
                        {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : isActive ? <Clock className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span className={cn('text-[9px] text-center leading-tight', isActive ? 'font-medium' : 'text-muted-foreground')}>
                        {REFUND_LABELS[st] || st}
                      </span>
                    </div>
                    {idx < REFUND_TIMELINE.length - 1 && (
                      <div className={cn('h-0.5 w-6', isPast ? 'bg-primary/40' : 'bg-muted')} />
                    )}
                  </div>
                );
              })}
              {['denied', 'not_applicable', 'failed'].includes(refundStatus) && (
                <div className="flex items-center">
                  <div className="h-0.5 w-6 bg-muted" />
                  <div className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-destructive/20 text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[9px] font-medium text-destructive">
                      {refundStatus === 'denied' ? 'Afgewezen' : refundStatus === 'failed' ? 'Mislukt' : 'N.v.t.'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Refund guard */}
            {refundBlocked && (
              <Alert className="py-2">
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Inspectie eerst afronden, of wijzig in{' '}
                  <button className="underline text-primary" onClick={() => navigate('/admin/settings/returns')}>
                    Instellingen → Retouren
                  </button>{' '}
                  → "Inspectie vereist voor refund"
                </AlertDescription>
              </Alert>
            )}

            {/* Refund actions */}
            <div className="flex flex-wrap gap-2">
              {refundStatus === 'pending' && !refundBlocked && (
                <>
                  <Button size="sm" onClick={() => handleRefundAction('approved_for_refund')}>
                    Goedkeuren voor refund
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: 'not_applicable' })}>
                    N.v.t. markeren
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowDenyDialog(true)}>
                    Afwijzen
                  </Button>
                </>
              )}
              {refundStatus === 'approved_for_refund' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (returnRecord.refund_method === 'stripe' && !logisticsInspected && !refundRequiresInspection) {
                        setShowRefundWarning(true);
                        return;
                      }
                      executeRefund.mutate({
                        returnId: returnRecord.id,
                        refundMethod: returnRecord.refund_method,
                      });
                    }}
                    disabled={executeRefund.isPending}
                  >
                    {executeRefund.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Bezig...</>
                     ) : returnRecord.refund_method === 'stripe' && settings?.default_refund_method === 'auto_stripe' ? (
                       'Voer refund uit via Stripe'
                     ) : (
                       'Markeer refund als gestart'
                     )}
                   </Button>
                  <Button size="sm" variant="outline" onClick={() => updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: 'not_applicable' })}>
                    N.v.t. markeren
                  </Button>
                </>
              )}
               {refundStatus === 'initiated' && showManualConfirmUI && (
                 <>
                   <Button size="sm" onClick={() => updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: 'completed' })}>
                     Refund geslaagd
                   </Button>
                   <Button size="sm" variant="destructive" onClick={() => setShowFailDialog(true)}>
                     Refund mislukt
                   </Button>
                 </>
               )}
            </div>

             {refundStatus === 'initiated' && showManualConfirmUI && (
               <p className="text-xs text-muted-foreground">
                 Voer de refund handmatig uit in het{' '}
                 {returnRecord.refund_method === 'bolcom' ? 'Bol.com' :
                   returnRecord.refund_method === 'amazon' ? 'Amazon' :
                   returnRecord.refund_method === 'stripe' ? 'Stripe' : 'betalings'} dashboard,
                 bevestig daarna hier.
               </p>
             )}
             {refundStatus === 'initiated' && !showManualConfirmUI && returnRecord.refund_method === 'stripe' && (
               <p className="text-xs text-muted-foreground">
                 Stripe refund wordt verwerkt — dit duurt meestal enkele seconden.
               </p>
             )}

            <Separator />

            {/* Refund summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Te refunden</span>
                <span className="font-bold text-primary">{returnRecord.refund_amount ? formatCurrency(returnRecord.refund_amount) : '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Methode</span>
                <span className="capitalize">{returnRecord.refund_method || '-'}</span>
              </div>
              {returnRecord.subtotal != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotaal items</span>
                  <span>{formatCurrency(returnRecord.subtotal)}</span>
                </div>
              )}
              {(returnRecord.restocking_fees_total ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-destructive">
                  <span>Restocking fees</span>
                  <span>-{formatCurrency(returnRecord.restocking_fees_total!)}</span>
                </div>
              )}
              {(returnRecord.shipping_refund ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Verzendkosten</span>
                  <span>{formatCurrency(returnRecord.shipping_refund!)}</span>
                </div>
              )}
            </div>

            {/* Marketplace link */}
            {(() => {
              const mp = getMarketplaceUrl();
              return mp ? (
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a href={mp.url} target="_blank" rel="noopener noreferrer">
                    {mp.label} <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : null;
            })()}

            {/* Notes */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Interne notities</Label>
              <Textarea
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={updateReturnNotes.isPending}>
                Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CLOSE BUTTON */}
      {canClose && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Retour gereed om te sluiten</p>
              <p className="text-xs text-muted-foreground">Inspectie en refund zijn afgerond. Sluiten boekt stock terug indien van toepassing.</p>
            </div>
            <Button onClick={() => closeReturn.mutate({ returnId: returnRecord.id })} disabled={closeReturn.isPending}>
              Sluit retour
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ADMIN ACTIONS */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowStatusDialog(true)}>
          Status handmatig wijzigen
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowNoteDialog(true)}>
          <MessageSquarePlus className="h-3 w-3 mr-1" /> Notitie toevoegen
        </Button>
      </div>

      {/* AUDIT TRAIL */}
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
              <div className="flex gap-1 mb-2">
                {['all', 'logistics', 'financial', 'system'].map((f) => (
                  <Button key={f} variant={auditFilter === f ? 'default' : 'outline'} size="sm" className="h-6 text-xs px-2"
                    onClick={() => setAuditFilter(f)}>
                    {f === 'all' ? 'Alle' : f === 'logistics' ? '📦 Logistiek' : f === 'financial' ? '💰 Financieel' : '⚙️ Systeem'}
                  </Button>
                ))}
              </div>
              {filteredHistory.map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm py-1 border-b last:border-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.created_at && format(new Date(entry.created_at), 'dd-MM HH:mm')}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                    {entry.flow_type === 'financial' ? '💰' : entry.flow_type === 'system' ? '⚙️' : '📦'}
                  </Badge>
                  <div className="flex-1">
                    {entry.from_status && entry.from_status !== entry.to_status ? (
                      <span className="text-xs">
                        <Badge variant="outline" className="text-xs mr-1">{entry.from_status}</Badge>
                        → <Badge variant="outline" className="text-xs">{entry.to_status}</Badge>
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-xs">{entry.to_status}</Badge>
                    )}
                    {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                  </div>
                </div>
              ))}
              {filteredHistory.length === 0 && <p className="text-xs text-muted-foreground">Geen geschiedenis.</p>}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* DIALOGS */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Status handmatig wijzigen</DialogTitle></DialogHeader>
          <Select value={manualStatus} onValueChange={setManualStatus}>
            <SelectTrigger><SelectValue placeholder="Kies status..." /></SelectTrigger>
            <SelectContent>
              {ALL_LOGISTICS_STATUSES.filter((s) => s !== returnRecord.status).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Annuleren</Button>
            <Button onClick={() => { updateReturnStatus.mutate({ returnId: returnRecord.id, status: manualStatus as ReturnStatus }); setShowStatusDialog(false); setManualStatus(''); }}
              disabled={!manualStatus || updateReturnStatus.isPending}>Wijzigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notitie toevoegen</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Notitie..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Annuleren</Button>
            <Button onClick={() => { addStatusNote.mutate({ returnId: returnRecord.id, notes: noteText }); setNoteText(''); setShowNoteDialog(false); }}
              disabled={!noteText.trim() || addStatusNote.isPending}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund afwijzen</DialogTitle></DialogHeader>
          <Textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Reden van afwijzing..." rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyDialog(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={() => { updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: 'denied', reason: denyReason }); setDenyReason(''); setShowDenyDialog(false); }}
              disabled={!denyReason.trim()}>Afwijzen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund mislukt markeren</DialogTitle></DialogHeader>
          <Textarea value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="Reden..." rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFailDialog(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={() => { updateReturnRefundStatus.mutate({ returnId: returnRecord.id, refundStatus: 'failed', reason: failReason }); setFailReason(''); setShowFailDialog(false); }}>
              Markeer als mislukt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRefundWarning} onOpenChange={setShowRefundWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pakket nog niet geïnspecteerd</AlertDialogTitle>
            <AlertDialogDescription>
              Het pakket is nog niet ontvangen of geïnspecteerd. Weet je zeker dat je de refund wilt uitvoeren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { executeRefund.mutate({ returnId: returnRecord.id, refundMethod: returnRecord.refund_method }); setShowRefundWarning(false); }}>
              Doorgaan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

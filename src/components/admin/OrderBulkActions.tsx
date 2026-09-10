import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BatchPrintDialog } from '@/components/admin/BatchPrintDialog';
import {
  ChevronUp,
  XCircle,
  X,
  Truck,
  CheckCircle,
  Clock,
  Ban,
  CreditCard,
  FileText,
  Printer,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { generatePackingSlipPdf } from '@/utils/packingSlipPdf';
import type { Order, OrderStatus, PaymentStatus } from '@/types/order';
import { useCan } from '@/hooks/useCan';
import { useTranslation } from 'react-i18next';

interface OrderBulkActionsProps {
  selectedOrderIds: string[];
  orders: Order[];
  onClearSelection: () => void;
  onComplete: () => void;
}

export function OrderBulkActions({
  selectedOrderIds,
  orders,
  onClearSelection,
  onComplete,
}: OrderBulkActionsProps) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);
  // H4c — permissions: delete is tenant_admin-only; export gated to accountant/admin.
  const canWriteOrders = useCan('write', 'orders');
  const canReadReports = useCan('read', 'reports_financial');

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  const handleBulkStatusUpdate = async (status: OrderStatus) => {
    setLoadingAction(`status-${status}`);
    try {
      if (!currentTenant?.id) throw new Error('Geen tenant context');
      const failures: string[] = [];
      for (const orderId of selectedOrderIds) {
        try {
          await invokeWithErrorBody('update-order-fulfillment-status', {
            body: {
              tenant_id: currentTenant.id,
              order_id: orderId,
              new_status: status,
            },
          });
        } catch (err) {
          failures.push(`${orderId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (failures.length > 0) {
        throw new Error(t('admin.orderBulkActions.orders_niet_bijgewerkt', { count: failures.length, reason: failures[0] }));
      }

      toast({ title: t('admin.orderBulkActions.orders_bijgewerkt', { count: selectedOrderIds.length, status }) });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: t('admin.orderBulkActions.fout_bij_statuswijziging'), description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkPaymentUpdate = async (paymentStatus: PaymentStatus) => {
    setLoadingAction(`payment-${paymentStatus}`);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: paymentStatus })
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) betaalstatus bijgewerkt` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: t('admin.orderBulkActions.fout_bij_betaalstatus'), description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPackingSlips = async () => {
    setLoadingAction('packing-slips');
    try {
      if (!currentTenant) throw new Error('Geen tenant');

      // Fetch full order data with items
      const { data: fullOrders, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('id', selectedOrderIds);

      if (error) throw error;

      const tenant = {
        name: currentTenant.name,
        address: currentTenant.address,
        city: currentTenant.city,
        postal_code: currentTenant.postal_code,
        country: currentTenant.country,
        phone: currentTenant.phone,
        email: currentTenant.owner_email,
        kvk_number: currentTenant.kvk_number,
      };

      // Generate and merge PDFs
      const mergedPdf = await PDFDocument.create();

      for (const order of fullOrders || []) {
        const pdfBytes = await generatePackingSlipPdf(
          {
            order_number: order.order_number,
            created_at: order.created_at,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            shipping_address: order.shipping_address,
            order_items: order.order_items?.map((item: any) => ({
              product_name: item.product_name,
              product_sku: item.product_sku,
              quantity: item.quantity,
            })),
          },
          tenant,
        );

        const srcDoc = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p) => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `pakbonnen-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({ title: `${fullOrders?.length || 0} pakbon(nen) gedownload` });
    } catch (err: any) {
      toast({ title: t('admin.orderBulkActions.fout_bij_pakbonnen'), description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Bestelnummer', 'Klant', 'Email', 'Status', 'Betaalstatus', 'Totaal', 'Datum', 'Tracking', 'Carrier'];
    const rows = selectedOrders.map((o) => [
      o.order_number,
      o.customer_name || '',
      o.customer_email,
      o.status,
      o.payment_status,
      String(o.total),
      new Date(o.created_at).toLocaleDateString(i18n.language),
      o.tracking_number || '',
      o.carrier || '',
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast({ title: `${selectedOrders.length} order(s) geëxporteerd` });
  };

  const handleBulkDelete = async () => {
    setLoadingAction('delete');
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) verwijderd` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClearSelection();
    } catch (err: any) {
      toast({ title: t('admin.orderBulkActions.fout_bij_verwijderen'), description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
      setDeleteDialogOpen(false);
    }
  };

  if (selectedOrderIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-[calc(3.5rem+var(--safe-bottom))] md:bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg animate-in slide-in-from-bottom-2 lg:left-[var(--sidebar-width,280px)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="absolute top-1 right-1 h-7 w-7 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 pr-10 max-w-screen-xl mx-auto">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''} geselecteerd
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!!loadingAction}>
                {loadingAction ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronUp className="h-4 w-4 mr-2" />}
                Acties
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              {/* Status sub-menu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  {t('admin.orderBulkActions.status_wijzigen')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('pending')}>
                    <Clock className="h-4 w-4 mr-2" /> {t('admin.marketing.aBTestingPanel.in_afwachting')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('processing')}>
                    <Clock className="h-4 w-4 mr-2" /> {t('admin.orderFilters.in_behandeling')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('shipped')}>
                    <Truck className="h-4 w-4 mr-2" /> {t('admin.marketing.campaignCard.status.verzonden')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('delivered')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> {t('admin.marketing.campaignFunnel.afgeleverd')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('cancelled')} className="text-destructive">
                    <Ban className="h-4 w-4 mr-2" /> {t('admin.marketing.aBTestingPanel.geannuleerd')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Payment sub-menu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t('admin.orderBulkActions.betaalstatus_wijzigen')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('paid')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> {t('admin.orderFilters.betaald')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('pending')}>
                    <Clock className="h-4 w-4 mr-2" /> {t('admin.marketing.aBTestingPanel.in_afwachting')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('refunded')}>
                    <CreditCard className="h-4 w-4 mr-2" /> {t('admin.orderFilters.terugbetaald')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDownloadPackingSlips}>
                <FileText className="h-4 w-4 mr-2" /> {t('admin.orderBulkActions.pakbonnen_downloaden')}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setBatchPrintOpen(true)}>
                <Printer className="h-4 w-4 mr-2" /> {t('admin.orderBulkActions.labels_printen')}
              </DropdownMenuItem>

              {canReadReports && (
                <DropdownMenuItem onClick={handleExportCsv}>
                  <Download className="h-4 w-4 mr-2" /> {t('admin.orderBulkActions.exporteren_naar_csv')}
                </DropdownMenuItem>
              )}

              {canWriteOrders && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>

      {/* Batch Print Dialog */}
      <BatchPrintDialog
        open={batchPrintOpen}
        onOpenChange={setBatchPrintOpen}
        orderIds={selectedOrderIds}
        onComplete={onComplete}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.orderBulkActions.orders_verwijderen')}</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedOrderIds.length} order(s) wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loadingAction === 'delete'}
            >
              {loadingAction === 'delete' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
